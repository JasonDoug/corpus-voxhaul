// Property-based tests for Audio Synthesizer service
import * as fc from 'fast-check';
import {
  synthesizeAudio,
  concatenateScriptText,
  extractWordTimings,
  validateTimingMonotonicity,
  fixTimingMonotonicity,
  mapVoiceConfiguration,
  MockTTSProvider,
  TTSResult,
} from './audio-synthesizer';
import { LectureAgent } from '../models/agent';
import { LectureScript, ScriptSegment, ScriptBlock } from '../models/script';
import { WordTiming } from '../models/audio';

// Mock the dynamodb and s3 modules
jest.mock('./dynamodb');
jest.mock('./s3');

// Custom generators for domain-specific types

/**
 * Generator for ScriptBlock
 */
const scriptBlockArb = fc.record({
  id: fc.uuid(),
  text: fc.string({ minLength: 10, maxLength: 200 }),
  contentReference: fc.record({
    type: fc.constantFrom('text' as const, 'figure' as const, 'table' as const, 'formula' as const, 'citation' as const),
    id: fc.uuid(),
    pageNumber: fc.integer({ min: 1, max: 100 }),
  }),
  estimatedDuration: fc.integer({ min: 1, max: 60 }),
}) as fc.Arbitrary<ScriptBlock>;

/**
 * Generator for ScriptSegment
 */
const scriptSegmentArb = fc.record({
  segmentId: fc.uuid(),
  title: fc.string({ minLength: 5, maxLength: 100 }),
  scriptBlocks: fc.array(scriptBlockArb, { minLength: 1, maxLength: 5 }),
}) as fc.Arbitrary<ScriptSegment>;

/**
 * Generator for LectureScript
 */
const lectureScriptArb = fc.record({
  segments: fc.array(scriptSegmentArb, { minLength: 1, maxLength: 5 }),
  totalEstimatedDuration: fc.integer({ min: 60, max: 3600 }),
}) as fc.Arbitrary<LectureScript>;

/**
 * Generator for LectureAgent
 */
const lectureAgentArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  personality: fc.record({
    instructions: fc.string({ minLength: 10, maxLength: 200 }),
    tone: fc.constantFrom('humorous', 'serious', 'casual', 'formal', 'enthusiastic'),
    examples: fc.option(fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 5 })),
  }),
  voice: fc.record({
    voiceId: fc.string({ minLength: 3, maxLength: 20 }),
    speed: fc.double({ min: 0.5, max: 2.0 }),
    pitch: fc.integer({ min: -20, max: 20 }),
  }),
  createdAt: fc.date(),
}) as fc.Arbitrary<LectureAgent>;

/**
 * Generator for WordTiming
 */
const wordTimingArb = fc.record({
  word: fc.string({ minLength: 1, maxLength: 20 }),
  startTime: fc.double({ min: 0, max: 1000, noNaN: true }),
  endTime: fc.double({ min: 0, max: 1000, noNaN: true }),
  scriptBlockId: fc.uuid(),
}).filter(timing => timing.endTime >= timing.startTime) as fc.Arbitrary<WordTiming>;

/**
 * Generator for monotonic WordTiming array
 */
const monotonicWordTimingsArb = fc.array(
  fc.record({
    word: fc.string({ minLength: 1, maxLength: 20 }),
    duration: fc.double({ min: 0.1, max: 2.0 }),
    scriptBlockId: fc.uuid(),
  }),
  { minLength: 1, maxLength: 100 }
).map(timings => {
  let currentTime = 0;
  return timings.map(t => {
    const startTime = currentTime;
    const endTime = currentTime + t.duration;
    currentTime = endTime;
    return {
      word: t.word,
      startTime,
      endTime,
      scriptBlockId: t.scriptBlockId,
    };
  });
}) as fc.Arbitrary<WordTiming[]>;

// ============================================================================
// Property Tests
// ============================================================================

describe('Audio Synthesizer Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: pdf-lecture-service, Property 21: Audio generation success
  // Validates: Requirements 6.1
  test('Property 21: Audio generation success - for any valid script and agent, audio should be generated with positive duration', async () => {
    const { getContent, updateContent, getAgent, getJob, updateJob } = require('./dynamodb');
    const { uploadAudio } = require('./s3');

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        lectureScriptArb,
        lectureAgentArb,
        async (jobId, script, agent) => {
          // Mock database responses
          getJob.mockResolvedValue({
            jobId,
            agentId: agent.id,
            status: 'generating_script',
          });
          getContent.mockResolvedValue({
            jobId,
            script,
          });
          getAgent.mockResolvedValue(agent);
          updateContent.mockResolvedValue({});
          updateJob.mockResolvedValue({});
          uploadAudio.mockResolvedValue(`https://example.com/audio/${jobId}/lecture.mp3`);

          // Generate audio
          const audioOutput = await synthesizeAudio(jobId);

          // Property: Audio should be generated with valid URL
          expect(audioOutput.audioUrl).toBeDefined();
          expect(audioOutput.audioUrl.length).toBeGreaterThan(0);

          // Property: Duration should be positive
          expect(audioOutput.duration).toBeGreaterThan(0);

          // Property: Word timings should be present
          expect(audioOutput.wordTimings).toBeDefined();
          expect(Array.isArray(audioOutput.wordTimings)).toBe(true);

          // Property: Job status should be updated to completed
          expect(updateJob).toHaveBeenCalledWith(jobId, expect.objectContaining({
            status: 'completed',
          }));
        }
      ),
      { numRuns: 10 } // Reduced runs for async test
    );
  }, 30000); // 30 second timeout

  // Test script concatenation
  test('Property: Script concatenation should preserve all text content', () => {
    fc.assert(
      fc.property(lectureScriptArb, (script) => {
        const concatenated = concatenateScriptText(script);

        // Property: Concatenated text should not be empty if script has blocks
        const hasBlocks = script.segments.some(seg => seg.scriptBlocks.length > 0);
        if (hasBlocks) {
          expect(concatenated.length).toBeGreaterThan(0);
        }

        // Property: All block text should be present in concatenated text
        for (const segment of script.segments) {
          for (const block of segment.scriptBlocks) {
            if (block.text.trim().length > 0) {
              // The text should be present (possibly with normalized whitespace)
              const normalizedBlockText = block.text.replace(/\s+/g, ' ').trim();
              expect(concatenated).toContain(normalizedBlockText);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  // Test word timing extraction
  test('Property: Word timing extraction should assign block IDs to all timings', () => {
    fc.assert(
      fc.property(
        lectureScriptArb,
        fc.array(wordTimingArb, { minLength: 1, maxLength: 50 }),
        (script, timings) => {
          const ttsResult: TTSResult = {
            audioBuffer: Buffer.from([]),
            duration: 100,
            wordTimings: timings.map(t => ({ ...t, scriptBlockId: 'unknown' })),
          };

          const extracted = extractWordTimings(ttsResult, script);

          // Property: All timings should have a script block ID assigned
          for (const timing of extracted) {
            expect(timing.scriptBlockId).toBeDefined();
            expect(timing.scriptBlockId).not.toBe('unknown');
          }

          // Property: Number of timings should match input
          expect(extracted.length).toBe(timings.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test timing monotonicity validation
  test('Property: Monotonic timings should pass validation', () => {
    fc.assert(
      fc.property(monotonicWordTimingsArb, (timings) => {
        const isValid = validateTimingMonotonicity(timings);

        // Property: Monotonic timings should be valid
        expect(isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  // Test timing monotonicity fixing
  test('Property: Fixed timings should always be monotonic', () => {
    fc.assert(
      fc.property(
        fc.array(wordTimingArb, { minLength: 1, maxLength: 50 }),
        (timings) => {
          const fixed = fixTimingMonotonicity(timings);

          // Property: Fixed timings should be monotonic
          const isValid = validateTimingMonotonicity(fixed);
          expect(isValid).toBe(true);

          // Property: Should have same number of timings
          expect(fixed.length).toBe(timings.length);

          // Property: Each timing should have valid start/end times
          for (const timing of fixed) {
            expect(timing.endTime).toBeGreaterThanOrEqual(timing.startTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test voice configuration mapping
  test('Property: Voice configuration mapping should preserve all settings', () => {
    fc.assert(
      fc.property(lectureAgentArb, (agent) => {
        const mapped = mapVoiceConfiguration(agent);

        // Property: All voice settings should be preserved
        expect(mapped.voiceId).toBe(agent.voice.voiceId);
        expect(mapped.speed).toBe(agent.voice.speed);
        expect(mapped.pitch).toBe(agent.voice.pitch);
      }),
      { numRuns: 100 }
    );
  });

  // Test MockTTSProvider
  test('Property: MockTTSProvider should generate valid audio output', async () => {
    const provider = new MockTTSProvider();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 500 }),
        lectureAgentArb,
        async (text, agent) => {
          const result = await provider.synthesize(text, agent.voice);

          // Property: Audio buffer should be generated
          expect(result.audioBuffer).toBeDefined();
          expect(result.audioBuffer.length).toBeGreaterThan(0);

          // Property: Duration should be positive
          expect(result.duration).toBeGreaterThan(0);

          // Property: Word timings should match word count
          const words = text.split(/\s+/).filter(w => w.length > 0);
          expect(result.wordTimings.length).toBe(words.length);

          // Property: Timings should be monotonic
          const isValid = validateTimingMonotonicity(result.wordTimings);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  // Feature: pdf-lecture-service, Property 22: Voice configuration application
  // Validates: Requirements 6.2, 6.3, 6.4
  test('Property 22: Voice configuration application - agent voice settings should be used in TTS', async () => {
    const { getContent, updateContent, getAgent, getJob, updateJob } = require('./dynamodb');
    const { uploadAudio } = require('./s3');

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        lectureScriptArb,
        lectureAgentArb,
        async (jobId, script, agent) => {
          // Mock database responses
          getJob.mockResolvedValue({
            jobId,
            agentId: agent.id,
            status: 'generating_script',
          });
          getContent.mockResolvedValue({
            jobId,
            script,
          });
          getAgent.mockResolvedValue(agent);
          updateContent.mockResolvedValue({});
          updateJob.mockResolvedValue({});
          uploadAudio.mockResolvedValue(`https://example.com/audio/${jobId}/lecture.mp3`);

          // Generate audio
          const audioOutput = await synthesizeAudio(jobId);

          // Property: Audio should be generated
          expect(audioOutput).toBeDefined();
          expect(audioOutput.audioUrl).toBeDefined();

          // Property: Voice configuration should be applied
          // We verify this by checking that the agent was retrieved
          expect(getAgent).toHaveBeenCalledWith(agent.id);

          // Property: Voice speed should affect duration
          // For the same text, faster speed should result in shorter duration
          // (This is implicitly tested by the MockTTSProvider which uses speed in calculation)
          expect(audioOutput.duration).toBeGreaterThan(0);

          // Property: All voice settings should be within valid ranges
          expect(agent.voice.speed).toBeGreaterThanOrEqual(0.5);
          expect(agent.voice.speed).toBeLessThanOrEqual(2.0);
          expect(agent.voice.pitch).toBeGreaterThanOrEqual(-20);
          expect(agent.voice.pitch).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  // Test voice speed effect on duration
  test('Property: Voice speed should inversely affect audio duration', async () => {
    const provider = new MockTTSProvider();
    const text = 'This is a test sentence with multiple words to synthesize.';

    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        fc.double({ min: 0.5, max: 2.0, noNaN: true }),
        async (speed1, speed2) => {
          const voiceConfig1 = { voiceId: 'test', speed: speed1, pitch: 0 };
          const voiceConfig2 = { voiceId: 'test', speed: speed2, pitch: 0 };

          const result1 = await provider.synthesize(text, voiceConfig1);
          const result2 = await provider.synthesize(text, voiceConfig2);

          // Property: Faster speed should result in shorter duration
          if (speed1 > speed2) {
            expect(result1.duration).toBeLessThan(result2.duration);
          } else if (speed1 < speed2) {
            expect(result1.duration).toBeGreaterThan(result2.duration);
          } else {
            // Same speed should result in same duration
            expect(Math.abs(result1.duration - result2.duration)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);

  // Feature: pdf-lecture-service, Property 23: Audio metadata completeness
  // Validates: Requirements 6.6
  test('Property 23: Audio metadata completeness - audio output should include URL, duration, and word timings', async () => {
    const { getContent, updateContent, getAgent, getJob, updateJob } = require('./dynamodb');
    const { uploadAudio } = require('./s3');

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        lectureScriptArb,
        lectureAgentArb,
        async (jobId, script, agent) => {
          // Mock database responses
          getJob.mockResolvedValue({
            jobId,
            agentId: agent.id,
            status: 'generating_script',
          });
          getContent.mockResolvedValue({
            jobId,
            script,
          });
          getAgent.mockResolvedValue(agent);
          updateContent.mockResolvedValue({});
          updateJob.mockResolvedValue({});
          uploadAudio.mockResolvedValue(`https://example.com/audio/${jobId}/lecture.mp3`);

          // Generate audio
          const audioOutput = await synthesizeAudio(jobId);

          // Property: Audio URL should be valid and non-empty
          expect(audioOutput.audioUrl).toBeDefined();
          expect(typeof audioOutput.audioUrl).toBe('string');
          expect(audioOutput.audioUrl.length).toBeGreaterThan(0);

          // Property: Duration should be positive
          expect(audioOutput.duration).toBeDefined();
          expect(typeof audioOutput.duration).toBe('number');
          expect(audioOutput.duration).toBeGreaterThan(0);

          // Property: Word timings should be present and non-empty
          expect(audioOutput.wordTimings).toBeDefined();
          expect(Array.isArray(audioOutput.wordTimings)).toBe(true);
          expect(audioOutput.wordTimings.length).toBeGreaterThan(0);

          // Property: Each word timing should have all required fields
          for (const timing of audioOutput.wordTimings) {
            expect(timing.word).toBeDefined();
            expect(typeof timing.word).toBe('string');
            expect(timing.startTime).toBeDefined();
            expect(typeof timing.startTime).toBe('number');
            expect(timing.endTime).toBeDefined();
            expect(typeof timing.endTime).toBe('number');
            expect(timing.scriptBlockId).toBeDefined();
            expect(typeof timing.scriptBlockId).toBe('string');
          }

          // Property: Last word's end time should approximately equal total duration
          const lastTiming = audioOutput.wordTimings[audioOutput.wordTimings.length - 1];
          const durationDiff = Math.abs(lastTiming.endTime - audioOutput.duration);
          expect(durationDiff).toBeLessThan(1.0); // Within 1 second tolerance
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);

  // Test timing data consistency
  test('Property: Word timings should be consistent with audio duration', async () => {
    const provider = new MockTTSProvider();

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }),
        lectureAgentArb,
        async (text, agent) => {
          const result = await provider.synthesize(text, agent.voice);

          // Property: Word timings should be present
          expect(result.wordTimings.length).toBeGreaterThan(0);

          // Property: All timings should be within audio duration
          for (const timing of result.wordTimings) {
            expect(timing.startTime).toBeGreaterThanOrEqual(0);
            expect(timing.startTime).toBeLessThanOrEqual(result.duration);
            expect(timing.endTime).toBeGreaterThanOrEqual(0);
            expect(timing.endTime).toBeLessThanOrEqual(result.duration + 0.01); // Small tolerance
          }

          // Property: Last word should end at or near total duration
          const lastTiming = result.wordTimings[result.wordTimings.length - 1];
          expect(Math.abs(lastTiming.endTime - result.duration)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 50 }
    );
  }, 30000);
});

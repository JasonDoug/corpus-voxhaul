// Unit tests for Audio Synthesizer service
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

describe('Audio Synthesizer Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test audio generation with different voice settings
  describe('Audio generation with different voice settings', () => {
    test('should generate audio with slow voice speed', async () => {
      const provider = new MockTTSProvider();
      const text = 'This is a test sentence.';
      const voiceConfig = { voiceId: 'test', speed: 0.5, pitch: 0 };

      const result = await provider.synthesize(text, voiceConfig);

      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.wordTimings.length).toBeGreaterThan(0);
    });

    test('should generate audio with fast voice speed', async () => {
      const provider = new MockTTSProvider();
      const text = 'This is a test sentence.';
      const voiceConfig = { voiceId: 'test', speed: 2.0, pitch: 0 };

      const result = await provider.synthesize(text, voiceConfig);

      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.wordTimings.length).toBeGreaterThan(0);
    });

    test('should generate audio with high pitch', async () => {
      const provider = new MockTTSProvider();
      const text = 'This is a test sentence.';
      const voiceConfig = { voiceId: 'test', speed: 1.0, pitch: 20 };

      const result = await provider.synthesize(text, voiceConfig);

      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.wordTimings.length).toBeGreaterThan(0);
    });

    test('should generate audio with low pitch', async () => {
      const provider = new MockTTSProvider();
      const text = 'This is a test sentence.';
      const voiceConfig = { voiceId: 'test', speed: 1.0, pitch: -20 };

      const result = await provider.synthesize(text, voiceConfig);

      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.wordTimings.length).toBeGreaterThan(0);
    });

    test('should generate audio with different voice IDs', async () => {
      const provider = new MockTTSProvider();
      const text = 'This is a test sentence.';
      
      const voiceIds = ['Joanna', 'Matthew', 'Amy', 'Brian'];
      
      for (const voiceId of voiceIds) {
        const voiceConfig = { voiceId, speed: 1.0, pitch: 0 };
        const result = await provider.synthesize(text, voiceConfig);

        expect(result.audioBuffer).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
        expect(result.wordTimings.length).toBeGreaterThan(0);
      }
    });
  });

  // Test handling of very long scripts
  describe('Handling of very long scripts', () => {
    test('should handle script with many segments', async () => {
      const { getContent, updateContent, getAgent, getJob, updateJob } = require('./dynamodb');
      const { uploadAudio } = require('./s3');

      // Create a long script with many segments
      const segments: ScriptSegment[] = [];
      for (let i = 0; i < 20; i++) {
        segments.push({
          segmentId: `seg-${i}`,
          title: `Segment ${i}`,
          scriptBlocks: [
            {
              id: `block-${i}`,
              text: `This is segment ${i} with some content to synthesize into audio.`,
              contentReference: {
                type: 'text',
                id: `content-${i}`,
                pageNumber: i + 1,
              },
              estimatedDuration: 5,
            },
          ],
        });
      }

      const longScript: LectureScript = {
        segments,
        totalEstimatedDuration: 100,
      };

      const agent: LectureAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'Joanna',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      getJob.mockResolvedValue({
        jobId: 'job-1',
        agentId: 'agent-1',
        status: 'generating_script',
      });
      getContent.mockResolvedValue({
        jobId: 'job-1',
        script: longScript,
      });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      uploadAudio.mockResolvedValue('https://example.com/audio/job-1/lecture.mp3');

      const audioOutput = await synthesizeAudio('job-1');

      expect(audioOutput.audioUrl).toBeDefined();
      expect(audioOutput.duration).toBeGreaterThan(0);
      expect(audioOutput.wordTimings.length).toBeGreaterThan(0);
    });

    test('should handle script with very long text blocks', async () => {
      const provider = new MockTTSProvider();
      
      // Create a very long text (1000 words)
      const words = Array(1000).fill('word').map((w, i) => `${w}${i}`);
      const longText = words.join(' ');
      
      const voiceConfig = { voiceId: 'test', speed: 1.0, pitch: 0 };
      const result = await provider.synthesize(longText, voiceConfig);

      expect(result.audioBuffer).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.wordTimings.length).toBe(1000);
    });

    test('should concatenate script with many blocks correctly', () => {
      const segments: ScriptSegment[] = [];
      for (let i = 0; i < 10; i++) {
        const blocks: ScriptBlock[] = [];
        for (let j = 0; j < 10; j++) {
          blocks.push({
            id: `block-${i}-${j}`,
            text: `Segment ${i} block ${j}.`,
            contentReference: {
              type: 'text',
              id: `content-${i}-${j}`,
              pageNumber: 1,
            },
            estimatedDuration: 2,
          });
        }
        segments.push({
          segmentId: `seg-${i}`,
          title: `Segment ${i}`,
          scriptBlocks: blocks,
        });
      }

      const script: LectureScript = {
        segments,
        totalEstimatedDuration: 200,
      };

      const concatenated = concatenateScriptText(script);

      // Should contain all blocks
      expect(concatenated.length).toBeGreaterThan(0);
      
      // Should contain text from all segments
      for (let i = 0; i < 10; i++) {
        expect(concatenated).toContain(`Segment ${i}`);
      }
    });
  });

  // Test error handling for TTS API failures
  describe('Error handling for TTS API failures', () => {
    test('should throw error when script is not found', async () => {
      const { getContent, getJob } = require('./dynamodb');

      getJob.mockResolvedValue({
        jobId: 'job-1',
        status: 'generating_script',
      });
      getContent.mockResolvedValue({
        jobId: 'job-1',
        // No script
      });

      await expect(synthesizeAudio('job-1')).rejects.toThrow('No lecture script found');
    });

    test('should throw error when job is not found', async () => {
      const { getContent, getJob } = require('./dynamodb');

      getContent.mockResolvedValue({
        jobId: 'job-1',
        script: {
          segments: [],
          totalEstimatedDuration: 0,
        },
      });
      getJob.mockResolvedValue(null);

      await expect(synthesizeAudio('job-1')).rejects.toThrow('Job not found');
    });

    test('should throw error when script text is empty', async () => {
      const { getContent, getAgent, getJob } = require('./dynamodb');

      const emptyScript: LectureScript = {
        segments: [
          {
            segmentId: 'seg-1',
            title: 'Empty Segment',
            scriptBlocks: [
              {
                id: 'block-1',
                text: '',
                contentReference: {
                  type: 'text',
                  id: 'content-1',
                  pageNumber: 1,
                },
                estimatedDuration: 0,
              },
            ],
          },
        ],
        totalEstimatedDuration: 0,
      };

      getJob.mockResolvedValue({
        jobId: 'job-1',
        agentId: 'agent-1',
        status: 'generating_script',
      });
      getContent.mockResolvedValue({
        jobId: 'job-1',
        script: emptyScript,
      });
      getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'Joanna',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      });

      await expect(synthesizeAudio('job-1')).rejects.toThrow('Script text is empty');
    });

    test('should update job status to failed on error', async () => {
      const { getContent, getJob, updateJob } = require('./dynamodb');

      getJob.mockResolvedValue({
        jobId: 'job-1',
        status: 'generating_script',
      });
      getContent.mockResolvedValue({
        jobId: 'job-1',
        // No script - will cause error
      });
      updateJob.mockResolvedValue({});

      await expect(synthesizeAudio('job-1')).rejects.toThrow();

      // Should have attempted to update job status to failed
      expect(updateJob).toHaveBeenCalledWith('job-1', expect.objectContaining({
        status: 'failed',
        error: expect.any(String),
      }));
    });
  });

  // Test timing validation and fixing
  describe('Timing validation and fixing', () => {
    test('should validate monotonic timings as valid', () => {
      const timings: WordTiming[] = [
        { word: 'hello', startTime: 0, endTime: 0.5, scriptBlockId: 'block-1' },
        { word: 'world', startTime: 0.5, endTime: 1.0, scriptBlockId: 'block-1' },
        { word: 'test', startTime: 1.0, endTime: 1.5, scriptBlockId: 'block-1' },
      ];

      const isValid = validateTimingMonotonicity(timings);
      expect(isValid).toBe(true);
    });

    test('should detect non-monotonic timings', () => {
      const timings: WordTiming[] = [
        { word: 'hello', startTime: 0, endTime: 0.5, scriptBlockId: 'block-1' },
        { word: 'world', startTime: 0.3, endTime: 1.0, scriptBlockId: 'block-1' }, // Overlaps
        { word: 'test', startTime: 1.0, endTime: 1.5, scriptBlockId: 'block-1' },
      ];

      const isValid = validateTimingMonotonicity(timings);
      expect(isValid).toBe(false);
    });

    test('should detect invalid word timing (end before start)', () => {
      const timings: WordTiming[] = [
        { word: 'hello', startTime: 0, endTime: 0.5, scriptBlockId: 'block-1' },
        { word: 'world', startTime: 1.0, endTime: 0.5, scriptBlockId: 'block-1' }, // Invalid
      ];

      const isValid = validateTimingMonotonicity(timings);
      expect(isValid).toBe(false);
    });

    test('should fix non-monotonic timings', () => {
      const timings: WordTiming[] = [
        { word: 'hello', startTime: 0, endTime: 0.5, scriptBlockId: 'block-1' },
        { word: 'world', startTime: 0.3, endTime: 1.0, scriptBlockId: 'block-1' }, // Overlaps
        { word: 'test', startTime: 0.8, endTime: 1.5, scriptBlockId: 'block-1' }, // Overlaps
      ];

      const fixed = fixTimingMonotonicity(timings);

      // Should be valid after fixing
      const isValid = validateTimingMonotonicity(fixed);
      expect(isValid).toBe(true);

      // Should have same number of timings
      expect(fixed.length).toBe(timings.length);

      // Each timing should be valid
      for (const timing of fixed) {
        expect(timing.endTime).toBeGreaterThanOrEqual(timing.startTime);
      }
    });

    test('should handle empty timing array', () => {
      const timings: WordTiming[] = [];

      const isValid = validateTimingMonotonicity(timings);
      expect(isValid).toBe(true);

      const fixed = fixTimingMonotonicity(timings);
      expect(fixed.length).toBe(0);
    });
  });

  // Test word timing extraction
  describe('Word timing extraction', () => {
    test('should assign script block IDs to word timings', () => {
      const script: LectureScript = {
        segments: [
          {
            segmentId: 'seg-1',
            title: 'Test Segment',
            scriptBlocks: [
              {
                id: 'block-1',
                text: 'Hello world',
                contentReference: {
                  type: 'text',
                  id: 'content-1',
                  pageNumber: 1,
                },
                estimatedDuration: 2,
              },
              {
                id: 'block-2',
                text: 'Test sentence',
                contentReference: {
                  type: 'text',
                  id: 'content-2',
                  pageNumber: 1,
                },
                estimatedDuration: 2,
              },
            ],
          },
        ],
        totalEstimatedDuration: 4,
      };

      const ttsResult: TTSResult = {
        audioBuffer: Buffer.from([]),
        duration: 4,
        wordTimings: [
          { word: 'Hello', startTime: 0, endTime: 0.5, scriptBlockId: 'unknown' },
          { word: 'world', startTime: 0.5, endTime: 1.0, scriptBlockId: 'unknown' },
          { word: 'Test', startTime: 1.0, endTime: 1.5, scriptBlockId: 'unknown' },
          { word: 'sentence', startTime: 1.5, endTime: 2.0, scriptBlockId: 'unknown' },
        ],
      };

      const extracted = extractWordTimings(ttsResult, script);

      // Should assign block IDs
      expect(extracted[0].scriptBlockId).toBe('block-1');
      expect(extracted[1].scriptBlockId).toBe('block-1');
      expect(extracted[2].scriptBlockId).toBe('block-2');
      expect(extracted[3].scriptBlockId).toBe('block-2');
    });

    test('should handle extra timings beyond script words', () => {
      const script: LectureScript = {
        segments: [
          {
            segmentId: 'seg-1',
            title: 'Test Segment',
            scriptBlocks: [
              {
                id: 'block-1',
                text: 'Hello',
                contentReference: {
                  type: 'text',
                  id: 'content-1',
                  pageNumber: 1,
                },
                estimatedDuration: 1,
              },
            ],
          },
        ],
        totalEstimatedDuration: 1,
      };

      const ttsResult: TTSResult = {
        audioBuffer: Buffer.from([]),
        duration: 2,
        wordTimings: [
          { word: 'Hello', startTime: 0, endTime: 0.5, scriptBlockId: 'unknown' },
          { word: 'extra', startTime: 0.5, endTime: 1.0, scriptBlockId: 'unknown' },
          { word: 'words', startTime: 1.0, endTime: 1.5, scriptBlockId: 'unknown' },
        ],
      };

      const extracted = extractWordTimings(ttsResult, script);

      // Should assign all timings to the last block
      expect(extracted.length).toBe(3);
      expect(extracted[0].scriptBlockId).toBe('block-1');
      expect(extracted[1].scriptBlockId).toBe('block-1');
      expect(extracted[2].scriptBlockId).toBe('block-1');
    });
  });

  // Test voice configuration mapping
  describe('Voice configuration mapping', () => {
    test('should map voice configuration correctly', () => {
      const agent: LectureAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'Joanna',
          speed: 1.5,
          pitch: 5,
        },
        createdAt: new Date(),
      };

      const mapped = mapVoiceConfiguration(agent);

      expect(mapped.voiceId).toBe('Joanna');
      expect(mapped.speed).toBe(1.5);
      expect(mapped.pitch).toBe(5);
    });
  });

  // Test script concatenation
  describe('Script concatenation', () => {
    test('should concatenate script blocks with spaces', () => {
      const script: LectureScript = {
        segments: [
          {
            segmentId: 'seg-1',
            title: 'Segment 1',
            scriptBlocks: [
              {
                id: 'block-1',
                text: 'First block.',
                contentReference: { type: 'text', id: 'c1', pageNumber: 1 },
                estimatedDuration: 2,
              },
              {
                id: 'block-2',
                text: 'Second block.',
                contentReference: { type: 'text', id: 'c2', pageNumber: 1 },
                estimatedDuration: 2,
              },
            ],
          },
          {
            segmentId: 'seg-2',
            title: 'Segment 2',
            scriptBlocks: [
              {
                id: 'block-3',
                text: 'Third block.',
                contentReference: { type: 'text', id: 'c3', pageNumber: 2 },
                estimatedDuration: 2,
              },
            ],
          },
        ],
        totalEstimatedDuration: 6,
      };

      const concatenated = concatenateScriptText(script);

      expect(concatenated).toBe('First block. Second block. Third block.');
    });

    test('should normalize whitespace in concatenated text', () => {
      const script: LectureScript = {
        segments: [
          {
            segmentId: 'seg-1',
            title: 'Segment 1',
            scriptBlocks: [
              {
                id: 'block-1',
                text: 'Text   with   extra   spaces.',
                contentReference: { type: 'text', id: 'c1', pageNumber: 1 },
                estimatedDuration: 2,
              },
              {
                id: 'block-2',
                text: 'Another\n\nblock\nwith\nnewlines.',
                contentReference: { type: 'text', id: 'c2', pageNumber: 1 },
                estimatedDuration: 2,
              },
            ],
          },
        ],
        totalEstimatedDuration: 4,
      };

      const concatenated = concatenateScriptText(script);

      // Should normalize all whitespace to single spaces
      expect(concatenated).not.toContain('   ');
      expect(concatenated).not.toContain('\n');
      expect(concatenated).toContain('Text with extra spaces.');
      expect(concatenated).toContain('Another block with newlines.');
    });

    test('should handle empty script', () => {
      const script: LectureScript = {
        segments: [],
        totalEstimatedDuration: 0,
      };

      const concatenated = concatenateScriptText(script);

      expect(concatenated).toBe('');
    });
  });
});

// Audio Synthesizer service - Convert lecture scripts to MP3 audio with word-level timing
import { logger } from '../utils/logger';
import { withRetryAndCircuitBreaker } from '../utils/retry';
import { ExternalServiceError } from '../utils/errors';
import { LectureAgent } from '../models/agent';
import { LectureScript } from '../models/script';
import { AudioOutput, WordTiming } from '../models/audio';
import { uploadAudio } from './s3';

/**
 * TTS Provider interface
 * Abstracts the TTS service to allow different providers
 */
export interface TTSProvider {
  synthesize(text: string, voiceConfig: LectureAgent['voice']): Promise<TTSResult>;
}

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
  wordTimings: WordTiming[];
}

/**
 * Mock TTS Provider for testing and development
 * In production, this would be replaced with actual TTS service (AWS Polly, Google TTS, ElevenLabs)
 */
export class MockTTSProvider implements TTSProvider {
  async synthesize(text: string, voiceConfig: LectureAgent['voice']): Promise<TTSResult> {
    logger.info('Mock TTS synthesis', {
      textLength: text.length,
      voiceId: voiceConfig.voiceId,
      speed: voiceConfig.speed,
      pitch: voiceConfig.pitch,
    });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock audio buffer (empty MP3 header)
    const audioBuffer = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 frame header
      ...Array(1000).fill(0), // Padding
    ]);

    // Generate mock word timings
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordTimings: WordTiming[] = [];
    
    // Calculate timing based on voice speed
    // Base rate: 155 words per minute
    const wordsPerMinute = 155 * voiceConfig.speed;
    const secondsPerWord = 60 / wordsPerMinute;
    
    let currentTime = 0;
    for (const word of words) {
      const wordDuration = secondsPerWord;
      wordTimings.push({
        word: word.replace(/[.,!?;:]$/, ''), // Remove trailing punctuation
        startTime: currentTime,
        endTime: currentTime + wordDuration,
        scriptBlockId: 'unknown', // Will be set later
      });
      currentTime += wordDuration;
    }

    const duration = currentTime;

    return {
      audioBuffer,
      duration,
      wordTimings,
    };
  }
}

/**
 * AWS Polly TTS Provider
 * Uses AWS Polly for text-to-speech synthesis
 */
export class PollyTTSProvider implements TTSProvider {
  private polly: any; // AWS.Polly instance

  constructor() {
    // Initialize AWS Polly client
    // This would be configured based on environment
    const AWS = require('aws-sdk');
    const { config } = require('../utils/config');
    
    const pollyConfig: any = {
      region: config.aws.region,
    };
    
    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      pollyConfig.accessKeyId = config.aws.accessKeyId;
      pollyConfig.secretAccessKey = config.aws.secretAccessKey;
    }
    
    this.polly = new AWS.Polly(pollyConfig);
  }

  async synthesize(text: string, voiceConfig: LectureAgent['voice']): Promise<TTSResult> {
    logger.info('AWS Polly TTS synthesis', {
      textLength: text.length,
      voiceId: voiceConfig.voiceId,
    });

    return withRetryAndCircuitBreaker(
      'aws-polly',
      async () => {
        try {
          // Request speech synthesis with word-level timing
          const params = {
            Text: text,
            OutputFormat: 'mp3',
            VoiceId: voiceConfig.voiceId,
            Engine: 'neural', // Use neural engine for better quality
            SpeechMarkTypes: ['word'], // Request word-level timing
          };

          // Get audio stream
          const audioResult = await this.polly.synthesizeSpeech(params).promise();
          const audioBuffer = audioResult.AudioStream as Buffer;

          // Get word timing marks
          const timingParams = {
            ...params,
            OutputFormat: 'json',
          };
          const timingResult = await this.polly.synthesizeSpeech(timingParams).promise();
          const timingData = timingResult.AudioStream.toString('utf-8');
          
          // Parse timing marks (each line is a JSON object)
          const wordTimings: WordTiming[] = [];
          const lines = timingData.split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const mark = JSON.parse(line);
              if (mark.type === 'word') {
                wordTimings.push({
                  word: mark.value,
                  startTime: mark.time / 1000, // Convert ms to seconds
                  endTime: (mark.time + mark.duration) / 1000,
                  scriptBlockId: 'unknown', // Will be set later
                });
              }
            } catch (e) {
              logger.warn('Failed to parse timing mark', { line: line as string });
            }
          }

          // Calculate duration from last word timing
          const duration = wordTimings.length > 0
            ? wordTimings[wordTimings.length - 1].endTime
            : 0;

          return {
            audioBuffer,
            duration,
            wordTimings,
          };
        } catch (error) {
          logger.error('AWS Polly synthesis failed', { error });
          throw new ExternalServiceError(
            `TTS synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
            'aws-polly',
            { error }
          );
        }
      },
      { maxAttempts: 3, initialDelayMs: 1000 },
      { failureThreshold: 5, timeout: 60000 }
    );
  }
}

/**
 * Get TTS provider based on configuration
 */
export function getTTSProvider(): TTSProvider {
  const ttsProvider = process.env.TTS_PROVIDER || 'mock';
  
  switch (ttsProvider.toLowerCase()) {
    case 'polly':
    case 'aws':
      return new PollyTTSProvider();
    case 'mock':
    default:
      return new MockTTSProvider();
  }
}

/**
 * Map voice configuration from agent settings to TTS provider format
 */
export function mapVoiceConfiguration(agent: LectureAgent): LectureAgent['voice'] {
  // In production, this might map generic voice IDs to provider-specific IDs
  // For now, we pass through the configuration
  return {
    voiceId: agent.voice.voiceId,
    speed: agent.voice.speed,
    pitch: agent.voice.pitch,
  };
}

/**
 * Extract word-level timing data from TTS result
 * Assigns script block IDs to word timings based on text position
 */
export function extractWordTimings(
  ttsResult: TTSResult,
  script: LectureScript
): WordTiming[] {
  const wordTimings = ttsResult.wordTimings;
  
  // Build a map of word positions to script blocks
  const scriptWords: Array<{ word: string; blockId: string }> = [];
  
  for (const segment of script.segments) {
    for (const block of segment.scriptBlocks) {
      const words = block.text.split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        scriptWords.push({
          word: word.replace(/[.,!?;:]$/, ''), // Remove trailing punctuation
          blockId: block.id,
        });
      }
    }
  }
  
  // Assign script block IDs to word timings
  const result: WordTiming[] = [];
  
  for (let i = 0; i < wordTimings.length && i < scriptWords.length; i++) {
    result.push({
      ...wordTimings[i],
      scriptBlockId: scriptWords[i].blockId,
    });
  }
  
  // If there are extra timings without matching script words, use the last block ID
  if (wordTimings.length > scriptWords.length && scriptWords.length > 0) {
    const lastBlockId = scriptWords[scriptWords.length - 1].blockId;
    for (let i = scriptWords.length; i < wordTimings.length; i++) {
      result.push({
        ...wordTimings[i],
        scriptBlockId: lastBlockId,
      });
    }
  }
  
  return result;
}

/**
 * Validate timing monotonicity
 * Ensures that word timings are in increasing order
 */
export function validateTimingMonotonicity(wordTimings: WordTiming[]): boolean {
  if (wordTimings.length === 0) {
    return true;
  }
  
  for (let i = 1; i < wordTimings.length; i++) {
    const prev = wordTimings[i - 1];
    const curr = wordTimings[i];
    
    // Current word's start time should be >= previous word's end time
    if (curr.startTime < prev.endTime) {
      logger.warn('Timing monotonicity violation detected', {
        index: i,
        prevWord: prev.word,
        prevEnd: prev.endTime,
        currWord: curr.word,
        currStart: curr.startTime,
      });
      return false;
    }
    
    // Word's end time should be >= start time
    if (curr.endTime < curr.startTime) {
      logger.warn('Invalid word timing detected', {
        index: i,
        word: curr.word,
        startTime: curr.startTime,
        endTime: curr.endTime,
      });
      return false;
    }
  }
  
  return true;
}

/**
 * Fix timing monotonicity issues
 * Adjusts timings to ensure they are monotonically increasing
 */
export function fixTimingMonotonicity(wordTimings: WordTiming[]): WordTiming[] {
  if (wordTimings.length === 0) {
    return wordTimings;
  }
  
  const fixed: WordTiming[] = [wordTimings[0]];
  
  for (let i = 1; i < wordTimings.length; i++) {
    const prev = fixed[i - 1];
    const curr = { ...wordTimings[i] };
    
    // Ensure current start time is >= previous end time
    if (curr.startTime < prev.endTime) {
      curr.startTime = prev.endTime;
    }
    
    // Ensure end time is >= start time
    if (curr.endTime < curr.startTime) {
      curr.endTime = curr.startTime + 0.1; // Add small duration
    }
    
    fixed.push(curr);
  }
  
  return fixed;
}

/**
 * Concatenate script blocks into full text for TTS
 */
export function concatenateScriptText(script: LectureScript): string {
  const textParts: string[] = [];
  
  for (const segment of script.segments) {
    for (const block of segment.scriptBlocks) {
      textParts.push(block.text);
    }
  }
  
  // Join with spaces and normalize whitespace
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Main audio synthesis function
 * Retrieves lecture script and agent, generates audio, and stores the result
 */
export async function synthesizeAudio(jobId: string): Promise<AudioOutput> {
  try {
    logger.info('Starting audio synthesis', { jobId });
    
    // Import dynamodb functions here to avoid circular dependencies
    const { getContent, updateContent, getAgent, getJob, updateJob } = require('./dynamodb');
    
    // Retrieve lecture script from database
    const contentRecord = await getContent(jobId);
    if (!contentRecord || !contentRecord.script) {
      throw new Error(`No lecture script found for job: ${jobId}`);
    }
    
    const script = contentRecord.script as LectureScript;
    
    // Retrieve agent configuration
    const job = await getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    let agent = null;
    if (job.agentId) {
      agent = await getAgent(job.agentId);
    }
    
    // If no agent found, use default
    if (!agent) {
      logger.warn('No agent specified, using default agent');
      agent = {
        id: 'default',
        name: 'Default Lecturer',
        description: 'A clear and straightforward science communicator',
        personality: {
          instructions: 'Explain concepts clearly and accessibly',
          tone: 'casual' as const,
        },
        voice: {
          voiceId: 'Joanna', // AWS Polly default voice
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
    }
    
    // Concatenate script blocks into full text
    const fullText = concatenateScriptText(script);
    
    if (fullText.length === 0) {
      throw new Error('Script text is empty');
    }
    
    logger.info('Script concatenated', {
      jobId,
      textLength: fullText.length,
      wordCount: fullText.split(/\s+/).length,
    });
    
    // Get TTS provider
    const ttsProvider = getTTSProvider();
    
    // Map voice configuration
    const voiceConfig = mapVoiceConfiguration(agent);
    
    // Generate audio with agent's voice settings
    const ttsResult = await ttsProvider.synthesize(fullText, voiceConfig);
    
    logger.info('TTS synthesis completed', {
      jobId,
      duration: ttsResult.duration,
      wordCount: ttsResult.wordTimings.length,
    });
    
    // Extract word-level timing data
    let wordTimings = extractWordTimings(ttsResult, script);
    
    // Validate timing monotonicity
    const isMonotonic = validateTimingMonotonicity(wordTimings);
    if (!isMonotonic) {
      logger.warn('Timing monotonicity validation failed, fixing timings', { jobId });
      wordTimings = fixTimingMonotonicity(wordTimings);
    }
    
    // Store MP3 file in S3
    const audioUrl = await uploadAudio(jobId, ttsResult.audioBuffer);
    
    logger.info('Audio uploaded to S3', { jobId, audioUrl });
    
    // Create audio output
    const audioOutput: AudioOutput = {
      audioUrl,
      duration: ttsResult.duration,
      wordTimings,
    };
    
    // Store audio metadata and timings in database
    await updateContent(jobId, {
      audioUrl,
      wordTimings,
    });
    
    // Update job status to completed
    await updateJob(jobId, {
      status: 'completed',
    });
    
    logger.info('Audio synthesis completed', {
      jobId,
      audioUrl,
      duration: ttsResult.duration,
      wordTimingCount: wordTimings.length,
    });
    
    return audioOutput;
  } catch (error) {
    logger.error('Audio synthesis failed', { jobId, error });
    
    // Update job status to failed
    try {
      const { updateJob } = require('./dynamodb');
      await updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Audio synthesis failed',
      });
    } catch (updateError) {
      logger.error('Failed to update job status', { jobId, error: updateError });
    }
    
    throw error;
  }
}

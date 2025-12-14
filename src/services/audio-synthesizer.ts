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
 * 
 * Supports multiple engines:
 * - generative: Best quality, most natural (newest, limited voices)
 * - long-form: Optimized for long content (news-style voices)
 * - neural: High quality, natural (most voices available)
 * - standard: Basic quality, fast (all voices available)
 */
export class PollyTTSProvider implements TTSProvider {
  private polly: any; // PollyClient instance
  private engine: string;

  constructor() {
    // Initialize AWS Polly client
    const { PollyClient } = require('@aws-sdk/client-polly');
    const { config } = require('../utils/config');

    const pollyConfig: any = {
      region: config.aws.region,
    };

    // In Lambda, rely on environment variables (IAM role) which SDK picks up automatically.
    // Explicitly setting credentials here is only needed for local development if not using
    // default AWS CLI profile, or if config.localMode is enabled and explicit keys are provided.
    if (config.localstack.useLocalStack && config.aws.accessKeyId && config.aws.secretAccessKey) {
      pollyConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      };
    }

    this.polly = new PollyClient(pollyConfig);

    // Get engine from environment (generative, long-form, neural, standard)
    this.engine = process.env.POLLY_ENGINE || 'neural';

    logger.info('AWS Polly TTS Provider initialized', {
      region: config.aws.region,
      engine: this.engine,
    });
  }

  async synthesize(text: string, voiceConfig: LectureAgent['voice']): Promise<TTSResult> {
    logger.info('AWS Polly TTS synthesis', {
      textLength: text.length,
      voiceId: voiceConfig.voiceId,
      engine: this.engine,
    });

    const chunks = this.chunkText(text);
    if (chunks.length > 1) {
      logger.info('Text exceeds limit, split into chunks', { count: chunks.length });
    }

    const audioBuffers: Buffer[] = [];
    let totalDuration = 0;
    const allWordTimings: WordTiming[] = [];

    // Synthesize chunks sequentially
    for (const [index, chunk] of chunks.entries()) {
      if (chunks.length > 1) {
        logger.info(`Synthesizing chunk ${index + 1}/${chunks.length}`, { length: chunk.length });
      }

      const chunkResult = await withRetryAndCircuitBreaker(
        'aws-polly',
        async () => {
          return this.synthesizeChunk(chunk, voiceConfig);
        },
        { maxAttempts: 3, initialDelayMs: 1000 },
        { failureThreshold: 5, timeout: 60000 }
      );

      audioBuffers.push(chunkResult.audioBuffer);

      // Adjust timings for this chunk
      const adjustedTimings = chunkResult.wordTimings.map(t => ({
        ...t,
        startTime: t.startTime + totalDuration,
        endTime: t.endTime + totalDuration,
      }));
      allWordTimings.push(...adjustedTimings);

      totalDuration += chunkResult.duration;
    }

    return {
      audioBuffer: Buffer.concat(audioBuffers),
      duration: totalDuration,
      wordTimings: allWordTimings,
    };
  }

  /**
   * Synthesize a single chunk of text
   */
  private async synthesizeChunk(text: string, voiceConfig: LectureAgent['voice']): Promise<TTSResult> {
    try {
      const { SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
      
      // Build synthesis parameters
      const params: any = {
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: voiceConfig.voiceId,
        Engine: this.engine,
      };

      // Add engine-specific parameters
      if (this.engine === 'generative') {
        logger.info('Using generative engine (word timings will be estimated)');
      } else if (this.engine === 'long-form') {
        // Long-form can use speech marks with JSON output for timings, but not with MP3 directly
        // The SpeechMarkTypes are explicitly added for the separate JSON timing request below.
        // This 'else if' branch will remain empty for MP3 parameters as SpeechMarkTypes should not be here.
      } else {
        // Neural and standard engines also handle SpeechMarkTypes separately for JSON output.
        // This 'else' branch will remain empty for MP3 parameters as SpeechMarkTypes should not be here.
      }

      // Get audio stream
      const audioCommand = new SynthesizeSpeechCommand(params);
      const audioResult = await this.polly.send(audioCommand);
      
      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of audioResult.AudioStream as any) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      let wordTimings: WordTiming[] = [];
      let duration = 0;

      // Get word timing marks (if supported by engine)
      // We attempt this for all engines. If it fails (e.g. not supported), we fall back to estimation.
      try {
        const timingParams = {
          Text: text,
          OutputFormat: 'json' as const,
          VoiceId: voiceConfig.voiceId,
          Engine: 'standard' as const, // Speech marks only work with standard engine, not neural
          SpeechMarkTypes: ['word' as const],
        };
        const timingCommand = new SynthesizeSpeechCommand(timingParams);
        const timingResult = await this.polly.send(timingCommand);
        
        // Convert timing stream to string
        const timingChunks: Uint8Array[] = [];
        for await (const chunk of timingResult.AudioStream as any) {
          timingChunks.push(chunk);
        }
        const timingData = Buffer.concat(timingChunks).toString('utf-8');

        const lines = timingData.split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          try {
            const mark = JSON.parse(line);
            if (mark.type === 'word') {
              wordTimings.push({
                word: mark.value,
                startTime: mark.time / 1000,
                endTime: (mark.time + (mark.duration || 0)) / 1000,
                scriptBlockId: 'unknown',
              });
            }
          } catch (e) {
            logger.warn('Failed to parse timing mark', { line: line as string });
          }
        }

        duration = wordTimings.length > 0
          ? wordTimings[wordTimings.length - 1].endTime
          : 0;
      } catch (timingError) {
        logger.warn('Failed to get word timings, will estimate', { error: timingError });
      }

      // Estimate timings if missing
      if (wordTimings.length === 0) {
        wordTimings = this.estimateWordTimings(text, voiceConfig.speed);
        duration = wordTimings.length > 0
          ? wordTimings[wordTimings.length - 1].endTime
          : 0;
      }

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
  }

  /**
   * Split text into chunks that respect AWS Polly limits (3000 chars)
   * Uses safe margin of 2800 chars and splits on sentence boundaries
   */
  private chunkText(text: string): string[] {
    const MAX_LENGTH = 2800; // Safe margin below 3000
    if (text.length <= MAX_LENGTH) return [text];

    const chunks: string[] = [];
    let currentChunk = '';

    // Split by sentence boundaries (roughly)
    // Matches period/exclamation/question followed by space or newline, or just newline
    const sentences = text.match(/[^.!?\n]+([.!?\n]+|$)/g) || [text];

    for (const sentence of sentences) {
      // If adding this sentence exceeds limit
      if ((currentChunk + sentence).length > MAX_LENGTH) {
        // If current chunk has content, push it
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If the sentence itself is massive (rare), strict split by words
        if (sentence.length > MAX_LENGTH) {
          const words = sentence.split(' ');
          for (const word of words) {
            if ((currentChunk + ' ' + word).length > MAX_LENGTH) {
              chunks.push(currentChunk.trim());
              currentChunk = word;
            } else {
              currentChunk = currentChunk ? currentChunk + ' ' + word : word;
            }
          }
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Estimate word timings when actual timings are not available
   * Used for generative engine or when timing fetch fails
   */
  private estimateWordTimings(text: string, speed: number): WordTiming[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordTimings: WordTiming[] = [];

    // Calculate timing based on voice speed
    // Base rate: 155 words per minute
    const wordsPerMinute = 155 * speed;
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

    return wordTimings;
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

    // Instead of concatenating full text, process segment by segment
    // const fullText = concatenateScriptText(script);

    // Get TTS provider
    const ttsProvider = getTTSProvider();

    // Map voice configuration
    const voiceConfig = mapVoiceConfiguration(agent);

    let combinedAudioBuffer = Buffer.alloc(0);
    let combinedWordTimings: WordTiming[] = [];
    let totalDuration = 0;

    logger.info('Starting segmented synthesis', {
      jobId,
      segmentCount: script.segments.length
    });

    for (const segment of script.segments) {
      // Concatenate text for this segment only
      const segmentTextParts: string[] = [];
      const segmentBlocks: { word: string; blockId: string }[] = [];

      for (const block of segment.scriptBlocks) {
        segmentTextParts.push(block.text);

        // Map words to block IDs for this segment to help with extraction later if needed
        // (Though extractWordTimings logic might need adjustment if we do it per segment)
      }
      const segmentText = segmentTextParts.join(' ').replace(/\s+/g, ' ').trim();

      if (segmentText.length === 0) continue;

      logger.info('Synthesizing segment', {
        segmentId: segment.segmentId,
        textLength: segmentText.length
      });

      // Synthesize segment
      const ttsResult = await ttsProvider.synthesize(segmentText, voiceConfig);

      // Extract timings for this segment relative to the start of the SEGMNET's audio
      // We need to map these timings to the correct ScriptBlock IDs within this segment
      // We can reuse extractWordTimings but pass a "mini-script" containing only this segment
      const segmentScript: LectureScript = { ...script, segments: [segment] };
      const segmentTimings = extractWordTimings(ttsResult, segmentScript);

      // Adjust timings by adding the current total duration
      const adjustedTimings = segmentTimings.map(t => ({
        ...t,
        startTime: t.startTime + totalDuration,
        endTime: t.endTime + totalDuration,
      }));

      // Concatenate audio
      combinedAudioBuffer = Buffer.concat([combinedAudioBuffer, ttsResult.audioBuffer]);
      combinedWordTimings.push(...adjustedTimings);
      totalDuration += ttsResult.duration;
    }

    if (combinedAudioBuffer.length === 0) {
      throw new Error('Script text yielded no audio');
    }

    logger.info('TTS synthesis completed', {
      jobId,
      duration: totalDuration,
      wordCount: combinedWordTimings.length,
    });

    // Validate timing monotonicity
    const isMonotonic = validateTimingMonotonicity(combinedWordTimings);
    let finalTimings = combinedWordTimings;
    if (!isMonotonic) {
      logger.warn('Timing monotonicity validation failed, fixing timings', { jobId });
      finalTimings = fixTimingMonotonicity(combinedWordTimings);
    }

    // Store MP3 file in S3
    const audioUrl = await uploadAudio(jobId, combinedAudioBuffer);

    logger.info('Audio uploaded to S3', { jobId, audioUrl });

    // Create audio output
    const audioOutput: AudioOutput = {
      audioUrl,
      duration: totalDuration,
      wordTimings: finalTimings,
    };

    // Store audio metadata and timings in database
    await updateContent(jobId, {
      audioUrl,
      wordTimings: finalTimings,
    });

    // Update job status to completed
    await updateJob(jobId, {
      status: 'completed',
    });

    logger.info('Audio synthesis completed', {
      jobId,
      audioUrl,
      duration: totalDuration,
      wordTimingCount: finalTimings.length,
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

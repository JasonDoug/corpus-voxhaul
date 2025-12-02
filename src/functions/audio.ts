// Audio Synthesizer function - Serverless function wrapper
import { synthesizeAudio } from '../services/audio-synthesizer';
import { getJob, updateJob } from '../services/dynamodb';
import { publishJobCompleted } from '../services/eventbridge';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Lambda handler for audio synthesis
 * This function synthesizes audio from the lecture script,
 * extracts word-level timing data, and marks the job as completed.
 */
export async function audioHandler(event: any): Promise<any> {
  try {
    logger.info('Audio synthesizer function invoked');
    
    // Parse the request
    const jobId = event.jobId;
    
    if (!jobId) {
      throw new Error('jobId is required');
    }
    
    // Get the job
    const job = await getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Update job status to 'synthesizing_audio'
    await updateJob(jobId, {
      status: 'synthesizing_audio',
      stages: job.stages.map(stage =>
        stage.stage === 'audio_synthesis'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });
    
    logger.info('Starting audio synthesis', { jobId });
    
    // Synthesize the audio
    const audioOutput = await synthesizeAudio(jobId);
    
    // Job status is updated to 'completed' by synthesizeAudio
    
    logger.info('Audio synthesis completed successfully', { jobId });
    
    // Publish job completion event in production
    if (config.nodeEnv === 'production') {
      await publishJobCompleted(jobId);
      logger.info('Job completion event published', { jobId });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId,
        status: 'completed',
        message: 'Audio synthesis completed',
        audioOutput: {
          audioUrl: audioOutput.audioUrl,
          duration: audioOutput.duration,
          wordTimingCount: audioOutput.wordTimings.length,
        },
      }),
    };
  } catch (error) {
    logger.error('Audio synthesizer handler error', { error });
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'AUDIO_SYNTHESIS_FAILED',
      retryable: true,
    };
    
    // Try to update job status to failed
    if (event.jobId) {
      try {
        const job = await getJob(event.jobId);
        if (job) {
          await updateJob(event.jobId, {
            status: 'failed',
            error: errorResponse.error,
            stages: job.stages.map(stage =>
              stage.stage === 'audio_synthesis'
                ? { ...stage, status: 'failed', error: errorResponse.error }
                : stage
            ),
          });
        }
      } catch (updateError) {
        logger.error('Failed to update job status', { error: updateError });
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify(errorResponse),
    };
  }
}

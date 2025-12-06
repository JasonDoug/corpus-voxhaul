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
    logger.info('Audio synthesizer function invoked', { eventType: event['detail-type'] || 'DirectInvocation' });
    
    // Parse the request - handle both EventBridge events and direct invocations
    const jobId = event.detail?.jobId || event.jobId || event.pathParameters?.jobId;
    
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
          wordTimings: audioOutput.wordTimings.length,
        },
      }),
    };
  } catch (error) {
    // Ensure the jobId variable is used, not event.jobId
    const currentJobId = event.detail?.jobId || event.jobId || event.pathParameters?.jobId;
    
    // Explicitly serialize the error object for better logging
    const serializedError = {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...(error && typeof error === 'object' && 'retryable' in error ? { retryable: (error as any).retryable } : {}),
      ...(error && typeof error === 'object' && 'retryAfter' in error ? { retryAfter: (error as any).retryAfter } : {}),
    };
    
    logger.error('Audio synthesizer handler error', { jobId: currentJobId, error: serializedError });
    
    const errorResponse: ErrorResponse = {
      error: serializedError.message,
      code: 'AUDIO_SYNTHESIS_FAILED',
      retryable: serializedError.retryable || true, // Default to true if not specified
    };
    
    // Try to update job status to failed
    if (currentJobId) {
      try {
        const jobToUpdate = await getJob(currentJobId);
        if (jobToUpdate) {
          await updateJob(currentJobId, {
            status: 'failed',
            error: errorResponse.error,
            stages: jobToUpdate.stages.map(stage =>
              stage.stage === 'audio_synthesis'
                ? { ...stage, status: 'failed', error: errorResponse.error }
                : stage
            ),
          });
        }
      } catch (updateError) {
        logger.error('Failed to update job status in error handler', { jobId: currentJobId, error: updateError });
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify(errorResponse),
    };
  }
}

// Script Generator function - Serverless function wrapper
import { generateScript } from '../services/script-generator';
import { getJob, updateJob } from '../services/dynamodb';
import { triggerAudioSynthesis } from '../services/eventbridge';
import { ErrorResponse } from '../models/errors';
import { Job } from '../models/job';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Lambda handler for script generation
 * This function generates a lecture script with personality,
 * applies timing calculations, and triggers audio synthesis.
 */
export async function scriptHandler(event: any): Promise<any> {
  try {
    logger.info('Script generator function invoked', { eventType: event['detail-type'] || 'DirectInvocation' });

    // Parse the request - handle both EventBridge events and direct invocations
    const jobId = event.detail?.jobId || event.jobId || event.pathParameters?.jobId;
    const agentId = event.agentId; // Optional agent ID override

    if (!jobId) {
      throw new Error('jobId is required');
    }

    // Get the job
    const job = await getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    logger.info('ScriptFunction: Job object before first update', { jobId, job });
    const updatesForScriptGeneration: Partial<Job> = {
      status: 'generating_script',
      stages: job.stages.map(stage =>
        stage.stage === 'script_generation'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    };
    logger.info('ScriptFunction: Updates object for first update', { jobId, updates: updatesForScriptGeneration });

    // Update job status to 'generating_script'
    await updateJob(jobId, updatesForScriptGeneration);

    logger.info('Starting script generation', { jobId, agentId });

    // Generate the script
    const lectureScript = await generateScript(jobId, agentId);

    // Update job status to 'synthesizing_audio'
    await updateJob(jobId, {
      status: 'synthesizing_audio',
      stages: job.stages.map(stage => {
        if (stage.stage === 'script_generation') {
          return { ...stage, status: 'completed', completedAt: new Date() };
        }
        if (stage.stage === 'audio_synthesis') {
          return { ...stage, status: 'in_progress', startedAt: new Date() };
        }
        return stage;
      }),
    });

    logger.info('Script generation completed successfully', { jobId });

    // Trigger audio synthesis asynchronously in production
    if (config.nodeEnv === 'production') {
      await triggerAudioSynthesis(jobId);
      logger.info('Audio synthesis triggered asynchronously', { jobId });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId,
        status: 'synthesizing_audio',
        message: 'Script generation completed',
        lectureScript: {
          segments: lectureScript.segments.length,
          totalEstimatedDuration: lectureScript.totalEstimatedDuration,
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

    logger.error('Script generator handler error', { jobId: currentJobId, error: serializedError });

    const errorResponse: ErrorResponse = {
      error: serializedError.message,
      code: 'SCRIPT_GENERATION_FAILED',
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
              stage.stage === 'script_generation'
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

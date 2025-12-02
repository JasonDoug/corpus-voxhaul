// Script Generator function - Serverless function wrapper
import { generateScript } from '../services/script-generator';
import { getJob, updateJob } from '../services/dynamodb';
import { triggerAudioSynthesis } from '../services/eventbridge';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Lambda handler for script generation
 * This function generates a lecture script with personality,
 * applies timing calculations, and triggers audio synthesis.
 */
export async function scriptHandler(event: any): Promise<any> {
  try {
    logger.info('Script generator function invoked');
    
    // Parse the request
    const jobId = event.jobId;
    const agentId = event.agentId; // Optional agent ID override
    
    if (!jobId) {
      throw new Error('jobId is required');
    }
    
    // Get the job
    const job = await getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Update job status to 'generating_script'
    await updateJob(jobId, {
      status: 'generating_script',
      stages: job.stages.map(stage =>
        stage.stage === 'script_generation'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });
    
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
    logger.error('Script generator handler error', { error });
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'SCRIPT_GENERATION_FAILED',
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
              stage.stage === 'script_generation'
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

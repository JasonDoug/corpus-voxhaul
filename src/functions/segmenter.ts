// Segmenter function - Serverless function wrapper
import { segmentContent } from '../services/segmenter';
import { getJob, updateJob } from '../services/dynamodb';
import { triggerScriptGeneration } from '../services/eventbridge';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Lambda handler for content segmentation
 * This function segments extracted content into logical topics,
 * applies dependency-based ordering, and triggers script generation.
 */
export async function segmenterHandler(event: any): Promise<any> {
  try {
    logger.info('Segmenter function invoked');
    
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
    
    // Update job status to 'segmenting'
    await updateJob(jobId, {
      status: 'segmenting',
      stages: job.stages.map(stage =>
        stage.stage === 'segmentation'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });
    
    logger.info('Starting content segmentation', { jobId });
    
    // Segment the content
    const segmentedContent = await segmentContent(jobId);
    
    // Update job status to 'generating_script'
    await updateJob(jobId, {
      status: 'generating_script',
      stages: job.stages.map(stage => {
        if (stage.stage === 'segmentation') {
          return { ...stage, status: 'completed', completedAt: new Date() };
        }
        if (stage.stage === 'script_generation') {
          return { ...stage, status: 'in_progress', startedAt: new Date() };
        }
        return stage;
      }),
    });
    
    logger.info('Content segmentation completed successfully', { jobId });
    
    // Trigger script generation asynchronously in production
    if (config.nodeEnv === 'production') {
      await triggerScriptGeneration(jobId, job.agentId);
      logger.info('Script generation triggered asynchronously', { jobId });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId,
        status: 'generating_script',
        message: 'Content segmentation completed',
        segmentedContent: {
          segments: segmentedContent.segments.length,
        },
      }),
    };
  } catch (error) {
    logger.error('Segmenter handler error', { error });
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'SEGMENTATION_FAILED',
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
              stage.stage === 'segmentation'
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

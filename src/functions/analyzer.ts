// Analyzer function - Serverless function wrapper
// Conditional imports to avoid loading pdf-parse when using vision-first
// import { analyzeContent } from '../services/analyzer';  // Only needed for legacy pipeline
import { analyzeContentVisionFirst } from '../services/analyzer-vision';
import { getJob, updateJob, getContent, createContent, updateContent } from '../services/dynamodb';
import { triggerSegmentation } from '../services/eventbridge';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * Lambda handler for content analysis
 * This function analyzes a PDF, extracts all content elements,
 * stores the results, and triggers the segmentation pipeline.
 */
export async function analyzerHandler(event: any): Promise<any> {
  try {
    logger.info('Analyzer function invoked');
    
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
    
    // Update job status to 'analyzing'
    await updateJob(jobId, {
      status: 'analyzing',
      stages: job.stages.map(stage =>
        stage.stage === 'analysis'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });
    
    logger.info('Starting content analysis', { jobId });
    
    // Check if vision-first pipeline is enabled
    if (config.featureFlags.enableVisionFirstPipeline) {
      logger.info('Using vision-first pipeline', { jobId });
      
      // Vision-first pipeline: analyze and segment in one step
      const segmentedContent = await analyzeContentVisionFirst(jobId);
      
      // Create or update content record
      let contentRecord = await getContent(jobId);
      if (!contentRecord) {
        contentRecord = await createContent(jobId);
      }
      
      // Store segmented content directly (skip separate segmentation step)
      await updateContent(jobId, {
        segmentedContent,
      });
      
      // Update job status to 'generating_script' (skip segmentation stage)
      await updateJob(jobId, {
        status: 'generating_script',
        stages: job.stages.map(stage => {
          if (stage.stage === 'analysis') {
            return { ...stage, status: 'completed', completedAt: new Date() };
          }
          if (stage.stage === 'segmentation') {
            return { ...stage, status: 'completed', completedAt: new Date() };
          }
          if (stage.stage === 'script_generation') {
            return { ...stage, status: 'in_progress', startedAt: new Date() };
          }
          return stage;
        }),
      });
      
      logger.info('Vision-first analysis completed successfully', {
        jobId,
        segmentCount: segmentedContent.segments.length,
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          jobId,
          status: 'generating_script',
          message: 'Vision-first analysis completed',
          segmentedContent: {
            segments: segmentedContent.segments.length,
          },
        }),
      };
    } else {
      // Legacy pipeline: separate analysis and segmentation steps
      logger.info('Using legacy multi-step pipeline', { jobId });
      
      // Dynamically import analyzer to avoid loading pdf-parse unless needed
      const { analyzeContent } = await import('../services/analyzer');
      
      // Analyze the PDF content
      const extractedContent = await analyzeContent(jobId);
      
      // Create or update content record
      let contentRecord = await getContent(jobId);
      if (!contentRecord) {
        contentRecord = await createContent(jobId);
      }
      
      await updateContent(jobId, {
        extractedContent,
      });
      
      // Update job status to 'segmenting'
      await updateJob(jobId, {
        status: 'segmenting',
        stages: job.stages.map(stage => {
          if (stage.stage === 'analysis') {
            return { ...stage, status: 'completed', completedAt: new Date() };
          }
          if (stage.stage === 'segmentation') {
            return { ...stage, status: 'in_progress', startedAt: new Date() };
          }
          return stage;
        }),
      });
      
      logger.info('Content analysis completed successfully', { jobId });
      
      // Trigger segmentation asynchronously in production
      if (config.nodeEnv === 'production') {
        await triggerSegmentation(jobId);
        logger.info('Segmentation triggered asynchronously', { jobId });
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          jobId,
          status: 'segmenting',
          message: 'Content analysis completed',
          extractedContent: {
            pages: extractedContent.pages.length,
            figures: extractedContent.figures.length,
            tables: extractedContent.tables.length,
            formulas: extractedContent.formulas.length,
            citations: extractedContent.citations.length,
          },
        }),
      };
    }
  } catch (error) {
    logger.error('Analyzer handler error', { error });
    
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'ANALYSIS_FAILED',
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
              stage.stage === 'analysis'
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

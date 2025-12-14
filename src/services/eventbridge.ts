// EventBridge service for asynchronous function triggering
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

const eventBridge = new EventBridgeClient({
  ...(config.isLocal && {
    endpoint: 'http://localhost:4566',
  }),
  region: config.awsRegion,
});

export interface PipelineEvent {
  jobId: string;
  agentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Publish an event to EventBridge to trigger the next stage in the pipeline
 */
export async function publishPipelineEvent(
  detailType: string,
  detail: PipelineEvent
): Promise<void> {
  const eventBusName = config.eventBusName || 'pdf-lecture-service-events';
  
  try {
    logger.info('Publishing pipeline event', { detailType, jobId: detail.jobId });
    
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: 'pdf-lecture-service',
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          EventBusName: eventBusName,
        },
      ],
    });
    
    const result = await eventBridge.send(command);
    
    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      const errors = result.Entries?.filter(e => e.ErrorCode).map(e => ({
        code: e.ErrorCode,
        message: e.ErrorMessage,
      }));
      throw new Error(`Failed to publish event: ${JSON.stringify(errors)}`);
    }
    
    logger.info('Pipeline event published successfully', { detailType, jobId: detail.jobId });
  } catch (error) {
    logger.error('Failed to publish pipeline event', { error, detailType, jobId: detail.jobId });
    throw error;
  }
}

/**
 * Trigger the content analysis stage
 */
export async function triggerAnalysis(jobId: string): Promise<void> {
  await publishPipelineEvent('JobCreated', { jobId });
}

/**
 * Trigger the content segmentation stage
 */
export async function triggerSegmentation(jobId: string): Promise<void> {
  await publishPipelineEvent('AnalysisCompleted', { jobId });
}

/**
 * Trigger the script generation stage
 */
export async function triggerScriptGeneration(jobId: string, agentId?: string): Promise<void> {
  await publishPipelineEvent('SegmentationCompleted', { jobId, agentId });
}

/**
 * Trigger the audio synthesis stage
 */
export async function triggerAudioSynthesis(jobId: string): Promise<void> {
  await publishPipelineEvent('ScriptGenerationCompleted', { jobId });
}

/**
 * Publish a job completion event
 */
export async function publishJobCompleted(jobId: string): Promise<void> {
  await publishPipelineEvent('JobCompleted', { jobId });
}

/**
 * Publish a job failure event
 */
export async function publishJobFailed(jobId: string, error: string): Promise<void> {
  await publishPipelineEvent('JobFailed', { 
    jobId, 
    metadata: { error } 
  });
}

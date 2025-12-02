// Status query service
import { getJob, getContent } from './dynamodb';
import { Job } from '../models/job';
import { PlaybackState } from '../models/playback';
import { logger } from '../utils/logger';

export interface StatusQueryRequest {
  jobId: string;
}

export interface StatusQueryResponse {
  jobId: string;
  status: Job['status'];
  createdAt: Date;
  updatedAt: Date;
  pdfFilename: string;
  agentId?: string;
  stages: Job['stages'];
  error?: string;
}

/**
 * Retrieve job status by job ID
 * Returns job status, stage progress, and error information
 * Throws error if job ID does not exist
 */
export async function getJobStatus(request: StatusQueryRequest): Promise<StatusQueryResponse> {
  const { jobId } = request;
  
  logger.info('Retrieving job status', { jobId });
  
  // Retrieve job from database
  const job = await getJob(jobId);
  
  // Handle non-existent job IDs
  if (!job) {
    logger.warn('Job not found', { jobId });
    throw new Error(`Job not found: ${jobId}`);
  }
  
  // Return job status information
  const response: StatusQueryResponse = {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    pdfFilename: job.pdfFilename,
    agentId: job.agentId,
    stages: job.stages,
    error: job.error,
  };
  
  logger.info('Job status retrieved', { jobId, status: job.status });
  
  return response;
}

/**
 * Retrieve playback data for a completed job
 * Returns all data needed for the Immersive Reader interface
 */
export async function getPlaybackData(jobId: string): Promise<PlaybackState> {
  logger.info('Retrieving playback data', { jobId });
  
  // Retrieve job from database
  const job = await getJob(jobId);
  
  if (!job) {
    logger.warn('Job not found', { jobId });
    throw new Error(`Job not found: ${jobId}`);
  }
  
  // Check if job is completed
  if (job.status !== 'completed') {
    logger.warn('Job not completed', { jobId, status: job.status });
    throw new Error(`Job not completed: ${job.status}`);
  }
  
  // Retrieve content data
  const content = await getContent(jobId);
  
  if (!content) {
    logger.warn('Content not found', { jobId });
    throw new Error(`Content not found for job: ${jobId}`);
  }
  
  // Construct playback state
  const playbackState: PlaybackState = {
    jobId: job.jobId,
    pdfUrl: job.pdfUrl,
    script: content.script,
    audioUrl: content.audioUrl,
    wordTimings: content.wordTimings,
    currentTime: 0,
    isPlaying: false,
  };
  
  logger.info('Playback data retrieved', { jobId });
  
  return playbackState;
}

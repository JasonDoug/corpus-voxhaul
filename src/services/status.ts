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
  pdfUrl?: string;
  audioUrl?: string;
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

  // Generate presigned URL for PDF if it exists
  let pdfUrl = job.pdfUrl;
  if (job.pdfUrl && !job.pdfUrl.startsWith('http')) {
    // It's likely a key or local path, but if we stored the full S3 URL in the DB, 
    // we need to decide if we overwrite it. 
    // Current implementation in upload.ts stores the full URL. 
    // Let's assume we need to generate a signed URL regardless of what's stored 
    // if we want to access private buckets.
  }

  // To properly generate a signed URL, we need the jobId. 
  // s3.ts helpers expect jobId to derive the key: `${jobId}/original.pdf`
  // This matches our storage pattern.

  const signedPdfUrl = await import('./s3').then(s3 => s3.getPDFSignedUrl(job.jobId));
  const signedAudioUrl = job.status === 'completed'
    ? await import('./s3').then(s3 => s3.getAudioSignedUrl(job.jobId))
    : undefined;

  const response: StatusQueryResponse = {
    jobId: job.jobId,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    pdfFilename: job.pdfFilename,
    agentId: job.agentId,
    stages: job.stages,
    error: job.error,
    // Overwrite database URLs with dynamic presigned URLs
    // Note: We need to extend the interface if we want to be strict, 
    // but Job interface has pdfUrl as string, so we can just replace it.
  };

  // We need to actually construct the response object with the signed URLs
  // Typescript might complain if we try to modify strict properties, 
  // but let's look at the return object construction.

  return {
    ...response,
    pdfUrl: signedPdfUrl || job.pdfUrl, // Fallback to original if signing fails
    // We assume the frontend looks for audioUrl in the 'content' or 'playback' endpoint
    // but if expecting it here, we should add it. 
    // Wait, StatusQueryResponse defined on lines 11-20 does NOT have audioUrl.
    // It has stages. 
    // Let's check getPlaybackData (lines 62-101) which DOES return audioUrl.
  };
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

  // Retrieve signed URLs
  const [pdfSignedUrl, audioSignedUrl] = await Promise.all([
    import('./s3').then(s3 => s3.getPDFSignedUrl(job.jobId)),
    import('./s3').then(s3 => s3.getAudioSignedUrl(job.jobId))
  ]);

  // Construct playback state
  const playbackState: PlaybackState = {
    jobId: job.jobId,
    pdfUrl: pdfSignedUrl || job.pdfUrl,
    script: content.script,
    audioUrl: audioSignedUrl || content.audioUrl || '',
    wordTimings: content.wordTimings || [],
    currentTime: 0,
    isPlaying: false,
  };

  logger.info('Playback data retrieved', { jobId });

  return playbackState;
}

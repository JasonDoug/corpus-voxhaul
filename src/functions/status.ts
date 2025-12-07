// Status query function - Serverless function wrapper
import { getJobStatus, getPlaybackData, StatusQueryRequest, StatusQueryResponse } from '../services/status';
import { PlaybackState } from '../models/playback';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';

/**
 * Lambda handler for job status queries
 * This function retrieves the current status of a job by its ID,
 * including stage progress and any error information.
 */
export async function statusHandler(event: any): Promise<any> {
  try {
    logger.info('Status query function invoked');

    // Parse the request
    const jobId = event.jobId || event.pathParameters?.jobId;

    if (!jobId) {
      throw new Error('jobId is required');
    }

    const request: StatusQueryRequest = { jobId };

    // Get job status
    const response: StatusQueryResponse = await getJobStatus(request);

    logger.info('Status query completed successfully', { jobId });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Status handler error', { error });

    // Check if this is a "not found" error
    const isNotFound = error instanceof Error && error.message.includes('not found');

    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      code: isNotFound ? 'JOB_NOT_FOUND' : 'STATUS_QUERY_FAILED',
      jobId: event.jobId || event.pathParameters?.jobId,
      retryable: !isNotFound, // Don't retry if job doesn't exist
    };

    return {
      statusCode: isNotFound ? 404 : 500,
      body: JSON.stringify(errorResponse),
    };
  }
}

/**
 * Lambda handler for playback data
 * This function retrieves the playback data for a completed job,
 * including the script, word timings, and signed URLs.
 */
export async function playbackHandler(event: any): Promise<any> {
  try {
    logger.info('Playback function invoked');

    // Parse the request
    const jobId = event.jobId || event.pathParameters?.jobId;

    if (!jobId) {
      throw new Error('jobId is required');
    }

    // Get playback data
    const response: PlaybackState = await getPlaybackData(jobId);

    logger.info('Playback data retrieved successfully', { jobId });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Playback handler error', { error });

    // Check specific error types
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNotFound = errorMessage.includes('not found');
    const isNotCompleted = errorMessage.includes('not completed');

    const errorResponse: ErrorResponse = {
      error: errorMessage,
      code: isNotFound ? 'JOB_NOT_FOUND' : (isNotCompleted ? 'JOB_NOT_COMPLETED' : 'PLAYBACK_QUERY_FAILED'),
      jobId: event.jobId || event.pathParameters?.jobId,
      retryable: false,
    };

    return {
      statusCode: isNotFound ? 404 : (isNotCompleted ? 400 : 500),
      body: JSON.stringify(errorResponse),
    };
  }
}

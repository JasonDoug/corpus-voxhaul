// Status query function - Serverless function wrapper
import { getJobStatus, StatusQueryRequest, StatusQueryResponse } from '../services/status';
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

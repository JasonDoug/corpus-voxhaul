// Upload function - Serverless function wrapper
import { handleUpload, UploadRequest, UploadResponse, generateErrorResponse } from '../services/upload';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';

/**
 * Lambda handler for PDF upload
 * This function accepts a PDF file, validates it, stores it in S3,
 * creates a job record, and triggers the analysis pipeline.
 */
export async function uploadHandler(event: any): Promise<any> {
  try {
    logger.info('Upload function invoked');
    
    // Parse the request
    // In a real Lambda with API Gateway, the file would come from event.body
    // For now, we expect the event to have the structure we need
    const request: UploadRequest = {
      file: event.file, // Buffer
      filename: event.filename,
      agentId: event.agentId,
    };
    
    // Handle the upload
    const response: UploadResponse = await handleUpload(request);
    
    logger.info('Upload completed successfully', { jobId: response.jobId });
    
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Upload handler error', { error });
    
    const errorResponse: ErrorResponse = generateErrorResponse(error as any);
    
    // Determine HTTP status code based on error type
    let statusCode = 500;
    if ('code' in (error as any)) {
      const code = (error as any).code;
      if (code === 'FILE_TOO_LARGE' || code === 'INVALID_PDF') {
        statusCode = 400; // Bad Request
      }
    }
    
    return {
      statusCode,
      body: JSON.stringify(errorResponse),
    };
  }
}

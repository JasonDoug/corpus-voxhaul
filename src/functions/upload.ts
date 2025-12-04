// Upload function - Serverless function wrapper
import { handleUpload, UploadRequest, UploadResponse, generateErrorResponse } from '../services/upload';
import { ErrorResponse } from '../models/errors';
import { logger } from '../utils/logger';
import { metrics, RequestMetrics } from '../utils/metrics';
import { randomUUID } from 'crypto';

// Initialize request metrics tracker
const requestMetrics = new RequestMetrics();

/**
 * Lambda handler for PDF upload
 * This function accepts a PDF file, validates it, stores it in S3,
 * creates a job record, and triggers the analysis pipeline.
 */
export async function uploadHandler(event: any): Promise<any> {
  // Generate correlation ID for request tracking
  const correlationId = event.requestContext?.requestId || randomUUID();
  logger.setCorrelationId(correlationId);
  logger.setFunctionName('UploadFunction');
  
  // Start timing the request
  const timerId = metrics.startTimer('UploadFunctionDuration', { function: 'upload' });
  
  try {
    logger.info('Upload function invoked', { correlationId });
    requestMetrics.incrementRequest('upload');
    
    // Parse the request body from API Gateway
    let body: any;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body || event;
    }
    
    // Convert base64 file to Buffer if needed
    let fileBuffer: Buffer;
    if (typeof body.file === 'string') {
      fileBuffer = Buffer.from(body.file, 'base64');
    } else if (Buffer.isBuffer(body.file)) {
      fileBuffer = body.file;
    } else {
      throw new Error('Invalid file format - must be base64 string or Buffer');
    }
    
    const request: UploadRequest = {
      file: fileBuffer,
      filename: body.filename,
      agentId: body.agentId,
    };
    
    // Track file size
    if (request.file) {
      metrics.recordSize('UploadFileSize', request.file.length, { function: 'upload' });
    }
    
    // Handle the upload
    const response: UploadResponse = await handleUpload(request);
    
    logger.info('Upload completed successfully', { jobId: response.jobId, correlationId });
    requestMetrics.incrementSuccess('upload');
    metrics.stopTimer(timerId);
    
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Upload handler error', { error, correlationId });
    
    const errorType = (error as any).code || 'UnknownError';
    requestMetrics.incrementError('upload', errorType);
    metrics.recordCount('UploadError', 1, { function: 'upload', errorType });
    metrics.stopTimer(timerId);
    
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

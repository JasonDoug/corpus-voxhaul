// Upload validation and handling service
import { randomUUID } from 'crypto';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../models/errors';
import { 
  ValidationError, 
  validateFileSize as validateFileSizeUtil, 
  validatePDFFormat as validatePDFFormatUtil,
  AppError 
} from '../utils/errors';
import { Job, JobStatus, StageStatus } from '../models/job';
import { uploadPDF } from './s3';
import { createJob, createContent } from './dynamodb';
import { triggerAnalysis } from './eventbridge';

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates the complete upload request
 * @param buffer File buffer
 * @param filename Original filename
 * @throws ValidationError if validation fails
 */
export function validateUpload(buffer: Buffer, filename: string): void {
  const maxSizeBytes = config.processing.maxPdfSizeMB * 1024 * 1024;
  
  // Validate file size
  try {
    validateFileSizeUtil(buffer.length, maxSizeBytes);
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('File size validation failed', { 
        fileSize: buffer.length, 
        maxSize: maxSizeBytes,
        filename 
      });
    }
    throw error;
  }
  
  // Validate PDF format
  try {
    validatePDFFormatUtil(buffer);
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('PDF format validation failed', { filename });
    }
    throw error;
  }
  
  logger.info('Upload validation passed', { filename, size: buffer.length });
}

/**
 * Generates an error response for upload failures
 * @param error The error that occurred
 * @param jobId Optional job ID if available
 * @returns Formatted error response
 */
export function generateErrorResponse(error: Error, jobId?: string): ErrorResponse {
  if (error instanceof AppError) {
    return error.toResponse(jobId);
  }
  
  // Handle legacy UploadError format
  if ('code' in error && typeof (error as any).code === 'string') {
    const uploadError = error as any;
    return {
      error: uploadError.error || error.message,
      code: uploadError.code,
      jobId,
      retryable: uploadError.code === 'UPLOAD_FAILED',
    };
  }
  
  // Generic error
  return {
    error: error.message || 'An unexpected error occurred',
    code: 'UPLOAD_FAILED',
    jobId,
    retryable: true,
  };
}

// ============================================================================
// Upload Handler
// ============================================================================

export interface UploadRequest {
  file: Buffer;
  filename: string;
  agentId?: string;
}

export interface UploadResponse {
  jobId: string;
  status: JobStatus;
  message: string;
}

/**
 * Handles the complete PDF upload process
 * @param request Upload request containing file buffer and metadata
 * @returns Upload response with job ID
 * @throws ValidationError for validation failures
 * @throws AppError for processing failures
 */
export async function handleUpload(request: UploadRequest): Promise<UploadResponse> {
  const { file, filename, agentId } = request;
  
  // Validate the upload (throws ValidationError if invalid)
  validateUpload(file, filename);
  
  // Generate unique job ID
  const jobId = randomUUID();
  logger.info('Starting upload process', { jobId, filename, agentId });
  
  try {
    // Upload PDF to S3
    const pdfUrl = await uploadPDF(jobId, file, filename);
    logger.info('PDF uploaded to storage', { jobId, pdfUrl });
    
    // Create job record in database
    const job: Job = {
      jobId,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      pdfFilename: filename,
      pdfUrl,
      agentId,
      stages: initializeStages(),
    };
    
    await createJob(job);
    logger.info('Job record created', { jobId });
    
    // Create content record
    await createContent(jobId);
    logger.info('Content record created', { jobId });
    
    // Trigger Content Analysis function asynchronously
    // In production, this publishes an event to EventBridge
    // In local mode, the local server will handle this synchronously
    if (config.nodeEnv === 'production') {
      await triggerAnalysis(jobId);
      logger.info('Analysis triggered asynchronously', { jobId });
    } else {
      logger.info('Job queued for analysis (local mode)', { jobId });
    }
    
    return {
      jobId,
      status: 'queued',
      message: 'PDF uploaded successfully and queued for processing',
    };
  } catch (error) {
    logger.error('Upload failed', { jobId, error });
    
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Otherwise, wrap it in a ProcessingError
    throw new AppError(
      error instanceof Error ? error.message : 'Upload failed',
      'UPLOAD_FAILED',
      500,
      true
    );
  }
}

/**
 * Initializes the stages array for a new job
 * @returns Array of stage statuses
 */
function initializeStages(): StageStatus[] {
  const stageNames = [
    'upload',
    'analysis',
    'segmentation',
    'script_generation',
    'audio_synthesis',
  ];
  
  return stageNames.map((stage, index) => ({
    stage,
    status: index === 0 ? 'completed' : 'pending', // Upload stage is completed
  }));
}

// Upload validation and handling service
import { randomUUID } from 'crypto';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ErrorResponse, UploadError } from '../models/errors';
import { Job, JobStatus, StageStatus } from '../models/job';
import { uploadPDF } from './s3';
import { createJob, createContent } from './dynamodb';

// PDF magic bytes for validation
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates file size against the configured maximum
 * @param fileSize Size of the file in bytes
 * @returns Error response if validation fails, null otherwise
 */
export function validateFileSize(fileSize: number): UploadError | null {
  const maxSizeBytes = config.processing.maxPdfSizeMB * 1024 * 1024;
  
  if (fileSize > maxSizeBytes) {
    logger.warn('File size exceeds limit', { 
      fileSize, 
      maxSize: maxSizeBytes,
      maxSizeMB: config.processing.maxPdfSizeMB 
    });
    
    return {
      error: `File size exceeds maximum allowed size of ${config.processing.maxPdfSizeMB}MB`,
      code: 'FILE_TOO_LARGE',
    };
  }
  
  return null;
}

/**
 * Validates PDF format by checking magic bytes
 * @param buffer File buffer to validate
 * @returns Error response if validation fails, null otherwise
 */
export function validatePDFFormat(buffer: Buffer): UploadError | null {
  // Check if buffer is empty
  if (buffer.length === 0) {
    logger.warn('Empty file provided');
    return {
      error: 'File is empty',
      code: 'INVALID_PDF',
    };
  }
  
  // Check if buffer has enough bytes for magic number
  if (buffer.length < PDF_MAGIC_BYTES.length) {
    logger.warn('File too small to be a valid PDF', { size: buffer.length });
    return {
      error: 'File is too small to be a valid PDF',
      code: 'INVALID_PDF',
    };
  }
  
  // Check magic bytes
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) {
      logger.warn('Invalid PDF magic bytes', { 
        expected: PDF_MAGIC_BYTES, 
        actual: Array.from(buffer.slice(0, PDF_MAGIC_BYTES.length)) 
      });
      return {
        error: 'File is not a valid PDF document',
        code: 'INVALID_PDF',
      };
    }
  }
  
  return null;
}

/**
 * Validates the complete upload request
 * @param buffer File buffer
 * @param filename Original filename
 * @returns Error response if validation fails, null otherwise
 */
export function validateUpload(buffer: Buffer, filename: string): UploadError | null {
  // Validate file size
  const sizeError = validateFileSize(buffer.length);
  if (sizeError) {
    return sizeError;
  }
  
  // Validate PDF format
  const formatError = validatePDFFormat(buffer);
  if (formatError) {
    return formatError;
  }
  
  logger.info('Upload validation passed', { filename, size: buffer.length });
  return null;
}

/**
 * Generates an error response for upload failures
 * @param error The error that occurred
 * @param jobId Optional job ID if available
 * @returns Formatted error response
 */
export function generateErrorResponse(error: UploadError | Error, jobId?: string): ErrorResponse {
  if ('code' in error) {
    // It's an UploadError
    return {
      error: error.error,
      code: error.code,
      jobId,
      retryable: error.code === 'UPLOAD_FAILED',
    };
  }
  
  // It's a generic Error
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
 * @throws Error if upload fails
 */
export async function handleUpload(request: UploadRequest): Promise<UploadResponse> {
  const { file, filename, agentId } = request;
  
  // Validate the upload
  const validationError = validateUpload(file, filename);
  if (validationError) {
    throw validationError;
  }
  
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
    
    // TODO: Trigger Content Analysis function (will be implemented in task 6)
    // For now, we just log that the job is queued
    logger.info('Job queued for analysis', { jobId });
    
    return {
      jobId,
      status: 'queued',
      message: 'PDF uploaded successfully and queued for processing',
    };
  } catch (error) {
    logger.error('Upload failed', { jobId, error });
    
    // If it's already an UploadError, rethrow it
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    // Otherwise, wrap it in an UPLOAD_FAILED error
    const uploadError: UploadError = {
      error: error instanceof Error ? error.message : 'Upload failed',
      code: 'UPLOAD_FAILED',
    };
    throw uploadError;
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

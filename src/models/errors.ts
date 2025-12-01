// Error response models

export interface ErrorResponse {
  error: string; // Human-readable error message
  code: string; // Machine-readable error code
  jobId?: string; // If applicable
  details?: Record<string, any>; // Additional context
  retryable: boolean; // Whether the client should retry
}

export interface UploadError {
  error: string;
  code: 'FILE_TOO_LARGE' | 'INVALID_PDF' | 'UPLOAD_FAILED';
}

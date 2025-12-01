// Error handling utilities

export interface ErrorResponse {
  error: string;
  code: string;
  jobId?: string;
  details?: Record<string, any>;
  retryable: boolean;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse(jobId?: string): ErrorResponse {
    return {
      error: this.message,
      code: this.code,
      jobId,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, false, details);
    this.name = 'ValidationError';
  }
}

export class ProcessingError extends AppError {
  constructor(message: string, retryable: boolean = true, details?: Record<string, any>) {
    super(message, 'PROCESSING_ERROR', 500, retryable, details);
    this.name = 'ProcessingError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, service: string, details?: Record<string, any>) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, true, { service, ...details });
    this.name = 'ExternalServiceError';
  }
}

export class ResourceError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RESOURCE_ERROR', 503, true, details);
    this.name = 'ResourceError';
  }
}

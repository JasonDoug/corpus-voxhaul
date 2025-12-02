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

// Validation helpers
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
  validateRequired(value, fieldName);
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
  }
  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
  }
}

export function validateNumber(value: any, fieldName: string, min?: number, max?: number): void {
  validateRequired(value, fieldName);
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }
  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`);
  }
}

export function validateEnum<T extends string>(value: any, fieldName: string, allowedValues: T[]): void {
  validateRequired(value, fieldName);
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
}

export function validateArray(value: any, fieldName: string, itemValidator?: (item: any, index: number) => void): void {
  validateRequired(value, fieldName);
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  if (itemValidator) {
    value.forEach((item, index) => {
      try {
        itemValidator(item, index);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(`${fieldName}[${index}]: ${error.message}`);
        }
        throw error;
      }
    });
  }
}

export function validateFileSize(size: number, maxSize: number): void {
  if (size > maxSize) {
    throw new ValidationError(`File size exceeds maximum allowed size of ${maxSize} bytes`, {
      actualSize: size,
      maxSize,
    });
  }
}

export function validatePDFFormat(buffer: Buffer): void {
  // Check PDF magic bytes: %PDF-
  if (buffer.length < 5) {
    throw new ValidationError('File is too small to be a valid PDF');
  }
  
  const header = buffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new ValidationError('File is not a valid PDF (invalid magic bytes)', {
      actualHeader: header,
    });
  }
}

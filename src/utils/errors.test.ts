// Test error utilities
import { ValidationError, ProcessingError, ExternalServiceError, ResourceError } from './errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with correct properties', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should convert to error response', () => {
      const error = new ValidationError('Invalid input');
      const response = error.toResponse('job-123');
      
      expect(response.error).toBe('Invalid input');
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.jobId).toBe('job-123');
      expect(response.retryable).toBe(false);
    });
  });

  describe('ProcessingError', () => {
    it('should create processing error with retryable flag', () => {
      const error = new ProcessingError('Processing failed', true);
      
      expect(error.code).toBe('PROCESSING_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create external service error with service name', () => {
      const error = new ExternalServiceError('API timeout', 'OpenAI');
      
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.retryable).toBe(true);
      expect(error.details?.service).toBe('OpenAI');
    });
  });

  describe('ResourceError', () => {
    it('should create resource error', () => {
      const error = new ResourceError('Out of memory');
      
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
    });
  });
});

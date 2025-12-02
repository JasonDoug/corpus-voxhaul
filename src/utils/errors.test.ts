// Unit tests for error handling utilities
import {
  AppError,
  ValidationError,
  ExternalServiceError,
  ResourceError,
  validateRequired,
  validateString,
  validateNumber,
  validateEnum,
  validateArray,
  validateFileSize,
  validatePDFFormat,
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('Test error', 'TEST_CODE', 500, true, { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error.details).toEqual({ detail: 'test' });
    });
    
    it('should convert to error response', () => {
      const error = new AppError('Test error', 'TEST_CODE', 500, true);
      const response = error.toResponse('job-123');
      
      expect(response).toEqual({
        error: 'Test error',
        code: 'TEST_CODE',
        jobId: 'job-123',
        details: undefined,
        retryable: true,
      });
    });
  });
  
  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });
  });
  
  describe('ExternalServiceError', () => {
    it('should create external service error with service name', () => {
      const error = new ExternalServiceError('API failed', 'openai');
      
      expect(error.message).toBe('API failed');
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.retryable).toBe(true);
      expect(error.details).toEqual({ service: 'openai' });
    });
  });
  
  describe('ResourceError', () => {
    it('should create resource error with 503 status', () => {
      const error = new ResourceError('Out of memory');
      
      expect(error.message).toBe('Out of memory');
      expect(error.code).toBe('RESOURCE_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
    });
  });
});

describe('Validation Helpers', () => {
  describe('validateRequired', () => {
    it('should pass for non-null values', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
      expect(() => validateRequired(0, 'field')).not.toThrow();
      expect(() => validateRequired(false, 'field')).not.toThrow();
    });
    
    it('should throw for null or undefined', () => {
      expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
      expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
    });
  });
  
  describe('validateString', () => {
    it('should pass for valid strings', () => {
      expect(() => validateString('test', 'field')).not.toThrow();
      expect(() => validateString('test', 'field', 2, 10)).not.toThrow();
    });
    
    it('should throw for non-strings', () => {
      expect(() => validateString(123, 'field')).toThrow(ValidationError);
      expect(() => validateString(null, 'field')).toThrow(ValidationError);
    });
    
    it('should validate min length', () => {
      expect(() => validateString('ab', 'field', 3)).toThrow(ValidationError);
      expect(() => validateString('abc', 'field', 3)).not.toThrow();
    });
    
    it('should validate max length', () => {
      expect(() => validateString('abcdef', 'field', undefined, 5)).toThrow(ValidationError);
      expect(() => validateString('abcde', 'field', undefined, 5)).not.toThrow();
    });
  });
  
  describe('validateNumber', () => {
    it('should pass for valid numbers', () => {
      expect(() => validateNumber(5, 'field')).not.toThrow();
      expect(() => validateNumber(0, 'field')).not.toThrow();
      expect(() => validateNumber(-5, 'field')).not.toThrow();
    });
    
    it('should throw for non-numbers', () => {
      expect(() => validateNumber('5', 'field')).toThrow(ValidationError);
      expect(() => validateNumber(NaN, 'field')).toThrow(ValidationError);
    });
    
    it('should validate min value', () => {
      expect(() => validateNumber(4, 'field', 5)).toThrow(ValidationError);
      expect(() => validateNumber(5, 'field', 5)).not.toThrow();
    });
    
    it('should validate max value', () => {
      expect(() => validateNumber(11, 'field', undefined, 10)).toThrow(ValidationError);
      expect(() => validateNumber(10, 'field', undefined, 10)).not.toThrow();
    });
  });
  
  describe('validateEnum', () => {
    it('should pass for valid enum values', () => {
      expect(() => validateEnum('a', 'field', ['a', 'b', 'c'])).not.toThrow();
    });
    
    it('should throw for invalid enum values', () => {
      expect(() => validateEnum('d', 'field', ['a', 'b', 'c'])).toThrow(ValidationError);
    });
  });
  
  describe('validateArray', () => {
    it('should pass for valid arrays', () => {
      expect(() => validateArray([], 'field')).not.toThrow();
      expect(() => validateArray([1, 2, 3], 'field')).not.toThrow();
    });
    
    it('should throw for non-arrays', () => {
      expect(() => validateArray('not array', 'field')).toThrow(ValidationError);
      expect(() => validateArray(null, 'field')).toThrow(ValidationError);
    });
    
    it('should validate array items', () => {
      const validator = (item: any) => {
        if (typeof item !== 'number') throw new ValidationError('Must be number');
      };
      
      expect(() => validateArray([1, 2, 3], 'field', validator)).not.toThrow();
      expect(() => validateArray([1, 'two', 3], 'field', validator)).toThrow(ValidationError);
    });
  });
  
  describe('validateFileSize', () => {
    it('should pass for files within size limit', () => {
      expect(() => validateFileSize(1000, 2000)).not.toThrow();
      expect(() => validateFileSize(2000, 2000)).not.toThrow();
    });
    
    it('should throw for files exceeding size limit', () => {
      expect(() => validateFileSize(3000, 2000)).toThrow(ValidationError);
      expect(() => validateFileSize(3000, 2000)).toThrow(/exceeds maximum/);
    });
  });
  
  describe('validatePDFFormat', () => {
    it('should pass for valid PDF files', () => {
      const validPDF = Buffer.from('%PDF-1.4\n...');
      expect(() => validatePDFFormat(validPDF)).not.toThrow();
    });
    
    it('should throw for files too small', () => {
      const tooSmall = Buffer.from('PDF');
      expect(() => validatePDFFormat(tooSmall)).toThrow(ValidationError);
      expect(() => validatePDFFormat(tooSmall)).toThrow(/too small/);
    });
    
    it('should throw for invalid magic bytes', () => {
      const invalid = Buffer.from('NOTPDF');
      expect(() => validatePDFFormat(invalid)).toThrow(ValidationError);
      expect(() => validatePDFFormat(invalid)).toThrow(/invalid magic bytes/);
    });
  });
});

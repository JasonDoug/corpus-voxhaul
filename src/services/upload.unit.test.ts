// Unit tests for upload service edge cases
import { handleUpload, validateFileSize, validatePDFFormat } from './upload';
import { config } from '../utils/config';
import * as s3Service from './s3';
import * as dynamodbService from './dynamodb';

// Mock the external services
jest.mock('./s3');
jest.mock('./dynamodb');
jest.mock('../utils/logger');

describe('Upload Service - Unit Tests (Edge Cases)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File size validation edge cases', () => {
    it('should accept file exactly at 100MB limit', () => {
      const exactLimit = config.processing.maxPdfSizeMB * 1024 * 1024;
      const result = validateFileSize(exactLimit);
      expect(result).toBeNull();
    });

    it('should reject file one byte over 100MB limit', () => {
      const overLimit = config.processing.maxPdfSizeMB * 1024 * 1024 + 1;
      const result = validateFileSize(overLimit);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('FILE_TOO_LARGE');
    });

    it('should accept file one byte under 100MB limit', () => {
      const underLimit = config.processing.maxPdfSizeMB * 1024 * 1024 - 1;
      const result = validateFileSize(underLimit);
      expect(result).toBeNull();
    });
  });

  describe('PDF format validation edge cases', () => {
    it('should reject empty file', () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validatePDFFormat(emptyBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
      expect(result?.error).toContain('empty');
    });

    it('should reject file with only 1 byte', () => {
      const tinyBuffer = Buffer.from([0x25]);
      const result = validatePDFFormat(tinyBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
      expect(result?.error).toContain('too small');
    });

    it('should reject file with only 3 bytes', () => {
      const smallBuffer = Buffer.from([0x25, 0x50, 0x44]);
      const result = validatePDFFormat(smallBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
    });

    it('should accept file with exactly 4 bytes (minimum valid PDF)', () => {
      const minBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      const result = validatePDFFormat(minBuffer);
      expect(result).toBeNull();
    });

    it('should reject file with wrong first byte', () => {
      const wrongBuffer = Buffer.from([0x00, 0x50, 0x44, 0x46]);
      const result = validatePDFFormat(wrongBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
      expect(result?.error).toContain('not a valid PDF');
    });

    it('should reject file with wrong second byte', () => {
      const wrongBuffer = Buffer.from([0x25, 0x00, 0x44, 0x46]);
      const result = validatePDFFormat(wrongBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
    });

    it('should reject file with wrong third byte', () => {
      const wrongBuffer = Buffer.from([0x25, 0x50, 0x00, 0x46]);
      const result = validatePDFFormat(wrongBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
    });

    it('should reject file with wrong fourth byte', () => {
      const wrongBuffer = Buffer.from([0x25, 0x50, 0x44, 0x00]);
      const result = validatePDFFormat(wrongBuffer);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_PDF');
    });

    it('should accept valid PDF with additional content', () => {
      const validBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
      const result = validatePDFFormat(validBuffer);
      expect(result).toBeNull();
    });
  });

  describe('Corrupted PDF handling', () => {
    it('should reject PDF with corrupted magic bytes at start', async () => {
      const corruptedBuffer = Buffer.alloc(1000);
      corruptedBuffer[0] = 0xFF; // Wrong magic byte
      corruptedBuffer[1] = 0x50;
      corruptedBuffer[2] = 0x44;
      corruptedBuffer[3] = 0x46;

      await expect(
        handleUpload({
          file: corruptedBuffer,
          filename: 'corrupted.pdf',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PDF',
      });

      expect(s3Service.uploadPDF).not.toHaveBeenCalled();
      expect(dynamodbService.createJob).not.toHaveBeenCalled();
    });

    it('should reject file that looks like PDF but has wrong magic bytes', async () => {
      const fakeBuffer = Buffer.alloc(1000);
      // Fill with random data that might look like PDF content
      fakeBuffer.write('This is not a PDF', 0);

      await expect(
        handleUpload({
          file: fakeBuffer,
          filename: 'fake.pdf',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PDF',
      });
    });
  });

  describe('Empty file handling', () => {
    it('should reject completely empty file', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        handleUpload({
          file: emptyBuffer,
          filename: 'empty.pdf',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PDF',
        error: expect.stringContaining('empty'),
      });

      expect(s3Service.uploadPDF).not.toHaveBeenCalled();
      expect(dynamodbService.createJob).not.toHaveBeenCalled();
    });

    it('should reject file with only whitespace (no actual PDF content)', async () => {
      const whitespaceBuffer = Buffer.from('    ');

      await expect(
        handleUpload({
          file: whitespaceBuffer,
          filename: 'whitespace.pdf',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PDF',
      });
    });
  });

  describe('Boundary conditions', () => {
    it('should handle file exactly at 100MB with valid PDF magic bytes', async () => {
      // Configure mocks
      (s3Service.uploadPDF as jest.Mock).mockResolvedValue('https://s3.example.com/test.pdf');
      (dynamodbService.createJob as jest.Mock).mockImplementation((job) => Promise.resolve(job));
      (dynamodbService.createContent as jest.Mock).mockResolvedValue({ jobId: 'test' });

      const exactLimit = config.processing.maxPdfSizeMB * 1024 * 1024;
      const buffer = Buffer.alloc(exactLimit);
      buffer.write('%PDF', 0);

      const response = await handleUpload({
        file: buffer,
        filename: 'exact-limit.pdf',
      });

      expect(response).toHaveProperty('jobId');
      expect(response.status).toBe('queued');
      expect(s3Service.uploadPDF).toHaveBeenCalled();
      expect(dynamodbService.createJob).toHaveBeenCalled();
    });

    it('should reject file at 100MB + 1 byte even with valid PDF magic bytes', async () => {
      const overLimit = config.processing.maxPdfSizeMB * 1024 * 1024 + 1;
      const buffer = Buffer.alloc(overLimit);
      buffer.write('%PDF', 0);

      await expect(
        handleUpload({
          file: buffer,
          filename: 'over-limit.pdf',
        })
      ).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
      });

      expect(s3Service.uploadPDF).not.toHaveBeenCalled();
      expect(dynamodbService.createJob).not.toHaveBeenCalled();
    });
  });

  describe('Filename edge cases', () => {
    it('should handle very long filenames', async () => {
      // Configure mocks
      (s3Service.uploadPDF as jest.Mock).mockResolvedValue('https://s3.example.com/test.pdf');
      (dynamodbService.createJob as jest.Mock).mockImplementation((job) => Promise.resolve(job));
      (dynamodbService.createContent as jest.Mock).mockResolvedValue({ jobId: 'test' });

      const buffer = Buffer.alloc(1000);
      buffer.write('%PDF', 0);
      const longFilename = 'a'.repeat(200) + '.pdf';

      const response = await handleUpload({
        file: buffer,
        filename: longFilename,
      });

      expect(response).toHaveProperty('jobId');
      expect(response.status).toBe('queued');
    });

    it('should handle filenames with special characters', async () => {
      // Configure mocks
      (s3Service.uploadPDF as jest.Mock).mockResolvedValue('https://s3.example.com/test.pdf');
      (dynamodbService.createJob as jest.Mock).mockImplementation((job) => Promise.resolve(job));
      (dynamodbService.createContent as jest.Mock).mockResolvedValue({ jobId: 'test' });

      const buffer = Buffer.alloc(1000);
      buffer.write('%PDF', 0);
      const specialFilename = 'test-file_2024 (1).pdf';

      const response = await handleUpload({
        file: buffer,
        filename: specialFilename,
      });

      expect(response).toHaveProperty('jobId');
      expect(response.status).toBe('queued');
    });
  });
});

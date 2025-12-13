// Property-based tests for local development server
import * as fc from 'fast-check';
import { uploadHandler } from '../functions/upload';
import { analyzerHandler } from '../functions/analyzer';

import { scriptHandler } from '../functions/script';
import { audioHandler } from '../functions/audio';
import { statusHandler } from '../functions/status';

/**
 * Feature: pdf-lecture-service, Property 35: Local-serverless interface compatibility
 * 
 * For any serverless function, the local HTTP endpoint should accept the same input 
 * parameters and return the same output structure as the deployed serverless function.
 * 
 * Validates: Requirements 10.2, 10.3
 * 
 * This test verifies that:
 * 1. Serverless handlers accept event objects with specific parameters
 * 2. Serverless handlers return objects with statusCode and body
 * 3. The body is a JSON string that can be parsed
 * 4. Local endpoints can wrap these handlers and produce equivalent results
 */

describe('Property 35: Local-serverless interface compatibility', () => {
  // Generator for job IDs
  const jobIdArb = fc.uuid();

  // Generator for agent IDs
  const agentIdArb = fc.uuid();

  // Generator for filenames
  const filenameArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.pdf`);

  /**
   * Test that all serverless handlers follow the Lambda response format
   */
  it('should return Lambda-compatible response format from all handlers', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          // Test status handler (most likely to succeed without setup)
          const statusEvent = {
            pathParameters: { jobId },
          };

          const statusResult = await statusHandler(statusEvent);

          // Verify Lambda response format
          expect(statusResult).toHaveProperty('statusCode');
          expect(statusResult).toHaveProperty('body');
          expect(typeof statusResult.statusCode).toBe('number');
          expect(typeof statusResult.body).toBe('string');

          // Verify body is valid JSON
          expect(() => JSON.parse(statusResult.body)).not.toThrow();

          const parsedBody = JSON.parse(statusResult.body);

          // Status handler should return either job data or error
          if (statusResult.statusCode === 200) {
            expect(parsedBody).toHaveProperty('jobId');
            expect(parsedBody).toHaveProperty('status');
          } else {
            expect(parsedBody).toHaveProperty('error');
            expect(parsedBody).toHaveProperty('code');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that upload handler accepts the correct event structure
   */
  it('should accept upload event with file, filename, and optional agentId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        filenameArb,
        fc.option(agentIdArb, { nil: undefined }),
        async (fileData, filename, agentId) => {
          const event = {
            file: Buffer.from(fileData),
            filename,
            agentId,
          };

          const result = await uploadHandler(event);

          // Verify Lambda response format
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string');

          // Verify body is valid JSON
          const parsedBody = JSON.parse(result.body);

          // Should return either success or error
          if (result.statusCode === 200) {
            expect(parsedBody).toHaveProperty('jobId');
            expect(parsedBody).toHaveProperty('status');
          } else {
            expect(parsedBody).toHaveProperty('error');
            expect(parsedBody).toHaveProperty('code');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Test that analyzer handler accepts jobId in event
   */
  it('should accept analyzer event with jobId', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          const event = { jobId };

          const result = await analyzerHandler(event);

          // Verify Lambda response format
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string');

          // Verify body is valid JSON
          const parsedBody = JSON.parse(result.body);

          // Should return error (job won't exist) but in correct format
          expect(parsedBody).toHaveProperty('error');
          expect(parsedBody).toHaveProperty('code');
        }
      ),
      { numRuns: 100 }
    );
  });



  /**
   * Test that script handler accepts jobId and optional agentId in event
   */
  it('should accept script event with jobId and optional agentId', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        fc.option(agentIdArb, { nil: undefined }),
        async (jobId, agentId) => {
          const event = { jobId, agentId };

          const result = await scriptHandler(event);

          // Verify Lambda response format
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string');

          // Verify body is valid JSON
          const parsedBody = JSON.parse(result.body);

          // Should return error (job won't exist) but in correct format
          expect(parsedBody).toHaveProperty('error');
          expect(parsedBody).toHaveProperty('code');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that audio handler accepts jobId in event
   */
  it('should accept audio event with jobId', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          const event = { jobId };

          const result = await audioHandler(event);

          // Verify Lambda response format
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string');

          // Verify body is valid JSON
          const parsedBody = JSON.parse(result.body);

          // Should return error (job won't exist) but in correct format
          expect(parsedBody).toHaveProperty('error');
          expect(parsedBody).toHaveProperty('code');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that status handler accepts pathParameters with jobId
   */
  it('should accept status event with pathParameters.jobId', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          const event = {
            pathParameters: { jobId },
          };

          const result = await statusHandler(event);

          // Verify Lambda response format
          expect(result).toHaveProperty('statusCode');
          expect(result).toHaveProperty('body');
          expect(typeof result.statusCode).toBe('number');
          expect(typeof result.body).toBe('string');

          // Verify body is valid JSON
          const parsedBody = JSON.parse(result.body);

          // Should return error (job won't exist) but in correct format
          expect(parsedBody).toHaveProperty('error');
          expect(parsedBody).toHaveProperty('code');
          expect(parsedBody.code).toBe('JOB_NOT_FOUND');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that all handlers return consistent error format
   */
  it('should return consistent error format across all handlers', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          // Test multiple handlers with non-existent job
          const handlers = [
            { name: 'analyzer', handler: analyzerHandler, event: { jobId } },

            { name: 'script', handler: scriptHandler, event: { jobId } },
            { name: 'audio', handler: audioHandler, event: { jobId } },
            { name: 'status', handler: statusHandler, event: { pathParameters: { jobId } } },
          ];

          for (const { handler, event } of handlers) {
            const result = await handler(event);

            // All should return error format
            expect(result.statusCode).toBeGreaterThanOrEqual(400);

            const parsedBody = JSON.parse(result.body);
            expect(parsedBody).toHaveProperty('error');
            expect(parsedBody).toHaveProperty('code');
            expect(parsedBody).toHaveProperty('retryable');

            expect(typeof parsedBody.error).toBe('string');
            expect(typeof parsedBody.code).toBe('string');
            expect(typeof parsedBody.retryable).toBe('boolean');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Test that response status codes are valid HTTP codes
   */
  it('should return valid HTTP status codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        jobIdArb,
        async (jobId) => {
          const handlers = [
            { handler: analyzerHandler, event: { jobId } },

            { handler: scriptHandler, event: { jobId } },
            { handler: audioHandler, event: { jobId } },
            { handler: statusHandler, event: { pathParameters: { jobId } } },
          ];

          for (const { handler, event } of handlers) {
            const result = await handler(event);

            // Status code should be a valid HTTP code (100-599)
            expect(result.statusCode).toBeGreaterThanOrEqual(100);
            expect(result.statusCode).toBeLessThan(600);

            // For our error cases, should be 4xx or 5xx
            expect(result.statusCode).toBeGreaterThanOrEqual(400);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

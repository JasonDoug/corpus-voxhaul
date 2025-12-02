// Property-based tests for EventBridge asynchronous processing
import * as fc from 'fast-check';

// Mock AWS SDK before importing the module
const mockPutEvents = jest.fn();
jest.mock('aws-sdk', () => ({
  EventBridge: jest.fn().mockImplementation(() => ({
    putEvents: mockPutEvents,
  })),
}));

import { 
  publishPipelineEvent, 
  triggerAnalysis, 
  triggerSegmentation,
  triggerScriptGeneration,
  triggerAudioSynthesis,
  publishJobCompleted,
  publishJobFailed
} from './eventbridge';

describe('EventBridge Asynchronous Processing', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock EventBridge putEvents to return success
    mockPutEvents.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        FailedEntryCount: 0,
        Entries: [{ EventId: 'test-event-id' }],
      }),
    });
  });
  
  /**
   * Feature: pdf-lecture-service, Property 33: Asynchronous processing support
   * Validates: Requirements 9.4
   * 
   * For any long-running operation (analysis, segmentation, script generation, audio synthesis),
   * the function should return a job ID immediately without blocking, and the operation should
   * continue asynchronously.
   */
  describe('Property 33: Asynchronous processing support', () => {
    // Generator for valid job IDs
    const jobIdArb = fc.uuid();
    
    // Generator for agent IDs
    const agentIdArb = fc.option(fc.uuid(), { nil: undefined });
    
    it('should publish events without blocking for analysis trigger', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, async (jobId) => {
          // Reset mock for this iteration
          mockPutEvents.mockClear();
          
          const startTime = Date.now();
          
          // Trigger analysis - should return immediately
          await triggerAnalysis(jobId);
          
          const duration = Date.now() - startTime;
          
          // Should complete very quickly (< 100ms) since it's async
          expect(duration).toBeLessThan(100);
          
          // Should have called putEvents
          expect(mockPutEvents).toHaveBeenCalledTimes(1);
          
          // Verify event structure
          const call = mockPutEvents.mock.calls[0][0];
          expect(call.Entries).toHaveLength(1);
          expect(call.Entries[0].Source).toBe('pdf-lecture-service');
          expect(call.Entries[0].DetailType).toBe('JobCreated');
          
          const detail = JSON.parse(call.Entries[0].Detail);
          expect(detail.jobId).toBe(jobId);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should publish events without blocking for segmentation trigger', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, async (jobId) => {
          mockPutEvents.mockClear();
          const startTime = Date.now();
          
          // Trigger segmentation - should return immediately
          await triggerSegmentation(jobId);
          
          const duration = Date.now() - startTime;
          
          // Should complete very quickly (< 100ms) since it's async
          expect(duration).toBeLessThan(100);
          
          // Should have called putEvents
          expect(mockPutEvents).toHaveBeenCalledTimes(1);
          
          // Verify event structure
          const call = mockPutEvents.mock.calls[0][0];
          expect(call.Entries[0].DetailType).toBe('AnalysisCompleted');
          
          const detail = JSON.parse(call.Entries[0].Detail);
          expect(detail.jobId).toBe(jobId);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should publish events without blocking for script generation trigger', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, agentIdArb, async (jobId, agentId) => {
          mockPutEvents.mockClear();
          const startTime = Date.now();
          
          // Trigger script generation - should return immediately
          await triggerScriptGeneration(jobId, agentId);
          
          const duration = Date.now() - startTime;
          
          // Should complete very quickly (< 100ms) since it's async
          expect(duration).toBeLessThan(100);
          
          // Should have called putEvents
          expect(mockPutEvents).toHaveBeenCalledTimes(1);
          
          // Verify event structure
          const call = mockPutEvents.mock.calls[0][0];
          expect(call.Entries[0].DetailType).toBe('SegmentationCompleted');
          
          const detail = JSON.parse(call.Entries[0].Detail);
          expect(detail.jobId).toBe(jobId);
          if (agentId) {
            expect(detail.agentId).toBe(agentId);
          }
        }),
        { numRuns: 100 }
      );
    });
    
    it('should publish events without blocking for audio synthesis trigger', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, async (jobId) => {
          mockPutEvents.mockClear();
          const startTime = Date.now();
          
          // Trigger audio synthesis - should return immediately
          await triggerAudioSynthesis(jobId);
          
          const duration = Date.now() - startTime;
          
          // Should complete very quickly (< 100ms) since it's async
          expect(duration).toBeLessThan(100);
          
          // Should have called putEvents
          expect(mockPutEvents).toHaveBeenCalledTimes(1);
          
          // Verify event structure
          const call = mockPutEvents.mock.calls[0][0];
          expect(call.Entries[0].DetailType).toBe('ScriptGenerationCompleted');
          
          const detail = JSON.parse(call.Entries[0].Detail);
          expect(detail.jobId).toBe(jobId);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should publish completion events without blocking', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, async (jobId) => {
          mockPutEvents.mockClear();
          const startTime = Date.now();
          
          // Publish job completed - should return immediately
          await publishJobCompleted(jobId);
          
          const duration = Date.now() - startTime;
          
          // Should complete very quickly (< 100ms) since it's async
          expect(duration).toBeLessThan(100);
          
          // Should have called putEvents
          expect(mockPutEvents).toHaveBeenCalledTimes(1);
          
          // Verify event structure
          const call = mockPutEvents.mock.calls[0][0];
          expect(call.Entries[0].DetailType).toBe('JobCompleted');
          
          const detail = JSON.parse(call.Entries[0].Detail);
          expect(detail.jobId).toBe(jobId);
        }),
        { numRuns: 100 }
      );
    });
    
    it('should publish failure events without blocking', async () => {
      await fc.assert(
        fc.asyncProperty(
          jobIdArb, 
          fc.string({ minLength: 1, maxLength: 200 }), 
          async (jobId, errorMessage) => {
            mockPutEvents.mockClear();
            const startTime = Date.now();
            
            // Publish job failed - should return immediately
            await publishJobFailed(jobId, errorMessage);
            
            const duration = Date.now() - startTime;
            
            // Should complete very quickly (< 100ms) since it's async
            expect(duration).toBeLessThan(100);
            
            // Should have called putEvents
            expect(mockPutEvents).toHaveBeenCalledTimes(1);
            
            // Verify event structure
            const call = mockPutEvents.mock.calls[0][0];
            expect(call.Entries[0].DetailType).toBe('JobFailed');
            
            const detail = JSON.parse(call.Entries[0].Detail);
            expect(detail.jobId).toBe(jobId);
            expect(detail.metadata.error).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle multiple concurrent event publications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(jobIdArb, { minLength: 2, maxLength: 10 }),
          async (jobIds) => {
            mockPutEvents.mockClear();
            const startTime = Date.now();
            
            // Trigger multiple events concurrently
            const promises = jobIds.map(jobId => triggerAnalysis(jobId));
            await Promise.all(promises);
            
            const duration = Date.now() - startTime;
            
            // Should complete quickly even with multiple events
            expect(duration).toBeLessThan(500);
            
            // Should have called putEvents for each job
            expect(mockPutEvents).toHaveBeenCalledTimes(jobIds.length);
            
            // Verify all job IDs were published
            const publishedJobIds = mockPutEvents.mock.calls.map(call => {
              const detail = JSON.parse(call[0].Entries[0].Detail);
              return detail.jobId;
            });
            
            expect(publishedJobIds.sort()).toEqual(jobIds.sort());
          }
        ),
        { numRuns: 50 }
      );
    });
    
    it('should properly structure events for EventBridge', async () => {
      await fc.assert(
        fc.asyncProperty(jobIdArb, async (jobId) => {
          mockPutEvents.mockClear();
          await publishPipelineEvent('TestEvent', { jobId });
          
          // Verify event structure matches EventBridge requirements
          const call = mockPutEvents.mock.calls[0][0];
          const entry = call.Entries[0];
          
          // Required fields
          expect(entry.Source).toBe('pdf-lecture-service');
          expect(entry.DetailType).toBe('TestEvent');
          expect(entry.Detail).toBeDefined();
          expect(entry.EventBusName).toBeDefined();
          
          // Detail should be valid JSON
          const detail = JSON.parse(entry.Detail);
          expect(detail.jobId).toBe(jobId);
        }),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Error handling in asynchronous processing', () => {
    it('should handle EventBridge failures gracefully', async () => {
      // Mock a failure
      mockPutEvents.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          FailedEntryCount: 1,
          Entries: [{ ErrorCode: 'InternalError', ErrorMessage: 'Service unavailable' }],
        }),
      });
      
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (jobId) => {
          // Should throw an error when EventBridge fails
          await expect(triggerAnalysis(jobId)).rejects.toThrow();
        }),
        { numRuns: 10 }
      );
    });
  });
});

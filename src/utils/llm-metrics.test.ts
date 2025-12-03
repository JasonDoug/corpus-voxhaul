// Tests for LLM metrics tracking

import { calculateLLMCost, recordLLMCallMetrics, JobLLMMetrics, calculateLLMSuccessRate } from './llm-metrics';
import { metrics } from './metrics';

describe('LLM Metrics', () => {
  beforeEach(() => {
    // Clear metrics before each test
    metrics.clearMetrics();
  });

  describe('calculateLLMCost', () => {
    it('should calculate cost for GPT-4 Turbo', () => {
      const cost = calculateLLMCost('gpt-4-turbo-preview', 1000, 500);
      // Input: 1000 tokens * $10/1M = $0.01
      // Output: 500 tokens * $30/1M = $0.015
      // Total: $0.025
      expect(cost).toBeCloseTo(0.025, 4);
    });

    it('should calculate cost for Claude 3 Opus', () => {
      const cost = calculateLLMCost('claude-3-opus-20240229', 2000, 1000);
      // Input: 2000 tokens * $15/1M = $0.03
      // Output: 1000 tokens * $75/1M = $0.075
      // Total: $0.105
      expect(cost).toBeCloseTo(0.105, 4);
    });

    it('should use default pricing for unknown models', () => {
      const cost = calculateLLMCost('unknown-model', 1000, 500);
      // Input: 1000 tokens * $5/1M = $0.005
      // Output: 500 tokens * $15/1M = $0.0075
      // Total: $0.0125
      expect(cost).toBeCloseTo(0.0125, 4);
    });

    it('should handle zero tokens', () => {
      const cost = calculateLLMCost('gpt-4-turbo-preview', 0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('recordLLMCallMetrics', () => {
    it('should record successful LLM call metrics', () => {
      recordLLMCallMetrics({
        operation: 'segmentation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        durationMs: 2000,
        success: true,
      });

      const recordedMetrics = metrics.getMetrics();
      
      // Should record success count
      expect(recordedMetrics.some(m => m.name === 'LLMCallSuccess')).toBe(true);
      
      // Should record duration
      expect(recordedMetrics.some(m => m.name === 'LLMCallDuration')).toBe(true);
      
      // Should record token counts
      expect(recordedMetrics.some(m => m.name === 'LLMPromptTokens')).toBe(true);
      expect(recordedMetrics.some(m => m.name === 'LLMCompletionTokens')).toBe(true);
      expect(recordedMetrics.some(m => m.name === 'LLMTotalTokens')).toBe(true);
      
      // Should record cost
      expect(recordedMetrics.some(m => m.name === 'LLMCallCostCents')).toBe(true);
    });

    it('should record failed LLM call metrics', () => {
      recordLLMCallMetrics({
        operation: 'script_generation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: 1000,
        success: false,
        errorType: 'API_ERROR',
      });

      const recordedMetrics = metrics.getMetrics();
      
      // Should record failure count
      expect(recordedMetrics.some(m => m.name === 'LLMCallFailure')).toBe(true);
      
      // Should record duration even for failures
      expect(recordedMetrics.some(m => m.name === 'LLMCallDuration')).toBe(true);
    });
  });

  describe('JobLLMMetrics', () => {
    it('should track metrics for a job', () => {
      const jobMetrics = new JobLLMMetrics('test-job-123');

      // Record first call
      jobMetrics.recordCall({
        operation: 'segmentation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        durationMs: 2000,
        success: true,
      });

      // Record second call
      jobMetrics.recordCall({
        operation: 'script_generation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
        durationMs: 1500,
        success: true,
      });

      const summary = jobMetrics.getSummary();

      expect(summary.jobId).toBe('test-job-123');
      expect(summary.totalCalls).toBe(2);
      expect(summary.totalTokens).toBe(2700);
      expect(summary.totalCost).toBeGreaterThan(0);
      expect(summary.callsByOperation).toEqual({
        segmentation: 1,
        script_generation: 1,
      });
    });

    it('should not count failed calls in totals', () => {
      const jobMetrics = new JobLLMMetrics('test-job-456');

      // Record successful call
      jobMetrics.recordCall({
        operation: 'segmentation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        durationMs: 2000,
        success: true,
      });

      // Record failed call
      jobMetrics.recordCall({
        operation: 'script_generation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: 1000,
        success: false,
        errorType: 'API_ERROR',
      });

      const summary = jobMetrics.getSummary();

      expect(summary.totalCalls).toBe(1); // Only successful call
      expect(summary.totalTokens).toBe(1500);
    });

    it('should log summary with formatted cost', () => {
      const jobMetrics = new JobLLMMetrics('test-job-789');

      jobMetrics.recordCall({
        operation: 'segmentation',
        model: 'gpt-4-turbo-preview',
        provider: 'openai',
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        durationMs: 2000,
        success: true,
      });

      // Should not throw
      expect(() => jobMetrics.logSummary()).not.toThrow();
    });
  });

  describe('calculateLLMSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      expect(calculateLLMSuccessRate(8, 2)).toBe(80);
      expect(calculateLLMSuccessRate(10, 0)).toBe(100);
      expect(calculateLLMSuccessRate(0, 10)).toBe(0);
    });

    it('should return 100% for zero calls', () => {
      expect(calculateLLMSuccessRate(0, 0)).toBe(100);
    });
  });
});

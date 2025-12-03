// LLM-specific metrics tracking for monitoring API usage, costs, and performance

import { logger } from './logger';
import { metrics } from './metrics';

/**
 * Model pricing per 1M tokens (approximate, as of 2024-2025)
 * These are rough estimates and should be updated based on actual provider pricing
 */
const MODEL_PRICING = {
  // OpenAI models
  'gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
  'gpt-4-vision-preview': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  
  // Anthropic models
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  
  // OpenRouter models (using base model pricing)
  'openai/gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
  'openai/gpt-4-vision-preview': { input: 10.0, output: 30.0 },
  'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'anthropic/claude-3-opus': { input: 15.0, output: 75.0 },
  'anthropic/claude-3-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  
  // FREE OpenRouter models (cost = $0)
  'google/gemini-2.0-flash-exp:free': { input: 0.0, output: 0.0 },
  'google/gemini-pro-vision': { input: 0.0, output: 0.0 },
  'x-ai/grok-4.1-fast:free': { input: 0.0, output: 0.0 },
  'meta-llama/llama-3.3-70b-instruct:free': { input: 0.0, output: 0.0 },
  'meta-llama/llama-3.1-405b-instruct:free': { input: 0.0, output: 0.0 },
  'qwen/qwen-2.5-72b-instruct:free': { input: 0.0, output: 0.0 },
  'mistralai/mistral-7b-instruct:free': { input: 0.0, output: 0.0 },
  
  // Default fallback pricing
  'default': { input: 5.0, output: 15.0 },
};

/**
 * Calculate cost for an LLM API call based on token usage
 */
export function calculateLLMCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Get pricing for the model, or use default
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.default;
  
  // Calculate cost (pricing is per 1M tokens, so divide by 1,000,000)
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Track metrics for an LLM API call
 */
export interface LLMCallMetrics {
  operation: string; // e.g., 'segmentation', 'script_generation', 'vision_analysis'
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  success: boolean;
  errorType?: string;
  jobId?: string;
}

/**
 * Record metrics for an LLM API call
 */
export function recordLLMCallMetrics(callMetrics: LLMCallMetrics): void {
  const dimensions = {
    operation: callMetrics.operation,
    model: callMetrics.model,
    provider: callMetrics.provider,
    success: callMetrics.success.toString(),
  };
  
  // Record success/failure count
  if (callMetrics.success) {
    metrics.recordCount('LLMCallSuccess', 1, dimensions);
  } else {
    metrics.recordCount('LLMCallFailure', 1, {
      ...dimensions,
      errorType: callMetrics.errorType || 'Unknown',
    });
  }
  
  // Record response time
  metrics.recordDuration('LLMCallDuration', callMetrics.durationMs, dimensions);
  
  // Record token usage
  metrics.recordCount('LLMPromptTokens', callMetrics.promptTokens, dimensions);
  metrics.recordCount('LLMCompletionTokens', callMetrics.completionTokens, dimensions);
  metrics.recordCount('LLMTotalTokens', callMetrics.totalTokens, dimensions);
  
  // Calculate and record cost
  const cost = calculateLLMCost(
    callMetrics.model,
    callMetrics.promptTokens,
    callMetrics.completionTokens
  );
  
  // Record cost in cents (multiply by 100 to avoid floating point issues)
  metrics.recordCount('LLMCallCostCents', Math.round(cost * 100), dimensions);
  
  // Log detailed metrics
  logger.info('LLM call metrics recorded', {
    ...callMetrics,
    estimatedCost: cost,
    costFormatted: `$${cost.toFixed(4)}`,
  });
}

/**
 * Helper class to track LLM metrics for a specific job
 */
export class JobLLMMetrics {
  private jobId: string;
  private totalCost: number = 0;
  private totalTokens: number = 0;
  private totalCalls: number = 0;
  private callsByOperation: Map<string, number> = new Map();
  
  constructor(jobId: string) {
    this.jobId = jobId;
  }
  
  /**
   * Record an LLM call for this job
   */
  recordCall(callMetrics: Omit<LLMCallMetrics, 'jobId'>): void {
    // Add jobId to metrics
    const fullMetrics: LLMCallMetrics = {
      ...callMetrics,
      jobId: this.jobId,
    };
    
    // Record global metrics
    recordLLMCallMetrics(fullMetrics);
    
    // Update job-specific tracking
    if (callMetrics.success) {
      this.totalCalls++;
      this.totalTokens += callMetrics.totalTokens;
      
      const cost = calculateLLMCost(
        callMetrics.model,
        callMetrics.promptTokens,
        callMetrics.completionTokens
      );
      this.totalCost += cost;
      
      // Track calls by operation
      const currentCount = this.callsByOperation.get(callMetrics.operation) || 0;
      this.callsByOperation.set(callMetrics.operation, currentCount + 1);
    }
  }
  
  /**
   * Get summary of LLM usage for this job
   */
  getSummary(): {
    jobId: string;
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    callsByOperation: Record<string, number>;
  } {
    return {
      jobId: this.jobId,
      totalCalls: this.totalCalls,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      callsByOperation: Object.fromEntries(this.callsByOperation),
    };
  }
  
  /**
   * Log final summary for this job
   */
  logSummary(): void {
    const summary = this.getSummary();
    
    logger.info('Job LLM metrics summary', {
      ...summary,
      costFormatted: `$${summary.totalCost.toFixed(4)}`,
    });
    
    // Record job-level metrics
    metrics.recordCount('JobLLMCalls', summary.totalCalls, { jobId: this.jobId });
    metrics.recordCount('JobLLMTokens', summary.totalTokens, { jobId: this.jobId });
    metrics.recordCount('JobLLMCostCents', Math.round(summary.totalCost * 100), { jobId: this.jobId });
  }
}

/**
 * Calculate success rate for LLM calls
 */
export function calculateLLMSuccessRate(
  successCount: number,
  failureCount: number
): number {
  const total = successCount + failureCount;
  if (total === 0) return 100;
  return (successCount / total) * 100;
}

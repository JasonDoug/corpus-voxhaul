// Retry logic and circuit breaker utilities

import { logger } from './logger';
import { ExternalServiceError, ResourceError } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
};

/**
 * Delays execution for the specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  // Check if error has retryable flag
  if (typeof error.retryable === 'boolean') {
    return error.retryable;
  }
  
  // Check error name (for custom error classes)
  if (error.name && retryableErrors.includes(error.name)) {
    return true;
  }
  
  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }
  
  // Check for common transient error messages
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('network') ||
    message.includes('temporary') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests')
  );
}

/**
 * Executes a function with exponential backoff retry logic
 * @param fn Function to execute
 * @param options Retry configuration options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let delayMs = opts.initialDelayMs;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', { attempt });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      const isRetryable = isRetryableError(error, opts.retryableErrors);
      const isLastAttempt = attempt === opts.maxAttempts;
      
      logger.warn('Operation failed', {
        attempt,
        maxAttempts: opts.maxAttempts,
        isRetryable,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (!isRetryable || isLastAttempt) {
        throw error;
      }
      
      // Wait before retrying
      logger.info('Retrying operation', { attempt, delayMs });
      await delay(delayMs);
      
      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }
  
  throw lastError;
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeoutMs?: number;
}

const DEFAULT_CIRCUIT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeoutMs: 60000,
};

/**
 * Circuit breaker implementation for external service calls
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;
  private readonly options: Required<CircuitBreakerOptions>;
  
  constructor(
    private readonly serviceName: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }
  
  /**
   * Executes a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        logger.warn('Circuit breaker is OPEN, rejecting request', {
          service: this.serviceName,
          nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
        });
        throw new ExternalServiceError(
          `Service ${this.serviceName} is currently unavailable (circuit breaker OPEN)`,
          this.serviceName
        );
      }
      
      // Try to recover
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info('Circuit breaker entering HALF_OPEN state', {
        service: this.serviceName,
      });
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Executes function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new ResourceError('Operation timeout', { timeout: this.options.timeout })),
          this.options.timeout
        )
      ),
    ]);
  }
  
  /**
   * Handles successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker closed', { service: this.serviceName });
      }
    }
  }
  
  /**
   * Handles failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
      logger.warn('Circuit breaker opened from HALF_OPEN', {
        service: this.serviceName,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      });
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
      logger.warn('Circuit breaker opened', {
        service: this.serviceName,
        failureCount: this.failureCount,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      });
    }
  }
  
  /**
   * Gets current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Resets circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
    logger.info('Circuit breaker manually reset', { service: this.serviceName });
  }
}

// ============================================================================
// Global Circuit Breakers
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Gets or creates a circuit breaker for a service
 */
export function getCircuitBreaker(
  serviceName: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, options));
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Executes a function with both retry logic and circuit breaker protection
 */
export async function withRetryAndCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
  circuitOptions?: CircuitBreakerOptions
): Promise<T> {
  const circuitBreaker = getCircuitBreaker(serviceName, circuitOptions);
  
  return withRetry(
    () => circuitBreaker.execute(fn),
    retryOptions
  );
}

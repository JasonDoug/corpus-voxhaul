// Unit tests for retry logic and circuit breaker
import { withRetry, CircuitBreaker, CircuitState, getCircuitBreaker } from './retry';
import { ExternalServiceError, ResourceError } from './errors';

// Mock logger to avoid console output during tests
jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on transient failures', async () => {
      const error1: any = new Error('Connection timeout');
      error1.code = 'ETIMEDOUT';
      const error2: any = new Error('Connection reset');
      error2.code = 'ECONNRESET';
      
      const fn = jest.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should throw after max attempts', async () => {
      const error: any = new Error('Connection timeout');
      error.code = 'ETIMEDOUT';
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should not retry non-retryable errors', async () => {
      const error: any = new Error('Not retryable');
      error.retryable = false;
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should respect retryable flag on errors', async () => {
      const retryableError = new ExternalServiceError('Service down', 'test-service');
      const fn = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await withRetry(fn, { 
        maxAttempts: 3, 
        initialDelayMs: 100,
        backoffMultiplier: 2 
      });
      const endTime = Date.now();
      
      // Should have waited at least 100ms + 200ms = 300ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(250);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker('test-service');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
    
    it('should execute function successfully in CLOSED state', async () => {
      const breaker = new CircuitBreaker('test-service');
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
    
    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker('test-service', { 
        failureThreshold: 3,
        resetTimeoutMs: 1000 
      });
      const fn = jest.fn().mockRejectedValue(new Error('Service down'));
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }
      
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should reject requests when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker('test-service', { 
        failureThreshold: 2,
        resetTimeoutMs: 10000 
      });
      const fn = jest.fn().mockRejectedValue(new Error('Service down'));
      
      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      
      // Next request should be rejected without calling fn
      await expect(breaker.execute(fn)).rejects.toThrow(ExternalServiceError);
      expect(fn).toHaveBeenCalledTimes(2); // Not called the third time
    });
    
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker('test-service', { 
        failureThreshold: 2,
        resetTimeoutMs: 100 
      });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Next request should transition to HALF_OPEN and succeed
      const result = await breaker.execute(fn);
      expect(result).toBe('success');
    });
    
    it('should close circuit after success threshold in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker('test-service', { 
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100 
      });
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success 1')
        .mockResolvedValueOnce('success 2');
      
      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Succeed twice to close circuit
      await breaker.execute(fn);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      await breaker.execute(fn);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
    
    it('should timeout long-running operations', async () => {
      const breaker = new CircuitBreaker('test-service', { timeout: 100 });
      const fn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('too slow'), 200))
      );
      
      await expect(breaker.execute(fn)).rejects.toThrow(ResourceError);
      await expect(breaker.execute(fn)).rejects.toThrow(/timeout/);
    });
    
    it('should reset circuit manually', async () => {
      const breaker = new CircuitBreaker('test-service', { failureThreshold: 2 });
      const fn = jest.fn().mockRejectedValue(new Error('Fail'));
      
      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
      
      // Reset manually
      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });
  
  describe('getCircuitBreaker', () => {
    it('should return same instance for same service name', () => {
      const breaker1 = getCircuitBreaker('test-service');
      const breaker2 = getCircuitBreaker('test-service');
      
      expect(breaker1).toBe(breaker2);
    });
    
    it('should return different instances for different service names', () => {
      const breaker1 = getCircuitBreaker('service-1');
      const breaker2 = getCircuitBreaker('service-2');
      
      expect(breaker1).not.toBe(breaker2);
    });
  });
});

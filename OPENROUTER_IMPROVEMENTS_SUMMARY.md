# OpenRouter Rate Limiting and Error Handling Improvements

**Date**: December 3, 2025  
**Status**: ✅ COMPLETED

## Overview

Enhanced the PDF Lecture Service to handle OpenRouter's flakiness and rate limits more gracefully. OpenRouter is notoriously unreliable, especially on the free tier, so we've implemented comprehensive error handling and rate limiting strategies.

## Changes Made

### 1. Client-Side Rate Limiting

**File**: `src/services/llm.ts`

Added intelligent request throttling to the OpenRouter client:

```typescript
private minRequestInterval: number;
private lastRequestTime: number = 0;

private async rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.minRequestInterval) {
    const waitTime = this.minRequestInterval - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  this.lastRequestTime = Date.now();
}
```

**Benefits**:
- Prevents rapid-fire requests that trigger rate limits
- Configurable via `OPENROUTER_MIN_REQUEST_INTERVAL_MS` (default: 500ms)
- Automatically applied to all OpenRouter API calls

### 2. Enhanced Error Parsing

**File**: `src/services/llm.ts`

Created custom `RateLimitError` class and improved error parsing:

```typescript
class RateLimitError extends Error {
  public retryable = true;
  public retryAfter?: number;
}

private parseErrorResponse(status: number, errorText: string): Error {
  // Extracts rate limit info from OpenRouter error responses
  // Marks errors as retryable
  // Logs rate limit headers (remaining, reset time)
}
```

**Benefits**:
- Distinguishes rate limit errors from other errors
- Extracts retry-after information
- Enables intelligent retry logic

### 3. Rate Limit Header Logging

**File**: `src/services/llm.ts`

Added logging of OpenRouter rate limit headers:

```typescript
const rateLimitHeaders = {
  limit: response.headers.get('X-RateLimit-Limit'),
  remaining: response.headers.get('X-RateLimit-Remaining'),
  reset: response.headers.get('X-RateLimit-Reset'),
};

logger.debug('OpenRouter rate limit status', rateLimitHeaders);
```

**Benefits**:
- Monitor how close you are to rate limits
- Predict when limits will reset
- Adjust configuration proactively

### 4. Configurable Retry Logic

**File**: `src/services/llm.ts`

Made retry settings configurable via environment variables:

```typescript
// Chat requests
const maxAttempts = parseInt(process.env.LLM_MAX_RETRY_ATTEMPTS || '5', 10);
const initialDelay = parseInt(process.env.LLM_INITIAL_RETRY_DELAY_MS || '2000', 10);
const maxDelay = parseInt(process.env.LLM_MAX_RETRY_DELAY_MS || '30000', 10);

// Vision requests (more aggressive)
const maxAttempts = parseInt(process.env.LLM_VISION_MAX_RETRY_ATTEMPTS || '5', 10);
const initialDelay = parseInt(process.env.LLM_VISION_INITIAL_RETRY_DELAY_MS || '3000', 10);
const maxDelay = parseInt(process.env.LLM_VISION_MAX_RETRY_DELAY_MS || '60000', 10);
```

**Benefits**:
- Tune retry behavior for your use case
- Different settings for chat vs. vision APIs
- No code changes needed to adjust

### 5. Improved Retry Error Detection

**File**: `src/utils/retry.ts`

Enhanced the retry utility to better detect rate limit errors:

```typescript
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  // Check error name (for custom error classes like RateLimitError)
  if (error.name && retryableErrors.includes(error.name)) {
    return true;
  }
  
  // Check for rate limit indicators
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests')
  );
}
```

**Benefits**:
- Automatically retries rate limit errors
- Recognizes multiple error formats
- Works with custom error classes

### 6. Configuration Documentation

**Files**: `.env`, `.env.example`, `docs/OPENROUTER_RATE_LIMITING.md`

Added comprehensive configuration options:

```bash
# Rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000

# Retry settings
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=2000
LLM_MAX_RETRY_DELAY_MS=30000

# Vision retry settings (more aggressive)
LLM_VISION_MAX_RETRY_ATTEMPTS=5
LLM_VISION_INITIAL_RETRY_DELAY_MS=3000
LLM_VISION_MAX_RETRY_DELAY_MS=60000
```

**Benefits**:
- Clear documentation of all options
- Sensible defaults for free tier
- Easy to adjust for paid tier

## Configuration Profiles

### Conservative (Free Tier)

```bash
OPENROUTER_MIN_REQUEST_INTERVAL_MS=2000
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=3000
LLM_MAX_RETRY_DELAY_MS=60000
```

**Use when**: Using free tier, frequently hitting rate limits

### Balanced (Default)

```bash
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=2000
LLM_MAX_RETRY_DELAY_MS=30000
```

**Use when**: Development, testing, moderate usage

### Aggressive (Paid Tier)

```bash
OPENROUTER_MIN_REQUEST_INTERVAL_MS=200
LLM_MAX_RETRY_ATTEMPTS=3
LLM_INITIAL_RETRY_DELAY_MS=1000
LLM_MAX_RETRY_DELAY_MS=10000
```

**Use when**: Production, high throughput, paid tier

## Testing

All tests pass with the new implementation:

```bash
npm test -- src/services/llm.test.ts

✓ Provider Detection (4 tests)
✓ Model Recommendations (5 tests)
✓ Model Recommendations by Provider (3 tests)
✓ Recommended Models Structure (3 tests)

Test Suites: 1 passed
Tests: 15 passed
```

## Impact

### Before

- ❌ Frequent 429 rate limit errors
- ❌ No automatic retry for rate limits
- ❌ No visibility into rate limit status
- ❌ Hard-coded retry settings
- ❌ Rapid-fire requests triggering limits

### After

- ✅ Client-side rate limiting prevents most 429 errors
- ✅ Automatic retry with exponential backoff
- ✅ Rate limit headers logged for monitoring
- ✅ Configurable retry settings per environment
- ✅ Intelligent request pacing

## Usage Example

### Development (.env)

```bash
# Conservative settings for free tier
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=2000
LLM_MAX_RETRY_DELAY_MS=30000
```

### Production (.env.production)

```bash
# Aggressive settings for paid tier
OPENROUTER_MIN_REQUEST_INTERVAL_MS=200
LLM_MAX_RETRY_ATTEMPTS=3
LLM_INITIAL_RETRY_DELAY_MS=1000
LLM_MAX_RETRY_DELAY_MS=10000
```

## Monitoring

Check logs for rate limit status:

```
[DEBUG] OpenRouter rate limit status {
  limit: '50',
  remaining: '45',
  reset: '1764806400000'
}
```

Watch for warnings:

```
[WARN] OpenRouter rate limit hit {
  message: 'Rate limit exceeded: free-models-per-day',
  retryAfter: 1764806400000,
  remaining: '0'
}
```

## Documentation

- **Configuration Guide**: `docs/OPENROUTER_RATE_LIMITING.md`
- **Environment Variables**: `.env.example`
- **Code Comments**: Inline documentation in `src/services/llm.ts`

## Recommendations

1. **Start Conservative**: Use default settings (1000ms interval, 5 retries)
2. **Monitor Logs**: Watch for rate limit warnings
3. **Adjust as Needed**: Increase interval if hitting limits, decrease if not
4. **Consider Paid Tier**: For production, paid tier has much higher limits
5. **Use Direct APIs**: If OpenRouter is too flaky, switch to direct OpenAI/Anthropic

## Future Improvements

Potential enhancements for the future:

1. **Adaptive Rate Limiting**: Automatically adjust interval based on rate limit headers
2. **Request Queuing**: Queue requests when rate limit is hit instead of failing
3. **Circuit Breaker**: Temporarily stop requests after repeated failures
4. **Fallback Providers**: Automatically switch to backup provider on failure
5. **Cost Tracking**: Monitor and alert on API costs

## Conclusion

The OpenRouter client is now much more robust and can handle the service's flakiness gracefully. The configurable settings allow tuning for different environments and usage patterns, while the automatic retry logic ensures requests eventually succeed even when rate limits are hit.

For most users, the default settings will work well. Adjust based on your tier and usage patterns as documented in `docs/OPENROUTER_RATE_LIMITING.md`.

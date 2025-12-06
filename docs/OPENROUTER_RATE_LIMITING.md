# OpenRouter Rate Limiting and Error Handling

## Overview

OpenRouter is a unified API gateway that provides access to multiple LLM providers (OpenAI, Anthropic, Google, Meta, etc.). While convenient, it can be flaky and has strict rate limits, especially on the free tier.

This document explains how the PDF Lecture Service handles OpenRouter's rate limits and provides configuration options for optimal performance.

## Rate Limiting Strategy

### 1. Request Throttling

The service implements client-side rate limiting to avoid hitting API limits:

```typescript
// Minimum interval between requests (configurable)
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000  // 1 second between requests
```

**How it works:**
- Before each API call, the client checks when the last request was made
- If insufficient time has passed, it waits before making the next request
- This prevents rapid-fire requests that trigger rate limits

**Configuration:**
- **Free tier**: Set to `1000ms` (1 second) or higher
- **Paid tier**: Can reduce to `500ms` or `200ms` depending on your limits
- **Heavy usage**: Increase to `2000ms` (2 seconds) if you're still hitting limits

### 2. Exponential Backoff Retry

When rate limits are hit, the service automatically retries with exponential backoff:

```typescript
LLM_MAX_RETRY_ATTEMPTS=5              // Try up to 5 times
LLM_INITIAL_RETRY_DELAY_MS=2000       // Start with 2 second delay
LLM_MAX_RETRY_DELAY_MS=30000          // Max 30 second delay
```

**Retry sequence:**
1. First retry: Wait 2 seconds
2. Second retry: Wait 4 seconds
3. Third retry: Wait 8 seconds
4. Fourth retry: Wait 16 seconds
5. Fifth retry: Wait 30 seconds (capped at max)

### 3. Vision API Special Handling

Vision APIs are more prone to rate limits, so they have separate, more aggressive settings:

```typescript
LLM_VISION_MAX_RETRY_ATTEMPTS=5           // Try up to 5 times
LLM_VISION_INITIAL_RETRY_DELAY_MS=3000    // Start with 3 second delay
LLM_VISION_MAX_RETRY_DELAY_MS=60000       // Max 60 second delay (1 minute)
```

## Error Types

### Rate Limit Errors (429)

**Symptoms:**
```
OpenRouter API error: 429 - Rate limit exceeded: free-models-per-day
```

**Handling:**
- Automatically marked as retryable
- Exponential backoff applied
- Logs include rate limit headers (remaining requests, reset time)

**Solutions:**
1. Increase `OPENROUTER_MIN_REQUEST_INTERVAL_MS`
2. Use paid tier for higher limits
3. Switch to direct API keys (OpenAI, Anthropic) instead of OpenRouter

### Connection Errors

**Symptoms:**
```
ECONNRESET, ETIMEDOUT, ECONNREFUSED
```

**Handling:**
- Automatically retried
- Exponential backoff applied
- Logged with full error details

### Timeout Errors

**Symptoms:**
```
Operation timeout
```

**Handling:**
- Automatically retried
- Configurable timeout per operation
- Separate timeouts for analysis vs. audio synthesis

## Configuration Guide

### Conservative (Free Tier, Avoid Rate Limits)

```bash
# Rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=2000  # 2 seconds between requests

# Retry settings
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=3000
LLM_MAX_RETRY_DELAY_MS=60000

# Vision retry settings
LLM_VISION_MAX_RETRY_ATTEMPTS=5
LLM_VISION_INITIAL_RETRY_DELAY_MS=5000
LLM_VISION_MAX_RETRY_DELAY_MS=120000
```

**Use when:**
- Using free tier
- Frequently hitting rate limits
- Processing non-urgent PDFs
- Running batch jobs overnight

### Balanced (Default)

```bash
# Rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000  # 1 second between requests

# Retry settings
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=2000
LLM_MAX_RETRY_DELAY_MS=30000

# Vision retry settings
LLM_VISION_MAX_RETRY_ATTEMPTS=5
LLM_VISION_INITIAL_RETRY_DELAY_MS=3000
LLM_VISION_MAX_RETRY_DELAY_MS=60000
```

**Use when:**
- Using free tier with moderate usage
- Development and testing
- Single PDF processing

### Aggressive (Paid Tier)

```bash
# Rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=200  # 200ms between requests

# Retry settings
LLM_MAX_RETRY_ATTEMPTS=3
LLM_INITIAL_RETRY_DELAY_MS=1000
LLM_MAX_RETRY_DELAY_MS=10000

# Vision retry settings
LLM_VISION_MAX_RETRY_ATTEMPTS=3
LLM_VISION_INITIAL_RETRY_DELAY_MS=1000
LLM_VISION_MAX_RETRY_DELAY_MS=20000
```

**Use when:**
- Using paid tier with high limits
- Production environment
- Real-time processing requirements
- High throughput needed

## Monitoring Rate Limits

The service logs rate limit information from OpenRouter headers:

```typescript
logger.debug('OpenRouter rate limit status', {
  limit: '50',           // Total requests allowed
  remaining: '45',       // Requests remaining
  reset: '1764806400000' // Unix timestamp when limit resets
});
```

**Watch for:**
- `remaining` approaching 0
- Frequent 429 errors in logs
- Long retry delays

## Best Practices

### 1. Use Free Models Wisely

Free models have stricter rate limits. The service uses these by default:

```bash
LLM_MODEL_VISION=google/gemini-2.0-flash-exp:free
LLM_MODEL_SEGMENTATION=x-ai/grok-4.1-fast:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free
```

**Tips:**
- Process PDFs during off-peak hours
- Batch process multiple PDFs with delays between them
- Consider upgrading to paid models for production

### 2. Monitor Your Usage

Check OpenRouter dashboard regularly:
- Daily request count
- Rate limit status
- Cost per request (if using paid models)

### 3. Implement Graceful Degradation

If rate limits are consistently hit:
1. Queue PDFs for later processing
2. Notify users of delays
3. Implement job prioritization
4. Consider switching to direct API keys

### 4. Test with Conservative Settings

Always test with conservative rate limiting first:
```bash
OPENROUTER_MIN_REQUEST_INTERVAL_MS=2000
```

Then gradually reduce if you're not hitting limits.

## Troubleshooting

### Problem: Constant 429 Errors

**Solutions:**
1. Increase `OPENROUTER_MIN_REQUEST_INTERVAL_MS` to 2000 or 3000
2. Check OpenRouter dashboard for daily limits
3. Wait for rate limit reset (check `X-RateLimit-Reset` header)
4. Switch to paid tier or direct API keys

### Problem: Slow Processing

**Solutions:**
1. Reduce retry delays if you're not hitting rate limits
2. Reduce `OPENROUTER_MIN_REQUEST_INTERVAL_MS` if you have headroom
3. Use faster models (e.g., GPT-3.5 instead of GPT-4)
4. Enable parallel processing (if supported)

### Problem: Intermittent Failures

**Solutions:**
1. Increase `LLM_MAX_RETRY_ATTEMPTS` to 5 or more
2. Increase `LLM_MAX_RETRY_DELAY_MS` to allow longer waits
3. Check OpenRouter status page for outages
4. Implement fallback to alternative providers

## Alternative: Direct API Keys

If OpenRouter is too flaky, use direct API keys:

```bash
# Disable OpenRouter
OPENROUTER_API_KEY=

# Use direct OpenAI
OPENAI_API_KEY=your_openai_key
LLM_PROVIDER=openai

# Or use direct Anthropic
ANTHROPIC_API_KEY=your_anthropic_key
LLM_PROVIDER=anthropic
```

**Pros:**
- More reliable
- Better rate limits
- Direct support

**Cons:**
- Need separate keys for each provider
- Can't easily switch between models
- May be more expensive

## Summary

The PDF Lecture Service implements comprehensive rate limiting and error handling for OpenRouter:

✅ **Client-side rate limiting** - Prevents hitting API limits  
✅ **Exponential backoff retry** - Handles transient failures  
✅ **Configurable settings** - Tune for your use case  
✅ **Detailed logging** - Monitor rate limit status  
✅ **Graceful degradation** - Continues working despite errors  

For most users, the default settings work well. Adjust based on your tier and usage patterns.

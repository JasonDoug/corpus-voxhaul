# LLM Integration Monitoring Guide

This document describes the monitoring and observability features for LLM API calls in the PDF Lecture Service.

## Overview

The system tracks comprehensive metrics for all LLM API calls, including:
- API success/failure rates
- Response times
- Token usage (prompt, completion, and total)
- Estimated costs per call and per PDF
- Correlation IDs for request tracing

## Metrics Tracked

### Per-Call Metrics

For each LLM API call, the following metrics are recorded:

1. **Success/Failure Count**
   - Metric: `LLMCallSuccess` or `LLMCallFailure`
   - Dimensions: operation, model, provider, success status
   - Use: Track API reliability

2. **Response Time**
   - Metric: `LLMCallDuration`
   - Unit: Milliseconds
   - Dimensions: operation, model, provider
   - Use: Monitor API performance

3. **Token Usage**
   - Metrics: `LLMPromptTokens`, `LLMCompletionTokens`, `LLMTotalTokens`
   - Unit: Count
   - Dimensions: operation, model, provider
   - Use: Track API consumption

4. **Cost**
   - Metric: `LLMCallCostCents`
   - Unit: Cents (USD)
   - Dimensions: operation, model, provider
   - Use: Monitor spending

### Per-Job Metrics

For each PDF processing job, aggregate metrics are tracked:

1. **Total LLM Calls**
   - Metric: `JobLLMCalls`
   - Dimensions: jobId
   
2. **Total Tokens Used**
   - Metric: `JobLLMTokens`
   - Dimensions: jobId
   
3. **Total Cost**
   - Metric: `JobLLMCostCents`
   - Dimensions: jobId

## Operations Tracked

The system tracks metrics for these LLM operations:

1. **Segmentation** (`segmentation`)
   - Analyzes PDF content and creates logical topic segments
   - Typically 1 call per PDF
   - Model: Claude 3 Opus (recommended)

2. **Script Generation** (`script_generation`)
   - Generates lecture scripts with personality
   - Typically 3-5 calls per PDF (one per segment)
   - Model: GPT-4 Turbo (recommended)

3. **Vision Analysis** (`vision_analysis`)
   - Analyzes figures and generates descriptions
   - Variable calls per PDF (depends on figure count)
   - Model: GPT-4 Vision (recommended)

4. **Chat** (`chat`)
   - Generic LLM chat calls
   - Used for table/formula interpretation

## Structured Logging

All LLM requests include structured logging with:

### Correlation IDs

Each LLM request is assigned a correlation ID for tracing:

```
segmentation: seg-{jobId}-{uuid}
script generation: script-{jobId}-{uuid}
  └─ per segment: script-{jobId}-{uuid}-seg{index}
vision analysis: {correlationId}-fig-{figureId}
```

### Log Fields

Every LLM log entry includes:

- `correlationId`: Unique request identifier
- `operation`: Type of LLM operation
- `model`: Model used
- `provider`: API provider (openai, anthropic, openrouter)
- `duration`: Response time in milliseconds
- `tokensUsed`: Total tokens consumed
- `promptTokens`: Input tokens
- `completionTokens`: Output tokens

### Error Logging

Failed LLM calls include:

- `errorType`: Categorized error (API_ERROR, JSON_PARSE_ERROR, etc.)
- `errorMessage`: Human-readable error description
- `errorStack`: Full stack trace for debugging

## Cost Estimation

The system estimates costs based on current model pricing:

### Model Pricing (per 1M tokens)

| Model | Input | Output |
|-------|-------|--------|
| GPT-4 Turbo | $10.00 | $30.00 |
| GPT-4 Vision | $10.00 | $30.00 |
| GPT-3.5 Turbo | $0.50 | $1.50 |
| Claude 3 Opus | $15.00 | $75.00 |
| Claude 3 Sonnet | $3.00 | $15.00 |
| Claude 3 Haiku | $0.25 | $1.25 |

### Typical PDF Costs

Based on a 10-page scientific paper:

- **Segmentation**: $0.01-0.05 (1 call)
- **Script Generation**: $0.05-0.15 (3-5 calls)
- **Vision Analysis**: $0.01-0.03 per figure
- **Total**: $0.10-0.30 per PDF

## Usage Examples

### Tracking Job-Level Metrics

```typescript
import { JobLLMMetrics } from '../utils/llm-metrics';

async function processJob(jobId: string) {
  const jobMetrics = new JobLLMMetrics(jobId);
  
  // Process segments...
  // Metrics are automatically recorded via recordLLMCallMetrics
  
  // Log final summary
  jobMetrics.logSummary();
  // Output: {
  //   jobId: 'job-123',
  //   totalCalls: 5,
  //   totalTokens: 12500,
  //   totalCost: 0.25,
  //   costFormatted: '$0.2500',
  //   callsByOperation: {
  //     segmentation: 1,
  //     script_generation: 4
  //   }
  // }
}
```

### Calculating Success Rate

```typescript
import { calculateLLMSuccessRate } from '../utils/llm-metrics';

const successRate = calculateLLMSuccessRate(95, 5); // 95%
```

### Manual Metric Recording

```typescript
import { recordLLMCallMetrics } from '../utils/llm-metrics';

recordLLMCallMetrics({
  operation: 'custom_operation',
  model: 'gpt-4-turbo-preview',
  provider: 'openai',
  promptTokens: 1000,
  completionTokens: 500,
  totalTokens: 1500,
  durationMs: 2000,
  success: true,
});
```

## Monitoring in Production

### CloudWatch Integration

In production (`NODE_ENV=production`), metrics are automatically published to CloudWatch:

1. **Metric Namespace**: `PDFLectureService/LLM`
2. **Dimensions**: operation, model, provider, success
3. **Retention**: 15 months (CloudWatch default)

### Recommended Alarms

Set up CloudWatch alarms for:

1. **High Error Rate**
   - Metric: `LLMCallFailure`
   - Threshold: > 5% of total calls
   - Action: Alert operations team

2. **High Latency**
   - Metric: `LLMCallDuration`
   - Threshold: > 10 seconds (p99)
   - Action: Investigate API performance

3. **High Cost**
   - Metric: `JobLLMCostCents`
   - Threshold: > 50 cents per job
   - Action: Review token usage optimization

4. **Token Limit Approaching**
   - Metric: `LLMTotalTokens`
   - Threshold: > 100k tokens per job
   - Action: Check for prompt optimization opportunities

## Feature Flags

Control LLM integration rollout with feature flags:

```bash
# Enable/disable real LLM calls
ENABLE_REAL_SEGMENTATION=true
ENABLE_REAL_SCRIPT_GENERATION=true
ENABLE_IMAGE_EXTRACTION=true
```

When disabled, the system uses mock implementations that return placeholder data without making API calls.

## Debugging

### Finding Requests by Correlation ID

All logs include correlation IDs. To trace a specific request:

```bash
# Search CloudWatch Logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service \
  --filter-pattern "seg-job-123-abc"
```

### Analyzing Token Usage

To identify high token usage:

```typescript
// Check logs for high token counts
logger.info('High token usage detected', {
  correlationId: 'seg-job-123-abc',
  tokensUsed: 15000,
  promptLength: 50000,
  model: 'gpt-4-turbo-preview'
});
```

### Cost Analysis

Review job-level costs:

```bash
# Query CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace PDFLectureService/LLM \
  --metric-name JobLLMCostCents \
  --dimensions Name=jobId,Value=job-123 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Best Practices

1. **Always use correlation IDs** for request tracing
2. **Monitor costs regularly** to avoid surprises
3. **Set up alarms** for error rates and latency
4. **Review token usage** to optimize prompts
5. **Use feature flags** for gradual rollout
6. **Log errors with full context** for debugging
7. **Track success rates** by operation and model

## Troubleshooting

### High Costs

If costs are higher than expected:

1. Check token usage per operation
2. Review prompt lengths (may be too verbose)
3. Consider using cheaper models for non-critical operations
4. Implement caching for repeated requests

### High Error Rates

If error rates increase:

1. Check API provider status
2. Review error types in logs
3. Verify API keys are valid
4. Check rate limits
5. Review retry logic

### Slow Response Times

If response times are slow:

1. Check API provider latency
2. Review prompt complexity
3. Consider parallel processing
4. Check network connectivity
5. Review timeout settings

## Related Documentation

- [API Implementation Status](./IMPLEMENTATION_STATUS.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [User Guide](./USER_GUIDE.md)

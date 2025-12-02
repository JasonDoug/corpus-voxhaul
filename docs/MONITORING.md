# Monitoring and Logging Guide

This document describes the monitoring and logging infrastructure for the PDF Lecture Service.

## Overview

The service implements comprehensive monitoring and logging with:
- **Structured JSON logging** with correlation IDs and log levels
- **Metrics collection** for request counts, error rates, processing times, and storage usage
- **CloudWatch integration** with log groups, metric filters, and alarms

## Structured Logging

### Log Levels

The logger supports four log levels:
- `ERROR` - Critical errors that require immediate attention
- `WARN` - Warning conditions that should be investigated
- `INFO` - Informational messages about normal operations
- `DEBUG` - Detailed debugging information

Set the minimum log level via environment variable:
```bash
export LOG_LEVEL=INFO  # Default
```

### Using the Logger

```typescript
import { logger } from '../utils/logger';

// Set correlation ID for request tracking
logger.setCorrelationId(requestId);
logger.setFunctionName('UploadFunction');

// Log messages with metadata
logger.info('Processing started', { jobId: '123', filename: 'paper.pdf' });
logger.warn('Retry attempt', { attempt: 2, maxAttempts: 3 });
logger.error('Processing failed', { error: error.message, stack: error.stack });
logger.debug('Detailed state', { state: complexObject });
```

### Sensitive Data Redaction

The logger automatically redacts sensitive fields matching these patterns:
- `password`, `secret`, `token`, `apikey`, `api_key`
- `authorization`, `auth`, `credential`
- `private_key`, `access_key`

Example:
```typescript
logger.info('User authenticated', {
  username: 'john',
  password: 'secret123',  // Will be redacted as [REDACTED]
  apiKey: 'abc123'        // Will be redacted as [REDACTED]
});
```

### Correlation IDs

Correlation IDs track requests across multiple functions:
```typescript
// In Lambda handler
const correlationId = event.requestContext?.requestId || randomUUID();
logger.setCorrelationId(correlationId);

// All subsequent logs will include this correlation ID
logger.info('Step 1 complete');
logger.info('Step 2 complete');
```

## Metrics Collection

### Recording Metrics

```typescript
import { metrics } from '../utils/metrics';

// Count metrics
metrics.recordCount('RequestCount', 1, { endpoint: 'upload' });
metrics.recordCount('ErrorCount', 1, { endpoint: 'upload', errorType: 'ValidationError' });

// Duration metrics
metrics.recordDuration('ProcessingTime', 1500, { stage: 'analysis' });

// Size metrics
metrics.recordSize('FileSize', 1024000, { type: 'pdf' });

// Rate metrics
metrics.recordRate('ErrorRate', 2.5, { endpoint: 'upload' });
```

### Using Timers

```typescript
// Start a timer
const timerId = metrics.startTimer('AnalysisDuration', { jobId: '123' });

// ... perform operation ...

// Stop timer and record duration
const duration = metrics.stopTimer(timerId);
```

### Helper Classes

#### RequestMetrics

Track request counts and error rates:
```typescript
import { RequestMetrics } from '../utils/metrics';

const requestMetrics = new RequestMetrics();

requestMetrics.incrementRequest('upload');
requestMetrics.incrementSuccess('upload');
requestMetrics.incrementError('upload', 'ValidationError');
requestMetrics.recordErrorRate('upload');
```

#### StageMetrics

Track processing stage metrics:
```typescript
import { StageMetrics } from '../utils/metrics';

const stageMetrics = new StageMetrics();

stageMetrics.recordStageStart('analysis', jobId);
// ... process ...
stageMetrics.recordStageComplete('analysis', jobId, duration);
// or on error:
stageMetrics.recordStageFailed('analysis', jobId, 'LLMTimeout');
```

#### ExternalAPIMetrics

Track external API calls:
```typescript
import { ExternalAPIMetrics } from '../utils/metrics';

const apiMetrics = new ExternalAPIMetrics();

apiMetrics.recordAPICall('OpenAI', 'completion');
apiMetrics.recordAPILatency('OpenAI', 'completion', 1200);
apiMetrics.recordAPIError('OpenAI', 'completion', 'RateLimitExceeded');
```

#### StorageMetrics

Track storage operations:
```typescript
import { StorageMetrics } from '../utils/metrics';

const storageMetrics = new StorageMetrics();

storageMetrics.recordStorageWrite('S3', fileSize);
storageMetrics.recordStorageRead('DynamoDB', recordSize);
storageMetrics.recordStorageUsage('S3', totalBucketSize);
```

## CloudWatch Integration

### Log Groups

Each Lambda function has a dedicated CloudWatch log group:
- `/aws/lambda/UploadFunction`
- `/aws/lambda/AnalyzerFunction`
- `/aws/lambda/SegmenterFunction`
- `/aws/lambda/ScriptFunction`
- `/aws/lambda/AudioFunction`
- `/aws/lambda/StatusFunction`

Logs are retained for 30 days.

### Metric Filters

Metric filters extract metrics from structured logs:
- `UploadErrors` - Counts ERROR level logs in upload function
- `AnalyzerErrors` - Counts ERROR level logs in analyzer function
- `SegmenterErrors` - Counts ERROR level logs in segmenter function
- `ScriptErrors` - Counts ERROR level logs in script function
- `AudioErrors` - Counts ERROR level logs in audio function

### CloudWatch Alarms

Pre-configured alarms:

#### High Error Rate Alarm
- **Metric**: Lambda Errors
- **Threshold**: > 5 errors in 5 minutes
- **Action**: Alert when error rate exceeds threshold

#### Function Timeout Alarms
- **Upload**: Alert when duration > 55 seconds (90% of 60s timeout)
- **Analyzer**: Alert when duration > 290 seconds (90% of 300s timeout)
- **Audio**: Alert when duration > 590 seconds (90% of 600s timeout)

### Publishing Metrics to CloudWatch

Metrics are automatically published to CloudWatch in production:

```typescript
import { publishMetric, publishMetrics } from '../utils/cloudwatch';

// Publish single metric
await publishMetric({
  name: 'CustomMetric',
  value: 42,
  unit: 'Count',
  dimensions: { Environment: 'production' },
});

// Publish multiple metrics
await publishMetrics([
  { name: 'Metric1', value: 10, unit: 'Count' },
  { name: 'Metric2', value: 20, unit: 'Milliseconds' },
]);
```

### Creating Custom Alarms

```typescript
import { createAlarm, createStandardAlarmsForFunction } from '../utils/cloudwatch';

// Create a custom alarm
await createAlarm({
  alarmName: 'HighLatency',
  metricName: 'ProcessingTime',
  threshold: 5000,
  comparisonOperator: 'GreaterThanThreshold',
  evaluationPeriods: 2,
  period: 300,
  statistic: 'Average',
  dimensions: { Stage: 'analysis' },
});

// Create standard alarms for a function
await createStandardAlarmsForFunction('MyFunction', 60000);
```

## Best Practices

### 1. Always Set Correlation IDs

```typescript
export async function handler(event: any) {
  const correlationId = event.requestContext?.requestId || randomUUID();
  logger.setCorrelationId(correlationId);
  // ... rest of handler
}
```

### 2. Use Timers for Performance Tracking

```typescript
const timerId = metrics.startTimer('OperationName');
try {
  await performOperation();
} finally {
  metrics.stopTimer(timerId);
}
```

### 3. Track Both Success and Failure

```typescript
try {
  await operation();
  metrics.recordCount('OperationSuccess', 1);
} catch (error) {
  metrics.recordCount('OperationFailure', 1, { errorType: error.name });
  throw error;
}
```

### 4. Add Dimensions for Filtering

```typescript
// Good - allows filtering by endpoint and error type
metrics.recordCount('ErrorCount', 1, {
  endpoint: 'upload',
  errorType: 'ValidationError',
});

// Less useful - no context
metrics.recordCount('ErrorCount', 1);
```

### 5. Log at Appropriate Levels

```typescript
// ERROR - for failures requiring attention
logger.error('Failed to process job', { jobId, error });

// WARN - for recoverable issues
logger.warn('Retry attempt', { attempt: 2 });

// INFO - for normal operations
logger.info('Job completed', { jobId, duration });

// DEBUG - for detailed debugging (disabled in production)
logger.debug('Internal state', { state });
```

## Viewing Logs and Metrics

### CloudWatch Logs Insights

Query logs using CloudWatch Logs Insights:

```sql
# Find all errors in the last hour
fields @timestamp, message, metadata.error
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

# Track a specific job by correlation ID
fields @timestamp, message, function
| filter correlationId = "abc-123"
| sort @timestamp asc

# Calculate average processing time
fields @timestamp, metadata.metric.value as duration
| filter metadata.metric.name = "StageDuration"
| stats avg(duration) by metadata.metric.dimensions.stage
```

### CloudWatch Metrics

View metrics in CloudWatch console:
- Namespace: `PDFLectureService`
- Dimensions: `endpoint`, `stage`, `jobId`, `errorType`, etc.

### CloudWatch Dashboards

Create custom dashboards to visualize:
- Request rates and error rates
- Processing times per stage
- External API latency
- Storage usage trends

## Local Development

In local mode, metrics are logged but not published to CloudWatch:

```bash
export NODE_ENV=development
export LOG_LEVEL=DEBUG

# To test CloudWatch integration locally with LocalStack
export USE_LOCALSTACK=true
export LOCALSTACK_ENDPOINT=http://localhost:4566
```

## Troubleshooting

### Logs Not Appearing in CloudWatch

1. Check IAM permissions for Lambda execution role
2. Verify log group exists: `/aws/lambda/<FunctionName>`
3. Check function timeout - logs may not flush if function times out

### Metrics Not Publishing

1. Verify `NODE_ENV=production` in Lambda environment
2. Check IAM permissions for `cloudwatch:PutMetricData`
3. Review CloudWatch API throttling limits

### High CloudWatch Costs

1. Reduce log retention period (default: 30 days)
2. Lower log level in production (INFO instead of DEBUG)
3. Sample high-volume metrics instead of recording every occurrence
4. Use metric filters instead of custom metrics where possible

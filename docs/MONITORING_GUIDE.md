# Monitoring & Observability Guide

## 🎯 Overview

The PDF Lecture Service has comprehensive logging and metrics built in. This guide shows you where to find everything in AWS CloudWatch and how to interpret the data.

---

## 📊 What's Being Tracked

### 1. **Structured JSON Logs**
Every Lambda function outputs structured JSON logs with:
- Correlation IDs (track a single job through the entire pipeline)
- Log levels (ERROR, WARN, INFO, DEBUG)
- Timestamps
- Metadata (redacted for sensitive data)
- Function name and service name

### 2. **Custom Metrics**
- Request counts per endpoint
- Error rates and types
- Processing duration per stage
- LLM API calls, tokens, and costs
- External API latency
- Storage usage

### 3. **CloudWatch Alarms**
- High error rate (>5%)
- Function timeouts
- Processing failures

---

## 🔍 CloudWatch Log Groups

### Deployed Log Groups

```
/aws/lambda/pdf-lecture-service-UploadFunction-f1EN4kRje8U5
/aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5
/aws/lambda/pdf-lecture-service-SegmenterFunction-sPSIcFq12tHO
/aws/lambda/pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD
/aws/lambda/pdf-lecture-service-AudioFunction-XhEMVtD7LTkX
/aws/lambda/pdf-lecture-service-StatusFunction-aXfVCv8MVSeb
```

### How to Access

**Via AWS Console:**
1. Go to CloudWatch → Logs → Log groups
2. Search for `pdf-lecture-service`
3. Click on any log group to see logs

**Via AWS CLI:**
```bash
# List all log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/pdf-lecture-service \
  --region us-west-2

# Tail logs in real-time
aws logs tail /aws/lambda/pdf-lecture-service-UploadFunction-f1EN4kRje8U5 \
  --follow \
  --region us-west-2

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "ERROR" \
  --region us-west-2
```


---

## 🔎 Finding Logs for a Specific Job

### Using Correlation ID

Every job has a unique correlation ID that flows through all functions. To trace a job:

**Step 1: Get the job ID from upload**
```bash
# When you upload, you get a jobId
jobId="550e8400-e29b-41d4-a716-446655440000"
```

**Step 2: Search logs across all functions**
```bash
# Search UploadFunction
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-UploadFunction-f1EN4kRje8U5 \
  --filter-pattern "$jobId" \
  --region us-west-2

# Search AnalyzerFunction
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "$jobId" \
  --region us-west-2

# And so on for other functions...
```

**Step 3: Parse JSON logs**
```bash
# Get logs and parse with jq
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "$jobId" \
  --region us-west-2 \
  --query 'events[].message' \
  --output text | jq '.'
```

### Example Log Entry

```json
{
  "level": "INFO",
  "message": "Vision analysis completed for page",
  "timestamp": "2024-12-03T17:45:23.456Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "service": "pdf-lecture-service",
  "function": "AnalyzerFunction",
  "metadata": {
    "pageNumber": 1,
    "segmentsFound": 2,
    "processingTimeMs": 3245,
    "model": "nvidia/nemotron-nano-12b-v2-vl:free"
  }
}
```

---

## 📈 Custom Metrics

### Available Metrics

The system tracks these custom metrics in CloudWatch:

#### Request Metrics
- `RequestCount` - Total API requests
- `ErrorCount` - Failed requests
- `SuccessCount` - Successful requests
- `ErrorRate` - Percentage of failed requests

#### Stage Metrics
- `StageStarted` - When a pipeline stage begins
- `StageCompleted` - When a stage finishes
- `StageFailed` - When a stage fails
- `StageDuration` - How long each stage took

#### LLM Metrics
- `LLMCallSuccess` - Successful LLM API calls
- `LLMCallFailure` - Failed LLM API calls
- `LLMCallDuration` - Response time from LLM
- `LLMPromptTokens` - Input tokens used
- `LLMCompletionTokens` - Output tokens generated
- `LLMTotalTokens` - Total tokens
- `LLMCallCostCents` - Estimated cost in cents

#### Storage Metrics
- `StorageWrite` - Files written to S3
- `StorageRead` - Files read from S3
- `StorageWriteSize` - Bytes written
- `StorageReadSize` - Bytes read

### Viewing Metrics in Console

1. Go to CloudWatch → Metrics → All metrics
2. Select "PDFLectureService" namespace
3. Browse available metrics
4. Create graphs and dashboards

### Querying Metrics via CLI

```bash
# Get LLM call count for last hour
aws cloudwatch get-metric-statistics \
  --namespace PDFLectureService \
  --metric-name LLMCallSuccess \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2

# Get average processing duration
aws cloudwatch get-metric-statistics \
  --namespace PDFLectureService \
  --metric-name StageDuration \
  --dimensions Name=stage,Value=analysis \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average \
  --region us-west-2
```

---


## 🚨 CloudWatch Alarms

### Deployed Alarms

| Alarm Name | Metric | Threshold | Description |
|------------|--------|-----------|-------------|
| `pdf-lecture-service-HighErrorRate` | Errors | 5 | Triggers when error rate exceeds 5% |
| `pdf-lecture-service-UploadTimeout` | Duration | 55s | Upload function approaching timeout |
| `pdf-lecture-service-AnalyzerTimeout` | Duration | 290s | Analyzer function approaching timeout |
| `pdf-lecture-service-AudioTimeout` | Duration | 590s | Audio function approaching timeout |

### Viewing Alarms

**Via Console:**
1. Go to CloudWatch → Alarms
2. Filter by "pdf-lecture-service"
3. Click on any alarm to see details and history

**Via CLI:**
```bash
# List all alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix pdf-lecture-service \
  --region us-west-2

# Get alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name pdf-lecture-service-HighErrorRate \
  --region us-west-2 \
  --max-records 10
```

### Setting Up SNS Notifications

To get email alerts when alarms trigger:

```bash
# Create SNS topic
aws sns create-topic \
  --name pdf-lecture-service-alerts \
  --region us-west-2

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-west-2:456522530654:pdf-lecture-service-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-west-2

# Update alarm to use SNS topic
aws cloudwatch put-metric-alarm \
  --alarm-name pdf-lecture-service-HighErrorRate \
  --alarm-actions arn:aws:sns:us-west-2:456522530654:pdf-lecture-service-alerts \
  --region us-west-2
```

---

## 📊 Creating Custom Dashboards

### Recommended Dashboard Widgets

**1. Pipeline Health Overview**
- Request count (last hour)
- Error rate (last hour)
- Average processing time per stage
- Current alarm status

**2. LLM Usage Dashboard**
- LLM calls per operation
- Token usage over time
- Estimated costs
- Success rate by model

**3. Performance Dashboard**
- P50, P90, P99 latencies per function
- Concurrent executions
- Memory usage
- Cold start frequency

### Creating a Dashboard via Console

1. Go to CloudWatch → Dashboards → Create dashboard
2. Name it "PDF-Lecture-Service-Overview"
3. Add widgets:
   - **Line graph**: LLMCallSuccess over time
   - **Number**: Total jobs processed today
   - **Line graph**: StageDuration by stage
   - **Number**: Total LLM cost today

### Creating a Dashboard via CLI

```bash
# Create dashboard JSON
cat > dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["PDFLectureService", "LLMCallSuccess", {"stat": "Sum"}],
          [".", "LLMCallFailure", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-west-2",
        "title": "LLM API Calls"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["PDFLectureService", "StageDuration", {"stat": "Average", "dimensions": {"stage": "analysis"}}],
          ["...", {"dimensions": {"stage": "script_generation"}}],
          ["...", {"dimensions": {"stage": "audio_synthesis"}}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-west-2",
        "title": "Processing Time by Stage"
      }
    }
  ]
}
EOF

# Create the dashboard
aws cloudwatch put-dashboard \
  --dashboard-name PDF-Lecture-Service \
  --dashboard-body file://dashboard.json \
  --region us-west-2
```

---


## 🔍 Common Monitoring Queries

### Find All Errors in Last Hour

```bash
# Search all functions for errors
for log_group in $(aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/pdf-lecture-service \
  --region us-west-2 \
  --query 'logGroups[].logGroupName' \
  --output text); do
  
  echo "=== $log_group ==="
  aws logs filter-log-events \
    --log-group-name "$log_group" \
    --filter-pattern '{ $.level = "ERROR" }' \
    --start-time $(($(date +%s) - 3600))000 \
    --region us-west-2 \
    --query 'events[].message' \
    --output text | jq -r '.'
done
```

### Track a Job Through the Pipeline

```bash
#!/bin/bash
# track-job.sh - Follow a job through all stages

JOB_ID=$1

if [ -z "$JOB_ID" ]; then
  echo "Usage: ./track-job.sh <job-id>"
  exit 1
fi

echo "Tracking job: $JOB_ID"
echo "================================"

FUNCTIONS=(
  "UploadFunction-f1EN4kRje8U5"
  "AnalyzerFunction-WNQyG4ZdZZF5"
  "SegmenterFunction-sPSIcFq12tHO"
  "ScriptFunction-Y2WH8O7G1aOD"
  "AudioFunction-XhEMVtD7LTkX"
)

for func in "${FUNCTIONS[@]}"; do
  echo ""
  echo "--- $func ---"
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/pdf-lecture-service-$func" \
    --filter-pattern "$JOB_ID" \
    --region us-west-2 \
    --query 'events[].message' \
    --output text | jq -r 'select(.level == "INFO" or .level == "ERROR") | "\(.timestamp) [\(.level)] \(.message)"'
done
```

### Calculate Total LLM Cost for a Job

```bash
#!/bin/bash
# calculate-job-cost.sh - Sum up LLM costs for a job

JOB_ID=$1

echo "Calculating LLM costs for job: $JOB_ID"

# Search all functions for LLM cost metrics
total_cost=0

for log_group in $(aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/pdf-lecture-service \
  --region us-west-2 \
  --query 'logGroups[].logGroupName' \
  --output text); do
  
  costs=$(aws logs filter-log-events \
    --log-group-name "$log_group" \
    --filter-pattern "$JOB_ID" \
    --region us-west-2 \
    --query 'events[].message' \
    --output text | jq -r 'select(.message == "LLM call metrics recorded") | .metadata.estimatedCost' 2>/dev/null)
  
  for cost in $costs; do
    total_cost=$(echo "$total_cost + $cost" | bc)
  done
done

echo "Total LLM cost: \$$total_cost"
```

### Monitor Real-Time Processing

```bash
# Watch logs in real-time for all functions
aws logs tail /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --follow \
  --format short \
  --region us-west-2 \
  | jq -r 'select(.level == "INFO" or .level == "ERROR") | "\(.timestamp) [\(.level)] \(.message)"'
```

---

## 📉 Performance Analysis

### Identify Slow Operations

```bash
# Find slowest LLM calls
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern '{ $.message = "LLM call metrics recorded" }' \
  --start-time $(($(date +%s) - 86400))000 \
  --region us-west-2 \
  --query 'events[].message' \
  --output text \
  | jq -r 'select(.metadata.durationMs > 10000) | "\(.metadata.operation): \(.metadata.durationMs)ms"' \
  | sort -t: -k2 -n -r \
  | head -10
```

### Analyze Token Usage Patterns

```bash
# Get average tokens per operation
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD \
  --filter-pattern '{ $.message = "LLM call metrics recorded" }' \
  --start-time $(($(date +%s) - 86400))000 \
  --region us-west-2 \
  --query 'events[].message' \
  --output text \
  | jq -r '"\(.metadata.operation),\(.metadata.totalTokens)"' \
  | awk -F, '{sum[$1]+=$2; count[$1]++} END {for (op in sum) print op": "sum[op]/count[op]" avg tokens"}'
```

---

## 🎯 Key Metrics to Watch

### Daily Health Check

Monitor these metrics daily:

1. **Error Rate** - Should be < 1%
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
     --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 86400 \
     --statistics Sum \
     --region us-west-2
   ```

2. **Average Processing Time** - Should be < 60 seconds
3. **LLM Success Rate** - Should be > 95%
4. **Daily Cost** - Track spending trends

### Weekly Review

1. Analyze error patterns
2. Review slowest operations
3. Check for cost anomalies
4. Verify alarm configurations

---

## 🔧 Troubleshooting Common Issues

### Issue: High Error Rate

**Check:**
```bash
# Find most common errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern '{ $.level = "ERROR" }' \
  --start-time $(($(date +%s) - 3600))000 \
  --region us-west-2 \
  --query 'events[].message' \
  --output text \
  | jq -r '.message' \
  | sort | uniq -c | sort -rn | head -5
```

### Issue: Slow Processing

**Check:**
```bash
# Find bottleneck stages
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern '{ $.message = "Metric recorded" && $.metadata.metric.name = "StageDuration" }' \
  --start-time $(($(date +%s) - 3600))000 \
  --region us-west-2 \
  --query 'events[].message' \
  --output text \
  | jq -r '"\(.metadata.metric.dimensions.stage): \(.metadata.metric.value)ms"' \
  | awk '{sum[$1]+=$2; count[$1]++} END {for (stage in sum) print stage" "sum[stage]/count[stage]"ms avg"}' \
  | sort -k2 -n -r
```

### Issue: High LLM Costs

**Check:**
```bash
# Find most expensive operations
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD \
  --filter-pattern '{ $.message = "LLM call metrics recorded" }' \
  --start-time $(($(date +%s) - 86400))000 \
  --region us-west-2 \
  --query 'events[].message' \
  --output text \
  | jq -r '"\(.metadata.operation),\(.metadata.estimatedCost)"' \
  | awk -F, '{sum[$1]+=$2; count[$1]++} END {for (op in sum) print op": $"sum[op]" total, $"sum[op]/count[op]" avg"}' \
  | sort -t$ -k2 -n -r
```

---

## 📚 Additional Resources

- **CloudWatch Logs Insights**: Use for complex log queries
- **X-Ray Tracing**: Enable for detailed request tracing (not currently configured)
- **Lambda Insights**: Enable for enhanced Lambda metrics
- **Cost Explorer**: Track AWS spending by service

---

## 🎓 Best Practices

1. **Set up SNS notifications** for critical alarms
2. **Create a daily dashboard** for at-a-glance health
3. **Review logs weekly** for patterns and anomalies
4. **Track costs daily** to catch unexpected spikes
5. **Use correlation IDs** to trace jobs end-to-end
6. **Archive old logs** to S3 for cost savings (after 30 days)
7. **Set up log retention** policies (currently 30 days)

---

**Your monitoring infrastructure is ready!** All logs and metrics are flowing to CloudWatch automatically.

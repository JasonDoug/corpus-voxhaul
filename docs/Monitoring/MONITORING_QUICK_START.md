# Monitoring Quick Start

## 🚀 Quick Access to Your Logs & Metrics

### View Logs in AWS Console

**Fastest way:**
1. Go to: https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logsV2:log-groups
2. Search for: `pdf-lecture-service`
3. Click any function to see logs

### View Metrics in AWS Console

**Fastest way:**
1. Go to: https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#metricsV2:
2. Click "All metrics"
3. Look for "PDFLectureService" namespace (will appear after first job runs)

### View Alarms

**Fastest way:**
1. Go to: https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#alarmsV2:
2. Filter by: `pdf-lecture-service`

---

## 📊 What You'll See After Processing a Job

### In Logs (JSON format):

```json
{
  "level": "INFO",
  "message": "Vision analysis completed for page",
  "timestamp": "2024-12-03T17:45:23.456Z",
  "correlationId": "your-job-id-here",
  "function": "AnalyzerFunction",
  "metadata": {
    "pageNumber": 1,
    "segmentsFound": 2,
    "processingTimeMs": 3245,
    "model": "nvidia/nemotron-nano-12b-v2-vl:free",
    "tokensUsed": 1234,
    "estimatedCost": 0.0
  }
}
```

### In Metrics:

- **LLMCallSuccess**: Number of successful LLM API calls
- **LLMTotalTokens**: Tokens used
- **LLMCallCostCents**: Cost in cents
- **StageDuration**: Time per pipeline stage
- **RequestCount**: Total API requests

---

## 🔍 Quick Commands

### Tail logs in real-time:
```bash
aws logs tail /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --follow --region us-west-2
```

### Search for errors:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "ERROR" \
  --region us-west-2
```

### Track a specific job:
```bash
JOB_ID="your-job-id"
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "$JOB_ID" \
  --region us-west-2
```

---

## 📈 Key Things to Monitor

1. **Error Rate** - Should stay below 5%
2. **Processing Time** - Average 30-60 seconds per PDF
3. **LLM Costs** - Track daily spending
4. **Success Rate** - Should be >95%

---

For detailed monitoring guide, see: `docs/MONITORING_GUIDE.md`

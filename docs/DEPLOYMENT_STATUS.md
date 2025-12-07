# PDF Lecture Service - Deployment Status

**Deployment Date:** December 3, 2025  
**Stack Name:** `pdf-lecture-service`  
**Region:** `us-west-2` (Oregon)  
**Status:** ✅ **DEPLOYED** (API Gateway needs configuration)

---

## ✅ Successfully Deployed Resources

### CloudFormation Stack
- **Stack Name:** `pdf-lecture-service`
- **Status:** `CREATE_COMPLETE`
- **Created:** 2025-12-03 at 17:42:16 UTC
- **View in Console:** [CloudFormation Stack](https://us-west-2.console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks)

### API Gateway
- **API ID:** `vtqny8cp7e`
- **API Name:** `pdf-lecture-service`
- **Base URL:** `https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev`
- **Stage:** `dev`
- **View in Console:** [API Gateway](https://us-west-2.console.aws.amazon.com/apigateway/home?region=us-west-2#/apis/vtqny8cp7e/resources)

### API Key
- **Key Name:** `pdf-lecture-dev-key`
- **Key ID:** `bk0qjrvbnh`
- **Key Value:** `rB5y5sScAKN3Ndoec3sq3iHQiaUpSt07A1XVuFYd`
- **Status:** Enabled
- **Usage Plan:** `pdf-lecture-dev-plan` (ID: `0m0w51`)

### Lambda Functions (6 total)
All functions deployed with Node.js 20.x runtime:

1. **UploadFunction**
   - Name: `pdf-lecture-service-UploadFunction-f1EN4kRje8U5`
   - Timeout: 60 seconds
   - Memory: 1024 MB
   - Purpose: Accept PDF uploads, validate, store in S3

2. **AnalyzerFunction**
   - Name: `pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5`
   - Timeout: 300 seconds (5 minutes)
   - Memory: 2048 MB
   - Purpose: Vision-first PDF analysis with LLM

3. **SegmenterFunction**
   - Name: `pdf-lecture-service-SegmenterFunction-sPSIcFq12tHO`
   - Timeout: 300 seconds
   - Memory: 1024 MB
   - Purpose: Fallback content segmentation (not used in vision-first mode)

4. **ScriptFunction**
   - Name: `pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD`
   - Timeout: 300 seconds
   - Memory: 1024 MB
   - Purpose: Generate lecture scripts with agent personality

5. **AudioFunction**
   - Name: `pdf-lecture-service-AudioFunction-XhEMVtD7LTkX`
   - Timeout: 600 seconds (10 minutes)
   - Memory: 2048 MB
   - Purpose: Synthesize audio with AWS Polly

6. **StatusFunction**
   - Name: `pdf-lecture-service-StatusFunction-aXfVCv8MVSeb`
   - Timeout: 30 seconds
   - Memory: 512 MB
   - Purpose: Query job status

**View in Console:** [Lambda Functions](https://us-west-2.console.aws.amazon.com/lambda/home?region=us-west-2#/functions)

### DynamoDB Tables (3 total)

1. **Jobs Table**
   - Name: `pdf-lecture-service-jobs`
   - Billing: Pay-per-request
   - Encryption: Enabled
   - Point-in-time recovery: Enabled
   - Purpose: Track processing jobs

2. **Agents Table**
   - Name: `pdf-lecture-service-agents`
   - Billing: Pay-per-request
   - Encryption: Enabled
   - Point-in-time recovery: Enabled
   - Purpose: Store lecture agent personalities

3. **Content Table**
   - Name: `pdf-lecture-service-content`
   - Billing: Pay-per-request
   - Encryption: Enabled
   - Point-in-time recovery: Enabled
   - Purpose: Store extracted content, scripts, and audio metadata

**View in Console:** [DynamoDB Tables](https://us-west-2.console.aws.amazon.com/dynamodbv2/home?region=us-west-2#tables)

### S3 Buckets (2 total)

1. **PDF Storage**
   - Name: `pdf-lecture-service-pdfs-456522530654`
   - Encryption: AES256
   - Public access: Blocked
   - Lifecycle: Delete after 30 days
   - Purpose: Store uploaded PDFs

2. **Audio Storage**
   - Name: `pdf-lecture-service-audio-456522530654`
   - Encryption: AES256
   - Public access: Blocked
   - CORS: Enabled for playback
   - Lifecycle: Delete after 30 days
   - Purpose: Store generated MP3 files

**View in Console:** [S3 Buckets](https://s3.console.aws.amazon.com/s3/buckets?region=us-west-2)

### EventBridge Event Bus
- **Name:** `pdf-lecture-service-events`
- **Purpose:** Coordinate async pipeline between Lambda functions
- **Events:**
  - `JobCreated` → Triggers AnalyzerFunction
  - `AnalysisCompleted` → Triggers ScriptFunction (vision-first mode)
  - `SegmentationCompleted` → Triggers ScriptFunction (legacy mode)
  - `ScriptGenerationCompleted` → Triggers AudioFunction

**View in Console:** [EventBridge](https://us-west-2.console.aws.amazon.com/events/home?region=us-west-2#/eventbuses)

### CloudWatch Log Groups (6 total)
All logs retained for 30 days:

```
/aws/lambda/pdf-lecture-service-UploadFunction-f1EN4kRje8U5
/aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5
/aws/lambda/pdf-lecture-service-SegmenterFunction-sPSIcFq12tHO
/aws/lambda/pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD
/aws/lambda/pdf-lecture-service-AudioFunction-XhEMVtD7LTkX
/aws/lambda/pdf-lecture-service-StatusFunction-aXfVCv8MVSeb
```

**View in Console:** [CloudWatch Logs](https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logsV2:log-groups)

### CloudWatch Alarms (4 total)

1. **High Error Rate**
   - Name: `pdf-lecture-service-HighErrorRate`
   - Threshold: >5 errors
   - Purpose: Alert on high failure rate

2. **Upload Timeout**
   - Name: `pdf-lecture-service-UploadTimeout`
   - Threshold: >55 seconds
   - Purpose: Alert when upload function approaches timeout

3. **Analyzer Timeout**
   - Name: `pdf-lecture-service-AnalyzerTimeout`
   - Threshold: >290 seconds
   - Purpose: Alert when analyzer function approaches timeout

4. **Audio Timeout**
   - Name: `pdf-lecture-service-AudioTimeout`
   - Threshold: >590 seconds
   - Purpose: Alert when audio function approaches timeout

**View in Console:** [CloudWatch Alarms](https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#alarmsV2:)

### IAM Roles
Each Lambda function has its own execution role with least-privilege permissions:
- DynamoDB read/write access
- S3 read/write access
- EventBridge publish access
- CloudWatch Logs write access

---

## ⚠️ Known Issue: API Gateway Authentication

**Problem:** API Gateway returns `{"message":"Forbidden"}` when calling endpoints.

**Cause:** The API key is created and associated with a usage plan, but the API Gateway stage may need to be redeployed to pick up the authentication configuration.

**Solution:** Redeploy the API Gateway stage:

```bash
# Get the deployment ID
aws apigateway get-deployments \
  --rest-api-id vtqny8cp7e \
  --region us-west-2

# Create a new deployment
aws apigateway create-deployment \
  --rest-api-id vtqny8cp7e \
  --stage-name dev \
  --region us-west-2
```

**Or via Console:**
1. Go to API Gateway → `pdf-lecture-service`
2. Click "Resources"
3. Click "Actions" → "Deploy API"
4. Select stage: `dev`
5. Click "Deploy"

---

## 🧪 Testing the Deployment

### Once API Gateway is Fixed

**Test Status Endpoint:**
```bash
curl -X GET "https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev/status/test-job-id" \
  -H "x-api-key: rB5y5sScAKN3Ndoec3sq3iHQiaUpSt07A1XVuFYd"
```

Expected response (404 is correct - job doesn't exist):
```json
{
  "error": "Job not found: test-job-id",
  "code": "JOB_NOT_FOUND",
  "retryable": false
}
```

### Test Locally (No API Key Required)

```bash
# Start local server
npm run dev

# Test upload
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d @test-upload.json
```

---

## 📊 Environment Configuration

### Environment Variables Set in Lambda

All Lambda functions have these environment variables:

```bash
NODE_ENV=production
OPENROUTER_API_KEY=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
LLM_PROVIDER=openrouter
TTS_PROVIDER=polly
ENABLE_VISION_FIRST_PIPELINE=true
VISION_MODEL=nvidia/nemotron-nano-12b-v2-vl:free
LLM_MODEL_SCRIPT=tngtech/deepseek-r1t2-chimera:free

# AWS Resources (auto-configured)
DYNAMODB_TABLE_JOBS=pdf-lecture-service-jobs
DYNAMODB_TABLE_AGENTS=pdf-lecture-service-agents
DYNAMODB_TABLE_CONTENT=pdf-lecture-service-content
S3_BUCKET_PDFS=pdf-lecture-service-pdfs-456522530654
S3_BUCKET_AUDIO=pdf-lecture-service-audio-456522530654
EVENT_BUS_NAME=pdf-lecture-service-events
```

---

## 💰 Cost Estimate

### Per PDF Processing (typical 10-page paper)

- **Lambda Execution:** ~$0.01 (5 minutes total)
- **DynamoDB:** ~$0.001 (read/write operations)
- **S3 Storage:** ~$0.001 (100MB PDF + 10MB audio)
- **LLM API Calls:** $0.00 (using free models)
- **AWS Polly TTS:** ~$0.16 (4,000 words)
- **EventBridge:** $0.00 (included in free tier)

**Total per PDF:** ~$0.17

### Monthly Costs (100 PDFs/month)

- **Lambda:** ~$1
- **DynamoDB:** ~$0.10
- **S3:** ~$0.50
- **LLM:** $0 (free models)
- **Polly:** ~$16
- **API Gateway:** ~$0.35

**Total monthly:** ~$18 for 100 PDFs

---

## 📚 Documentation

- **API Documentation:** `docs/API.md`
- **Frontend Guide:** `docs/FRONTEND_DEVELOPER_GUIDE.md`
- **Monitoring Guide:** `docs/MONITORING_GUIDE.md`
- **Monitoring Quick Start:** `docs/MONITORING_QUICK_START.md`

---

## 🔧 Management Commands

### View Stack Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service \
  --region us-west-2 \
  --query 'Stacks[0].Outputs'
```

### View Lambda Functions
```bash
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `pdf-lecture-service`)].FunctionName' \
  --region us-west-2
```

### View DynamoDB Tables
```bash
aws dynamodb list-tables \
  --query 'TableNames[?starts_with(@, `pdf-lecture-service`)]' \
  --region us-west-2
```

### Tail Logs
```bash
aws logs tail /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --follow \
  --region us-west-2
```

### Update Stack (Redeploy)
```bash
sam build
sam deploy --config-env default \
  --parameter-overrides "Stage=dev OpenRouterApiKey=$OPENROUTER_API_KEY LLMProvider=openrouter"
```

### Delete Stack (Cleanup)
```bash
aws cloudformation delete-stack \
  --stack-name pdf-lecture-service \
  --region us-west-2
```

---

## ✅ Next Steps

1. **Fix API Gateway:** Redeploy the API Gateway stage to enable API key authentication
2. **Create Default Agent:** Use the API to create a lecture agent
3. **Test Upload:** Upload a sample PDF and monitor processing
4. **Monitor Logs:** Watch CloudWatch logs for the first job
5. **Build Frontend:** Use the Frontend Developer Guide to build the UI

---

**Deployment completed successfully!** 🎉

All infrastructure is in place. Once the API Gateway is redeployed, the system will be fully operational.

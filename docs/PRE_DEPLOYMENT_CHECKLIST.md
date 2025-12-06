# Pre-Deployment Checklist - PDF Lecture Service

**Date**: December 3, 2025  
**Status**: Ready for AWS Deployment 🚀

## ✅ System Readiness

### Code & Tests
- ✅ All core functionality implemented
- ✅ Vision-first pipeline operational
- ✅ Agent management working
- ✅ OpenRouter rate limiting configured
- ✅ AWS Polly TTS support (all engines)
- ✅ Local E2E tests passing

### Configuration
- ✅ Environment variables documented
- ✅ Feature flags configured
- ✅ Model selection optimized (free tier)
- ✅ Rate limiting configured (conservative)
- ✅ TTS engines documented

### Documentation
- ✅ Deployment guide complete
- ✅ API documentation available
- ✅ Configuration guides written
- ✅ Troubleshooting documented

## 📋 Pre-Deployment Tasks

### 1. AWS Account Setup

- [ ] **Verify AWS CLI**
  ```bash
  aws --version
  # Should show: aws-cli/2.x.x
  ```

- [ ] **Verify AWS Credentials**
  ```bash
  export AWS_PROFILE=admin
  aws sts get-caller-identity
  # Should show your account details
  ```

- [ ] **Verify SAM CLI**
  ```bash
  sam --version
  # Should show: SAM CLI, version 1.x.x
  ```

### 2. API Keys Configuration

- [ ] **Get OpenRouter API Key**
  - Sign up at: https://openrouter.ai
  - Get API key from: https://openrouter.ai/keys
  - Free tier available!

- [ ] **Set Environment Variables**
  ```bash
  export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
  ```

- [ ] **Verify Key Works**
  ```bash
  # Test with curl
  curl https://openrouter.ai/api/v1/models \
    -H "Authorization: Bearer $OPENROUTER_API_KEY"
  ```

### 3. Build & Test Locally

- [ ] **Install Dependencies**
  ```bash
  npm install
  ```

- [ ] **Build Application**
  ```bash
  npm run build
  npm run bundle
  ```

- [ ] **Run Tests**
  ```bash
  npm test
  # Should see most tests passing
  ```

- [ ] **Test Locally**
  ```bash
  # Start local server
  npm run dev
  
  # In another terminal, run E2E test
  node scripts/e2e-test.js
  ```

### 4. Review Configuration

- [ ] **Check .env.production**
  ```bash
  cat .env.production
  # Verify all settings are correct
  ```

- [ ] **Review template.yaml**
  ```bash
  # Verify Lambda timeouts, memory, etc.
  grep -A 5 "Timeout:" template.yaml
  ```

- [ ] **Validate SAM Template**
  ```bash
  sam validate --lint
  # Should show: template.yaml is a valid SAM Template
  ```

### 5. Cost Review

- [ ] **Review Cost Estimates**
  - Development: ~$11-23/month
  - Production: ~$110-220/month + API costs
  - See `AWS_SETUP_INSTRUCTIONS.md` for details

- [ ] **Check Free Tier Eligibility**
  - Lambda: 1M requests/month free
  - DynamoDB: 25GB storage free
  - S3: 5GB storage free
  - API Gateway: 1M requests/month free

- [ ] **Set Up Billing Alerts**
  ```bash
  # Create billing alarm (optional)
  aws cloudwatch put-metric-alarm \
    --alarm-name billing-alarm \
    --alarm-description "Alert when bill exceeds $50" \
    --metric-name EstimatedCharges \
    --namespace AWS/Billing \
    --statistic Maximum \
    --period 21600 \
    --evaluation-periods 1 \
    --threshold 50 \
    --comparison-operator GreaterThanThreshold
  ```

## 🚀 Deployment Steps

### Step 1: Deploy to Development

```bash
# Quick deploy (recommended)
bash scripts/quick-deploy.sh dev

# Or manual deploy
sam build
sam deploy --config-env default \
  --parameter-overrides \
    "Stage=dev \
     OpenRouterApiKey=$OPENROUTER_API_KEY \
     LLMProvider=openrouter"
```

**Expected Output**:
```
Successfully created/updated stack - pdf-lecture-service-dev
```

### Step 2: Get API Endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

**Save this endpoint** - you'll need it for testing!

### Step 3: Create API Key

```bash
# Create API key
aws apigateway create-api-key \
  --name "pdf-lecture-dev-key" \
  --enabled \
  --region us-west-2

# Get key value (save the api-key-id from above)
aws apigateway get-api-key \
  --api-key <api-key-id> \
  --include-value \
  --region us-west-2
```

**Save this API key** - you'll need it for all API calls!

### Step 4: Test Deployment

```bash
# Set variables
export API_ENDPOINT="<your-api-endpoint>"
export API_KEY="<your-api-key>"

# Test status endpoint
curl -X GET "$API_ENDPOINT/status/test" \
  -H "x-api-key: $API_KEY"

# Should return 404 (expected for non-existent job)
```

### Step 5: Create Default Agent

```bash
curl -X POST "$API_ENDPOINT/agents" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Professor Friendly",
    "description": "A friendly and engaging professor",
    "personality": {
      "instructions": "Explain scientific concepts clearly and enthusiastically",
      "tone": "enthusiastic"
    },
    "voice": {
      "voiceId": "Joanna",
      "speed": 1.0,
      "pitch": 0
    }
  }'
```

**Save the agent ID** from the response!

### Step 6: Test Complete Pipeline

```bash
# Upload a test PDF
# (You'll need to create a test PDF or use an existing one)

# Monitor CloudWatch logs
sam logs --stack-name pdf-lecture-service-dev --tail
```

## 📊 Post-Deployment Verification

### Check All Resources Created

```bash
# Check Lambda functions
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `pdf-lecture-service-dev`)].FunctionName'

# Check DynamoDB tables
aws dynamodb list-tables \
  --query 'TableNames[?starts_with(@, `pdf-lecture-service-dev`)]'

# Check S3 buckets
aws s3 ls | grep pdf-lecture-service-dev

# Check API Gateway
aws apigateway get-rest-apis \
  --query 'items[?name==`pdf-lecture-service-dev`]'
```

### Monitor CloudWatch

```bash
# View logs
sam logs --stack-name pdf-lecture-service-dev --tail

# Check for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-dev-UploadFunction \
  --filter-pattern "ERROR"
```

### Check Alarms

```bash
# List alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix pdf-lecture-service-dev

# Check alarm state
aws cloudwatch describe-alarms \
  --state-value ALARM
```

## 🔧 Configuration Recommendations

### For Development

```bash
# Use free models
VISION_MODEL=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free

# Conservative rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000

# Mock TTS (no AWS Polly costs)
TTS_PROVIDER=mock
```

### For Production

```bash
# Use paid models for better quality
VISION_MODEL=anthropic/claude-3-5-sonnet
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview

# Aggressive rate limiting
OPENROUTER_MIN_REQUEST_INTERVAL_MS=200

# Real TTS with neural engine
TTS_PROVIDER=polly
POLLY_ENGINE=neural
```

## ⚠️ Important Notes

### Rate Limits

- **OpenRouter Free Tier**: 50 requests/day
- **Solution**: Use conservative rate limiting (1000ms interval)
- **Alternative**: Upgrade to paid tier or use direct API keys

### Costs

- **Development**: Minimal with free tier
- **Production**: Monitor CloudWatch for actual usage
- **Set billing alerts** to avoid surprises

### Security

- **API Keys**: Never commit to git
- **Use Secrets Manager**: For production (recommended)
- **Rotate keys**: Regularly for security

### Monitoring

- **CloudWatch Logs**: Check regularly for errors
- **CloudWatch Alarms**: Set up for critical metrics
- **Cost Explorer**: Monitor AWS costs

## 🎯 Success Criteria

Deployment is successful when:

- ✅ All Lambda functions deployed
- ✅ All DynamoDB tables created
- ✅ All S3 buckets created
- ✅ API Gateway accessible
- ✅ Status endpoint returns 404 (expected)
- ✅ Agent creation works
- ✅ No CloudWatch alarms triggered
- ✅ Logs show no errors

## 🚨 Rollback Plan

If deployment fails:

```bash
# Delete the stack
aws cloudformation delete-stack --stack-name pdf-lecture-service-dev

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name pdf-lecture-service-dev

# Fix issues and redeploy
bash scripts/quick-deploy.sh dev
```

## 📚 Reference Documentation

- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **AWS Setup**: `AWS_SETUP_INSTRUCTIONS.md`
- **API Documentation**: `docs/API.md`
- **Configuration**: `docs/MODEL_CONFIGURATION.md`
- **TTS Setup**: `docs/TTS_CONFIGURATION.md`
- **Rate Limiting**: `docs/OPENROUTER_RATE_LIMITING.md`
- **Feature Flags**: `docs/FEATURE_FLAGS.md`

## ✅ Final Checklist

Before deploying to production:

- [ ] Development deployment successful
- [ ] All tests passing in dev
- [ ] Monitoring set up
- [ ] Billing alerts configured
- [ ] API keys secured
- [ ] Documentation reviewed
- [ ] Team notified
- [ ] Rollback plan ready

---

## 🚀 Ready to Deploy!

**Command to run**:
```bash
bash scripts/quick-deploy.sh dev
```

**Time estimate**: 5-10 minutes

**What happens**:
1. Builds TypeScript code
2. Bundles Lambda functions
3. Creates CloudFormation stack
4. Deploys all AWS resources
5. Outputs API endpoint

**After deployment**:
1. Get API endpoint
2. Create API key
3. Test with sample PDF
4. Monitor CloudWatch logs
5. Deploy to production when ready

---

**Good luck with your deployment! 🎉**

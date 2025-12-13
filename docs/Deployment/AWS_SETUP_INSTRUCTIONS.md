
# AWS Setup Instructions for PDF Lecture Service

## Overview

This guide covers AWS setup for both local development (LocalStack) and production deployment (AWS).

## Prerequisites

✅ **Required Tools**:
- AWS CLI v2 installed
- AWS SAM CLI installed
- Docker and Docker Compose (for LocalStack)
- Node.js 20.x
- LocalStack Pro (for local testing)

## AWS Account Setup

### 1. Verify AWS CLI Installation

```bash
aws --version
# Should show: aws-cli/2.x.x or higher
```

### 2. Configure AWS Credentials

Your AWS CLI is already configured with the `admin` profile:

```bash
export AWS_PROFILE=admin

aws sts get-caller-identity
# Output:
# {
#     "UserId": "AIDAWUSW475PGMFN5MVCY",
#     "Account": "456522530654",
#     "Arn": "arn:aws:iam::456522530654:user/cli-admin"
# }
```

### 3. AWS Configuration Files

**~/.aws/config**:
```ini
[default]
region = us-west-2
output = json

[profile admin]
region = us-west-2
output = json

[profile localstack]
region = us-west-2
output = json
endpoint_url = http://localhost:4566
```

**~/.aws/credentials**:
```ini
[admin]
aws_access_key_id = YOUR_AWS_ACCESS_KEY_ID
aws_secret_access_key = YOUR_AWS_SECRET_ACCESS_KEY

[localstack]
aws_access_key_id = test
aws_secret_access_key = test
```

## LocalStack Setup (Local Development)

### 1. Start LocalStack

```bash
# LocalStack Pro is already configured
# Endpoint: localhost.localstack.cloud:4566
docker-compose up -d localstack
```

### 2. Verify LocalStack

```bash
# Using awslocal wrapper (recommended)
awslocal sts get-caller-identity

# Or using AWS CLI with localstack profile
export AWS_PROFILE=localstack
aws sts get-caller-identity
```

### 3. LocalStack vs AWS Commands

```bash
# LocalStack (local testing)
awslocal s3 ls
awslocal dynamodb list-tables

# AWS (production)
export AWS_PROFILE=admin
aws s3 ls
aws dynamodb list-tables
```

## API Keys Configuration

### Required API Keys

Before deployment, you need to configure these API keys:

#### 1. OpenRouter API Key (Recommended)

```bash
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

**Get your key**: https://openrouter.ai/keys

**Why OpenRouter?**
- Unified access to multiple LLM providers
- Free tier available
- Easy to switch between models

#### 2. Alternative: Direct LLM Provider Keys

If not using OpenRouter, configure direct provider keys:

```bash
# OpenAI (alternative to OpenRouter)
export OPENAI_API_KEY="sk-your-openai-key"

# Anthropic (alternative to OpenRouter)
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
```

#### 3. TTS Configuration

For AWS Polly (recommended):
```bash
# No separate TTS_API_KEY needed
# Polly uses your AWS credentials automatically
export TTS_PROVIDER=polly
export POLLY_ENGINE=neural
```

For other TTS providers:
```bash
export TTS_API_KEY="your-tts-key"
export TTS_PROVIDER=elevenlabs  # or google, azure, etc.
```

### Environment Variables for Deployment

Create a `.env.production` file:

```bash
# LLM Configuration
OPENROUTER_API_KEY=sk-or-v1-your-key-here
LLM_PROVIDER=openrouter

# Model Selection (using free models)
VISION_MODEL=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free

# TTS Configuration
TTS_PROVIDER=polly
POLLY_ENGINE=neural

# Feature Flags
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=true

# Rate Limiting (conservative for free tier)
OPENROUTER_MIN_REQUEST_INTERVAL_MS=1000
LLM_MAX_RETRY_ATTEMPTS=5
LLM_INITIAL_RETRY_DELAY_MS=2000
LLM_MAX_RETRY_DELAY_MS=30000
```

## Pre-Deployment Checklist

### ✅ Verify Prerequisites

```bash
# 1. Check AWS CLI
aws --version

# 2. Check SAM CLI
sam --version

# 3. Check AWS credentials
export AWS_PROFILE=admin
aws sts get-caller-identity

# 4. Check Node.js
node --version  # Should be 20.x

# 5. Check Docker
docker --version
docker-compose --version
```

### ✅ Verify API Keys

```bash
# Check OpenRouter key is set
echo $OPENROUTER_API_KEY

# Or check alternative keys
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

### ✅ Build and Test Locally

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Run tests
npm test

# 4. Test locally with LocalStack
npm run dev
# In another terminal:
node scripts/e2e-test.js
```

## Deployment Commands

### Quick Deployment

```bash
# Deploy to development
bash scripts/quick-deploy.sh dev

# Deploy to production
bash scripts/quick-deploy.sh prod
```

**Note:** The quick-deploy script may not always trigger a full rebuild of Lambda artifacts. If you make code changes and the deployment seems to use cached artifacts, use the manual deployment method below.

### Manual Deployment (Recommended for Code Changes)

```bash
# 1. Build TypeScript and bundle
npm run build
npm run bundle

# 2. SAM build (rebuilds Lambda artifacts)
sam build

# 3. Deploy to dev
export AWS_PROFILE=admin
sam deploy --config-env default --no-confirm-changeset

# Or deploy to prod
sam deploy --config-env prod --no-confirm-changeset
```

**Alternative:** With parameter overrides:

```bash
sam deploy \
  --config-env default \
  --no-confirm-changeset \
  --parameter-overrides \
    "Stage=dev \
     OpenRouterApiKey=$OPENROUTER_API_KEY \
     LLMProvider=openrouter"
```

## Post-Deployment Verification

### 1. Get API Endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### 2. Create API Key

```bash
# Get API Gateway ID
API_ID=$(aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text)

# Create API key
aws apigateway create-api-key \
  --name "pdf-lecture-api-key" \
  --enabled \
  --region us-west-2

# Get key value
aws apigateway get-api-key \
  --api-key <key-id> \
  --include-value \
  --region us-west-2
```

### 3. Test Deployment

```bash
# Set variables
API_ENDPOINT="https://your-api-id.execute-api.us-west-2.amazonaws.com/dev"
API_KEY="your-api-key"

# Test status endpoint
curl -X GET "$API_ENDPOINT/status/test" \
  -H "x-api-key: $API_KEY"

# Should return 404 (expected for non-existent job)
```

### 4. Run E2E Test

```bash
# Use the deployment test script
bash scripts/test-deployment.sh dev us-west-2 $API_KEY
```

## IAM Permissions Required

Your `cli-admin` user needs these permissions:

### Required AWS Services:
- ✅ Lambda (create, update, invoke)
- ✅ API Gateway (create, update, deploy)
- ✅ DynamoDB (create tables, read/write)
- ✅ S3 (create buckets, read/write objects)
- ✅ EventBridge (create event bus, rules)
- ✅ CloudWatch (create log groups, metrics, alarms)
- ✅ IAM (create roles for Lambda)
- ✅ CloudFormation (create/update stacks)

### Recommended IAM Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "dynamodb:*",
        "s3:*",
        "events:*",
        "logs:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Issue: "Unable to locate credentials"

**Solution**:
```bash
export AWS_PROFILE=admin
aws configure list
```

### Issue: "Stack already exists"

**Solution**:
```bash
# Update existing stack
sam deploy --config-env default --no-confirm-changeset

# Or delete and redeploy
aws cloudformation delete-stack --stack-name pdf-lecture-service-dev
aws cloudformation wait stack-delete-complete --stack-name pdf-lecture-service-dev
sam deploy --config-env default
```

### Issue: "Bucket does not exist"

**Solution**:
```bash
# SAM will create deployment bucket automatically
# If it fails, create manually:
aws s3 mb s3://pdf-lecture-service-deployment-$(aws sts get-caller-identity --query Account --output text)
```

### Issue: LocalStack not responding

**Solution**:
```bash
# Restart LocalStack
docker-compose restart localstack

# Check logs
docker-compose logs localstack

# Verify endpoint
curl http://localhost:4566/_localstack/health
```

## Cost Estimation

### Development Environment:
- Lambda: ~$5-10/month
- DynamoDB: ~$2-5/month (PAY_PER_REQUEST)
- S3: ~$1-3/month
- API Gateway: ~$3-5/month
- **Total: ~$11-23/month**

### Production Environment:
- Lambda: ~$50-100/month
- DynamoDB: ~$20-50/month
- S3: ~$10-20/month
- API Gateway: ~$30-50/month
- External APIs (OpenRouter/Polly): Variable
- **Total: ~$110-220/month + API costs**

### Free Tier Benefits:
- Lambda: 1M requests/month free
- DynamoDB: 25GB storage free
- S3: 5GB storage free
- API Gateway: 1M requests/month free

## Security Best Practices

1. ✅ Use AWS Secrets Manager for API keys (instead of environment variables)
2. ✅ Enable CloudTrail for audit logging
3. ✅ Set up AWS WAF for API Gateway
4. ✅ Enable S3 bucket versioning
5. ✅ Use VPC for Lambda functions (optional)
6. ✅ Rotate API keys regularly
7. ✅ Enable MFA on AWS account

## Next Steps

1. ✅ Verify AWS credentials: `aws sts get-caller-identity`
2. ✅ Set API keys: `export OPENROUTER_API_KEY="..."`
3. ✅ Build application: `npm run build && npm run bundle`
4. ✅ Deploy to dev: `bash scripts/quick-deploy.sh dev`
5. ✅ Test deployment: `bash scripts/test-deployment.sh dev us-west-2 $API_KEY`
6. ✅ Monitor logs: `sam logs --stack-name pdf-lecture-service-dev --tail`
7. ✅ Deploy to prod: `bash scripts/quick-deploy.sh prod`

## Support

For issues:
- Check CloudWatch Logs
- Review `DEPLOYMENT_GUIDE.md`
- Check `TEST_STATUS.md` for known issues
- Review AWS CloudFormation events

---

**You're ready to deploy! 🚀**

Run: `bash scripts/quick-deploy.sh dev`


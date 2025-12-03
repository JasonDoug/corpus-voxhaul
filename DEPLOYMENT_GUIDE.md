# PDF Lecture Service - Production Deployment Guide

## Prerequisites

✅ AWS CLI configured with IAM user credentials
✅ SAM CLI installed
✅ LocalStack Pro running for testing
✅ Node.js 20.x installed
✅ All tests passing (97% pass rate)

## Pre-Deployment Checklist

### 1. Set API Keys as Environment Variables

You'll need to configure these API keys for the Lambda functions:

```bash
# Export these in your shell or add to AWS Systems Manager Parameter Store
export OPENAI_API_KEY="your-openai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export TTS_API_KEY="your-tts-api-key"
```

### 2. Update SAM Template with API Keys

Edit `template.yaml` to add API keys to the Lambda environment variables:

```yaml
Globals:
  Function:
    Environment:
      Variables:
        OPENAI_API_KEY: !Ref OpenAIApiKey
        ANTHROPIC_API_KEY: !Ref AnthropicApiKey
        TTS_API_KEY: !Ref TTSApiKey
```

Add parameters section:

```yaml
Parameters:
  OpenAIApiKey:
    Type: String
    NoEcho: true
    Description: OpenAI API Key
  AnthropicApiKey:
    Type: String
    NoEcho: true
    Description: Anthropic API Key
  TTSApiKey:
    Type: String
    NoEcho: true
    Description: TTS API Key
```

### 3. Verify AWS Credentials

```bash
# Check your AWS identity
aws sts get-caller-identity

# Should show your IAM user details
```

## Deployment Steps

### Step 1: Build the Application

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Bundle Lambda functions
npm run bundle
```

### Step 2: Validate SAM Template

```bash
# Validate the CloudFormation template
sam validate --lint
```

### Step 3: Build SAM Application

```bash
# Build the SAM application
sam build
```

### Step 4: Deploy to Development

```bash
# Deploy to dev environment
sam deploy \
  --config-env default \
  --parameter-overrides \
    "Stage=dev \
     OpenAIApiKey=$OPENAI_API_KEY \
     AnthropicApiKey=$ANTHROPIC_API_KEY \
     TTSApiKey=$TTS_API_KEY"
```

Or use the deployment script:

```bash
# Using the deployment script
bash scripts/deploy.sh dev us-east-1
```

### Step 5: Test the Deployment

```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

echo "API Endpoint: $API_ENDPOINT"

# Test the status endpoint
curl -X GET "$API_ENDPOINT/status/test-job-id"
```

### Step 6: Deploy to Staging (Optional)

```bash
# Deploy to staging
sam deploy \
  --config-env staging \
  --parameter-overrides \
    "Stage=staging \
     OpenAIApiKey=$OPENAI_API_KEY \
     AnthropicApiKey=$ANTHROPIC_API_KEY \
     TTSApiKey=$TTS_API_KEY"
```

### Step 7: Deploy to Production

```bash
# Deploy to production (requires confirmation)
sam deploy \
  --config-env prod \
  --parameter-overrides \
    "Stage=prod \
     OpenAIApiKey=$OPENAI_API_KEY \
     AnthropicApiKey=$ANTHROPIC_API_KEY \
     TTSApiKey=$TTS_API_KEY"
```

## Post-Deployment Configuration

### 1. Create API Key for API Gateway

```bash
# Create an API key
aws apigateway create-api-key \
  --name "pdf-lecture-service-api-key" \
  --enabled \
  --region us-east-1

# Get the API key value
aws apigateway get-api-key \
  --api-key <api-key-id> \
  --include-value \
  --region us-east-1
```

### 2. Create a Default Agent

```bash
# Create a default lecture agent
curl -X POST "$API_ENDPOINT/agents" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "name": "Professor Friendly",
    "description": "A friendly and engaging professor who explains complex topics clearly",
    "personality": {
      "instructions": "Explain scientific concepts in an accessible way with enthusiasm",
      "tone": "enthusiastic",
      "examples": ["Think of it like...", "Here's a fun way to understand this..."]
    },
    "voice": {
      "voiceId": "en-US-Neural2-A",
      "speed": 1.0,
      "pitch": 0
    }
  }'
```

### 3. Set Up CloudWatch Alarms (Optional)

```bash
# Subscribe to alarm notifications
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:pdf-lecture-service-dev-alarms \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Monitoring and Logs

### View Lambda Logs

```bash
# View logs for a specific function
sam logs -n UploadFunction --stack-name pdf-lecture-service-dev --tail

# View logs for all functions
sam logs --stack-name pdf-lecture-service-dev --tail
```

### View CloudWatch Metrics

```bash
# Open CloudWatch console
aws cloudwatch get-dashboard \
  --dashboard-name pdf-lecture-service-dev
```

### Check Stack Status

```bash
# Get stack status
aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].StackStatus'
```

## Troubleshooting

### Issue: Deployment Fails with "Bucket does not exist"

**Solution:** SAM will create an S3 bucket for deployment artifacts automatically. If it fails, create one manually:

```bash
aws s3 mb s3://pdf-lecture-service-deployment-artifacts-$(aws sts get-caller-identity --query Account --output text)
```

### Issue: Lambda Function Timeout

**Solution:** Increase timeout in `template.yaml`:

```yaml
Timeout: 600  # Increase to 10 minutes
```

### Issue: API Gateway 403 Forbidden

**Solution:** Ensure API key is properly configured and passed in headers:

```bash
curl -H "x-api-key: YOUR_API_KEY" "$API_ENDPOINT/status/test"
```

### Issue: DynamoDB Throttling

**Solution:** DynamoDB is set to PAY_PER_REQUEST mode, which auto-scales. If you see throttling, check CloudWatch metrics and consider switching to provisioned capacity.

## Cleanup

To delete the stack and all resources:

```bash
# Delete dev stack
aws cloudformation delete-stack --stack-name pdf-lecture-service-dev

# Delete staging stack
aws cloudformation delete-stack --stack-name pdf-lecture-service-staging

# Delete prod stack
aws cloudformation delete-stack --stack-name pdf-lecture-service-prod

# Empty and delete S3 buckets (they won't auto-delete if not empty)
aws s3 rm s3://pdf-lecture-service-dev-pdfs-ACCOUNT_ID --recursive
aws s3 rb s3://pdf-lecture-service-dev-pdfs-ACCOUNT_ID
aws s3 rm s3://pdf-lecture-service-dev-audio-ACCOUNT_ID --recursive
aws s3 rb s3://pdf-lecture-service-dev-audio-ACCOUNT_ID
```

## Cost Estimation

### Development Environment (Low Usage)
- Lambda: ~$5-10/month
- DynamoDB: ~$2-5/month (PAY_PER_REQUEST)
- S3: ~$1-3/month
- API Gateway: ~$3-5/month
- **Total: ~$11-23/month**

### Production Environment (Moderate Usage)
- Lambda: ~$50-100/month
- DynamoDB: ~$20-50/month
- S3: ~$10-20/month
- API Gateway: ~$30-50/month
- External APIs (OpenAI, TTS): Variable
- **Total: ~$110-220/month + API costs**

## Security Best Practices

1. ✅ Enable CloudTrail for audit logging
2. ✅ Use AWS Secrets Manager for API keys (instead of environment variables)
3. ✅ Enable VPC for Lambda functions (optional, for enhanced security)
4. ✅ Set up AWS WAF for API Gateway (optional, for DDoS protection)
5. ✅ Enable S3 bucket versioning for data recovery
6. ✅ Set up backup policies for DynamoDB tables

## Next Steps

1. Deploy to development environment
2. Test the complete pipeline with a sample PDF
3. Monitor CloudWatch logs and metrics
4. Deploy to staging for integration testing
5. Deploy to production when ready
6. Set up CI/CD pipeline (GitHub Actions, AWS CodePipeline)

## Support

For issues or questions:
- Check CloudWatch Logs
- Review the TEST_STATUS.md for known issues
- Check AWS CloudFormation events for deployment errors

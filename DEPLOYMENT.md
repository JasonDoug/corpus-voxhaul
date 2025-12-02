# Deployment Guide

This guide covers deploying the PDF Lecture Service to AWS using AWS SAM (Serverless Application Model).

## Prerequisites

1. **AWS CLI** - Install from https://aws.amazon.com/cli/
2. **AWS SAM CLI** - Install from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
3. **Node.js 20.x** - Required for Lambda runtime
4. **AWS Account** - With appropriate permissions to create resources

## AWS Credentials

Configure your AWS credentials:

```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Output format (json)

## Quick Deployment

### Development Environment

```bash
npm run deploy
```

This will:
1. Build TypeScript code
2. Bundle Lambda functions
3. Validate SAM template
4. Deploy to AWS with stack name `pdf-lecture-service-dev`

### Staging Environment

```bash
npm run deploy:staging
```

### Production Environment

```bash
npm run deploy:prod
```

## Manual Deployment Steps

If you prefer to run each step manually:

### 1. Build TypeScript

```bash
npm run build
```

### 2. Bundle Lambda Functions

```bash
npm run bundle
```

### 3. Validate SAM Template

```bash
npm run sam:validate
```

### 4. Build SAM Application

```bash
npm run sam:build
```

### 5. Deploy

```bash
sam deploy --guided
```

Follow the prompts to configure your deployment.

## Infrastructure Components

The deployment creates the following AWS resources:

### Lambda Functions
- **UploadFunction** - Handles PDF uploads (60s timeout, 1GB memory)
- **AnalyzerFunction** - Analyzes PDF content (300s timeout, 2GB memory)
- **SegmenterFunction** - Segments content (300s timeout, 1GB memory)
- **ScriptFunction** - Generates lecture scripts (300s timeout, 1GB memory)
- **AudioFunction** - Synthesizes audio (600s timeout, 2GB memory)
- **StatusFunction** - Queries job status (30s timeout, 512MB memory)

### API Gateway
- REST API with CORS enabled
- API key authentication required
- Endpoints for all Lambda functions

### DynamoDB Tables
- **JobsTable** - Stores job metadata and status
- **AgentsTable** - Stores lecture agent configurations
- **ContentTable** - Stores extracted and processed content

All tables use:
- Pay-per-request billing
- Server-side encryption
- Point-in-time recovery

### S3 Buckets
- **PDFBucket** - Stores uploaded PDF files
- **AudioBucket** - Stores generated audio files

Both buckets have:
- Server-side encryption (AES256)
- Public access blocked
- 30-day lifecycle policy

### EventBridge
- Custom event bus for asynchronous function triggering
- Event rules for pipeline orchestration

## Environment Variables

The following environment variables are automatically configured:

- `DYNAMODB_TABLE_JOBS` - Jobs table name
- `DYNAMODB_TABLE_AGENTS` - Agents table name
- `DYNAMODB_TABLE_CONTENT` - Content table name
- `S3_BUCKET_PDFS` - PDF bucket name
- `S3_BUCKET_AUDIO` - Audio bucket name
- `EVENT_BUS_NAME` - EventBridge bus name
- `NODE_ENV` - Set to "production"

## Testing Deployment

After deployment, you can test the API:

```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test status endpoint
curl -X GET "$API_ENDPOINT/status/test-job-id"
```

## Local Testing with SAM

You can test Lambda functions locally using SAM:

```bash
# Start local API Gateway
npm run sam:local

# The API will be available at http://localhost:3000
```

## Monitoring

### CloudWatch Logs

Each Lambda function creates its own log group:
- `/aws/lambda/pdf-lecture-service-dev-UploadFunction`
- `/aws/lambda/pdf-lecture-service-dev-AnalyzerFunction`
- etc.

### CloudWatch Metrics

Monitor Lambda metrics:
- Invocations
- Duration
- Errors
- Throttles

### X-Ray Tracing

X-Ray tracing is enabled for all Lambda functions to help debug performance issues.

## Cost Optimization

### Development
- Use pay-per-request billing for DynamoDB
- Set lifecycle policies to delete old files
- Use appropriate Lambda memory sizes

### Production
- Consider provisioned concurrency for frequently used functions
- Enable DynamoDB auto-scaling if needed
- Use CloudFront CDN for audio file delivery

## Cleanup

To delete all resources:

```bash
sam delete --stack-name pdf-lecture-service-dev
```

This will remove:
- All Lambda functions
- API Gateway
- DynamoDB tables
- S3 buckets (if empty)
- EventBridge bus
- IAM roles

**Note:** S3 buckets must be empty before deletion. Use the AWS Console or CLI to empty buckets first.

## Troubleshooting

### Deployment Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify SAM CLI version: `sam --version`
3. Check CloudFormation events in AWS Console

### Lambda Function Errors

1. Check CloudWatch Logs
2. Enable X-Ray tracing for detailed traces
3. Test locally with `sam local invoke`

### Permission Errors

Ensure your IAM user/role has permissions for:
- Lambda
- API Gateway
- DynamoDB
- S3
- EventBridge
- CloudFormation
- IAM (for creating roles)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - uses: aws-actions/setup-sam@v2
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm ci
      - run: npm run deploy
```

## Security Best Practices

1. **API Keys** - Rotate API keys regularly
2. **IAM Roles** - Use least privilege principle
3. **Encryption** - All data encrypted at rest and in transit
4. **VPC** - Consider deploying Lambda functions in VPC for production
5. **Secrets** - Use AWS Secrets Manager for API keys (LLM, TTS)

## Next Steps

After deployment:
1. Create API keys in API Gateway
2. Configure external service credentials (LLM, TTS APIs)
3. Create default lecture agents
4. Test the complete pipeline
5. Set up monitoring and alerts

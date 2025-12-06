# Deployment Guide

This comprehensive guide covers both local development setup and production deployment of the PDF Lecture Service to AWS using AWS SAM (Serverless Application Model).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Environment Configuration](#environment-configuration)
4. [Production Deployment](#production-deployment)
5. [Infrastructure Components](#infrastructure-components)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [CI/CD Integration](#cicd-integration)

---

## Prerequisites

### Required Software

1. **Node.js 20.x or higher**
   ```bash
   node --version  # Should be >= 20.0.0
   ```
   Install from: https://nodejs.org/

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **Docker and Docker Compose** (for local development)
   ```bash
   docker --version
   docker-compose --version
   ```
   Install from: https://docs.docker.com/get-docker/

4. **AWS CLI** (for production deployment)
   ```bash
   aws --version
   ```
   Install from: https://aws.amazon.com/cli/

5. **AWS SAM CLI** (for production deployment)
   ```bash
   sam --version
   ```
   Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### AWS Account Requirements

For production deployment, you need:
- An AWS account with appropriate permissions
- IAM permissions to create:
  - Lambda functions
  - API Gateway
  - DynamoDB tables
  - S3 buckets
  - EventBridge event bus
  - IAM roles
  - CloudFormation stacks

### External Service Accounts

You'll need API keys for:
- **LLM Provider** (OpenAI, Anthropic, etc.) - For content analysis and script generation
- **TTS Provider** (AWS Polly, Google TTS, ElevenLabs, etc.) - For audio synthesis

---

## Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd pdf-lecture-service

# Install dependencies
npm install
```

### Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```bash
# Environment Configuration
NODE_ENV=development

# Local Development
PORT=3000
LOCAL_MODE=true

# LocalStack Configuration (Development)
LOCALSTACK_ENDPOINT=http://localhost:4566
USE_LOCALSTACK=true

# S3 Configuration
S3_BUCKET_NAME=pdf-lecture-service
S3_PDF_PREFIX=pdfs
S3_AUDIO_PREFIX=audio
S3_CACHE_PREFIX=cache

# DynamoDB Configuration
DYNAMODB_JOBS_TABLE=pdf-lecture-jobs
DYNAMODB_AGENTS_TABLE=pdf-lecture-agents
DYNAMODB_CONTENT_TABLE=pdf-lecture-content

# EventBridge Configuration
EVENT_BUS_NAME=pdf-lecture-service-events

# External API Keys (add your keys)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
TTS_API_KEY=your-tts-api-key-here

# Processing Configuration
MAX_PDF_SIZE_MB=100
ANALYSIS_TIMEOUT_MS=300000
AUDIO_SYNTHESIS_TIMEOUT_MS=600000
```

### Step 3: Start LocalStack

LocalStack emulates AWS services (S3, DynamoDB) locally:

```bash
# Start LocalStack in the background
docker-compose up -d

# Check if LocalStack is running
docker-compose ps

# View LocalStack logs
docker-compose logs -f localstack
```

The initialization script (`scripts/localstack-init.sh`) automatically creates:
- S3 buckets for PDFs and audio
- DynamoDB tables for jobs, agents, and content

### Step 4: Start Development Server

```bash
# Start the development server with hot reload
npm run dev
```

The server will start on `http://localhost:3000`.

### Step 5: Verify Setup

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "localMode": true
}
```

### Local Development Commands

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build TypeScript
npm run build

# Lint code
npm run lint

# Bundle Lambda functions
npm run bundle
```

### Stopping Local Services

```bash
# Stop LocalStack
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

---

## Environment Configuration

### Development Environment

For local development, use `.env` file with LocalStack configuration:

```bash
NODE_ENV=development
LOCAL_MODE=true
USE_LOCALSTACK=true
LOCALSTACK_ENDPOINT=http://localhost:4566
```

### Production Environment

For production deployment, environment variables are set in `template.yaml` and managed by AWS:

```yaml
Environment:
  Variables:
    DYNAMODB_TABLE_JOBS: !Ref JobsTable
    DYNAMODB_TABLE_AGENTS: !Ref AgentsTable
    DYNAMODB_TABLE_CONTENT: !Ref ContentTable
    S3_BUCKET_PDFS: !Ref PDFBucket
    S3_BUCKET_AUDIO: !Ref AudioBucket
    EVENT_BUS_NAME: !Ref EventBus
    NODE_ENV: production
```

### AWS Credentials

Configure your AWS credentials:

```bash
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Output format (json)

---

## Production Deployment

### Quick Deployment

The fastest way to deploy to AWS:

#### Development Environment

```bash
npm run deploy
```

This will:
1. Build TypeScript code
2. Bundle Lambda functions
3. Validate SAM template
4. Deploy to AWS with stack name `pdf-lecture-service-dev`

#### Staging Environment

```bash
npm run deploy:staging
```

#### Production Environment

```bash
npm run deploy:prod
```

### First-Time Deployment

For your first deployment, use the guided deployment:

```bash
# Build the application
npm run build
npm run bundle

# Validate the SAM template
npm run sam:validate

# Build SAM application
npm run sam:build

# Deploy with guided prompts
sam deploy --guided
```

You'll be prompted for:
- **Stack Name**: `pdf-lecture-service-dev` (or your preferred name)
- **AWS Region**: `us-east-1` (or your preferred region)
- **Parameter Stage**: `dev`, `staging`, or `prod`
- **Confirm changes before deploy**: Y
- **Allow SAM CLI IAM role creation**: Y
- **Save arguments to configuration file**: Y

This creates a `samconfig.toml` file with your deployment settings.

### Manual Deployment Steps

If you prefer to run each step manually:

#### 1. Build TypeScript

```bash
npm run build
```

This compiles TypeScript files from `src/` to `dist/`.

#### 2. Bundle Lambda Functions

```bash
npm run bundle
```

This uses esbuild to bundle Lambda functions with dependencies.

#### 3. Validate SAM Template

```bash
npm run sam:validate
```

This checks `template.yaml` for syntax errors and best practices.

#### 4. Build SAM Application

```bash
npm run sam:build
```

This prepares the application for deployment.

#### 5. Deploy to AWS

```bash
# For dev environment
sam deploy --config-env default --parameter-overrides Stage=dev

# For staging environment
sam deploy --config-env staging --parameter-overrides Stage=staging

# For production environment
sam deploy --config-env prod --parameter-overrides Stage=prod
```

### Deployment Configuration

The `samconfig.toml` file stores deployment settings:

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "pdf-lecture-service-dev"
s3_bucket = "aws-sam-cli-managed-default-samclisourcebucket"
s3_prefix = "pdf-lecture-service"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Stage=dev"
```

### Updating an Existing Deployment

To update an existing stack:

```bash
# Make your code changes
# Then rebuild and redeploy
npm run build
npm run bundle
sam build
sam deploy
```

SAM will only update changed resources.

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

---

## Monitoring and Troubleshooting

### CloudWatch Logs

Each Lambda function creates its own log group:
- `/aws/lambda/pdf-lecture-service-dev-UploadFunction`
- `/aws/lambda/pdf-lecture-service-dev-AnalyzerFunction`
- `/aws/lambda/pdf-lecture-service-dev-SegmenterFunction`
- `/aws/lambda/pdf-lecture-service-dev-ScriptFunction`
- `/aws/lambda/pdf-lecture-service-dev-AudioFunction`
- `/aws/lambda/pdf-lecture-service-dev-StatusFunction`

View logs in AWS Console or using CLI:

```bash
# View recent logs for a function
aws logs tail /aws/lambda/pdf-lecture-service-dev-UploadFunction --follow

# Search logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-dev-AnalyzerFunction \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics

Monitor Lambda metrics in CloudWatch:
- **Invocations** - Number of function executions
- **Duration** - Execution time
- **Errors** - Failed invocations
- **Throttles** - Rate-limited invocations
- **Concurrent Executions** - Functions running simultaneously

Create CloudWatch dashboards to visualize metrics:

```bash
# Get metrics for a function
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=pdf-lecture-service-dev-UploadFunction \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### X-Ray Tracing

X-Ray tracing is enabled for all Lambda functions to help debug performance issues.

View traces in AWS X-Ray Console to:
- Identify bottlenecks
- Track requests across services
- Analyze latency
- Debug errors

### CloudWatch Alarms

Set up alarms for critical metrics:

```bash
# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name pdf-lecture-high-error-rate \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=pdf-lecture-service-dev-AnalyzerFunction
```

### Common Issues and Solutions

#### Deployment Fails

**Issue:** CloudFormation stack creation fails

**Solutions:**
1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify SAM CLI version: `sam --version` (should be >= 1.100.0)
3. Check CloudFormation events in AWS Console for specific error
4. Ensure IAM permissions are sufficient

#### Lambda Function Errors

**Issue:** Function returns 500 errors

**Solutions:**
1. Check CloudWatch Logs for error details
2. Enable X-Ray tracing for detailed traces
3. Test locally with `sam local invoke`
4. Verify environment variables are set correctly
5. Check external API keys are valid

#### Timeout Errors

**Issue:** Lambda function times out

**Solutions:**
1. Increase timeout in `template.yaml`
2. Optimize code for performance
3. Increase memory allocation (more memory = more CPU)
4. Check external API response times

#### Permission Errors

**Issue:** Access denied errors

**Solutions:**
1. Verify IAM role has required permissions
2. Check S3 bucket policies
3. Verify DynamoDB table permissions
4. Ensure EventBridge permissions are correct

#### Out of Memory Errors

**Issue:** Lambda function runs out of memory

**Solutions:**
1. Increase memory in `template.yaml`
2. Optimize memory usage in code
3. Use streaming for large files
4. Process data in chunks

### Testing Deployment

After deployment, test the API:

```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test health endpoint
curl "$API_ENDPOINT/health"

# Test status endpoint (should return 404 for non-existent job)
curl "$API_ENDPOINT/status/test-job-id"

# List agents (should return empty array initially)
curl "$API_ENDPOINT/agents"
```

### Local Testing with SAM

Test Lambda functions locally using SAM:

```bash
# Start local API Gateway
npm run sam:local

# The API will be available at http://localhost:3000

# Test in another terminal
curl http://localhost:3000/health
```

### Viewing Stack Resources

List all resources created by the stack:

```bash
aws cloudformation describe-stack-resources \
  --stack-name pdf-lecture-service-dev \
  --output table
```

### Checking Stack Status

```bash
aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-dev \
  --query 'Stacks[0].StackStatus'
```

Possible statuses:
- `CREATE_IN_PROGRESS` - Stack is being created
- `CREATE_COMPLETE` - Stack created successfully
- `UPDATE_IN_PROGRESS` - Stack is being updated
- `UPDATE_COMPLETE` - Stack updated successfully
- `ROLLBACK_IN_PROGRESS` - Stack creation/update failed, rolling back
- `DELETE_IN_PROGRESS` - Stack is being deleted

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

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main        # Deploy to production
      - staging     # Deploy to staging
      - develop     # Deploy to development

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linter
        run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Setup AWS SAM
        uses: aws-actions/setup-sam@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Install dependencies
        run: npm ci
      
      - name: Determine stage
        id: stage
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "stage=prod" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "stage=staging" >> $GITHUB_OUTPUT
          else
            echo "stage=dev" >> $GITHUB_OUTPUT
          fi
      
      - name: Build and deploy
        run: |
          npm run build
          npm run bundle
          sam build
          sam deploy --config-env ${{ steps.stage.outputs.stage }} --no-confirm-changeset --no-fail-on-empty-changeset
      
      - name: Get API endpoint
        run: |
          API_ENDPOINT=$(aws cloudformation describe-stacks \
            --stack-name pdf-lecture-service-${{ steps.stage.outputs.stage }} \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
            --output text)
          echo "API Endpoint: $API_ENDPOINT"
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

variables:
  AWS_DEFAULT_REGION: us-east-1

test:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm test
    - npm run lint
  only:
    - branches

build:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
    - npm run bundle
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour
  only:
    - main
    - staging
    - develop

deploy:dev:
  stage: deploy
  image: public.ecr.aws/sam/build-nodejs20.x
  script:
    - sam build
    - sam deploy --config-env default --no-confirm-changeset
  only:
    - develop

deploy:staging:
  stage: deploy
  image: public.ecr.aws/sam/build-nodejs20.x
  script:
    - sam build
    - sam deploy --config-env staging --no-confirm-changeset
  only:
    - staging

deploy:prod:
  stage: deploy
  image: public.ecr.aws/sam/build-nodejs20.x
  script:
    - sam build
    - sam deploy --config-env prod --no-confirm-changeset
  only:
    - main
  when: manual
```

### Required Secrets

Add these secrets to your CI/CD platform:

- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `OPENAI_API_KEY` - OpenAI API key (if using)
- `ANTHROPIC_API_KEY` - Anthropic API key (if using)
- `TTS_API_KEY` - TTS provider API key

### Deployment Notifications

Add Slack notifications to GitHub Actions:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment to ${{ steps.stage.outputs.stage }} ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Security Best Practices

### API Key Management

1. **Rotate API keys regularly** (every 90 days)
2. **Use different keys for each environment** (dev, staging, prod)
3. **Store keys in AWS Secrets Manager**, not in code or environment variables
4. **Enable API Gateway usage plans** to track and limit API usage

### IAM Permissions

1. **Use least privilege principle** - Grant only necessary permissions
2. **Create separate IAM roles** for each Lambda function
3. **Enable MFA** for AWS console access
4. **Use IAM roles for service-to-service** communication, not access keys

### Data Encryption

1. **Enable S3 bucket encryption** (AES-256 or KMS)
2. **Enable DynamoDB encryption** at rest
3. **Use TLS 1.3** for all data in transit
4. **Enable CloudWatch Logs encryption**

### Network Security

1. **Deploy Lambda functions in VPC** for production (optional but recommended)
2. **Use VPC endpoints** for AWS service access
3. **Enable AWS WAF** on API Gateway to protect against common attacks
4. **Use CloudFront** with signed URLs for content delivery

### Secrets Management

Store sensitive credentials in AWS Secrets Manager:

```bash
# Store OpenAI API key
aws secretsmanager create-secret \
  --name pdf-lecture-service/openai-api-key \
  --secret-string "sk-your-key-here"

# Store TTS API key
aws secretsmanager create-secret \
  --name pdf-lecture-service/tts-api-key \
  --secret-string "your-tts-key-here"
```

Update Lambda functions to retrieve secrets:

```typescript
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

async function getSecret(secretName: string): Promise<string> {
  const result = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  return result.SecretString!;
}

const openaiKey = await getSecret('pdf-lecture-service/openai-api-key');
```

### Monitoring and Auditing

1. **Enable CloudTrail** for API call logging
2. **Set up CloudWatch alarms** for suspicious activity
3. **Review IAM Access Analyzer** findings regularly
4. **Enable AWS Config** for compliance monitoring

### Input Validation

1. **Validate all user inputs** at API Gateway level
2. **Implement rate limiting** to prevent abuse
3. **Sanitize file uploads** to prevent malicious content
4. **Set maximum file sizes** to prevent resource exhaustion

### Compliance

1. **GDPR compliance** - Implement data deletion policies
2. **Data retention** - Delete old jobs after 30 days
3. **Privacy policy** - Document data handling practices
4. **Terms of service** - Define acceptable use

---

## Post-Deployment Steps

### 1. Create API Keys

Create API keys in API Gateway:

```bash
# Create API key
aws apigateway create-api-key \
  --name pdf-lecture-service-key \
  --enabled

# Create usage plan
aws apigateway create-usage-plan \
  --name pdf-lecture-service-plan \
  --throttle burstLimit=100,rateLimit=50 \
  --quota limit=10000,period=MONTH

# Associate API key with usage plan
aws apigateway create-usage-plan-key \
  --usage-plan-id <usage-plan-id> \
  --key-id <api-key-id> \
  --key-type API_KEY
```

### 2. Configure External Services

Store external API credentials in Secrets Manager (see Security section above).

### 3. Create Default Lecture Agents

Create some default agents for users:

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name pdf-lecture-service-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Create enthusiastic agent
curl -X POST "$API_ENDPOINT/agents" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "name": "Dr. Enthusiastic",
    "description": "An energetic professor who loves making science fun",
    "personality": {
      "instructions": "Explain concepts with enthusiasm and use relatable analogies",
      "tone": "enthusiastic"
    },
    "voice": {
      "voiceId": "en-US-Neural2-A",
      "speed": 1.1,
      "pitch": 2
    }
  }'

# Create serious agent
curl -X POST "$API_ENDPOINT/agents" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "name": "Professor Serious",
    "description": "A formal academic who maintains scholarly rigor",
    "personality": {
      "instructions": "Maintain academic tone and precise terminology",
      "tone": "formal"
    },
    "voice": {
      "voiceId": "en-US-Neural2-D",
      "speed": 0.95,
      "pitch": -2
    }
  }'
```

### 4. Test the Complete Pipeline

Upload a test PDF and verify the entire pipeline:

```bash
# Upload PDF
JOB_ID=$(curl -X POST "$API_ENDPOINT/upload" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "file": "base64-encoded-pdf",
    "filename": "test.pdf"
  }' | jq -r '.jobId')

# Monitor status
while true; do
  STATUS=$(curl "$API_ENDPOINT/status/$JOB_ID" \
    -H "x-api-key: your-api-key" | jq -r '.status')
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  
  sleep 10
done

# Access playback interface
echo "Playback URL: $API_ENDPOINT/player/$JOB_ID"
```

### 5. Set Up Monitoring and Alerts

Create CloudWatch alarms for critical metrics:

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name pdf-lecture-high-errors \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# Long duration alarm
aws cloudwatch put-metric-alarm \
  --alarm-name pdf-lecture-long-duration \
  --alarm-description "Alert when function duration exceeds 5 minutes" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 300000 \
  --comparison-operator GreaterThanThreshold
```

### 6. Configure Backup and Disaster Recovery

Enable point-in-time recovery for DynamoDB:

```bash
aws dynamodb update-continuous-backups \
  --table-name pdf-lecture-service-prod-jobs \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

Enable S3 versioning:

```bash
aws s3api put-bucket-versioning \
  --bucket pdf-lecture-service-prod-pdfs \
  --versioning-configuration Status=Enabled
```

---

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [CloudWatch Documentation](https://docs.aws.amazon.com/cloudwatch/)

---

## Support

For deployment issues:
- Check [Troubleshooting](#monitoring-and-troubleshooting) section
- Review CloudWatch Logs
- Open GitHub issue with deployment logs
- Contact AWS Support for infrastructure issues

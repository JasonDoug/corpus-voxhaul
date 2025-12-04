# Migration Guide: AWS SDK v3 & Node.js 20 Upgrade

## Overview

This guide covers migrating from AWS SDK v2 to v3 and upgrading from Node.js 18 to Node.js 20 LTS.

**Estimated Time:** 3-5 hours  
**Difficulty:** Medium  
**Benefits:**
- 85% smaller Lambda bundle sizes (~5-10 MB vs ~70 MB)
- 30-50% faster cold starts
- Lower memory requirements (can reduce from 1024 MB back to 512 MB)
- Better TypeScript support
- Modern promise-based API
- Node.js 20 performance improvements and security updates

## Prerequisites

- Backup current deployment
- Test environment available
- Node.js 20 installed locally: `nvm install 20 && nvm use 20`

---

## Part 1: Node.js 20 Upgrade

### Step 1.1: Update Lambda Runtime in template.yaml

**File:** `template.yaml`

**Change:**
```yaml
# Find all occurrences of:
Runtime: nodejs18.x

# Replace with:
Runtime: nodejs20.x
```

**Locations to update:**
- `Globals.Function.Runtime`
- All individual function definitions (if any override the global)

### Step 1.2: Update package.json

**File:** `package.json`

**Change:**
```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Step 1.3: Update TypeScript Target (Optional but Recommended)

**File:** `tsconfig.json`

**Change:**
```json
{
  "compilerOptions": {
    "target": "ES2022",  // Node 20 supports ES2022
    "lib": ["ES2022"]
  }
}
```

### Step 1.4: Update esbuild Target

**File:** `template.yaml`

**Change in all function Metadata sections:**
```yaml
BuildProperties:
  Target: es2022  # Change from es2022 to es2023 (Node 20 supports ES2023)
```

---

## Part 2: AWS SDK v3 Migration

### Step 2.1: Install AWS SDK v3 Packages

```bash
# Install required SDK v3 packages
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-eventbridge

# Remove SDK v2
npm uninstall aws-sdk
```

**Package sizes comparison:**
- `aws-sdk` (v2): ~70 MB
- `@aws-sdk/client-s3`: ~2 MB
- `@aws-sdk/client-dynamodb`: ~1.5 MB
- `@aws-sdk/lib-dynamodb`: ~500 KB
- `@aws-sdk/client-eventbridge`: ~1 MB

### Step 2.2: Update S3 Service (src/services/s3.ts)

**Current imports:**
```typescript
import AWS from 'aws-sdk';
```

**New imports:**
```typescript
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
```

**Current client initialization:**
```typescript
const s3Config: AWS.S3.ClientConfiguration = {
  region: config.aws.region,
  s3ForcePathStyle: true,
  httpOptions: {
    timeout: 30000,
    connectTimeout: 5000,
  },
  maxRetries: 0,
};

if (config.localstack.useLocalStack) {
  s3Config.endpoint = config.localstack.endpoint;
  s3Config.accessKeyId = 'test';
  s3Config.secretAccessKey = 'test';
}

const s3 = new AWS.S3(s3Config);
```

**New client initialization:**
```typescript
const s3Config = {
  region: config.aws.region,
  forcePathStyle: true,  // Note: different property name
  requestHandler: {
    requestTimeout: 30000,
    connectionTimeout: 5000,
  },
  maxAttempts: 1,  // We handle retries ourselves
};

if (config.localstack.useLocalStack) {
  s3Config.endpoint = config.localstack.endpoint;
  s3Config.credentials = {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };
}

const s3Client = new S3Client(s3Config);
```

**Example function migration - uploadPDF:**

**Before (SDK v2):**
```typescript
export async function uploadPDF(jobId: string, pdfBuffer: Buffer, filename: string): Promise<string> {
  return withRetry(async () => {
    try {
      const key = `${jobId}/original.pdf`;
      
      await s3.putObject({
        Bucket: config.s3.pdfBucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          originalFilename: filename,
          jobId,
        },
      }).promise();  // Note: .promise() call
      
      logger.info('PDF uploaded', { jobId, key });
      
      if (config.localstack.useLocalStack) {
        return `${config.localstack.endpoint}/${config.s3.pdfBucket}/${key}`;
      }
      return `https://${config.s3.pdfBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
    } catch (error) {
      handleS3Error(error, 'uploadPDF');
    }
  }, { maxAttempts: 3, initialDelayMs: 1000 });
}
```

**After (SDK v3):**
```typescript
export async function uploadPDF(jobId: string, pdfBuffer: Buffer, filename: string): Promise<string> {
  return withRetry(async () => {
    try {
      const key = `${jobId}/original.pdf`;
      
      const command = new PutObjectCommand({
        Bucket: config.s3.pdfBucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          originalFilename: filename,
          jobId,
        },
      });
      
      await s3Client.send(command);  // No .promise() needed!
      
      logger.info('PDF uploaded', { jobId, key });
      
      if (config.localstack.useLocalStack) {
        return `${config.localstack.endpoint}/${config.s3.pdfBucket}/${key}`;
      }
      return `https://${config.s3.pdfBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
    } catch (error) {
      handleS3Error(error, 'uploadPDF');
    }
  }, { maxAttempts: 3, initialDelayMs: 1000 });
}
```

**Example - downloadPDF:**

**Before:**
```typescript
export async function downloadPDF(jobId: string): Promise<Buffer> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const result = await s3.getObject({
      Bucket: config.s3.pdfBucket,
      Key: key,
    }).promise();
    
    return result.Body as Buffer;
  } catch (error) {
    handleS3Error(error, 'downloadPDF');
  }
}
```

**After:**
```typescript
export async function downloadPDF(jobId: string): Promise<Buffer> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    const result = await s3Client.send(command);
    
    // In SDK v3, Body is a stream that needs to be converted
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    handleS3Error(error, 'downloadPDF');
  }
}
```

**Example - getSignedUrl:**

**Before:**
```typescript
export async function getPDFSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const url = s3.getSignedUrl('getObject', {
      Bucket: config.s3.pdfBucket,
      Key: key,
      Expires: expiresIn,
    });
    
    return url;
  } catch (error) {
    handleS3Error(error, 'getPDFSignedUrl');
  }
}
```

**After:**
```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getPDFSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    return url;
  } catch (error) {
    handleS3Error(error, 'getPDFSignedUrl');
  }
}
```

### Step 2.3: Update DynamoDB Service (src/services/dynamodb.ts)

**Current imports:**
```typescript
import AWS from 'aws-sdk';
```

**New imports:**
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
```

**Current client initialization:**
```typescript
const dynamoDBConfig: AWS.DynamoDB.ClientConfiguration = {
  region: config.aws.region,
};

if (config.localstack.useLocalStack) {
  dynamoDBConfig.endpoint = config.localstack.endpoint;
  dynamoDBConfig.accessKeyId = 'test';
  dynamoDBConfig.secretAccessKey = 'test';
}

const dynamoDB = new AWS.DynamoDB.DocumentClient(dynamoDBConfig);
```

**New client initialization:**
```typescript
const dynamoDBConfig = {
  region: config.aws.region,
};

if (config.localstack.useLocalStack) {
  dynamoDBConfig.endpoint = config.localstack.endpoint;
  dynamoDBConfig.credentials = {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };
}

const client = new DynamoDBClient(dynamoDBConfig);
const dynamoDB = DynamoDBDocumentClient.from(client);
```

**Example function migration - createJob:**

**Before:**
```typescript
export async function createJob(job: Job): Promise<void> {
  try {
    await dynamoDB.put({
      TableName: config.dynamodb.jobsTable,
      Item: job,
    }).promise();
    
    logger.info('Job created', { jobId: job.jobId });
  } catch (error) {
    handleDynamoDBError(error, 'createJob');
  }
}
```

**After:**
```typescript
export async function createJob(job: Job): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: config.dynamodb.jobsTable,
      Item: job,
    });
    
    await dynamoDB.send(command);
    
    logger.info('Job created', { jobId: job.jobId });
  } catch (error) {
    handleDynamoDBError(error, 'createJob');
  }
}
```

**Example - getJob:**

**Before:**
```typescript
export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const result = await dynamoDB.get({
      TableName: config.dynamodb.jobsTable,
      Key: { jobId },
    }).promise();
    
    return result.Item as Job || null;
  } catch (error) {
    handleDynamoDBError(error, 'getJob');
  }
}
```

**After:**
```typescript
export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const command = new GetCommand({
      TableName: config.dynamodb.jobsTable,
      Key: { jobId },
    });
    
    const result = await dynamoDB.send(command);
    
    return result.Item as Job || null;
  } catch (error) {
    handleDynamoDBError(error, 'getJob');
  }
}
```

**Example - listAgents (Scan):**

**Before:**
```typescript
export async function listAgents(): Promise<LectureAgent[]> {
  try {
    const result = await dynamoDB.scan({
      TableName: config.dynamodb.agentsTable,
    }).promise();
    
    return result.Items as LectureAgent[] || [];
  } catch (error) {
    handleDynamoDBError(error, 'listAgents');
  }
}
```

**After:**
```typescript
export async function listAgents(): Promise<LectureAgent[]> {
  try {
    const command = new ScanCommand({
      TableName: config.dynamodb.agentsTable,
    });
    
    const result = await dynamoDB.send(command);
    
    return result.Items as LectureAgent[] || [];
  } catch (error) {
    handleDynamoDBError(error, 'listAgents');
  }
}
```

### Step 2.4: Update EventBridge Service (if applicable)

**Current imports:**
```typescript
import AWS from 'aws-sdk';
```

**New imports:**
```typescript
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
```

**Current client:**
```typescript
const eventBridge = new AWS.EventBridge({ region: config.aws.region });
```

**New client:**
```typescript
const eventBridgeClient = new EventBridgeClient({ region: config.aws.region });
```

**Example - publishEvent:**

**Before:**
```typescript
await eventBridge.putEvents({
  Entries: [{
    Source: 'pdf-lecture-service',
    DetailType: 'JobCreated',
    Detail: JSON.stringify({ jobId }),
    EventBusName: config.eventBusName,
  }],
}).promise();
```

**After:**
```typescript
const command = new PutEventsCommand({
  Entries: [{
    Source: 'pdf-lecture-service',
    DetailType: 'JobCreated',
    Detail: JSON.stringify({ jobId }),
    EventBusName: config.eventBusName,
  }],
});

await eventBridgeClient.send(command);
```

### Step 2.5: Update Error Handling

SDK v3 has different error types. Update error handling:

**Before:**
```typescript
function handleS3Error(error: any, operation: string): never {
  logger.error(`S3 ${operation} failed`, { error: error.message, code: error.code });
  
  if (error.code === 'NoSuchBucket') {
    throw new ResourceError(`Bucket not found: ${operation}`);
  }
  // ...
}
```

**After:**
```typescript
import { S3ServiceException } from '@aws-sdk/client-s3';

function handleS3Error(error: any, operation: string): never {
  logger.error(`S3 ${operation} failed`, { error: error.message, code: error.name });
  
  // In SDK v3, error.name is used instead of error.code
  if (error.name === 'NoSuchBucket') {
    throw new ResourceError(`Bucket not found: ${operation}`);
  }
  
  if (error instanceof S3ServiceException) {
    // Handle S3-specific errors
  }
  // ...
}
```

### Step 2.6: Update template.yaml - Remove External Dependencies

Since SDK v3 is modular, we can now safely bundle it:

**File:** `template.yaml`

**Remove from all function Metadata sections:**
```yaml
# Remove this entire External section or just remove aws-sdk
External:
  - canvas
  # aws-sdk is no longer needed here
```

### Step 2.7: Reduce Lambda Memory

With smaller bundles, we can reduce memory:

**File:** `template.yaml`

**Change StatusFunction:**
```yaml
StatusFunction:
  Properties:
    MemorySize: 512  # Reduce from 1024 back to 512
```

**Consider reducing other functions too:**
```yaml
UploadFunction:
  Properties:
    MemorySize: 512  # Could reduce from 1024 to 512

AgentsFunction:
  Properties:
    MemorySize: 512  # Could reduce from 1024 to 512
```

---

## Part 3: Testing

### Step 3.1: Local Testing

```bash
# Build locally
npm run build

# Test with SAM local
sam build
sam local invoke UploadFunction --event test-events/upload.json
sam local invoke StatusFunction --event test-events/status.json
sam local invoke AgentsFunction --event test-events/agents.json
```

### Step 3.2: Unit Tests

Update any mocked AWS SDK calls in tests:

**Before:**
```typescript
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    putObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
  })),
}));
```

**After:**
```typescript
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: jest.fn(),
    })),
  },
  PutCommand: jest.fn(),
}));
```

### Step 3.3: Deploy to Test Environment

```bash
# Deploy to test/dev
export AWS_PROFILE=admin
export OPENROUTER_API_KEY="your-key"

sam build
sam deploy --config-env dev --parameter-overrides "Stage=dev OpenRouterApiKey=$OPENROUTER_API_KEY"
```

### Step 3.4: Smoke Tests

```bash
# Test all endpoints
curl -X GET "https://your-api.execute-api.us-west-2.amazonaws.com/dev/agents" \
  -H "x-api-key: your-key"

curl -X POST "https://your-api.execute-api.us-west-2.amazonaws.com/dev/upload" \
  -H "x-api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"file": "base64-pdf", "filename": "test.pdf", "agentId": "test-id"}'

curl -X GET "https://your-api.execute-api.us-west-2.amazonaws.com/dev/status/job-id" \
  -H "x-api-key: your-key"
```

### Step 3.5: Monitor CloudWatch

Check for:
- Cold start times (should be 30-50% faster)
- Memory usage (should be significantly lower)
- Error rates (should be same or better)
- Duration (should be similar or faster)

---

## Part 4: Verification Checklist

- [ ] Node.js 20 runtime updated in template.yaml
- [ ] All AWS SDK v2 imports replaced with v3
- [ ] All `.promise()` calls removed
- [ ] Error handling updated for SDK v3 error types
- [ ] S3 client using new command pattern
- [ ] DynamoDB client using DynamoDBDocumentClient
- [ ] EventBridge client updated (if used)
- [ ] External dependencies removed from esbuild config
- [ ] Lambda memory reduced where appropriate
- [ ] Local tests passing
- [ ] Unit tests updated and passing
- [ ] Deployed to test environment
- [ ] Smoke tests passing
- [ ] CloudWatch metrics look healthy
- [ ] Bundle sizes reduced (check in .aws-sam/build)
- [ ] Cold start times improved

---

## Expected Results

### Bundle Size Comparison

**Before (SDK v2):**
```
UploadFunction: ~72 MB
StatusFunction: ~70 MB
AgentsFunction: ~70 MB
```

**After (SDK v3):**
```
UploadFunction: ~8 MB (89% reduction)
StatusFunction: ~5 MB (93% reduction)
AgentsFunction: ~6 MB (91% reduction)
```

### Performance Improvements

- **Cold start**: 30-50% faster (from ~2.5s to ~1.5s)
- **Memory usage**: 40-60% lower
- **Execution time**: Similar or slightly faster
- **Cost**: ~30% reduction due to lower memory and faster execution

---

## Rollback Plan

If issues arise:

1. **Quick rollback:**
   ```bash
   git revert <commit-hash>
   sam build
   sam deploy
   ```

2. **Restore from backup:**
   - Restore previous CloudFormation stack
   - Redeploy previous version

3. **Gradual rollback:**
   - Keep SDK v3 but revert Node.js 20 to 18
   - Or keep Node.js 20 but revert to SDK v2

---

## Common Issues & Solutions

### Issue 1: Stream Handling in SDK v3

**Problem:** SDK v3 returns streams differently

**Solution:**
```typescript
// Helper function for converting streams
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Use in getObject
const result = await s3Client.send(new GetObjectCommand({...}));
const buffer = await streamToBuffer(result.Body);
```

### Issue 2: Error Names vs Codes

**Problem:** SDK v3 uses `error.name` instead of `error.code`

**Solution:** Update all error handling to check `error.name`

### Issue 3: Credentials Configuration

**Problem:** Credentials structure changed

**Solution:**
```typescript
// SDK v2
config.accessKeyId = 'test';
config.secretAccessKey = 'test';

// SDK v3
config.credentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
};
```

### Issue 4: TypeScript Types

**Problem:** Type imports changed

**Solution:**
```typescript
// Import types from SDK v3
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
```

---

## Additional Resources

- [AWS SDK v3 Migration Guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrating-to-v3.html)
- [Node.js 20 Release Notes](https://nodejs.org/en/blog/release/v20.0.0)
- [AWS Lambda Node.js 20 Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [SDK v3 Code Examples](https://github.com/awsdocs/aws-doc-sdk-examples/tree/main/javascriptv3)

---

## Timeline Estimate

| Task | Time | Priority |
|------|------|----------|
| Node.js 20 upgrade | 30 min | High |
| S3 service migration | 1-2 hours | High |
| DynamoDB service migration | 1-2 hours | High |
| EventBridge migration | 30 min | Medium |
| Error handling updates | 30 min | High |
| Test updates | 1 hour | High |
| Testing & validation | 1-2 hours | High |
| **Total** | **5-8 hours** | |

---

## Success Criteria

✅ All endpoints responding correctly  
✅ Bundle sizes reduced by >80%  
✅ Cold starts improved by >30%  
✅ Memory usage reduced by >40%  
✅ No increase in error rates  
✅ All tests passing  
✅ CloudWatch metrics healthy  
✅ Cost reduction visible in billing

// S3 client wrapper with local/production mode support
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Readable } from 'stream';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ResourceError, ExternalServiceError } from '../utils/errors';
import { withRetry } from '../utils/retry';

// Configure AWS SDK based on environment
const s3Config: any = {
  region: config.aws.region,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 30000,
    connectionTimeout: 5000,
  }),
};

if (config.localstack.useLocalStack) {
  s3Config.endpoint = config.localstack.endpoint;
  s3Config.forcePathStyle = true;
  s3Config.credentials = {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };
}
// In Lambda, don't set credentials - they're provided automatically via execution role

const s3Client = new S3Client(s3Config);

// Helper function to convert S3 stream to Buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  if (!stream) {
    throw new Error('Stream is undefined');
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Helper function to handle S3 errors
function handleS3Error(error: any, operation: string): never {
  logger.error(`S3 ${operation} failed`, { error: error.message, code: error.name });
  
  // In SDK v3, error.name is used instead of error.code
  if (error.name === 'RequestTimeout' || error.name === 'TimeoutError') {
    throw new ResourceError(`Storage operation timed out: ${operation}`, { error: error.message });
  }
  
  if (error.name === 'NoSuchBucket' || error.name === 'NoSuchKey' || error.name === 'NotFound') {
    throw new ResourceError(`Storage resource not found: ${operation}`, { error: error.message });
  }
  
  throw new ExternalServiceError(`Storage operation failed: ${operation}`, 's3', { error: error.message });
}

// ============================================================================
// PDF Operations
// ============================================================================

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
      
      await s3Client.send(command);
      
      logger.info('PDF uploaded', { jobId, key });
      
      // Return the S3 URL
      if (config.localstack.useLocalStack) {
        return `${config.localstack.endpoint}/${config.s3.pdfBucket}/${key}`;
      }
      return `https://${config.s3.pdfBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
    } catch (error) {
      handleS3Error(error, 'uploadPDF');
    }
  }, { maxAttempts: 3, initialDelayMs: 1000 });
}

export async function downloadPDF(jobId: string): Promise<Buffer> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    const result = await s3Client.send(command);
    
    logger.info('PDF downloaded', { jobId, key });
    return await streamToBuffer(result.Body);
  } catch (error) {
    handleS3Error(error, 'downloadPDF');
  }
}

export async function streamPDF(jobId: string): Promise<Readable> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    const result = await s3Client.send(command);
    
    logger.info('PDF stream created', { jobId, key });
    return result.Body as Readable;
  } catch (error) {
    handleS3Error(error, 'streamPDF');
  }
}

export async function deletePDF(jobId: string): Promise<void> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new DeleteObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    await s3Client.send(command);
    
    logger.info('PDF deleted', { jobId, key });
  } catch (error) {
    handleS3Error(error, 'deletePDF');
  }
}

export async function getPDFSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${jobId}/original.pdf`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    logger.info('PDF signed URL generated', { jobId, expiresIn });
    return url;
  } catch (error) {
    handleS3Error(error, 'getPDFSignedUrl');
  }
}

// ============================================================================
// Audio Operations
// ============================================================================

export async function uploadAudio(jobId: string, audioBuffer: Buffer): Promise<string> {
  try {
    const key = `${jobId}/lecture.mp3`;
    
    const command = new PutObjectCommand({
      Bucket: config.s3.audioBucket,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      Metadata: {
        jobId,
      },
    });
    
    await s3Client.send(command);
    
    logger.info('Audio uploaded', { jobId, key });
    
    // Return the S3 URL
    if (config.localstack.useLocalStack) {
      return `${config.localstack.endpoint}/${config.s3.audioBucket}/${key}`;
    }
    return `https://${config.s3.audioBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    handleS3Error(error, 'uploadAudio');
  }
}

export async function downloadAudio(jobId: string): Promise<Buffer> {
  try {
    const key = `${jobId}/lecture.mp3`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.audioBucket,
      Key: key,
    });
    
    const result = await s3Client.send(command);
    
    logger.info('Audio downloaded', { jobId, key });
    return await streamToBuffer(result.Body);
  } catch (error) {
    handleS3Error(error, 'downloadAudio');
  }
}

export async function streamAudio(jobId: string): Promise<Readable> {
  try {
    const key = `${jobId}/lecture.mp3`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.audioBucket,
      Key: key,
    });
    
    const result = await s3Client.send(command);
    
    logger.info('Audio stream created', { jobId, key });
    return result.Body as Readable;
  } catch (error) {
    handleS3Error(error, 'streamAudio');
  }
}

export async function deleteAudio(jobId: string): Promise<void> {
  try {
    const key = `${jobId}/lecture.mp3`;
    
    const command = new DeleteObjectCommand({
      Bucket: config.s3.audioBucket,
      Key: key,
    });
    
    await s3Client.send(command);
    
    logger.info('Audio deleted', { jobId, key });
  } catch (error) {
    handleS3Error(error, 'deleteAudio');
  }
}

export async function getAudioSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${jobId}/lecture.mp3`;
    
    const command = new GetObjectCommand({
      Bucket: config.s3.audioBucket,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    logger.info('Audio signed URL generated', { jobId, expiresIn });
    return url;
  } catch (error) {
    handleS3Error(error, 'getAudioSignedUrl');
  }
}

// ============================================================================
// Cache Operations (for figures, etc.)
// ============================================================================

export async function uploadCacheFile(
  jobId: string,
  fileType: 'figure' | 'table',
  fileId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const key = `${config.s3.cachePrefix}/${jobId}/${fileType}s/${fileId}.${extension}`;
    
    const command = new PutObjectCommand({
      Bucket: config.s3.pdfBucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        jobId,
        fileType,
        fileId,
      },
    });
    
    await s3Client.send(command);
    
    logger.info('Cache file uploaded', { jobId, fileType, fileId, key });
    
    // Return the S3 URL
    if (config.localstack.useLocalStack) {
      return `${config.localstack.endpoint}/${config.s3.pdfBucket}/${key}`;
    }
    return `https://${config.s3.pdfBucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    handleS3Error(error, 'uploadCacheFile');
  }
}

export async function downloadCacheFile(jobId: string, fileType: string, fileId: string): Promise<Buffer> {
  try {
    // Try both png and jpg extensions
    const extensions = ['png', 'jpg'];
    let lastError: any;
    
    for (const ext of extensions) {
      try {
        const key = `${config.s3.cachePrefix}/${jobId}/${fileType}s/${fileId}.${ext}`;
        const command = new GetObjectCommand({
          Bucket: config.s3.pdfBucket,
          Key: key,
        });
        
        const result = await s3Client.send(command);
        
        logger.info('Cache file downloaded', { jobId, fileType, fileId, key });
        return await streamToBuffer(result.Body);
      } catch (error: any) {
        lastError = error;
        if (error.name !== 'NoSuchKey') {
          throw error;
        }
      }
    }
    
    throw lastError;
  } catch (error) {
    handleS3Error(error, 'downloadCacheFile');
  }
}

export async function deleteCacheFiles(jobId: string): Promise<void> {
  try {
    const prefix = `${config.s3.cachePrefix}/${jobId}/`;
    
    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: config.s3.pdfBucket,
      Prefix: prefix,
    });
    
    const listResult = await s3Client.send(listCommand);
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      logger.info('No cache files to delete', { jobId });
      return;
    }
    
    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: config.s3.pdfBucket,
      Delete: {
        Objects: listResult.Contents.map(obj => ({ Key: obj.Key! })),
      },
    });
    
    await s3Client.send(deleteCommand);
    
    logger.info('Cache files deleted', { jobId, count: listResult.Contents.length });
  } catch (error) {
    handleS3Error(error, 'deleteCacheFiles');
  }
}

// ============================================================================
// Bucket Management (for local development)
// ============================================================================

export async function createBucketIfNotExists(): Promise<void> {
  if (!config.localstack.useLocalStack) {
    logger.info('Skipping bucket creation in production mode');
    return;
  }
  
  try {
    const headCommand = new HeadBucketCommand({ Bucket: config.s3.pdfBucket });
    await s3Client.send(headCommand);
    logger.info(`Bucket ${config.s3.pdfBucket} already exists`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
      try {
        const createCommand = new CreateBucketCommand({ Bucket: config.s3.pdfBucket });
        await s3Client.send(createCommand);
        logger.info(`Bucket ${config.s3.pdfBucket} created`);
      } catch (createError) {
        logger.error(`Failed to create bucket ${config.s3.pdfBucket}`, { error: createError });
      }
    } else {
      logger.error('Error checking bucket existence', { error });
    }
  }
}

// ============================================================================
// Cleanup Operations
// ============================================================================

export async function deleteAllJobFiles(jobId: string): Promise<void> {
  try {
    await Promise.all([
      deletePDF(jobId).catch(err => logger.warn('Failed to delete PDF', { jobId, error: err.message })),
      deleteAudio(jobId).catch(err => logger.warn('Failed to delete audio', { jobId, error: err.message })),
      deleteCacheFiles(jobId).catch(err => logger.warn('Failed to delete cache files', { jobId, error: err.message })),
    ]);
    
    logger.info('All job files deleted', { jobId });
  } catch (error) {
    logger.error('Error during job file cleanup', { jobId, error });
  }
}

// S3 client wrapper with local/production mode support
import AWS from 'aws-sdk';
import { Readable } from 'stream';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ResourceError, ExternalServiceError } from '../utils/errors';
import { withRetry } from '../utils/retry';

// Configure AWS SDK based on environment
const s3Config: AWS.S3.ClientConfiguration = {
  region: config.aws.region,
  s3ForcePathStyle: true, // Required for LocalStack
  httpOptions: {
    timeout: 30000, // 30 second timeout for operations
    connectTimeout: 5000, // 5 second connection timeout
  },
  maxRetries: 0, // We handle retries ourselves
};

if (config.localstack.useLocalStack) {
  s3Config.endpoint = config.localstack.endpoint;
  s3Config.accessKeyId = 'test';
  s3Config.secretAccessKey = 'test';
} else if (config.aws.accessKeyId && config.aws.secretAccessKey) {
  s3Config.accessKeyId = config.aws.accessKeyId;
  s3Config.secretAccessKey = config.aws.secretAccessKey;
}

const s3 = new AWS.S3(s3Config);

// Helper function to handle S3 errors
function handleS3Error(error: any, operation: string): never {
  logger.error(`S3 ${operation} failed`, { error: error.message, code: error.code });
  
  // Check for timeout errors
  if (error.code === 'RequestTimeout' || error.code === 'TimeoutError') {
    throw new ResourceError(`Storage operation timed out: ${operation}`, { error: error.message });
  }
  
  // Check for resource errors
  if (error.code === 'NoSuchBucket' || error.code === 'NoSuchKey') {
    throw new ResourceError(`Storage resource not found: ${operation}`, { error: error.message });
  }
  
  // Other errors are external service errors
  throw new ExternalServiceError(`Storage operation failed: ${operation}`, 's3', { error: error.message });
}

// ============================================================================
// PDF Operations
// ============================================================================

export async function uploadPDF(jobId: string, pdfBuffer: Buffer, filename: string): Promise<string> {
  return withRetry(async () => {
    try {
      const key = `${config.s3.pdfPrefix}/${jobId}/original.pdf`;
      
      await s3.putObject({
        Bucket: config.s3.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          originalFilename: filename,
          jobId,
        },
      }).promise();
      
      logger.info('PDF uploaded', { jobId, key });
      
      // Return the S3 URL
      if (config.localstack.useLocalStack) {
        return `${config.localstack.endpoint}/${config.s3.bucketName}/${key}`;
      }
      return `https://${config.s3.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
    } catch (error) {
      handleS3Error(error, 'uploadPDF');
    }
  }, { maxAttempts: 3, initialDelayMs: 1000 });
}

export async function downloadPDF(jobId: string): Promise<Buffer> {
  try {
    const key = `${config.s3.pdfPrefix}/${jobId}/original.pdf`;
    
    const result = await s3.getObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).promise();
    
    logger.info('PDF downloaded', { jobId, key });
    return result.Body as Buffer;
  } catch (error) {
    handleS3Error(error, 'downloadPDF');
  }
}

export async function streamPDF(jobId: string): Promise<Readable> {
  try {
    const key = `${config.s3.pdfPrefix}/${jobId}/original.pdf`;
    
    const stream = s3.getObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).createReadStream();
    
    logger.info('PDF stream created', { jobId, key });
    return stream;
  } catch (error) {
    handleS3Error(error, 'streamPDF');
  }
}

export async function deletePDF(jobId: string): Promise<void> {
  try {
    const key = `${config.s3.pdfPrefix}/${jobId}/original.pdf`;
    
    await s3.deleteObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).promise();
    
    logger.info('PDF deleted', { jobId, key });
  } catch (error) {
    handleS3Error(error, 'deletePDF');
  }
}

export async function getPDFSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${config.s3.pdfPrefix}/${jobId}/original.pdf`;
    
    const url = s3.getSignedUrl('getObject', {
      Bucket: config.s3.bucketName,
      Key: key,
      Expires: expiresIn,
    });
    
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
    const key = `${config.s3.audioPrefix}/${jobId}/lecture.mp3`;
    
    await s3.putObject({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      Metadata: {
        jobId,
      },
    }).promise();
    
    logger.info('Audio uploaded', { jobId, key });
    
    // Return the S3 URL
    if (config.localstack.useLocalStack) {
      return `${config.localstack.endpoint}/${config.s3.bucketName}/${key}`;
    }
    return `https://${config.s3.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
  } catch (error) {
    handleS3Error(error, 'uploadAudio');
  }
}

export async function downloadAudio(jobId: string): Promise<Buffer> {
  try {
    const key = `${config.s3.audioPrefix}/${jobId}/lecture.mp3`;
    
    const result = await s3.getObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).promise();
    
    logger.info('Audio downloaded', { jobId, key });
    return result.Body as Buffer;
  } catch (error) {
    handleS3Error(error, 'downloadAudio');
  }
}

export async function streamAudio(jobId: string): Promise<Readable> {
  try {
    const key = `${config.s3.audioPrefix}/${jobId}/lecture.mp3`;
    
    const stream = s3.getObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).createReadStream();
    
    logger.info('Audio stream created', { jobId, key });
    return stream;
  } catch (error) {
    handleS3Error(error, 'streamAudio');
  }
}

export async function deleteAudio(jobId: string): Promise<void> {
  try {
    const key = `${config.s3.audioPrefix}/${jobId}/lecture.mp3`;
    
    await s3.deleteObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }).promise();
    
    logger.info('Audio deleted', { jobId, key });
  } catch (error) {
    handleS3Error(error, 'deleteAudio');
  }
}

export async function getAudioSignedUrl(jobId: string, expiresIn: number = 3600): Promise<string> {
  try {
    const key = `${config.s3.audioPrefix}/${jobId}/lecture.mp3`;
    
    const url = s3.getSignedUrl('getObject', {
      Bucket: config.s3.bucketName,
      Key: key,
      Expires: expiresIn,
    });
    
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
    
    await s3.putObject({
      Bucket: config.s3.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        jobId,
        fileType,
        fileId,
      },
    }).promise();
    
    logger.info('Cache file uploaded', { jobId, fileType, fileId, key });
    
    // Return the S3 URL
    if (config.localstack.useLocalStack) {
      return `${config.localstack.endpoint}/${config.s3.bucketName}/${key}`;
    }
    return `https://${config.s3.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
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
        const result = await s3.getObject({
          Bucket: config.s3.bucketName,
          Key: key,
        }).promise();
        
        logger.info('Cache file downloaded', { jobId, fileType, fileId, key });
        return result.Body as Buffer;
      } catch (error: any) {
        lastError = error;
        if (error.code !== 'NoSuchKey') {
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
    const listResult = await s3.listObjectsV2({
      Bucket: config.s3.bucketName,
      Prefix: prefix,
    }).promise();
    
    if (!listResult.Contents || listResult.Contents.length === 0) {
      logger.info('No cache files to delete', { jobId });
      return;
    }
    
    // Delete all objects
    await s3.deleteObjects({
      Bucket: config.s3.bucketName,
      Delete: {
        Objects: listResult.Contents.map(obj => ({ Key: obj.Key! })),
      },
    }).promise();
    
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
    await s3.headBucket({ Bucket: config.s3.bucketName }).promise();
    logger.info(`Bucket ${config.s3.bucketName} already exists`);
  } catch (error: any) {
    if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
      try {
        await s3.createBucket({ Bucket: config.s3.bucketName }).promise();
        logger.info(`Bucket ${config.s3.bucketName} created`);
      } catch (createError) {
        logger.error(`Failed to create bucket ${config.s3.bucketName}`, { error: createError });
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

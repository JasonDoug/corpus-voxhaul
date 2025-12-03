// Configuration utilities
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  localMode: process.env.LOCAL_MODE === 'true',
  isLocal: process.env.NODE_ENV !== 'production',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  eventBusName: process.env.EVENT_BUS_NAME || 'pdf-lecture-service-events',
  
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  
  localstack: {
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    useLocalStack: process.env.USE_LOCALSTACK === 'true',
  },
  
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || 'pdf-lecture-service',
    pdfPrefix: process.env.S3_PDF_PREFIX || 'pdfs',
    audioPrefix: process.env.S3_AUDIO_PREFIX || 'audio',
    cachePrefix: process.env.S3_CACHE_PREFIX || 'cache',
  },
  
  dynamodb: {
    jobsTable: process.env.DYNAMODB_JOBS_TABLE || 'pdf-lecture-jobs',
    agentsTable: process.env.DYNAMODB_AGENTS_TABLE || 'pdf-lecture-agents',
    contentTable: process.env.DYNAMODB_CONTENT_TABLE || 'pdf-lecture-content',
  },
  
  processing: {
    maxPdfSizeMB: parseInt(process.env.MAX_PDF_SIZE_MB || '100', 10),
    analysisTimeoutMs: parseInt(process.env.ANALYSIS_TIMEOUT_MS || '300000', 10),
    audioSynthesisTimeoutMs: parseInt(process.env.AUDIO_SYNTHESIS_TIMEOUT_MS || '600000', 10),
  },
  
  featureFlags: {
    enableRealSegmentation: process.env.ENABLE_REAL_SEGMENTATION === 'true',
    enableRealScriptGeneration: process.env.ENABLE_REAL_SCRIPT_GENERATION === 'true',
    enableImageExtraction: process.env.ENABLE_IMAGE_EXTRACTION === 'true',
    enableVisionFirstPipeline: process.env.ENABLE_VISION_FIRST_PIPELINE === 'true',
  },
  
  vision: {
    model: process.env.VISION_MODEL || 'google/gemini-2.0-flash-exp:free',
    temperature: parseFloat(process.env.VISION_LLM_TEMPERATURE || '0.3'),
    maxTokens: parseInt(process.env.VISION_LLM_MAX_TOKENS || '4000', 10),
  },
};

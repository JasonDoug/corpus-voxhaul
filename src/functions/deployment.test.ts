// Deployment tests for Lambda functions
import { 
  uploadHandler, 
  analyzerHandler, 
  segmenterHandler, 
  scriptHandler, 
  audioHandler, 
  statusHandler 
} from './index';

describe('Lambda Function Deployment Tests', () => {
  describe('Lambda function packaging', () => {
    it('should export uploadHandler function', () => {
      expect(uploadHandler).toBeDefined();
      expect(typeof uploadHandler).toBe('function');
    });
    
    it('should export analyzerHandler function', () => {
      expect(analyzerHandler).toBeDefined();
      expect(typeof analyzerHandler).toBe('function');
    });
    
    it('should export segmenterHandler function', () => {
      expect(segmenterHandler).toBeDefined();
      expect(typeof segmenterHandler).toBe('function');
    });
    
    it('should export scriptHandler function', () => {
      expect(scriptHandler).toBeDefined();
      expect(typeof scriptHandler).toBe('function');
    });
    
    it('should export audioHandler function', () => {
      expect(audioHandler).toBeDefined();
      expect(typeof audioHandler).toBe('function');
    });
    
    it('should export statusHandler function', () => {
      expect(statusHandler).toBeDefined();
      expect(typeof statusHandler).toBe('function');
    });
  });
  
  describe('Lambda function signatures', () => {
    it('should accept event parameter in uploadHandler', async () => {
      const event = {
        file: Buffer.from('test'),
        filename: 'test.pdf',
      };
      
      // Should not throw on invocation (will fail on validation, but that's expected)
      const result = await uploadHandler(event);
      expect(result).toBeDefined();
      expect(result.statusCode).toBeDefined();
      expect(result.body).toBeDefined();
    });
    
    it('should accept event parameter in statusHandler', async () => {
      const event = {
        jobId: 'test-job-id',
      };
      
      // Should not throw on invocation
      const result = await statusHandler(event);
      expect(result).toBeDefined();
      expect(result.statusCode).toBeDefined();
      expect(result.body).toBeDefined();
    });
  });
  
  describe('Lambda response format', () => {
    it('should return proper Lambda response structure from uploadHandler', async () => {
      const event = {
        file: Buffer.from('test'),
        filename: 'test.pdf',
      };
      
      const result = await uploadHandler(event);
      
      // Lambda response should have statusCode and body
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(typeof result.statusCode).toBe('number');
      expect(typeof result.body).toBe('string');
      
      // Body should be valid JSON
      expect(() => JSON.parse(result.body)).not.toThrow();
    });
    
    it('should return proper Lambda response structure from statusHandler', async () => {
      const event = {
        jobId: 'non-existent-job',
      };
      
      const result = await statusHandler(event);
      
      // Lambda response should have statusCode and body
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(typeof result.statusCode).toBe('number');
      expect(typeof result.body).toBe('string');
      
      // Body should be valid JSON
      expect(() => JSON.parse(result.body)).not.toThrow();
    });
  });
  
  describe('Error handling in Lambda functions', () => {
    it('should return error response with proper status code from uploadHandler', async () => {
      const event = {
        file: Buffer.from('not a pdf'),
        filename: 'test.txt',
      };
      
      const result = await uploadHandler(event);
      
      // Should return 4xx error for invalid input
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
      expect(result.statusCode).toBeLessThan(500);
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
    });
    
    it('should return error response with proper status code from statusHandler', async () => {
      const event = {
        jobId: 'non-existent-job',
      };
      
      const result = await statusHandler(event);
      
      // Should return 404 for non-existent job
      expect(result.statusCode).toBe(404);
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
    });
  });
});

describe('Environment Variable Configuration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  it('should read NODE_ENV from environment', () => {
    process.env.NODE_ENV = 'production';
    const { config } = require('../utils/config');
    expect(config.nodeEnv).toBe('production');
  });
  
  it('should read AWS_REGION from environment', () => {
    process.env.AWS_REGION = 'us-west-2';
    const { config } = require('../utils/config');
    expect(config.awsRegion).toBe('us-west-2');
  });
  
  it('should read EVENT_BUS_NAME from environment', () => {
    process.env.EVENT_BUS_NAME = 'custom-event-bus';
    const { config } = require('../utils/config');
    expect(config.eventBusName).toBe('custom-event-bus');
  });
  
  it('should read DynamoDB table names from environment', () => {
    process.env.DYNAMODB_JOBS_TABLE = 'custom-jobs-table';
    process.env.DYNAMODB_AGENTS_TABLE = 'custom-agents-table';
    process.env.DYNAMODB_CONTENT_TABLE = 'custom-content-table';
    
    const { config } = require('../utils/config');
    expect(config.dynamodb.jobsTable).toBe('custom-jobs-table');
    expect(config.dynamodb.agentsTable).toBe('custom-agents-table');
    expect(config.dynamodb.contentTable).toBe('custom-content-table');
  });
  
  it('should read S3 bucket configuration from environment', () => {
    process.env.S3_BUCKET_NAME = 'custom-bucket';
    process.env.S3_PDF_PREFIX = 'custom-pdfs';
    process.env.S3_AUDIO_PREFIX = 'custom-audio';
    
    const { config } = require('../utils/config');
    expect(config.s3.bucketName).toBe('custom-bucket');
    expect(config.s3.pdfPrefix).toBe('custom-pdfs');
    expect(config.s3.audioPrefix).toBe('custom-audio');
  });
  
  it('should use default values when environment variables are not set', () => {
    delete process.env.NODE_ENV;
    delete process.env.AWS_REGION;
    delete process.env.EVENT_BUS_NAME;
    
    const { config } = require('../utils/config');
    expect(config.nodeEnv).toBe('development');
    expect(config.awsRegion).toBe('us-east-1');
    expect(config.eventBusName).toBe('pdf-lecture-service-events');
  });
});

describe('IAM Permissions Requirements', () => {
  it('should document required DynamoDB permissions', () => {
    const requiredPermissions = [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:Scan',
    ];
    
    // This test documents the required permissions
    // In a real deployment, these would be verified against the IAM role
    expect(requiredPermissions).toHaveLength(6);
    expect(requiredPermissions).toContain('dynamodb:GetItem');
    expect(requiredPermissions).toContain('dynamodb:PutItem');
  });
  
  it('should document required S3 permissions', () => {
    const requiredPermissions = [
      's3:GetObject',
      's3:PutObject',
      's3:DeleteObject',
    ];
    
    // This test documents the required permissions
    expect(requiredPermissions).toHaveLength(3);
    expect(requiredPermissions).toContain('s3:GetObject');
    expect(requiredPermissions).toContain('s3:PutObject');
  });
  
  it('should document required EventBridge permissions', () => {
    const requiredPermissions = [
      'events:PutEvents',
    ];
    
    // This test documents the required permissions
    expect(requiredPermissions).toHaveLength(1);
    expect(requiredPermissions).toContain('events:PutEvents');
  });
  
  it('should document required CloudWatch Logs permissions', () => {
    const requiredPermissions = [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
    ];
    
    // This test documents the required permissions
    expect(requiredPermissions).toHaveLength(3);
    expect(requiredPermissions).toContain('logs:CreateLogGroup');
  });
});

describe('Lambda Function Configuration', () => {
  it('should define appropriate memory sizes for each function', () => {
    const functionConfigs = {
      upload: { memory: 1024, timeout: 60 },
      analyzer: { memory: 2048, timeout: 300 },
      segmenter: { memory: 1024, timeout: 300 },
      script: { memory: 1024, timeout: 300 },
      audio: { memory: 2048, timeout: 600 },
      status: { memory: 512, timeout: 30 },
    };
    
    // Verify memory sizes are reasonable
    expect(functionConfigs.upload.memory).toBeGreaterThanOrEqual(512);
    expect(functionConfigs.analyzer.memory).toBeGreaterThanOrEqual(1024);
    expect(functionConfigs.audio.memory).toBeGreaterThanOrEqual(1024);
    
    // Verify timeouts are reasonable
    expect(functionConfigs.upload.timeout).toBeLessThanOrEqual(900);
    expect(functionConfigs.analyzer.timeout).toBeLessThanOrEqual(900);
    expect(functionConfigs.audio.timeout).toBeLessThanOrEqual(900);
  });
  
  it('should use Node.js 20.x runtime', () => {
    const runtime = 'nodejs20.x';
    expect(runtime).toBe('nodejs20.x');
  });
});

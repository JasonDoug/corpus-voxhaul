// Test configuration utilities
import { config } from './config';

describe('Configuration', () => {
  it('should load configuration values', () => {
    expect(config).toBeDefined();
    expect(config.nodeEnv).toBe('test');
    expect(config.localMode).toBe(true);
  });

  it('should have S3 configuration', () => {
    expect(config.s3.bucketName).toBeDefined();
    expect(config.s3.pdfPrefix).toBeDefined();
    expect(config.s3.audioPrefix).toBeDefined();
  });

  it('should have DynamoDB configuration', () => {
    expect(config.dynamodb.jobsTable).toBeDefined();
    expect(config.dynamodb.agentsTable).toBeDefined();
    expect(config.dynamodb.contentTable).toBeDefined();
  });

  it('should have processing configuration', () => {
    expect(config.processing.maxPdfSizeMB).toBeGreaterThan(0);
    expect(config.processing.analysisTimeoutMs).toBeGreaterThan(0);
    expect(config.processing.audioSynthesisTimeoutMs).toBeGreaterThan(0);
  });

  it('should have feature flags configuration', () => {
    expect(config.featureFlags).toBeDefined();
    expect(typeof config.featureFlags.enableRealSegmentation).toBe('boolean');
    expect(typeof config.featureFlags.enableRealScriptGeneration).toBe('boolean');
    expect(typeof config.featureFlags.enableImageExtraction).toBe('boolean');
  });
});

// Test setup and configuration
// This file runs before all tests

// Load .env file first
require('dotenv').config();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOCAL_MODE = 'true';
process.env.USE_LOCALSTACK = 'true';
process.env.LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost.localstack.cloud:4566';

// Only set mock API keys if real ones aren't already set
if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
  process.env.OPENROUTER_API_KEY = 'test-key-mock';
  process.env.OPENAI_API_KEY = 'test-key-mock';
  process.env.ANTHROPIC_API_KEY = 'test-key-mock';
}

// Enable feature flags by default in tests
process.env.ENABLE_REAL_SEGMENTATION = 'true';
process.env.ENABLE_REAL_SCRIPT_GENERATION = 'true';
process.env.ENABLE_IMAGE_EXTRACTION = 'true';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock DOM APIs required by pdf-parse
(global as any).DOMMatrix = class DOMMatrix {
  constructor() {}
};

(global as any).Path2D = class Path2D {
  constructor() {}
};

// Test setup and configuration
// This file runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOCAL_MODE = 'true';
process.env.USE_LOCALSTACK = 'true';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

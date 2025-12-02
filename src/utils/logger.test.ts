// Tests for structured logging utility
import { logger, LogLevel } from './logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log structured JSON messages', () => {
    logger.info('Test message', { key: 'value' });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    
    expect(logOutput.level).toBe(LogLevel.INFO);
    expect(logOutput.message).toBe('Test message');
    expect(logOutput.metadata).toEqual({ key: 'value' });
    expect(logOutput.timestamp).toBeDefined();
  });

  it('should include correlation ID when set', () => {
    logger.setCorrelationId('test-correlation-id');
    logger.info('Test message');

    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.correlationId).toBe('test-correlation-id');
  });

  it('should include service and function names when set', () => {
    logger.setServiceName('TestService');
    logger.setFunctionName('TestFunction');
    logger.info('Test message');

    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.service).toBe('TestService');
    expect(logOutput.function).toBe('TestFunction');
  });

  it('should redact sensitive data', () => {
    logger.info('User login', {
      username: 'john',
      password: 'secret123',
      apiKey: 'abc123',
      token: 'xyz789',
    });

    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.metadata.username).toBe('john');
    expect(logOutput.metadata.password).toBe('[REDACTED]');
    expect(logOutput.metadata.apiKey).toBe('[REDACTED]');
    expect(logOutput.metadata.token).toBe('[REDACTED]');
  });

  it('should redact nested sensitive data', () => {
    logger.info('Config loaded', {
      database: {
        host: 'localhost',
        password: 'dbpass',
      },
      api: {
        endpoint: 'https://api.example.com',
        secret: 'apisecret',
      },
    });

    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.metadata.database.host).toBe('localhost');
    expect(logOutput.metadata.database.password).toBe('[REDACTED]');
    expect(logOutput.metadata.api.endpoint).toBe('https://api.example.com');
    expect(logOutput.metadata.api.secret).toBe('[REDACTED]');
  });

  it('should support all log levels', () => {
    // Set LOG_LEVEL to DEBUG to ensure all levels are logged
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'DEBUG';
    
    // Need to reload logger module to pick up new env var
    jest.resetModules();
    const { logger: testLogger, LogLevel: TestLogLevel } = require('./logger');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    
    testLogger.error('Error message');
    testLogger.warn('Warning message');
    testLogger.info('Info message');
    testLogger.debug('Debug message');

    expect(spy).toHaveBeenCalledTimes(4);
    
    const logs = spy.mock.calls.map(call => JSON.parse(call[0]));
    expect(logs[0].level).toBe(TestLogLevel.ERROR);
    expect(logs[1].level).toBe(TestLogLevel.WARN);
    expect(logs[2].level).toBe(TestLogLevel.INFO);
    expect(logs[3].level).toBe(TestLogLevel.DEBUG);
    
    spy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('should create child logger with correlation ID', () => {
    // Reset modules and set log level to ensure logging happens
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'INFO';
    
    jest.resetModules();
    const { logger: testLogger } = require('./logger');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    
    const childLogger = testLogger.child('child-correlation-id');
    childLogger.info('Child message');

    expect(spy).toHaveBeenCalledTimes(1);
    const logOutput = JSON.parse(spy.mock.calls[0][0]);
    expect(logOutput.correlationId).toBe('child-correlation-id');
    
    spy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
    jest.resetModules();
  });

  it('should respect minimum log level', () => {
    // Save original env
    const originalLogLevel = process.env.LOG_LEVEL;
    
    // Set to WARN level
    process.env.LOG_LEVEL = 'WARN';
    
    // Reload logger module to pick up new env var
    jest.resetModules();
    const { logger: testLogger } = require('./logger');
    
    const spy = jest.spyOn(console, 'log').mockImplementation();
    
    testLogger.debug('Debug message'); // Should not log
    testLogger.info('Info message');   // Should not log
    testLogger.warn('Warn message');   // Should log
    testLogger.error('Error message'); // Should log

    expect(spy).toHaveBeenCalledTimes(2);
    
    spy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
    jest.resetModules();
  });
});

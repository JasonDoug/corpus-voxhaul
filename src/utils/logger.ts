// Logging utility with structured JSON logging, correlation IDs, and sensitive data redaction

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  service?: string;
  function?: string;
}

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api[_-]?key/i,
  /authorization/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
];

class Logger {
  private correlationId?: string;
  private serviceName?: string;
  private functionName?: string;
  private minLogLevel: LogLevel;

  constructor() {
    // Set minimum log level from environment or default to INFO
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    this.minLogLevel = envLogLevel || LogLevel.INFO;
  }

  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  setServiceName(name: string) {
    this.serviceName = name;
  }

  setFunctionName(name: string) {
    this.functionName = name;
  }

  /**
   * Redact sensitive data from metadata
   */
  private redactSensitiveData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    if (typeof data === 'object') {
      const redacted: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        // Check if key matches sensitive patterns
        const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
        
        if (isSensitive) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = this.redactSensitiveData(value);
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    }

    return data;
  }

  /**
   * Check if log level should be logged based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLogLevel);
    return currentLevelIndex <= minLevelIndex;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      service: this.serviceName,
      function: this.functionName,
      metadata: metadata ? this.redactSensitiveData(metadata) : undefined,
    };
    
    // Output as JSON for structured logging
    console.log(JSON.stringify(entry));
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Create a child logger with a specific correlation ID
   */
  child(correlationId: string): Logger {
    const childLogger = new Logger();
    childLogger.setCorrelationId(correlationId);
    childLogger.setServiceName(this.serviceName || '');
    childLogger.setFunctionName(this.functionName || '');
    return childLogger;
  }
}

export const logger = new Logger();

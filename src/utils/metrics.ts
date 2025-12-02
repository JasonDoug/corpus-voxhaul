// Metrics collection utility for tracking request counts, error rates, processing times, and storage usage

import { logger } from './logger';

export enum MetricType {
  COUNT = 'Count',
  DURATION = 'Duration',
  SIZE = 'Size',
  RATE = 'Rate',
}

export enum MetricUnit {
  COUNT = 'Count',
  MILLISECONDS = 'Milliseconds',
  SECONDS = 'Seconds',
  BYTES = 'Bytes',
  MEGABYTES = 'Megabytes',
  PERCENT = 'Percent',
}

interface MetricData {
  name: string;
  value: number;
  unit: MetricUnit;
  timestamp: Date;
  dimensions?: Record<string, string>;
}

interface TimerHandle {
  name: string;
  startTime: number;
  dimensions?: Record<string, string>;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private activeTimers: Map<string, TimerHandle> = new Map();

  /**
   * Record a count metric (e.g., request count, error count)
   */
  recordCount(name: string, value: number = 1, dimensions?: Record<string, string>) {
    this.recordMetric(name, value, MetricUnit.COUNT, dimensions);
  }

  /**
   * Record a duration metric in milliseconds
   */
  recordDuration(name: string, durationMs: number, dimensions?: Record<string, string>) {
    this.recordMetric(name, durationMs, MetricUnit.MILLISECONDS, dimensions);
  }

  /**
   * Record a size metric in bytes
   */
  recordSize(name: string, sizeBytes: number, dimensions?: Record<string, string>) {
    this.recordMetric(name, sizeBytes, MetricUnit.BYTES, dimensions);
  }

  /**
   * Record a rate metric (e.g., error rate as percentage)
   */
  recordRate(name: string, rate: number, dimensions?: Record<string, string>) {
    this.recordMetric(name, rate, MetricUnit.PERCENT, dimensions);
  }

  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string, dimensions?: Record<string, string>): string {
    const timerId = `${name}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerId, {
      name,
      startTime: Date.now(),
      dimensions,
    });
    return timerId;
  }

  /**
   * Stop a timer and record the duration
   */
  stopTimer(timerId: string): number | null {
    const timer = this.activeTimers.get(timerId);
    if (!timer) {
      logger.warn('Attempted to stop non-existent timer', { timerId });
      return null;
    }

    const duration = Date.now() - timer.startTime;
    this.recordDuration(timer.name, duration, timer.dimensions);
    this.activeTimers.delete(timerId);
    return duration;
  }

  /**
   * Record a generic metric
   */
  private recordMetric(
    name: string,
    value: number,
    unit: MetricUnit,
    dimensions?: Record<string, string>
  ) {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: new Date(),
      dimensions,
    };

    this.metrics.push(metric);

    // Log the metric for CloudWatch ingestion
    logger.info('Metric recorded', {
      metric: {
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        dimensions: metric.dimensions,
      },
    });

    // In production, this would also publish to CloudWatch
    if (process.env.NODE_ENV === 'production') {
      this.publishToCloudWatch(metric);
    }
  }

  /**
   * Publish metric to CloudWatch
   */
  private async publishToCloudWatch(metric: MetricData) {
    // Dynamically import to avoid circular dependencies
    const { publishMetric } = await import('./cloudwatch');
    
    await publishMetric({
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      dimensions: metric.dimensions,
      timestamp: metric.timestamp,
    });
  }

  /**
   * Get all recorded metrics (useful for testing)
   */
  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  /**
   * Clear all recorded metrics
   */
  clearMetrics() {
    this.metrics = [];
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

/**
 * Decorator for measuring function execution time
 */
export function measureExecutionTime(metricName: string, dimensions?: Record<string, string>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timerId = metrics.startTimer(metricName, dimensions);
      try {
        const result = await originalMethod.apply(this, args);
        metrics.stopTimer(timerId);
        return result;
      } catch (error) {
        metrics.stopTimer(timerId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Helper to track request metrics
 */
export class RequestMetrics {
  private requestCount = 0;
  private errorCount = 0;
  private successCount = 0;

  incrementRequest(endpoint: string) {
    this.requestCount++;
    metrics.recordCount('RequestCount', 1, { endpoint });
  }

  incrementError(endpoint: string, errorType?: string) {
    this.errorCount++;
    metrics.recordCount('ErrorCount', 1, { endpoint, errorType: errorType || 'Unknown' });
  }

  incrementSuccess(endpoint: string) {
    this.successCount++;
    metrics.recordCount('SuccessCount', 1, { endpoint });
  }

  getErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return (this.errorCount / this.requestCount) * 100;
  }

  recordErrorRate(endpoint: string) {
    const rate = this.getErrorRate();
    metrics.recordRate('ErrorRate', rate, { endpoint });
  }
}

/**
 * Helper to track processing stage metrics
 */
export class StageMetrics {
  recordStageStart(stage: string, jobId: string) {
    metrics.recordCount('StageStarted', 1, { stage, jobId });
  }

  recordStageComplete(stage: string, jobId: string, durationMs: number) {
    metrics.recordCount('StageCompleted', 1, { stage, jobId });
    metrics.recordDuration('StageDuration', durationMs, { stage, jobId });
  }

  recordStageFailed(stage: string, jobId: string, errorType: string) {
    metrics.recordCount('StageFailed', 1, { stage, jobId, errorType });
  }
}

/**
 * Helper to track external API metrics
 */
export class ExternalAPIMetrics {
  recordAPICall(apiName: string, operation: string) {
    metrics.recordCount('ExternalAPICall', 1, { apiName, operation });
  }

  recordAPILatency(apiName: string, operation: string, latencyMs: number) {
    metrics.recordDuration('ExternalAPILatency', latencyMs, { apiName, operation });
  }

  recordAPIError(apiName: string, operation: string, errorType: string) {
    metrics.recordCount('ExternalAPIError', 1, { apiName, operation, errorType });
  }
}

/**
 * Helper to track storage metrics
 */
export class StorageMetrics {
  recordStorageWrite(storageType: string, sizeBytes: number) {
    metrics.recordCount('StorageWrite', 1, { storageType });
    metrics.recordSize('StorageWriteSize', sizeBytes, { storageType });
  }

  recordStorageRead(storageType: string, sizeBytes: number) {
    metrics.recordCount('StorageRead', 1, { storageType });
    metrics.recordSize('StorageReadSize', sizeBytes, { storageType });
  }

  recordStorageUsage(storageType: string, totalBytes: number) {
    metrics.recordSize('StorageUsage', totalBytes, { storageType });
  }
}

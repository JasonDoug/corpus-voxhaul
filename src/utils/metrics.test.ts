// Tests for metrics collection utility
import { metrics, MetricUnit, RequestMetrics, StageMetrics } from './metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    metrics.clearMetrics();
  });

  it('should record count metrics', () => {
    metrics.recordCount('TestCount', 5, { dimension: 'test' });

    const recorded = metrics.getMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].name).toBe('TestCount');
    expect(recorded[0].value).toBe(5);
    expect(recorded[0].unit).toBe(MetricUnit.COUNT);
    expect(recorded[0].dimensions).toEqual({ dimension: 'test' });
  });

  it('should record duration metrics', () => {
    metrics.recordDuration('TestDuration', 1500);

    const recorded = metrics.getMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].name).toBe('TestDuration');
    expect(recorded[0].value).toBe(1500);
    expect(recorded[0].unit).toBe(MetricUnit.MILLISECONDS);
  });

  it('should record size metrics', () => {
    metrics.recordSize('TestSize', 1024000);

    const recorded = metrics.getMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].name).toBe('TestSize');
    expect(recorded[0].value).toBe(1024000);
    expect(recorded[0].unit).toBe(MetricUnit.BYTES);
  });

  it('should record rate metrics', () => {
    metrics.recordRate('TestRate', 2.5);

    const recorded = metrics.getMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].name).toBe('TestRate');
    expect(recorded[0].value).toBe(2.5);
    expect(recorded[0].unit).toBe(MetricUnit.PERCENT);
  });

  it('should start and stop timers', () => {
    const timerId = metrics.startTimer('TestTimer');
    
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Wait at least 10ms
    }
    
    const duration = metrics.stopTimer(timerId);

    expect(duration).toBeGreaterThanOrEqual(10);
    
    const recorded = metrics.getMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].name).toBe('TestTimer');
    expect(recorded[0].value).toBeGreaterThanOrEqual(10);
    expect(recorded[0].unit).toBe(MetricUnit.MILLISECONDS);
  });

  it('should handle stopping non-existent timer', () => {
    const duration = metrics.stopTimer('non-existent-timer');
    expect(duration).toBeNull();
  });

  it('should clear metrics', () => {
    metrics.recordCount('Test1', 1);
    metrics.recordCount('Test2', 2);
    
    expect(metrics.getMetrics()).toHaveLength(2);
    
    metrics.clearMetrics();
    
    expect(metrics.getMetrics()).toHaveLength(0);
  });
});

describe('RequestMetrics', () => {
  beforeEach(() => {
    metrics.clearMetrics();
  });

  it('should track request counts', () => {
    const requestMetrics = new RequestMetrics();
    
    requestMetrics.incrementRequest('upload');
    requestMetrics.incrementRequest('upload');
    requestMetrics.incrementSuccess('upload');
    requestMetrics.incrementError('upload', 'ValidationError');

    const recorded = metrics.getMetrics();
    expect(recorded.length).toBeGreaterThanOrEqual(3);
    
    const requestCounts = recorded.filter(m => m.name === 'RequestCount');
    expect(requestCounts).toHaveLength(2);
  });

  it('should calculate error rate', () => {
    const requestMetrics = new RequestMetrics();
    
    requestMetrics.incrementRequest('test');
    requestMetrics.incrementRequest('test');
    requestMetrics.incrementRequest('test');
    requestMetrics.incrementRequest('test');
    requestMetrics.incrementError('test');

    const errorRate = requestMetrics.getErrorRate();
    expect(errorRate).toBe(25); // 1 error out of 4 requests = 25%
  });

  it('should handle zero requests for error rate', () => {
    const requestMetrics = new RequestMetrics();
    expect(requestMetrics.getErrorRate()).toBe(0);
  });
});

describe('StageMetrics', () => {
  beforeEach(() => {
    metrics.clearMetrics();
  });

  it('should record stage lifecycle', () => {
    const stageMetrics = new StageMetrics();
    
    stageMetrics.recordStageStart('analysis', 'job-123');
    stageMetrics.recordStageComplete('analysis', 'job-123', 5000);

    const recorded = metrics.getMetrics();
    
    const startMetrics = recorded.filter(m => m.name === 'StageStarted');
    expect(startMetrics).toHaveLength(1);
    expect(startMetrics[0].dimensions).toEqual({ stage: 'analysis', jobId: 'job-123' });
    
    const completeMetrics = recorded.filter(m => m.name === 'StageCompleted');
    expect(completeMetrics).toHaveLength(1);
    
    const durationMetrics = recorded.filter(m => m.name === 'StageDuration');
    expect(durationMetrics).toHaveLength(1);
    expect(durationMetrics[0].value).toBe(5000);
  });

  it('should record stage failures', () => {
    const stageMetrics = new StageMetrics();
    
    stageMetrics.recordStageFailed('analysis', 'job-123', 'LLMTimeout');

    const recorded = metrics.getMetrics();
    const failedMetrics = recorded.filter(m => m.name === 'StageFailed');
    
    expect(failedMetrics).toHaveLength(1);
    expect(failedMetrics[0].dimensions).toEqual({
      stage: 'analysis',
      jobId: 'job-123',
      errorType: 'LLMTimeout',
    });
  });
});

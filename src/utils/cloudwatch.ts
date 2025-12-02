// CloudWatch integration for metrics and logs
import * as AWS from 'aws-sdk';
import { config } from './config';
import { logger } from './logger';

// Initialize CloudWatch client
const cloudwatch = new AWS.CloudWatch({
  region: config.aws.region,
  ...(config.localstack.useLocalStack && {
    endpoint: config.localstack.endpoint,
  }),
});

export interface CloudWatchMetric {
  name: string;
  value: number;
  unit: string;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

/**
 * Publish a single metric to CloudWatch
 */
export async function publishMetric(metric: CloudWatchMetric): Promise<void> {
  // Skip CloudWatch publishing in local mode
  if (config.isLocal && !config.localstack.useLocalStack) {
    logger.debug('Skipping CloudWatch metric in local mode', { metric });
    return;
  }

  try {
    const dimensions = metric.dimensions
      ? Object.entries(metric.dimensions).map(([name, value]) => ({
          Name: name,
          Value: value,
        }))
      : [];

    await cloudwatch
      .putMetricData({
        Namespace: 'PDFLectureService',
        MetricData: [
          {
            MetricName: metric.name,
            Value: metric.value,
            Unit: metric.unit as any,
            Timestamp: metric.timestamp || new Date(),
            Dimensions: dimensions,
          },
        ],
      })
      .promise();

    logger.debug('Metric published to CloudWatch', { metric });
  } catch (error) {
    logger.error('Failed to publish metric to CloudWatch', {
      metric,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Publish multiple metrics to CloudWatch in a batch
 */
export async function publishMetrics(metrics: CloudWatchMetric[]): Promise<void> {
  // Skip CloudWatch publishing in local mode
  if (config.isLocal && !config.localstack.useLocalStack) {
    logger.debug('Skipping CloudWatch metrics in local mode', { count: metrics.length });
    return;
  }

  try {
    const metricData = metrics.map((metric) => {
      const dimensions = metric.dimensions
        ? Object.entries(metric.dimensions).map(([name, value]) => ({
            Name: name,
            Value: value,
          }))
        : [];

      return {
        MetricName: metric.name,
        Value: metric.value,
        Unit: metric.unit as any,
        Timestamp: metric.timestamp || new Date(),
        Dimensions: dimensions,
      };
    });

    // CloudWatch allows max 20 metrics per request
    const batchSize = 20;
    for (let i = 0; i < metricData.length; i += batchSize) {
      const batch = metricData.slice(i, i + batchSize);
      await cloudwatch
        .putMetricData({
          Namespace: 'PDFLectureService',
          MetricData: batch,
        })
        .promise();
    }

    logger.debug('Metrics published to CloudWatch', { count: metrics.length });
  } catch (error) {
    logger.error('Failed to publish metrics to CloudWatch', {
      count: metrics.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a CloudWatch alarm programmatically
 */
export async function createAlarm(params: {
  alarmName: string;
  metricName: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  period: number;
  statistic: string;
  dimensions?: Record<string, string>;
}): Promise<void> {
  try {
    const dimensions = params.dimensions
      ? Object.entries(params.dimensions).map(([name, value]) => ({
          Name: name,
          Value: value,
        }))
      : [];

    await cloudwatch
      .putMetricAlarm({
        AlarmName: params.alarmName,
        MetricName: params.metricName,
        Namespace: 'PDFLectureService',
        Statistic: params.statistic,
        Period: params.period,
        EvaluationPeriods: params.evaluationPeriods,
        Threshold: params.threshold,
        ComparisonOperator: params.comparisonOperator,
        Dimensions: dimensions,
        TreatMissingData: 'notBreaching',
      })
      .promise();

    logger.info('CloudWatch alarm created', { alarmName: params.alarmName });
  } catch (error) {
    logger.error('Failed to create CloudWatch alarm', {
      alarmName: params.alarmName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Helper to create standard alarms for a Lambda function
 */
export async function createStandardAlarmsForFunction(
  functionName: string,
  timeoutMs: number
): Promise<void> {
  // Error rate alarm
  await createAlarm({
    alarmName: `${functionName}-ErrorRate`,
    metricName: 'Errors',
    threshold: 5,
    comparisonOperator: 'GreaterThanThreshold',
    evaluationPeriods: 1,
    period: 300,
    statistic: 'Sum',
    dimensions: { FunctionName: functionName },
  });

  // Timeout alarm (90% of actual timeout)
  await createAlarm({
    alarmName: `${functionName}-Timeout`,
    metricName: 'Duration',
    threshold: timeoutMs * 0.9,
    comparisonOperator: 'GreaterThanThreshold',
    evaluationPeriods: 1,
    period: 300,
    statistic: 'Maximum',
    dimensions: { FunctionName: functionName },
  });

  // Throttle alarm
  await createAlarm({
    alarmName: `${functionName}-Throttles`,
    metricName: 'Throttles',
    threshold: 1,
    comparisonOperator: 'GreaterThanThreshold',
    evaluationPeriods: 1,
    period: 300,
    statistic: 'Sum',
    dimensions: { FunctionName: functionName },
  });
}

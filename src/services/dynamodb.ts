// DynamoDB client wrapper with local/production mode support
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { Job, JobStatus, StageStatus } from '../models/job';
import { LectureAgent } from '../models/agent';
import { ExtractedContent, SegmentedContent } from '../models/content';
import { WordTiming } from '../models/audio';

// Configure AWS SDK based on environment
const dynamoDBConfig: any = {
  region: config.aws.region,
};

if (config.localstack.useLocalStack) {
  dynamoDBConfig.endpoint = { url: config.localstack.endpoint };
  dynamoDBConfig.credentials = {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  };
}
// In Lambda, don't set credentials - they're provided automatically via execution role

const client = new DynamoDBClient(dynamoDBConfig);
const dynamoDB = DynamoDBDocumentClient.from(client);

// Helper function to handle DynamoDB errors
function handleDynamoDBError(error: any, operation: string): never {
  logger.error(`DynamoDB ${operation} failed`, { error: error.message });
  throw new Error(`Database operation failed: ${operation}`);
}

// ============================================================================
// Jobs Table Operations
// ============================================================================

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  pdfFilename: string;
  pdfUrl: string;
  agentId?: string;
  stages: StageStatus[];
  error?: string;
}

function jobToRecord(job: Job): JobRecord {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function recordToJob(record: JobRecord): Job {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    stages: record.stages.map(stage => ({
      ...stage,
      startedAt: stage.startedAt ? new Date(stage.startedAt) : undefined,
      completedAt: stage.completedAt ? new Date(stage.completedAt) : undefined,
    })),
  };
}

export async function createJob(job: Job): Promise<Job> {
  try {
    const record = jobToRecord(job);
    const command = new PutCommand({
      TableName: config.dynamodb.jobsTable,
      Item: record,
    });
    
    await dynamoDB.send(command);

    logger.info('Job created', { jobId: job.jobId });
    return job;
  } catch (error) {
    handleDynamoDBError(error, 'createJob');
  }
}

export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const command = new GetCommand({
      TableName: config.dynamodb.jobsTable,
      Key: { jobId },
    });
    
    const result = await dynamoDB.send(command);

    if (!result.Item) {
      return null;
    }

    return recordToJob(result.Item as JobRecord);
  } catch (error) {
    handleDynamoDBError(error, 'getJob');
  }
}

export async function updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
  try {
    const current = await getJob(jobId);
    if (!current) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const updated: Job = {
      ...current,
      ...updates,
      jobId, // Ensure jobId doesn't change
      updatedAt: new Date(),
    };

    const record = jobToRecord(updated);
    const command = new PutCommand({
      TableName: config.dynamodb.jobsTable,
      Item: record,
    });
    
    await dynamoDB.send(command);

    logger.info('Job updated', { jobId });
    return updated;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    handleDynamoDBError(error, 'updateJob');
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  try {
    const command = new DeleteCommand({
      TableName: config.dynamodb.jobsTable,
      Key: { jobId },
    });
    
    await dynamoDB.send(command);

    logger.info('Job deleted', { jobId });
  } catch (error) {
    handleDynamoDBError(error, 'deleteJob');
  }
}

export async function listJobs(): Promise<Job[]> {
  try {
    const command = new ScanCommand({
      TableName: config.dynamodb.jobsTable,
    });
    
    const result = await dynamoDB.send(command);

    return (result.Items || []).map(item => recordToJob(item as JobRecord));
  } catch (error) {
    handleDynamoDBError(error, 'listJobs');
  }
}

// ============================================================================
// Agents Table Operations
// ============================================================================

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  personality: {
    instructions: string;
    tone: string;
    examples?: string[];
  };
  voice: {
    voiceId: string;
    speed: number;
    pitch: number;
  };
  createdAt: string;
}

function agentToRecord(agent: LectureAgent): AgentRecord {
  return {
    ...agent,
    createdAt: agent.createdAt.toISOString(),
  };
}

function recordToAgent(record: AgentRecord): LectureAgent {
  return {
    ...record,
    personality: {
      ...record.personality,
      tone: record.personality.tone as any,
    },
    createdAt: new Date(record.createdAt),
  };
}

export async function createAgent(agent: LectureAgent): Promise<LectureAgent> {
  try {
    // Check for unique name
    const existing = await listAgents();
    if (existing.some(a => a.name === agent.name && a.id !== agent.id)) {
      throw new Error(`Agent with name "${agent.name}" already exists`);
    }

    const record = agentToRecord(agent);
    const command = new PutCommand({
      TableName: config.dynamodb.agentsTable,
      Item: record,
    });
    
    await dynamoDB.send(command);

    logger.info('Agent created', { agentId: agent.id, name: agent.name });
    return agent;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    handleDynamoDBError(error, 'createAgent');
  }
}

export async function getAgent(id: string): Promise<LectureAgent | null> {
  try {
    const command = new GetCommand({
      TableName: config.dynamodb.agentsTable,
      Key: { id },
    });
    
    const result = await dynamoDB.send(command);

    if (!result.Item) {
      return null;
    }

    return recordToAgent(result.Item as AgentRecord);
  } catch (error) {
    handleDynamoDBError(error, 'getAgent');
  }
}

export async function updateAgent(id: string, updates: Partial<LectureAgent>): Promise<LectureAgent> {
  try {
    const current = await getAgent(id);
    if (!current) {
      throw new Error(`Agent not found: ${id}`);
    }

    // Check for unique name if name is being updated
    if (updates.name && updates.name !== current.name) {
      const existing = await listAgents();
      if (existing.some(a => a.name === updates.name && a.id !== id)) {
        throw new Error(`Agent with name "${updates.name}" already exists`);
      }
    }

    const updated: LectureAgent = {
      ...current,
      ...updates,
      id, // Ensure id doesn't change
      // Deep merge nested objects
      personality: updates.personality ? {
        ...current.personality,
        ...updates.personality,
      } : current.personality,
      voice: updates.voice ? {
        ...current.voice,
        ...updates.voice,
      } : current.voice,
    };

    const record = agentToRecord(updated);
    const command = new PutCommand({
      TableName: config.dynamodb.agentsTable,
      Item: record,
    });
    
    await dynamoDB.send(command);

    logger.info('Agent updated', { agentId: id });
    return updated;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('not found'))) {
      throw error;
    }
    handleDynamoDBError(error, 'updateAgent');
  }
}

export async function deleteAgent(id: string): Promise<void> {
  try {
    const command = new DeleteCommand({
      TableName: config.dynamodb.agentsTable,
      Key: { id },
    });
    
    await dynamoDB.send(command);

    logger.info('Agent deleted', { agentId: id });
  } catch (error) {
    handleDynamoDBError(error, 'deleteAgent');
  }
}

export async function listAgents(): Promise<LectureAgent[]> {
  try {
    const command = new ScanCommand({
      TableName: config.dynamodb.agentsTable,
    });
    
    const result = await dynamoDB.send(command);

    return (result.Items || []).map(item => recordToAgent(item as AgentRecord));
  } catch (error) {
    handleDynamoDBError(error, 'listAgents');
  }
}

// ============================================================================
// Content Table Operations
// ============================================================================

export interface ContentRecord {
  jobId: string;
  extractedContent?: ExtractedContent;
  segmentedContent?: SegmentedContent;
  originalSegmentedContent?: SegmentedContent; // Preserve original vision analysis
  script?: any; // LectureScript type from script model
  audioUrl?: string;
  wordTimings?: WordTiming[];
  createdAt: string;
  updatedAt: string;
}

export async function createContent(jobId: string): Promise<ContentRecord> {
  try {
    const record: ContentRecord = {
      jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: config.dynamodb.contentTable,
      Item: record,
    });
    
    await dynamoDB.send(command);

    logger.info('Content record created', { jobId });
    return record;
  } catch (error) {
    handleDynamoDBError(error, 'createContent');
  }
}

export async function getContent(jobId: string): Promise<ContentRecord | null> {
  try {
    const command = new GetCommand({
      TableName: config.dynamodb.contentTable,
      Key: { jobId },
    });
    
    const result = await dynamoDB.send(command);

    if (!result.Item) {
      return null;
    }

    return result.Item as ContentRecord;
  } catch (error) {
    handleDynamoDBError(error, 'getContent');
  }
}

export async function updateContent(jobId: string, updates: Partial<ContentRecord>): Promise<ContentRecord> {
  try {
    const current = await getContent(jobId);
    if (!current) {
      throw new Error(`Content not found for job: ${jobId}`);
    }

    const updated: ContentRecord = {
      ...current,
      ...updates,
      jobId, // Ensure jobId doesn't change
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: config.dynamodb.contentTable,
      Item: updated,
    });
    
    await dynamoDB.send(command);

    logger.info('Content updated', { jobId });
    return updated;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    handleDynamoDBError(error, 'updateContent');
  }
}

export async function deleteContent(jobId: string): Promise<void> {
  try {
    const command = new DeleteCommand({
      TableName: config.dynamodb.contentTable,
      Key: { jobId },
    });
    
    await dynamoDB.send(command);

    logger.info('Content deleted', { jobId });
  } catch (error) {
    handleDynamoDBError(error, 'deleteContent');
  }
}

// ============================================================================
// Table Creation (for local development)
// ============================================================================

export async function createTablesIfNotExist(): Promise<void> {
  if (!config.localstack.useLocalStack) {
    logger.info('Skipping table creation in production mode');
    return;
  }

  // Import DynamoDB commands for table management
  const { DescribeTableCommand, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

  const tables = [
    {
      TableName: config.dynamodb.jobsTable,
      KeySchema: [{ AttributeName: 'jobId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'jobId', AttributeType: 'S' }],
    },
    {
      TableName: config.dynamodb.agentsTable,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    },
    {
      TableName: config.dynamodb.contentTable,
      KeySchema: [{ AttributeName: 'jobId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'jobId', AttributeType: 'S' }],
    },
  ];

  for (const tableConfig of tables) {
    try {
      const describeCommand = new DescribeTableCommand({ TableName: tableConfig.TableName });
      await client.send(describeCommand);
      logger.info(`Table ${tableConfig.TableName} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        try {
          const createCommand = new CreateTableCommand({
            ...tableConfig,
            BillingMode: 'PAY_PER_REQUEST',
          });
          await client.send(createCommand);
          logger.info(`Table ${tableConfig.TableName} created`);
        } catch (createError) {
          logger.error(`Failed to create table ${tableConfig.TableName}`, { error: createError });
        }
      }
    }
  }
}

// Agent Management Service
import { v4 as uuidv4 } from 'uuid';
import { LectureAgent, PersonalityConfig, VoiceConfig } from '../models/agent';
import * as db from './dynamodb';
import { logger } from '../utils/logger';

export type AgentCreate = Omit<LectureAgent, 'id' | 'createdAt'>;
export type AgentUpdate = Partial<Omit<LectureAgent, 'id' | 'createdAt'>>;

// Validation error class
export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

// Validation functions
function validateName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new AgentValidationError('Agent name is required and must be a string');
  }
  if (name.trim().length === 0) {
    throw new AgentValidationError('Agent name cannot be empty');
  }
  if (name.length > 100) {
    throw new AgentValidationError('Agent name must be 100 characters or less');
  }
}

function validateDescription(description: string): void {
  if (!description || typeof description !== 'string') {
    throw new AgentValidationError('Agent description is required and must be a string');
  }
  if (description.trim().length === 0) {
    throw new AgentValidationError('Agent description cannot be empty');
  }
}

function validatePersonality(personality: PersonalityConfig): void {
  if (!personality || typeof personality !== 'object') {
    throw new AgentValidationError('Personality configuration is required');
  }

  if (!personality.instructions || typeof personality.instructions !== 'string') {
    throw new AgentValidationError('Personality instructions are required and must be a string');
  }

  if (personality.instructions.trim().length === 0) {
    throw new AgentValidationError('Personality instructions cannot be empty');
  }

  const validTones = ['humorous', 'serious', 'casual', 'formal', 'enthusiastic'];
  if (!validTones.includes(personality.tone)) {
    throw new AgentValidationError(`Personality tone must be one of: ${validTones.join(', ')}`);
  }

  if (personality.examples !== undefined) {
    if (!Array.isArray(personality.examples)) {
      throw new AgentValidationError('Personality examples must be an array');
    }
    if (personality.examples.some(ex => typeof ex !== 'string')) {
      throw new AgentValidationError('All personality examples must be strings');
    }
  }
}

function validateVoice(voice: VoiceConfig): void {
  if (!voice || typeof voice !== 'object') {
    throw new AgentValidationError('Voice configuration is required');
  }

  if (!voice.voiceId || typeof voice.voiceId !== 'string') {
    throw new AgentValidationError('Voice ID is required and must be a string');
  }

  if (typeof voice.speed !== 'number') {
    throw new AgentValidationError('Voice speed must be a number');
  }

  if (voice.speed < 0.5 || voice.speed > 2.0) {
    throw new AgentValidationError('Voice speed must be between 0.5 and 2.0');
  }

  if (typeof voice.pitch !== 'number') {
    throw new AgentValidationError('Voice pitch must be a number');
  }

  if (voice.pitch < -20 || voice.pitch > 20) {
    throw new AgentValidationError('Voice pitch must be between -20 and 20');
  }
}

function validateAgent(agent: Omit<LectureAgent, 'id' | 'createdAt'>): void {
  validateName(agent.name);
  validateDescription(agent.description);
  validatePersonality(agent.personality);
  validateVoice(agent.voice);
}

// Agent CRUD operations with validation

export async function createAgent(
  agentData: Omit<LectureAgent, 'id' | 'createdAt'>
): Promise<LectureAgent> {
  // Validate input
  validateAgent(agentData);

  // Create agent with generated ID and timestamp
  const agent: LectureAgent = {
    ...agentData,
    id: uuidv4(),
    createdAt: new Date(),
  };

  try {
    // Use database layer to create agent (includes unique name check)
    const created = await db.createAgent(agent);
    logger.info('Agent created successfully', { agentId: created.id, name: created.name });
    return created;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new AgentValidationError(error.message);
    }
    throw error;
  }
}

export async function getAgent(id: string): Promise<LectureAgent | null> {
  if (!id || typeof id !== 'string') {
    throw new AgentValidationError('Agent ID is required and must be a string');
  }

  return await db.getAgent(id);
}

export async function listAgents(): Promise<LectureAgent[]> {
  return await db.listAgents();
}

export async function updateAgent(
  id: string,
  updates: Partial<Omit<LectureAgent, 'id' | 'createdAt'>>
): Promise<LectureAgent> {
  if (!id || typeof id !== 'string') {
    throw new AgentValidationError('Agent ID is required and must be a string');
  }

  // Validate individual fields if provided
  if (updates.name !== undefined) {
    validateName(updates.name);
  }

  if (updates.description !== undefined) {
    validateDescription(updates.description);
  }

  if (updates.personality !== undefined) {
    validatePersonality(updates.personality);
  }

  if (updates.voice !== undefined) {
    validateVoice(updates.voice);
  }

  try {
    const updated = await db.updateAgent(id, updates);
    logger.info('Agent updated successfully', { agentId: id });
    return updated;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new AgentValidationError(error.message);
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new AgentValidationError(error.message);
    }
    throw error;
  }
}

export async function deleteAgent(id: string): Promise<void> {
  if (!id || typeof id !== 'string') {
    throw new AgentValidationError('Agent ID is required and must be a string');
  }

  await db.deleteAgent(id);
  logger.info('Agent deleted successfully', { agentId: id });
}

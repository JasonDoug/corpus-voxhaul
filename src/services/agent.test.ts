// Property-based tests for Agent Management Service
import * as fc from 'fast-check';
import {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deleteAgent,
} from './agent';
import { createTablesIfNotExist } from './dynamodb';
import { LectureAgent, PersonalityConfig, VoiceConfig } from '../models/agent';

// Setup: Create tables before running tests
beforeAll(async () => {
  await createTablesIfNotExist();
  // Wait a bit for tables to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 30000);

// Cleanup: Delete all agents after each test to avoid conflicts
afterEach(async () => {
  try {
    const agents = await listAgents();
    for (const agent of agents) {
      try {
        await deleteAgent(agent.id);
      } catch (error) {
        // Ignore individual deletion errors
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}, 30000); // 30 second timeout for cleanup

// Generators for property-based testing

const toneArb = fc.constantFrom<'humorous' | 'serious' | 'casual' | 'formal' | 'enthusiastic'>(
  'humorous', 'serious', 'casual', 'formal', 'enthusiastic'
);

const personalityArb: fc.Arbitrary<PersonalityConfig> = fc.record({
  instructions: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  tone: toneArb,
  examples: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }), { nil: undefined }),
});

const voiceArb: fc.Arbitrary<VoiceConfig> = fc.record({
  voiceId: fc.string({ minLength: 1, maxLength: 50 }),
  speed: fc.double({ min: 0.5, max: 2.0, noNaN: true }),
  pitch: fc.integer({ min: -20, max: 20 }),
});

const validAgentDataArb: fc.Arbitrary<Omit<LectureAgent, 'id' | 'createdAt'>> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  personality: personalityArb,
  voice: voiceArb,
});

// **Feature: pdf-lecture-service, Property 13: Agent creation round-trip**
// **Validates: Requirements 4.1**
describe('Property 13: Agent creation round-trip', () => {
  test('For any valid agent configuration, creating the agent and then retrieving it should return an equivalent agent with all fields preserved', async () => {
    await fc.assert(
      fc.asyncProperty(validAgentDataArb, async (agentData) => {
        // Create the agent
        const created = await createAgent(agentData);
        
        // Retrieve the agent
        const retrieved = await getAgent(created.id);
        
        // Verify the agent was retrieved and all fields match
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe(agentData.name);
        expect(retrieved?.description).toBe(agentData.description);
        expect(retrieved?.personality.instructions).toBe(agentData.personality.instructions);
        expect(retrieved?.personality.tone).toBe(agentData.personality.tone);
        expect(retrieved?.personality.examples).toEqual(agentData.personality.examples);
        expect(retrieved?.voice.voiceId).toBe(agentData.voice.voiceId);
        expect(retrieved?.voice.speed).toBeCloseTo(agentData.voice.speed, 2);
        expect(retrieved?.voice.pitch).toBe(agentData.voice.pitch);
        expect(retrieved?.createdAt).toBeInstanceOf(Date);
        
        // Verify created agent has expected structure
        expect(created.id).toBeDefined();
        expect(typeof created.id).toBe('string');
        expect(created.createdAt).toBeInstanceOf(Date);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// **Feature: pdf-lecture-service, Property 14: Agent listing completeness**
// **Validates: Requirements 4.2**
describe('Property 14: Agent listing completeness', () => {
  test('For any set of created agents, listing all agents should return all created agents with their names and descriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validAgentDataArb, { minLength: 1, maxLength: 5 }),
        async (agentsData) => {
          // Make names unique to avoid conflicts
          const uniqueAgentsData = agentsData.map((data, index) => ({
            ...data,
            name: `${data.name}_${index}_${Date.now()}`,
          }));
          
          // Create all agents
          const createdAgents: LectureAgent[] = [];
          for (const agentData of uniqueAgentsData) {
            const created = await createAgent(agentData);
            createdAgents.push(created);
          }
          
          // List all agents
          const listed = await listAgents();
          
          // Verify all created agents are in the list
          for (const created of createdAgents) {
            const found = listed.find(a => a.id === created.id);
            expect(found).toBeDefined();
            expect(found?.name).toBe(created.name);
            expect(found?.description).toBe(created.description);
          }
          
          // Verify the list contains at least the agents we created
          expect(listed.length).toBeGreaterThanOrEqual(createdAgents.length);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});

// **Feature: pdf-lecture-service, Property 15: Multiple agent support**
// **Validates: Requirements 4.4**
describe('Property 15: Multiple agent support', () => {
  test('For any two distinct agent configurations, both should be stored independently and retrievable by their unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        validAgentDataArb,
        validAgentDataArb,
        async (agentData1, agentData2) => {
          // Make names unique to avoid conflicts
          const uniqueAgentData1 = {
            ...agentData1,
            name: `${agentData1.name}_1_${Date.now()}`,
          };
          const uniqueAgentData2 = {
            ...agentData2,
            name: `${agentData2.name}_2_${Date.now()}`,
          };
          
          // Create both agents
          const created1 = await createAgent(uniqueAgentData1);
          const created2 = await createAgent(uniqueAgentData2);
          
          // Verify they have different IDs
          expect(created1.id).not.toBe(created2.id);
          
          // Retrieve both agents
          const retrieved1 = await getAgent(created1.id);
          const retrieved2 = await getAgent(created2.id);
          
          // Verify both agents exist and are independent
          expect(retrieved1).not.toBeNull();
          expect(retrieved2).not.toBeNull();
          
          // Verify agent 1 data
          expect(retrieved1?.id).toBe(created1.id);
          expect(retrieved1?.name).toBe(uniqueAgentData1.name);
          expect(retrieved1?.description).toBe(uniqueAgentData1.description);
          expect(retrieved1?.personality.instructions).toBe(uniqueAgentData1.personality.instructions);
          expect(retrieved1?.personality.tone).toBe(uniqueAgentData1.personality.tone);
          
          // Verify agent 2 data
          expect(retrieved2?.id).toBe(created2.id);
          expect(retrieved2?.name).toBe(uniqueAgentData2.name);
          expect(retrieved2?.description).toBe(uniqueAgentData2.description);
          expect(retrieved2?.personality.instructions).toBe(uniqueAgentData2.personality.instructions);
          expect(retrieved2?.personality.tone).toBe(uniqueAgentData2.personality.tone);
          
          // Verify they are truly independent (changing one doesn't affect the other)
          await updateAgent(created1.id, { description: 'Updated description 1' });
          const retrieved2After = await getAgent(created2.id);
          expect(retrieved2After?.description).toBe(uniqueAgentData2.description);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});

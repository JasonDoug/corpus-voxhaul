// Property-based tests for DynamoDB operations
import * as fc from 'fast-check';
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  createContent,
  getContent,
  updateContent,
  deleteContent,
  createTablesIfNotExist,
} from './dynamodb';
import { Job, JobStatus, StageStatus } from '../models/job';
import { LectureAgent } from '../models/agent';

// Setup: Create tables before running tests
beforeAll(async () => {
  await createTablesIfNotExist();
  // Wait a bit for tables to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 30000); // 30 second timeout for setup

// Generators for property-based testing

const jobStatusArb = fc.constantFrom<JobStatus>(
  'queued',
  'analyzing',
  'segmenting',
  'generating_script',
  'synthesizing_audio',
  'completed',
  'failed'
);

const stageStatusArb = fc.record({
  stage: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom('pending', 'in_progress', 'completed', 'failed'),
  startedAt: fc.option(fc.date(), { nil: undefined }),
  completedAt: fc.option(fc.date(), { nil: undefined }),
  error: fc.option(fc.string(), { nil: undefined }),
}) as fc.Arbitrary<StageStatus>;

const jobArb = fc.record({
  jobId: fc.uuid(),
  status: jobStatusArb,
  createdAt: fc.date(),
  updatedAt: fc.date(),
  pdfFilename: fc.string({ minLength: 1, maxLength: 100 }),
  pdfUrl: fc.webUrl(),
  agentId: fc.option(fc.uuid(), { nil: undefined }),
  stages: fc.array(stageStatusArb, { minLength: 0, maxLength: 5 }),
  error: fc.option(fc.string(), { nil: undefined }),
}) as fc.Arbitrary<Job>;

const toneArb = fc.constantFrom('humorous', 'serious', 'casual', 'formal', 'enthusiastic');

const agentArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  personality: fc.record({
    instructions: fc.string({ minLength: 1, maxLength: 500 }),
    tone: toneArb,
    examples: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }), { nil: undefined }),
  }),
  voice: fc.record({
    voiceId: fc.string({ minLength: 1, maxLength: 50 }),
    speed: fc.double({ min: 0.5, max: 2.0, noNaN: true }),
    pitch: fc.integer({ min: -20, max: 20 }),
  }),
  createdAt: fc.date(),
}) as fc.Arbitrary<LectureAgent>;

// **Feature: pdf-lecture-service, Property 32: Function execution and persistence**
// **Validates: Requirements 9.2, 9.5**
describe('Property 32: Function execution and persistence', () => {
  describe('Job persistence', () => {
    test('For any valid job, creating and retrieving it should return equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(jobArb, async (job) => {
          // Create the job
          await createJob(job);
          
          // Retrieve the job
          const retrieved = await getJob(job.jobId);
          
          // Cleanup
          await deleteJob(job.jobId);
          
          // Verify the job was retrieved and matches
          expect(retrieved).not.toBeNull();
          expect(retrieved?.jobId).toBe(job.jobId);
          expect(retrieved?.status).toBe(job.status);
          expect(retrieved?.pdfFilename).toBe(job.pdfFilename);
          expect(retrieved?.pdfUrl).toBe(job.pdfUrl);
          expect(retrieved?.agentId).toBe(job.agentId);
          expect(retrieved?.error).toBe(job.error);
          expect(retrieved?.stages.length).toBe(job.stages.length);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any job, updating it should persist the changes', async () => {
      await fc.assert(
        fc.asyncProperty(jobArb, jobStatusArb, fc.string(), async (job, newStatus, newError) => {
          // Create the job
          await createJob(job);
          
          // Update the job
          const updates = { status: newStatus, error: newError };
          const updated = await updateJob(job.jobId, updates);
          
          // Retrieve the job
          const retrieved = await getJob(job.jobId);
          
          // Cleanup
          await deleteJob(job.jobId);
          
          // Verify the updates were persisted
          expect(retrieved).not.toBeNull();
          expect(retrieved?.status).toBe(newStatus);
          expect(retrieved?.error).toBe(newError);
          expect(updated.status).toBe(newStatus);
          expect(updated.error).toBe(newError);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any job, deleting it should make it unretrievable', async () => {
      await fc.assert(
        fc.asyncProperty(jobArb, async (job) => {
          // Create the job
          await createJob(job);
          
          // Verify it exists
          const beforeDelete = await getJob(job.jobId);
          expect(beforeDelete).not.toBeNull();
          
          // Delete the job
          await deleteJob(job.jobId);
          
          // Verify it no longer exists
          const afterDelete = await getJob(job.jobId);
          expect(afterDelete).toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 30000);
  });

  describe('Agent persistence', () => {
    test('For any valid agent, creating and retrieving it should return equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(agentArb, async (agent) => {
          // Create the agent
          await createAgent(agent);
          
          // Retrieve the agent
          const retrieved = await getAgent(agent.id);
          
          // Cleanup
          await deleteAgent(agent.id);
          
          // Verify the agent was retrieved and matches
          expect(retrieved).not.toBeNull();
          expect(retrieved?.id).toBe(agent.id);
          expect(retrieved?.name).toBe(agent.name);
          expect(retrieved?.description).toBe(agent.description);
          expect(retrieved?.personality.instructions).toBe(agent.personality.instructions);
          expect(retrieved?.personality.tone).toBe(agent.personality.tone);
          expect(retrieved?.voice.voiceId).toBe(agent.voice.voiceId);
          expect(retrieved?.voice.speed).toBeCloseTo(agent.voice.speed, 2);
          expect(retrieved?.voice.pitch).toBe(agent.voice.pitch);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any agent, updating it should persist the changes', async () => {
      await fc.assert(
        fc.asyncProperty(agentArb, fc.string({ minLength: 1, maxLength: 200 }), async (agent, newDescription) => {
          // Create the agent
          await createAgent(agent);
          
          // Update the agent
          const updates = { description: newDescription };
          const updated = await updateAgent(agent.id, updates);
          
          // Retrieve the agent
          const retrieved = await getAgent(agent.id);
          
          // Cleanup
          await deleteAgent(agent.id);
          
          // Verify the updates were persisted
          expect(retrieved).not.toBeNull();
          expect(retrieved?.description).toBe(newDescription);
          expect(updated.description).toBe(newDescription);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any agent, deleting it should make it unretrievable', async () => {
      await fc.assert(
        fc.asyncProperty(agentArb, async (agent) => {
          // Create the agent
          await createAgent(agent);
          
          // Verify it exists
          const beforeDelete = await getAgent(agent.id);
          expect(beforeDelete).not.toBeNull();
          
          // Delete the agent
          await deleteAgent(agent.id);
          
          // Verify it no longer exists
          const afterDelete = await getAgent(agent.id);
          expect(afterDelete).toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 30000);
  });

  describe('Content persistence', () => {
    test('For any job ID, creating and retrieving content should return equivalent data', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (jobId) => {
          // Create content record
          const created = await createContent(jobId);
          
          // Retrieve the content
          const retrieved = await getContent(jobId);
          
          // Cleanup
          await deleteContent(jobId);
          
          // Verify the content was retrieved and matches
          expect(retrieved).not.toBeNull();
          expect(retrieved?.jobId).toBe(jobId);
          expect(retrieved?.createdAt).toBe(created.createdAt);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any content, updating it should persist the changes', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), fc.webUrl(), async (jobId, audioUrl) => {
          // Create content record
          await createContent(jobId);
          
          // Update the content
          const updates = { audioUrl };
          const updated = await updateContent(jobId, updates);
          
          // Retrieve the content
          const retrieved = await getContent(jobId);
          
          // Cleanup
          await deleteContent(jobId);
          
          // Verify the updates were persisted
          expect(retrieved).not.toBeNull();
          expect(retrieved?.audioUrl).toBe(audioUrl);
          expect(updated.audioUrl).toBe(audioUrl);
        }),
        { numRuns: 20 }
      );
    }, 30000);

    test('For any content, deleting it should make it unretrievable', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (jobId) => {
          // Create content record
          await createContent(jobId);
          
          // Verify it exists
          const beforeDelete = await getContent(jobId);
          expect(beforeDelete).not.toBeNull();
          
          // Delete the content
          await deleteContent(jobId);
          
          // Verify it no longer exists
          const afterDelete = await getContent(jobId);
          expect(afterDelete).toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 30000);
  });
});

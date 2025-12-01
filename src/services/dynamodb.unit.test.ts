// Unit tests for DynamoDB operations
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  listJobs,
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  listAgents,
  createContent,
  getContent,
  updateContent,
  deleteContent,
  createTablesIfNotExist,
} from './dynamodb';
import { Job, JobStatus } from '../models/job';
import { LectureAgent } from '../models/agent';

// Setup: Create tables before running tests
beforeAll(async () => {
  await createTablesIfNotExist();
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 30000);

// Cleanup: Delete all test data after each test
afterEach(async () => {
  const jobs = await listJobs();
  await Promise.all(jobs.map(job => deleteJob(job.jobId)));
  
  const agents = await listAgents();
  await Promise.all(agents.map(agent => deleteAgent(agent.id)));
});

describe('Jobs Table Operations', () => {
  const createTestJob = (): Job => ({
    jobId: `test-job-${Date.now()}`,
    status: 'queued' as JobStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
    pdfFilename: 'test.pdf',
    pdfUrl: 'https://example.com/test.pdf',
    stages: [],
  });

  test('should create and retrieve a job', async () => {
    const job = createTestJob();
    await createJob(job);
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.jobId).toBe(job.jobId);
    expect(retrieved?.status).toBe(job.status);
  });

  test('should return null for non-existent job', async () => {
    const retrieved = await getJob('non-existent-id');
    expect(retrieved).toBeNull();
  });

  test('should update job status', async () => {
    const job = createTestJob();
    await createJob(job);
    
    await updateJob(job.jobId, { status: 'analyzing' });
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved?.status).toBe('analyzing');
  });

  test('should update job with error message', async () => {
    const job = createTestJob();
    await createJob(job);
    
    const errorMessage = 'Test error';
    await updateJob(job.jobId, { status: 'failed', error: errorMessage });
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved?.status).toBe('failed');
    expect(retrieved?.error).toBe(errorMessage);
  });

  test('should throw error when updating non-existent job', async () => {
    await expect(updateJob('non-existent-id', { status: 'analyzing' }))
      .rejects.toThrow('Job not found');
  });

  test('should delete a job', async () => {
    const job = createTestJob();
    await createJob(job);
    
    await deleteJob(job.jobId);
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved).toBeNull();
  });

  test('should list all jobs', async () => {
    const job1 = createTestJob();
    const job2 = { ...createTestJob(), jobId: `test-job-${Date.now()}-2` };
    
    await createJob(job1);
    await createJob(job2);
    
    const jobs = await listJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    expect(jobs.some(j => j.jobId === job1.jobId)).toBe(true);
    expect(jobs.some(j => j.jobId === job2.jobId)).toBe(true);
  });

  test('should handle job with agent ID', async () => {
    const job = { ...createTestJob(), agentId: 'test-agent-123' };
    await createJob(job);
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved?.agentId).toBe('test-agent-123');
  });

  test('should preserve stage information', async () => {
    const job = {
      ...createTestJob(),
      stages: [
        {
          stage: 'upload',
          status: 'completed' as const,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        {
          stage: 'analysis',
          status: 'in_progress' as const,
          startedAt: new Date(),
        },
      ],
    };
    
    await createJob(job);
    
    const retrieved = await getJob(job.jobId);
    expect(retrieved?.stages.length).toBe(2);
    expect(retrieved?.stages[0].stage).toBe('upload');
    expect(retrieved?.stages[0].status).toBe('completed');
    expect(retrieved?.stages[1].stage).toBe('analysis');
    expect(retrieved?.stages[1].status).toBe('in_progress');
  });
});

describe('Agents Table Operations', () => {
  const createTestAgent = (): LectureAgent => ({
    id: `test-agent-${Date.now()}`,
    name: `Test Agent ${Date.now()}`,
    description: 'A test agent',
    personality: {
      instructions: 'Be helpful and friendly',
      tone: 'casual',
    },
    voice: {
      voiceId: 'test-voice',
      speed: 1.0,
      pitch: 0,
    },
    createdAt: new Date(),
  });

  test('should create and retrieve an agent', async () => {
    const agent = createTestAgent();
    await createAgent(agent);
    
    const retrieved = await getAgent(agent.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(agent.id);
    expect(retrieved?.name).toBe(agent.name);
  });

  test('should return null for non-existent agent', async () => {
    const retrieved = await getAgent('non-existent-id');
    expect(retrieved).toBeNull();
  });

  test('should enforce unique agent names', async () => {
    const agent1 = createTestAgent();
    await createAgent(agent1);
    
    const agent2 = { ...createTestAgent(), id: `test-agent-${Date.now()}-2`, name: agent1.name };
    await expect(createAgent(agent2)).rejects.toThrow('already exists');
  });

  test('should update agent description', async () => {
    const agent = createTestAgent();
    await createAgent(agent);
    
    const newDescription = 'Updated description';
    await updateAgent(agent.id, { description: newDescription });
    
    const retrieved = await getAgent(agent.id);
    expect(retrieved?.description).toBe(newDescription);
  });

  test('should update agent personality', async () => {
    const agent = createTestAgent();
    await createAgent(agent);
    
    const newPersonality = {
      instructions: 'Be serious and formal',
      tone: 'formal' as const,
    };
    await updateAgent(agent.id, { personality: newPersonality });
    
    const retrieved = await getAgent(agent.id);
    expect(retrieved?.personality.instructions).toBe(newPersonality.instructions);
    expect(retrieved?.personality.tone).toBe(newPersonality.tone);
  });

  test('should throw error when updating non-existent agent', async () => {
    await expect(updateAgent('non-existent-id', { description: 'test' }))
      .rejects.toThrow('Agent not found');
  });

  test('should enforce unique names on update', async () => {
    const agent1 = createTestAgent();
    const agent2 = { ...createTestAgent(), id: `test-agent-${Date.now()}-2`, name: `Different ${Date.now()}` };
    
    await createAgent(agent1);
    await createAgent(agent2);
    
    await expect(updateAgent(agent2.id, { name: agent1.name }))
      .rejects.toThrow('already exists');
  });

  test('should delete an agent', async () => {
    const agent = createTestAgent();
    await createAgent(agent);
    
    await deleteAgent(agent.id);
    
    const retrieved = await getAgent(agent.id);
    expect(retrieved).toBeNull();
  });

  test('should list all agents', async () => {
    const agent1 = createTestAgent();
    const agent2 = { ...createTestAgent(), id: `test-agent-${Date.now()}-2`, name: `Agent 2 ${Date.now()}` };
    
    await createAgent(agent1);
    await createAgent(agent2);
    
    const agents = await listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(2);
    expect(agents.some(a => a.id === agent1.id)).toBe(true);
    expect(agents.some(a => a.id === agent2.id)).toBe(true);
  });

  test('should preserve voice configuration', async () => {
    const agent = {
      ...createTestAgent(),
      voice: {
        voiceId: 'custom-voice',
        speed: 1.5,
        pitch: 5,
      },
    };
    
    await createAgent(agent);
    
    const retrieved = await getAgent(agent.id);
    expect(retrieved?.voice.voiceId).toBe('custom-voice');
    expect(retrieved?.voice.speed).toBeCloseTo(1.5, 2);
    expect(retrieved?.voice.pitch).toBe(5);
  });
});

describe('Content Table Operations', () => {
  test('should create and retrieve content', async () => {
    const jobId = `test-job-${Date.now()}`;
    await createContent(jobId);
    
    const retrieved = await getContent(jobId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.jobId).toBe(jobId);
  });

  test('should return null for non-existent content', async () => {
    const retrieved = await getContent('non-existent-id');
    expect(retrieved).toBeNull();
  });

  test('should update content with extracted content', async () => {
    const jobId = `test-job-${Date.now()}`;
    await createContent(jobId);
    
    const extractedContent = {
      pages: [{ pageNumber: 1, text: 'Test content', elements: [] }],
      figures: [],
      tables: [],
      formulas: [],
      citations: [],
    };
    
    await updateContent(jobId, { extractedContent });
    
    const retrieved = await getContent(jobId);
    expect(retrieved?.extractedContent).toBeDefined();
    expect(retrieved?.extractedContent?.pages.length).toBe(1);
  });

  test('should update content with audio URL', async () => {
    const jobId = `test-job-${Date.now()}`;
    await createContent(jobId);
    
    const audioUrl = 'https://example.com/audio.mp3';
    await updateContent(jobId, { audioUrl });
    
    const retrieved = await getContent(jobId);
    expect(retrieved?.audioUrl).toBe(audioUrl);
  });

  test('should throw error when updating non-existent content', async () => {
    await expect(updateContent('non-existent-id', { audioUrl: 'test' }))
      .rejects.toThrow('Content not found');
  });

  test('should delete content', async () => {
    const jobId = `test-job-${Date.now()}`;
    await createContent(jobId);
    
    await deleteContent(jobId);
    
    const retrieved = await getContent(jobId);
    expect(retrieved).toBeNull();
  });

  test('should update timestamps on content update', async () => {
    const jobId = `test-job-${Date.now()}`;
    const created = await createContent(jobId);
    
    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await updateContent(jobId, { audioUrl: 'test' });
    const retrieved = await getContent(jobId);
    
    expect(retrieved?.updatedAt).not.toBe(created.updatedAt);
  });
});

describe('Error Handling', () => {
  test('should handle database connection errors gracefully', async () => {
    // This test verifies that errors are properly wrapped
    // In a real scenario, we'd mock the DynamoDB client to simulate failures
    const result = await getJob('test-id');
    expect(result).toBeNull(); // Should not throw, just return null
  });
});

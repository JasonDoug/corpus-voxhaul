// Unit tests for Status Query Service
import { getJobStatus } from './status';
import { createJob, createTablesIfNotExist, deleteJob } from './dynamodb';
import { Job, JobStatus } from '../models/job';

// Setup: Create tables before running tests
beforeAll(async () => {
  await createTablesIfNotExist();
  await new Promise(resolve => setTimeout(resolve, 1000));
}, 30000);

// Cleanup: Delete test jobs after each test
afterEach(async () => {
  try {
    const { listJobs } = await import('./dynamodb');
    const jobs = await listJobs();
    for (const job of jobs) {
      await deleteJob(job.jobId);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('Status Query Service', () => {
  const createTestJob = (status: JobStatus, error?: string): Job => ({
    jobId: `test-job-${Date.now()}-${Math.random()}`,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
    pdfFilename: 'test.pdf',
    pdfUrl: 's3://bucket/test.pdf',
    agentId: 'test-agent-id',
    stages: [
      {
        stage: 'upload',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      },
      {
        stage: 'analysis',
        status: status === 'analyzing' ? 'in_progress' : 'pending',
        startedAt: status === 'analyzing' ? new Date() : undefined,
      },
      {
        stage: 'segmentation',
        status: 'pending',
      },
      {
        stage: 'script_generation',
        status: 'pending',
      },
      {
        stage: 'audio_synthesis',
        status: 'pending',
      },
    ],
    error,
  });

  describe('Status retrieval for various job states', () => {
    test('should retrieve status for queued job', async () => {
      const job = createTestJob('queued');
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('queued');
      expect(status.pdfFilename).toBe('test.pdf');
      expect(status.agentId).toBe('test-agent-id');
      expect(status.stages).toHaveLength(5);
      expect(status.error).toBeUndefined();
    });

    test('should retrieve status for analyzing job', async () => {
      const job = createTestJob('analyzing');
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('analyzing');
      expect(status.stages.find(s => s.stage === 'analysis')?.status).toBe('in_progress');
    });

    test('should retrieve status for segmenting job', async () => {
      const job = createTestJob('segmenting');
      job.stages[1].status = 'completed';
      job.stages[1].completedAt = new Date();
      job.stages[2].status = 'in_progress';
      job.stages[2].startedAt = new Date();
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('segmenting');
      expect(status.stages.find(s => s.stage === 'analysis')?.status).toBe('completed');
      expect(status.stages.find(s => s.stage === 'segmentation')?.status).toBe('in_progress');
    });

    test('should retrieve status for generating_script job', async () => {
      const job = createTestJob('generating_script');
      job.stages[1].status = 'completed';
      job.stages[2].status = 'completed';
      job.stages[3].status = 'in_progress';
      job.stages[3].startedAt = new Date();
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('generating_script');
      expect(status.stages.find(s => s.stage === 'script_generation')?.status).toBe('in_progress');
    });

    test('should retrieve status for synthesizing_audio job', async () => {
      const job = createTestJob('synthesizing_audio');
      job.stages[1].status = 'completed';
      job.stages[2].status = 'completed';
      job.stages[3].status = 'completed';
      job.stages[4].status = 'in_progress';
      job.stages[4].startedAt = new Date();
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('synthesizing_audio');
      expect(status.stages.find(s => s.stage === 'audio_synthesis')?.status).toBe('in_progress');
    });

    test('should retrieve status for completed job', async () => {
      const job = createTestJob('completed');
      job.stages.forEach(stage => {
        stage.status = 'completed';
        stage.startedAt = new Date();
        stage.completedAt = new Date();
      });
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('completed');
      expect(status.stages.every(s => s.status === 'completed')).toBe(true);
    });

    test('should retrieve status for failed job with error message', async () => {
      const errorMessage = 'PDF parsing failed: corrupted file';
      const job = createTestJob('failed', errorMessage);
      job.stages[1].status = 'failed';
      job.stages[1].error = errorMessage;
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe(errorMessage);
      expect(status.stages.find(s => s.stage === 'analysis')?.status).toBe('failed');
      expect(status.stages.find(s => s.stage === 'analysis')?.error).toBe(errorMessage);
    });

    test('should retrieve status with stage timestamps', async () => {
      const job = createTestJob('analyzing');
      const startTime = new Date();
      job.stages[0].startedAt = startTime;
      job.stages[0].completedAt = new Date(startTime.getTime() + 1000);
      job.stages[1].startedAt = new Date(startTime.getTime() + 1500);
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.stages[0].startedAt).toBeDefined();
      expect(status.stages[0].completedAt).toBeDefined();
      expect(status.stages[1].startedAt).toBeDefined();
      expect(status.stages[1].completedAt).toBeUndefined();
    });

    test('should retrieve status for job without agent', async () => {
      const job = createTestJob('queued');
      job.agentId = undefined;
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.jobId).toBe(job.jobId);
      expect(status.agentId).toBeUndefined();
    });
  });

  describe('Error handling for invalid job IDs', () => {
    test('should throw error for non-existent job ID', async () => {
      await expect(getJobStatus({ jobId: 'non-existent-job-id' }))
        .rejects.toThrow('Job not found: non-existent-job-id');
    });

    test('should throw error for empty job ID', async () => {
      await expect(getJobStatus({ jobId: '' }))
        .rejects.toThrow();
    });

    test('should throw error for malformed job ID', async () => {
      await expect(getJobStatus({ jobId: 'invalid@job#id' }))
        .rejects.toThrow('Job not found: invalid@job#id');
    });
  });

  describe('Status response completeness', () => {
    test('should include all required fields in response', async () => {
      const job = createTestJob('queued');
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      // Verify all required fields are present
      expect(status).toHaveProperty('jobId');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('createdAt');
      expect(status).toHaveProperty('updatedAt');
      expect(status).toHaveProperty('pdfFilename');
      expect(status).toHaveProperty('stages');
      
      // Verify types
      expect(typeof status.jobId).toBe('string');
      expect(typeof status.status).toBe('string');
      expect(status.createdAt).toBeInstanceOf(Date);
      expect(status.updatedAt).toBeInstanceOf(Date);
      expect(typeof status.pdfFilename).toBe('string');
      expect(Array.isArray(status.stages)).toBe(true);
    });

    test('should include stage progress details', async () => {
      const job = createTestJob('analyzing');
      await createJob(job);

      const status = await getJobStatus({ jobId: job.jobId });

      expect(status.stages).toHaveLength(5);
      
      // Verify each stage has required fields
      status.stages.forEach(stage => {
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('status');
        expect(typeof stage.stage).toBe('string');
        expect(['pending', 'in_progress', 'completed', 'failed']).toContain(stage.status);
      });
    });
  });
});

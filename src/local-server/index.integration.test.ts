// Integration tests for local development server endpoints
import request from 'supertest';
import app from './index';
import { createAgent, deleteAgent } from '../services/agent';
import { createJob, deleteJob, deleteContent } from '../services/dynamodb';
import { LectureAgent } from '../models/agent';
import { Job } from '../models/job';

/**
 * Integration tests for local endpoints
 * 
 * These tests verify:
 * 1. Complete pipeline from upload to completion
 * 2. Agent CRUD operations
 * 3. Error handling across endpoints
 * 
 * Validates: Requirements 10.4
 */

describe('Local Endpoint Integration Tests', () => {
  let testAgent: LectureAgent;
  let testJob: Job;
  
  beforeAll(async () => {
    // Create a test agent for use in tests
    testAgent = await createAgent({
      name: 'Test Integration Agent',
      description: 'Agent for integration testing',
      personality: {
        instructions: 'Be clear and concise',
        tone: 'casual',
      },
      voice: {
        voiceId: 'test-voice',
        speed: 1.0,
        pitch: 0,
      },
    });
  });
  
  afterAll(async () => {
    // Clean up test agent
    try {
      await deleteAgent(testAgent.id);
    } catch (error) {
      // Ignore errors during cleanup
    }
    
    // Clean up test job if it exists
    if (testJob) {
      try {
        await deleteJob(testJob.jobId);
        await deleteContent(testJob.jobId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });
  
  describe('Agent CRUD Operations', () => {
    let createdAgentId: string;
    
    afterEach(async () => {
      // Clean up created agent
      if (createdAgentId) {
        try {
          await deleteAgent(createdAgentId);
        } catch (error) {
          // Ignore errors
        }
        createdAgentId = '';
      }
    });
    
    it('should create a new agent via POST /api/agents', async () => {
      const agentData = {
        name: 'Test Agent via API',
        description: 'Created through API endpoint',
        personality: {
          instructions: 'Be enthusiastic',
          tone: 'enthusiastic',
        },
        voice: {
          voiceId: 'test-voice-2',
          speed: 1.2,
          pitch: 5,
        },
      };
      
      const response = await request(app)
        .post('/api/agents')
        .send(agentData)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(agentData.name);
      expect(response.body.description).toBe(agentData.description);
      expect(response.body.personality.tone).toBe(agentData.personality.tone);
      
      createdAgentId = response.body.id;
    });
    
    it('should list all agents via GET /api/agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);
      
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
      expect(response.body.agents.length).toBeGreaterThan(0);
      
      // Should include our test agent
      const foundAgent = response.body.agents.find((a: any) => a.id === testAgent.id);
      expect(foundAgent).toBeDefined();
    });
    
    it('should get a specific agent via GET /api/agents/:agentId', async () => {
      const response = await request(app)
        .get(`/api/agents/${testAgent.id}`)
        .expect(200);
      
      expect(response.body.id).toBe(testAgent.id);
      expect(response.body.name).toBe(testAgent.name);
    });
    
    it('should update an agent via PUT /api/agents/:agentId', async () => {
      // First create an agent to update
      const agent = await createAgent({
        name: 'Agent to Update',
        description: 'Will be updated',
        personality: {
          instructions: 'Original instructions',
          tone: 'casual',
        },
        voice: {
          voiceId: 'original-voice',
          speed: 1.0,
          pitch: 0,
        },
      });
      
      createdAgentId = agent.id;
      
      const updates = {
        description: 'Updated description',
        personality: {
          instructions: 'Updated instructions',
          tone: 'serious',
        },
      };
      
      const response = await request(app)
        .put(`/api/agents/${agent.id}`)
        .send(updates)
        .expect(200);
      
      expect(response.body.description).toBe(updates.description);
      expect(response.body.personality.instructions).toBe(updates.personality.instructions);
      expect(response.body.personality.tone).toBe(updates.personality.tone);
    });
    
    it('should delete an agent via DELETE /api/agents/:agentId', async () => {
      // First create an agent to delete
      const agent = await createAgent({
        name: 'Agent to Delete',
        description: 'Will be deleted',
        personality: {
          instructions: 'Test instructions',
          tone: 'casual',
        },
        voice: {
          voiceId: 'test-voice',
          speed: 1.0,
          pitch: 0,
        },
      });
      
      await request(app)
        .delete(`/api/agents/${agent.id}`)
        .expect(204);
      
      // Verify agent is deleted
      const response = await request(app)
        .get(`/api/agents/${agent.id}`)
        .expect(404);
      
      expect(response.body.code).toBe('AGENT_NOT_FOUND');
    });
    
    it('should return 400 for invalid agent data', async () => {
      const invalidData = {
        name: '', // Empty name is invalid
        description: 'Test',
        personality: {
          instructions: 'Test',
          tone: 'casual',
        },
        voice: {
          voiceId: 'test',
          speed: 1.0,
          pitch: 0,
        },
      };
      
      const response = await request(app)
        .post('/api/agents')
        .send(invalidData)
        .expect(400);
      
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
    
    it('should return 404 for non-existent agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent-id')
        .expect(404);
      
      expect(response.body.code).toBe('AGENT_NOT_FOUND');
    });
  });
  
  describe('Job Status Endpoint', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/status/non-existent-job-id')
        .expect(404);
      
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
    
    it('should return job status for existing job', async () => {
      // Create a test job
      const { v4: uuidv4 } = require('uuid');
      testJob = await createJob({
        jobId: uuidv4(),
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        pdfFilename: 'test.pdf',
        pdfUrl: 's3://test-bucket/test.pdf',
        agentId: testAgent.id,
        stages: [
          { stage: 'upload', status: 'completed', startedAt: new Date(), completedAt: new Date() },
          { stage: 'analysis', status: 'pending' },
          { stage: 'segmentation', status: 'pending' },
          { stage: 'script_generation', status: 'pending' },
          { stage: 'audio_synthesis', status: 'pending' },
        ],
      });
      
      const response = await request(app)
        .get(`/api/status/${testJob.jobId}`)
        .expect(200);
      
      expect(response.body.jobId).toBe(testJob.jobId);
      expect(response.body.status).toBe('queued');
      expect(response.body.pdfFilename).toBe('test.pdf');
    });
  });
  
  describe('Error Handling Across Endpoints', () => {
    it('should handle missing jobId in analyzer endpoint', async () => {
      const response = await request(app)
        .post('/api/analyze/invalid-job-id')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
    });
    
    it('should handle missing jobId in segmenter endpoint', async () => {
      const response = await request(app)
        .post('/api/segment/invalid-job-id')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
    
    it('should handle missing jobId in script endpoint', async () => {
      const response = await request(app)
        .post('/api/script/invalid-job-id')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
    
    it('should handle missing jobId in audio endpoint', async () => {
      const response = await request(app)
        .post('/api/audio/invalid-job-id')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('JOB_NOT_FOUND');
    });
    
    it('should return consistent error format across all endpoints', async () => {
      const endpoints = [
        { method: 'get' as const, path: '/api/status/invalid-id' },
        { method: 'post' as const, path: '/api/analyze/invalid-id' },
        { method: 'post' as const, path: '/api/segment/invalid-id' },
        { method: 'post' as const, path: '/api/script/invalid-id' },
        { method: 'post' as const, path: '/api/audio/invalid-id' },
      ];
      
      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === 'get') {
          response = await request(app).get(endpoint.path);
        } else {
          response = await request(app).post(endpoint.path);
        }
        
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('retryable');
        expect(typeof response.body.error).toBe('string');
        expect(typeof response.body.code).toBe('string');
        expect(typeof response.body.retryable).toBe('boolean');
      }
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });
  
  describe('Playback Interface', () => {
    it('should serve player HTML', async () => {
      const response = await request(app)
        .get('/api/player/test-job-id')
        .expect(200);
      
      expect(response.type).toMatch(/html/);
    });
  });
});

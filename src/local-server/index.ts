// Local development server
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import DOMMatrix from '@thednp/dommatrix';

// Polyfill DOM APIs required by pdf-parse
(global as any).DOMMatrix = DOMMatrix;

(global as any).Path2D = class Path2D {
  constructor() { }
};

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '110mb' }));
app.use(express.urlencoded({ extended: true, limit: '110mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body ? 'present' : 'none',
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    localMode: config.localMode,
  });
});

// Serve static files from public directory
app.use(express.static('public'));

// API routes - Serverless function wrappers

// POST /api/upload - Upload function wrapper
app.post('/api/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uploadHandler } = await import('../functions/upload');

    // Extract file from request
    // In a real implementation, this would use multer or similar for file uploads
    // For now, we expect the file to be in req.body

    // Convert file data to Buffer if needed
    let fileBuffer: Buffer;
    if (Buffer.isBuffer(req.body.file)) {
      fileBuffer = req.body.file;
    } else if (req.body.file && req.body.file.type === 'Buffer' && Array.isArray(req.body.file.data)) {
      // Handle JSON-serialized Buffer
      fileBuffer = Buffer.from(req.body.file.data);
    } else if (typeof req.body.file === 'string') {
      // Handle base64-encoded string
      fileBuffer = Buffer.from(req.body.file, 'base64');
    } else {
      throw new Error('Invalid file format');
    }

    const event = {
      file: fileBuffer,
      filename: req.body.filename,
      agentId: req.body.agentId,
    };

    const result = await uploadHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    next(error);
  }
});

// POST /api/analyze/:jobId - Analysis function wrapper
app.post('/api/analyze/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analyzerHandler } = await import('../functions/analyzer');

    const event = {
      jobId: req.params.jobId,
    };

    const result = await analyzerHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    next(error);
  }
});



// POST /api/script/:jobId - Script generation function wrapper
app.post('/api/script/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Import script generator service
    const { generateScript } = await import('../services/script-generator');
    const { getJob, updateJob } = await import('../services/dynamodb');

    const jobId = req.params.jobId;
    const agentId = req.body.agentId; // Optional agent ID override

    // Get the job
    const job = await getJob(jobId);
    if (!job) {
      res.status(404).json({
        error: `Job not found: ${jobId}`,
        code: 'JOB_NOT_FOUND',
        retryable: false,
      });
      return;
    }

    // Update job status to 'generating_script'
    await updateJob(jobId, {
      status: 'generating_script',
      stages: job.stages.map(stage =>
        stage.stage === 'script_generation'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });

    // Generate the script
    const lectureScript = await generateScript(jobId, agentId);

    // Update job status to 'synthesizing_audio'
    await updateJob(jobId, {
      status: 'synthesizing_audio',
      stages: job.stages.map(stage => {
        if (stage.stage === 'script_generation') {
          return { ...stage, status: 'completed', completedAt: new Date() };
        }
        if (stage.stage === 'audio_synthesis') {
          return { ...stage, status: 'in_progress', startedAt: new Date() };
        }
        return stage;
      }),
    });

    res.status(200).json({
      jobId,
      status: 'synthesizing_audio',
      message: 'Script generation completed',
      lectureScript: {
        segments: lectureScript.segments.length,
        totalEstimatedDuration: lectureScript.totalEstimatedDuration,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/:jobId - Audio synthesis function wrapper
app.post('/api/audio/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Import audio synthesizer service
    const { synthesizeAudio } = await import('../services/audio-synthesizer');
    const { getJob, updateJob } = await import('../services/dynamodb');

    const jobId = req.params.jobId;

    // Get the job
    const job = await getJob(jobId);
    if (!job) {
      res.status(404).json({
        error: `Job not found: ${jobId}`,
        code: 'JOB_NOT_FOUND',
        retryable: false,
      });
      return;
    }

    // Update job status to 'synthesizing_audio'
    await updateJob(jobId, {
      status: 'synthesizing_audio',
      stages: job.stages.map(stage =>
        stage.stage === 'audio_synthesis'
          ? { ...stage, status: 'in_progress', startedAt: new Date() }
          : stage
      ),
    });

    // Synthesize the audio
    const audioOutput = await synthesizeAudio(jobId);

    // Job status is updated to 'completed' by synthesizeAudio

    res.status(200).json({
      jobId,
      status: 'completed',
      message: 'Audio synthesis completed',
      audioOutput: {
        audioUrl: audioOutput.audioUrl,
        duration: audioOutput.duration,
        wordTimingCount: audioOutput.wordTimings.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/status/:jobId - Status query wrapper
app.get('/api/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { statusHandler } = await import('../functions/status');

    const event = {
      pathParameters: {
        jobId: req.params.jobId,
      },
    };

    const result = await statusHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    next(error);
  }
});

// GET /api/agents - List agents wrapper
app.get('/api/agents', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { listAgents } = await import('../services/agent');

    const agents = await listAgents();
    res.status(200).json({ agents });
  } catch (error) {
    next(error);
  }
});

// POST /api/agents - Create agent wrapper
app.post('/api/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { createAgent } = await import('../services/agent');

    const agentData = req.body;
    const agent = await createAgent(agentData);

    res.status(201).json(agent);
  } catch (error) {
    // Handle validation errors with 400 status
    if (error instanceof Error && error.name === 'AgentValidationError') {
      res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
      return;
    }
    next(error);
  }
});

// GET /api/agents/:agentId - Get agent by ID
app.get('/api/agents/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getAgent } = await import('../services/agent');

    const agent = await getAgent(req.params.agentId);

    if (!agent) {
      res.status(404).json({
        error: `Agent not found: ${req.params.agentId}`,
        code: 'AGENT_NOT_FOUND',
        retryable: false,
      });
      return;
    }

    res.status(200).json(agent);
  } catch (error) {
    next(error);
  }
});

// PUT /api/agents/:agentId - Update agent
app.put('/api/agents/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { updateAgent } = await import('../services/agent');

    const updates = req.body;
    const agent = await updateAgent(req.params.agentId, updates);

    res.status(200).json(agent);
  } catch (error) {
    // Handle validation errors with 400 status
    if (error instanceof Error && error.name === 'AgentValidationError') {
      res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        retryable: false,
      });
      return;
    }
    next(error);
  }
});

// DELETE /api/agents/:agentId - Delete agent
app.delete('/api/agents/:agentId', async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const { deleteAgent } = await import('../services/agent');

    await deleteAgent(req.params.agentId);

    // Send 204 No Content
    _res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Playback interface endpoint
app.get('/api/player/:jobId', (_req: Request, res: Response) => {
  res.sendFile('player.html', { root: 'public' });
});

// Playback data endpoint
app.get('/api/playback/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    // Import dynamically to avoid circular dependencies
    const { getPlaybackData } = await import('../services/status');
    const playbackData = await getPlaybackData(jobId);

    res.json(playbackData);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toResponse());
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    retryable: false,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    retryable: false,
  });
});

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.port;
  app.listen(PORT, () => {
    logger.info(`PDF Lecture Service running on port ${PORT}`, {
      environment: config.nodeEnv,
      localMode: config.localMode,
      useLocalStack: config.localstack.useLocalStack,
    });
  });
}

export default app;

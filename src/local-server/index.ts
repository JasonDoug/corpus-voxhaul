// Local development server
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

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

// API routes will be added in subsequent tasks
// POST /api/upload - Upload function wrapper
// POST /api/analyze/:jobId - Analysis function wrapper
// POST /api/segment/:jobId - Segmentation function wrapper
// POST /api/script/:jobId - Script generation function wrapper
// POST /api/audio/:jobId - Audio synthesis function wrapper
// GET /api/status/:jobId - Status query wrapper
// GET /api/agents - List agents wrapper
// POST /api/agents - Create agent wrapper
// GET /api/player/:jobId - Serve playback interface

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

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`PDF Lecture Service running on port ${PORT}`, {
    environment: config.nodeEnv,
    localMode: config.localMode,
    useLocalStack: config.localstack.useLocalStack,
  });
});

export default app;

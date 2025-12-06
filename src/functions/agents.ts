// Agents function - Serverless function wrapper for agent management
import { 
  listAgents, 
  getAgent, 
  createAgent, 
  updateAgent, 
  deleteAgent,
  AgentCreate,
  AgentUpdate
} from '../services/agent';
import { logger } from '../utils/logger';
import { metrics, RequestMetrics } from '../utils/metrics';
import { randomUUID } from 'crypto';

// Initialize request metrics tracker
const requestMetrics = new RequestMetrics();

/**
 * Lambda handler for agent management
 * Handles GET, POST, PUT, DELETE operations for lecture agents
 */
export async function agentsHandler(event: any): Promise<any> {
  // Generate correlation ID for request tracking
  const correlationId = event.requestContext?.requestId || randomUUID();
  logger.setCorrelationId(correlationId);
  logger.setFunctionName('AgentsFunction');
  
  const httpMethod = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters || {};
  
  // Start timing the request
  const timerId = metrics.startTimer('AgentsFunctionDuration', { 
    method: httpMethod,
    path: path
  });
  
  try {
    logger.info('Agents function invoked', { 
      correlationId, 
      method: httpMethod,
      path: path
    });
    requestMetrics.incrementRequest('agents');
    
    let response;
    
    // Route based on HTTP method and path
    if (httpMethod === 'GET' && !pathParameters.agentId) {
      // GET /api/agents - List all agents
      response = await handleListAgents();
    } else if (httpMethod === 'GET' && pathParameters.agentId) {
      // GET /api/agents/{agentId} - Get specific agent
      response = await handleGetAgent(pathParameters.agentId);
    } else if (httpMethod === 'POST') {
      // POST /api/agents - Create agent
      const body = JSON.parse(event.body || '{}');
      response = await handleCreateAgent(body);
    } else if (httpMethod === 'PUT' && pathParameters.agentId) {
      // PUT /api/agents/{agentId} - Update agent
      const body = JSON.parse(event.body || '{}');
      response = await handleUpdateAgent(pathParameters.agentId, body);
    } else if (httpMethod === 'DELETE' && pathParameters.agentId) {
      // DELETE /api/agents/{agentId} - Delete agent
      response = await handleDeleteAgent(pathParameters.agentId);
    } else {
      // Method not allowed
      response = {
        statusCode: 405,
        body: JSON.stringify({
          error: 'Method not allowed',
          code: 'METHOD_NOT_ALLOWED'
        })
      };
    }
    
    metrics.stopTimer(timerId);
    requestMetrics.incrementSuccess('agents');
    
    return response;
    
  } catch (error: any) {
    metrics.stopTimer(timerId);
    requestMetrics.incrementError('agents', error.name);
    
    logger.error('Agents function error', {
      error: error.message,
      stack: error.stack,
      correlationId
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        retryable: true
      })
    };
  }
}

/**
 * Handle GET /api/agents - List all agents
 */
async function handleListAgents(): Promise<any> {
  logger.info('Listing all agents');
  
  const agents = await listAgents();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ agents })
  };
}

/**
 * Handle GET /api/agents/{agentId} - Get specific agent
 */
async function handleGetAgent(agentId: string): Promise<any> {
  logger.info('Getting agent', { agentId });
  
  const agent = await getAgent(agentId);
  
  if (!agent) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: `Agent not found: ${agentId}`,
        code: 'AGENT_NOT_FOUND',
        retryable: false
      })
    };
  }
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(agent)
  };
}

/**
 * Handle POST /api/agents - Create agent
 */
async function handleCreateAgent(body: AgentCreate): Promise<any> {
  logger.info('Creating agent', { name: body.name });
  
  // Validate required fields
  if (!body.name || !body.description || !body.personality || !body.voice) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Missing required fields: name, description, personality, voice',
        code: 'VALIDATION_ERROR',
        retryable: false
      })
    };
  }
  
  try {
    const agent = await createAgent(body);
    
    logger.info('Agent created successfully', { agentId: agent.id });
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(agent)
    };
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: error.message,
          code: 'VALIDATION_ERROR',
          retryable: false
        })
      };
    }
    throw error;
  }
}

/**
 * Handle PUT /api/agents/{agentId} - Update agent
 */
async function handleUpdateAgent(agentId: string, body: AgentUpdate): Promise<any> {
  logger.info('Updating agent', { agentId });
  
  try {
    const agent = await updateAgent(agentId, body);
    
    logger.info('Agent updated successfully', { agentId });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(agent)
    };
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: `Agent not found: ${agentId}`,
          code: 'AGENT_NOT_FOUND',
          retryable: false
        })
      };
    }
    throw error;
  }
}

/**
 * Handle DELETE /api/agents/{agentId} - Delete agent
 */
async function handleDeleteAgent(agentId: string): Promise<any> {
  logger.info('Deleting agent', { agentId });
  
  try {
    await deleteAgent(agentId);
    
    logger.info('Agent deleted successfully', { agentId });
    
    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: ''
    };
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: `Agent not found: ${agentId}`,
          code: 'AGENT_NOT_FOUND',
          retryable: false
        })
      };
    }
    throw error;
  }
}

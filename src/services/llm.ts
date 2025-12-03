/**
 * LLM Service - Unified interface for multiple LLM providers via OpenRouter
 * 
 * Supports:
 * - OpenRouter (unified access to OpenAI, Anthropic, Google, Meta, etc.)
 * - Direct OpenAI API
 * - Direct Anthropic API
 */

import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { recordLLMCallMetrics } from '../utils/llm-metrics';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface VisionRequest {
  imageUrl: string;
  prompt: string;
  model?: string;
}

/**
 * LLM Provider types
 */
export type LLMProvider = 'openrouter' | 'openai' | 'anthropic';

/**
 * OpenRouter API client
 */
class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private appName: string = 'PDF Lecture Service';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || 'openai/gpt-4-turbo-preview';
    const startTime = Date.now();
    
    logger.info('OpenRouter chat request', {
      model,
      messageCount: request.messages.length,
    });
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/pdf-lecture-service',
          'X-Title': this.appName,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: request.stream ?? false,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        logger.error('OpenRouter API error', { status: response.status, error });
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }
      
      const data: any = await response.json();
      const duration = Date.now() - startTime;
      
      const result = {
        content: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
      
      // Record metrics for successful call
      recordLLMCallMetrics({
        operation: 'chat',
        model: data.model,
        provider: 'openrouter',
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        durationMs: duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record metrics for failed call
      recordLLMCallMetrics({
        operation: 'chat',
        model,
        provider: 'openrouter',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: duration,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }
  
  async vision(request: VisionRequest): Promise<string> {
    const model = request.model || 'openai/gpt-4-vision-preview';
    
    logger.info('OpenRouter vision request', { model });
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/pdf-lecture-service',
        'X-Title': this.appName,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: request.imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('OpenRouter vision API error', { status: response.status, error });
      throw new Error(`OpenRouter vision API error: ${response.status} - ${error}`);
    }
    
    const data: any = await response.json();
    return data.choices[0].message.content;
  }
}

/**
 * OpenAI API client (direct)
 */
class OpenAIClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || 'gpt-4-turbo-preview';
    const startTime = Date.now();
    
    logger.info('OpenAI chat request', {
      model,
      messageCount: request.messages.length,
    });
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        logger.error('OpenAI API error', { status: response.status, error });
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }
      
      const data: any = await response.json();
      const duration = Date.now() - startTime;
      
      const result = {
        content: data.choices[0].message.content,
        model: data.model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
      
      // Record metrics for successful call
      recordLLMCallMetrics({
        operation: 'chat',
        model: data.model,
        provider: 'openai',
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        durationMs: duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record metrics for failed call
      recordLLMCallMetrics({
        operation: 'chat',
        model,
        provider: 'openai',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: duration,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }
  
  async vision(request: VisionRequest): Promise<string> {
    const model = request.model || 'gpt-4-vision-preview';
    
    logger.info('OpenAI vision request', { model });
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: request.imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('OpenAI vision API error', { status: response.status, error });
      throw new Error(`OpenAI vision API error: ${response.status} - ${error}`);
    }
    
    const data: any = await response.json();
    return data.choices[0].message.content;
  }
}

/**
 * Anthropic API client (direct)
 */
class AnthropicClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || 'claude-3-opus-20240229';
    const startTime = Date.now();
    
    logger.info('Anthropic chat request', {
      model,
      messageCount: request.messages.length,
    });
    
    try {
      // Convert messages format for Anthropic
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
      
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          system: systemMessage?.content,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        logger.error('Anthropic API error', { status: response.status, error });
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }
      
      const data: any = await response.json();
      const duration = Date.now() - startTime;
      
      const result = {
        content: data.content[0].text,
        model: data.model,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
      };
      
      // Record metrics for successful call
      recordLLMCallMetrics({
        operation: 'chat',
        model: data.model,
        provider: 'anthropic',
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        durationMs: duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record metrics for failed call
      recordLLMCallMetrics({
        operation: 'chat',
        model,
        provider: 'anthropic',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: duration,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }
  
  async vision(request: VisionRequest): Promise<string> {
    const model = request.model || 'claude-3-opus-20240229';
    
    logger.info('Anthropic vision request', { model });
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: request.imageUrl,
                },
              },
              {
                type: 'text',
                text: request.prompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error('Anthropic vision API error', { status: response.status, error });
      throw new Error(`Anthropic vision API error: ${response.status} - ${error}`);
    }
    
    const data: any = await response.json();
    return data.content[0].text;
  }
}

/**
 * LLM Service - Main interface
 */
export class LLMService {
  private provider: LLMProvider;
  private client: OpenRouterClient | OpenAIClient | AnthropicClient;
  
  constructor(provider?: LLMProvider) {
    this.provider = provider || this.detectProvider();
    this.client = this.createClient();
    
    logger.info('LLM Service initialized', { provider: this.provider });
  }
  
  private detectProvider(): LLMProvider {
    // Check environment variables to determine provider
    if (process.env.OPENROUTER_API_KEY) {
      return 'openrouter';
    } else if (process.env.OPENAI_API_KEY) {
      return 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
    
    // Default to OpenRouter
    return 'openrouter';
  }
  
  private createClient(): OpenRouterClient | OpenAIClient | AnthropicClient {
    switch (this.provider) {
      case 'openrouter':
        const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        if (!openrouterKey) {
          throw new Error('OPENROUTER_API_KEY or OPENAI_API_KEY not set');
        }
        return new OpenRouterClient(openrouterKey);
      
      case 'openai':
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          throw new Error('OPENAI_API_KEY not set');
        }
        return new OpenAIClient(openaiKey);
      
      case 'anthropic':
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          throw new Error('ANTHROPIC_API_KEY not set');
        }
        return new AnthropicClient(anthropicKey);
      
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }
  
  /**
   * Send a chat completion request
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    return withRetry(
      async () => this.client.chat(request),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      }
    );
  }
  
  /**
   * Analyze an image with vision model
   */
  async vision(request: VisionRequest): Promise<string> {
    return withRetry(
      async () => this.client.vision(request),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      }
    );
  }
  
  /**
   * Get the current provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }
}

/**
 * Default LLM service instance
 */
export const llmService = new LLMService();

/**
 * Model recommendations for different tasks
 */
export const RECOMMENDED_MODELS = {
  // Content analysis - needs good reasoning
  analysis: {
    openrouter: 'openai/gpt-4-turbo-preview',
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-opus-20240229',
  },
  
  // Vision - for figures and diagrams
  vision: {
    openrouter: 'openai/gpt-4-vision-preview',
    openai: 'gpt-4-vision-preview',
    anthropic: 'claude-3-opus-20240229',
  },
  
  // Segmentation - needs good structure understanding
  segmentation: {
    openrouter: 'anthropic/claude-3-opus',
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-opus-20240229',
  },
  
  // Script generation - needs creativity
  script: {
    openrouter: 'openai/gpt-4-turbo-preview',
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-opus-20240229',
  },
  
  // Fast/cheap for testing
  fast: {
    openrouter: 'openai/gpt-3.5-turbo',
    openai: 'gpt-3.5-turbo',
    anthropic: 'claude-3-haiku-20240307',
  },
};

/**
 * Get recommended model for a task
 */
export function getRecommendedModel(
  task: keyof typeof RECOMMENDED_MODELS,
  provider?: LLMProvider
): string {
  // Check for environment variable override first
  const envVarMap: Record<string, string> = {
    'analysis': process.env.LLM_MODEL_ANALYSIS || '',
    'vision': process.env.LLM_MODEL_VISION || '',
    'segmentation': process.env.LLM_MODEL_SEGMENTATION || '',
    'script': process.env.LLM_MODEL_SCRIPT || '',
    'fast': process.env.LLM_MODEL_FAST || '',
  };
  
  if (envVarMap[task]) {
    return envVarMap[task];
  }
  
  // Fall back to recommended models
  const detectedProvider = provider || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai');
  return RECOMMENDED_MODELS[task][detectedProvider];
}

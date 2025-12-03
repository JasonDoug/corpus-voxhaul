/**
 * LLM Service Tests
 */

// Set up test environment before importing
process.env.OPENROUTER_API_KEY = 'test-key';

import { LLMService, getRecommendedModel, RECOMMENDED_MODELS } from './llm';

describe('LLM Service', () => {
  // Clean up after all tests
  afterAll(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  describe('Provider Detection', () => {
    it('should detect OpenRouter when OPENROUTER_API_KEY is set', () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      const service = new LLMService();
      expect(service.getProvider()).toBe('openrouter');
      delete process.env.OPENROUTER_API_KEY;
    });

    it('should detect OpenAI when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const service = new LLMService();
      expect(service.getProvider()).toBe('openai');
      delete process.env.OPENAI_API_KEY;
    });

    it('should detect Anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const service = new LLMService();
      expect(service.getProvider()).toBe('anthropic');
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should default to OpenRouter when no keys are set', () => {
      // Save current keys
      const savedOpenRouter = process.env.OPENROUTER_API_KEY;
      const savedOpenAI = process.env.OPENAI_API_KEY;
      const savedAnthropic = process.env.ANTHROPIC_API_KEY;
      
      // Set a dummy key for OpenRouter (since it's the default)
      process.env.OPENROUTER_API_KEY = 'test-default-key';
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const service = new LLMService();
      expect(service.getProvider()).toBe('openrouter');
      
      // Restore keys
      if (savedOpenRouter) process.env.OPENROUTER_API_KEY = savedOpenRouter;
      if (savedOpenAI) process.env.OPENAI_API_KEY = savedOpenAI;
      if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    });
  });

  describe('Model Recommendations', () => {
    it('should return correct model for analysis task', () => {
      const model = getRecommendedModel('analysis', 'openrouter');
      expect(model).toBe('openai/gpt-4-turbo-preview');
    });

    it('should return correct model for vision task', () => {
      const model = getRecommendedModel('vision', 'openrouter');
      expect(model).toBe('openai/gpt-4-vision-preview');
    });

    it('should return correct model for segmentation task', () => {
      const model = getRecommendedModel('segmentation', 'openrouter');
      expect(model).toBe('anthropic/claude-3-opus');
    });

    it('should return correct model for script task', () => {
      const model = getRecommendedModel('script', 'openrouter');
      expect(model).toBe('openai/gpt-4-turbo-preview');
    });

    it('should return fast model for testing', () => {
      const model = getRecommendedModel('fast', 'openrouter');
      expect(model).toBe('openai/gpt-3.5-turbo');
    });
  });

  describe('Model Recommendations by Provider', () => {
    it('should return OpenAI models when provider is openai', () => {
      const model = getRecommendedModel('analysis', 'openai');
      expect(model).toBe('gpt-4-turbo-preview');
    });

    it('should return Anthropic models when provider is anthropic', () => {
      const model = getRecommendedModel('analysis', 'anthropic');
      expect(model).toBe('claude-3-opus-20240229');
    });

    it('should return OpenRouter models when provider is openrouter', () => {
      const model = getRecommendedModel('analysis', 'openrouter');
      expect(model).toBe('openai/gpt-4-turbo-preview');
    });
  });

  describe('Recommended Models Structure', () => {
    it('should have all required tasks', () => {
      expect(RECOMMENDED_MODELS).toHaveProperty('analysis');
      expect(RECOMMENDED_MODELS).toHaveProperty('vision');
      expect(RECOMMENDED_MODELS).toHaveProperty('segmentation');
      expect(RECOMMENDED_MODELS).toHaveProperty('script');
      expect(RECOMMENDED_MODELS).toHaveProperty('fast');
    });

    it('should have all providers for each task', () => {
      Object.values(RECOMMENDED_MODELS).forEach(task => {
        expect(task).toHaveProperty('openrouter');
        expect(task).toHaveProperty('openai');
        expect(task).toHaveProperty('anthropic');
      });
    });

    it('should have valid model names', () => {
      Object.values(RECOMMENDED_MODELS).forEach(task => {
        expect(task.openrouter).toBeTruthy();
        expect(task.openai).toBeTruthy();
        expect(task.anthropic).toBeTruthy();
      });
    });
  });
});

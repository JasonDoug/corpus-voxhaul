# OpenRouter Integration Guide

## What is OpenRouter?

OpenRouter provides unified access to multiple LLM providers through a single API:
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude 3 Opus, Sonnet, Haiku)
- **Google** (Gemini Pro, Gemini Ultra)
- **Meta** (Llama 2, Llama 3)
- **Mistral** (Mistral Large, Medium, Small)
- **And many more...**

### Benefits

1. **Single API Key** - Access all models with one key
2. **Cost Optimization** - Automatically route to cheapest model
3. **Fallback Support** - Automatic failover if a model is down
4. **Model Flexibility** - Easy to switch between models
5. **Unified Billing** - One bill for all providers

## Getting Started

### 1. Get an OpenRouter API Key

1. Visit [https://openrouter.ai](https://openrouter.ai)
2. Sign up for an account
3. Go to Keys section
4. Create a new API key
5. Add credits to your account

### 2. Configure the Service

#### For Local Development

```bash
# Add to .env file
OPENROUTER_API_KEY=sk-or-v1-your-key-here
LLM_PROVIDER=openrouter
```

#### For Production Deployment

```bash
# Set as environment variable
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"

# Deploy with OpenRouter
sam deploy \
  --parameter-overrides \
    "OpenRouterApiKey=$OPENROUTER_API_KEY \
     LLMProvider=openrouter"
```

## Available Models

### Recommended Models for PDF Lecture Service

#### Content Analysis
- **GPT-4 Turbo** - `openai/gpt-4-turbo-preview` (Best quality)
- **Claude 3 Opus** - `anthropic/claude-3-opus` (Great reasoning)
- **Gemini Pro** - `google/gemini-pro` (Good balance)

#### Vision (Figures/Diagrams)
- **GPT-4 Vision** - `openai/gpt-4-vision-preview` (Best for diagrams)
- **Claude 3 Opus** - `anthropic/claude-3-opus` (Great for charts)
- **Gemini Pro Vision** - `google/gemini-pro-vision` (Fast)

#### Content Segmentation
- **Claude 3 Opus** - `anthropic/claude-3-opus` (Best structure)
- **GPT-4 Turbo** - `openai/gpt-4-turbo-preview` (Great logic)

#### Script Generation
- **GPT-4 Turbo** - `openai/gpt-4-turbo-preview` (Creative)
- **Claude 3 Opus** - `anthropic/claude-3-opus` (Natural)

#### Budget-Friendly Options
- **GPT-3.5 Turbo** - `openai/gpt-3.5-turbo` (Fast & cheap)
- **Claude 3 Haiku** - `anthropic/claude-3-haiku` (Very fast)
- **Llama 3 70B** - `meta-llama/llama-3-70b-instruct` (Open source)

### Full Model List

See [https://openrouter.ai/models](https://openrouter.ai/models) for complete list with pricing.

## Configuration Options

### Environment Variables

```bash
# Required: API Key
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: Provider selection
LLM_PROVIDER=openrouter  # or 'openai', 'anthropic'

# Optional: Model overrides
LLM_MODEL_ANALYSIS=openai/gpt-4-turbo-preview
LLM_MODEL_VISION=openai/gpt-4-vision-preview
LLM_MODEL_SEGMENTATION=anthropic/claude-3-opus
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview
```

### Model Selection Strategy

The service automatically selects appropriate models based on the task:

```typescript
// In your code
import { llmService, getRecommendedModel } from './services/llm';

// Use recommended model for analysis
const model = getRecommendedModel('analysis');
const response = await llmService.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Analyze this PDF content...' }
  ],
  model, // Uses recommended model
});
```

## Cost Comparison

### Per 1M Tokens (Approximate)

| Model | Input | Output | Best For |
|-------|-------|--------|----------|
| GPT-4 Turbo | $10 | $30 | Quality |
| GPT-3.5 Turbo | $0.50 | $1.50 | Speed |
| Claude 3 Opus | $15 | $75 | Reasoning |
| Claude 3 Haiku | $0.25 | $1.25 | Budget |
| Gemini Pro | $0.50 | $1.50 | Balance |
| Llama 3 70B | $0.70 | $0.90 | Open Source |

### Typical PDF Processing Costs

**Small PDF (10 pages, simple):**
- Analysis: ~10K tokens = $0.10 - $0.30
- Segmentation: ~5K tokens = $0.05 - $0.15
- Script: ~15K tokens = $0.15 - $0.45
- **Total: ~$0.30 - $0.90 per PDF**

**Large PDF (50 pages, complex):**
- Analysis: ~50K tokens = $0.50 - $1.50
- Segmentation: ~20K tokens = $0.20 - $0.60
- Script: ~60K tokens = $0.60 - $1.80
- **Total: ~$1.30 - $3.90 per PDF**

## Advanced Features

### Model Fallback

OpenRouter automatically falls back to alternative models if primary fails:

```typescript
// Specify fallback models
const response = await llmService.chat({
  messages: [...],
  model: 'openai/gpt-4-turbo-preview',
  // OpenRouter will fallback to similar models if GPT-4 is unavailable
});
```

### Cost Optimization

Use cheaper models for less critical tasks:

```typescript
// Use fast model for simple tasks
const quickAnalysis = await llmService.chat({
  messages: [...],
  model: 'openai/gpt-3.5-turbo', // Much cheaper
});

// Use premium model for complex tasks
const detailedAnalysis = await llmService.chat({
  messages: [...],
  model: 'anthropic/claude-3-opus', // Better quality
});
```

### Custom Model Selection

Override default models per request:

```typescript
// Use specific model for this request
const response = await llmService.chat({
  messages: [...],
  model: 'google/gemini-pro', // Try Google's model
  temperature: 0.7,
  maxTokens: 2048,
});
```

## Monitoring & Usage

### Track API Usage

OpenRouter provides detailed usage tracking:

1. Visit [https://openrouter.ai/activity](https://openrouter.ai/activity)
2. View requests, costs, and model usage
3. Set up budget alerts
4. Monitor rate limits

### CloudWatch Metrics

The service logs all LLM requests to CloudWatch:

```bash
# View LLM usage logs
sam logs -n AnalyzerFunction --stack-name pdf-lecture-service-dev | grep "LLM"
```

## Troubleshooting

### Issue: "Invalid API Key"

**Solution:** Verify your OpenRouter API key:
```bash
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Issue: "Model not found"

**Solution:** Check model name at [https://openrouter.ai/models](https://openrouter.ai/models)

Common mistakes:
- ❌ `gpt-4-turbo` (missing provider)
- ✅ `openai/gpt-4-turbo-preview` (correct)

### Issue: "Insufficient credits"

**Solution:** Add credits to your OpenRouter account:
1. Go to [https://openrouter.ai/credits](https://openrouter.ai/credits)
2. Add credits via credit card
3. Minimum: $5

### Issue: "Rate limit exceeded"

**Solution:** OpenRouter has generous rate limits, but you can:
1. Upgrade your account tier
2. Add retry logic (already implemented)
3. Use slower models

## Migration Guide

### From Direct OpenAI

```bash
# Before
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai

# After
OPENROUTER_API_KEY=sk-or-v1-...
LLM_PROVIDER=openrouter
LLM_MODEL_ANALYSIS=openai/gpt-4-turbo-preview  # Add provider prefix
```

### From Direct Anthropic

```bash
# Before
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic

# After
OPENROUTER_API_KEY=sk-or-v1-...
LLM_PROVIDER=openrouter
LLM_MODEL_ANALYSIS=anthropic/claude-3-opus  # Add provider prefix
```

## Best Practices

### 1. Use Appropriate Models

- **Analysis:** GPT-4 or Claude 3 Opus (accuracy matters)
- **Vision:** GPT-4 Vision (best for diagrams)
- **Segmentation:** Claude 3 Opus (great structure)
- **Script:** GPT-4 Turbo (creative writing)
- **Testing:** GPT-3.5 or Haiku (fast & cheap)

### 2. Set Reasonable Limits

```typescript
const response = await llmService.chat({
  messages: [...],
  maxTokens: 4096,  // Prevent runaway costs
  temperature: 0.7, // Balance creativity/consistency
});
```

### 3. Monitor Costs

- Set up budget alerts in OpenRouter
- Review usage weekly
- Optimize model selection based on results

### 4. Handle Errors Gracefully

The service includes automatic retry with exponential backoff:

```typescript
// Automatically retries on failure
const response = await llmService.chat({...});
// Retries up to 3 times with backoff
```

## Support

- **OpenRouter Docs:** [https://openrouter.ai/docs](https://openrouter.ai/docs)
- **Model Pricing:** [https://openrouter.ai/models](https://openrouter.ai/models)
- **Discord Community:** [https://discord.gg/openrouter](https://discord.gg/openrouter)

## Example: Complete Configuration

```bash
# .env file
OPENROUTER_API_KEY=sk-or-v1-1234567890abcdef
LLM_PROVIDER=openrouter

# Use GPT-4 for analysis
LLM_MODEL_ANALYSIS=openai/gpt-4-turbo-preview

# Use Claude for segmentation (better structure)
LLM_MODEL_SEGMENTATION=anthropic/claude-3-opus

# Use GPT-4 Vision for figures
LLM_MODEL_VISION=openai/gpt-4-vision-preview

# Use GPT-4 for script (creative)
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview

# TTS API
TTS_API_KEY=your-tts-key
```

This configuration gives you:
- ✅ Best quality for analysis
- ✅ Great structure for segmentation
- ✅ Excellent vision capabilities
- ✅ Creative script generation
- ✅ Single API key for all models
- ✅ Unified billing

---

**Ready to use OpenRouter!** 🚀

Get your API key at [https://openrouter.ai](https://openrouter.ai)

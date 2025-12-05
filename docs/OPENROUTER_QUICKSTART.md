# OpenRouter Quick Start Guide

## Why OpenRouter?

✅ **One API key** for 100+ models (OpenAI, Anthropic, Google, Meta, etc.)  
✅ **Cost optimization** - automatically use cheapest models  
✅ **Fallback support** - automatic failover if model is down  
✅ **Unified billing** - one bill for all providers  

## Setup (2 minutes)

### 1. Get API Key

Visit [https://openrouter.ai](https://openrouter.ai) and:
1. Sign up
2. Go to Keys → Create new key
3. Add $5-10 credits

### 2. Configure Locally

```bash
# Add to .env file
OPENROUTER_API_KEY=sk-or-v1-your-key-here
LLM_PROVIDER=openrouter
```

### 3. Test It

```bash
# Run tests
npm test src/services/llm.test.ts

# Start local server
npm run dev
```

## Deploy to AWS

```bash
# Set your API key
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"

# Deploy
bash scripts/quick-deploy.sh dev
```

## Model Selection

The service automatically picks the best model for each task:

| Task | Default Model | Cost/1M tokens |
|------|---------------|----------------|
| **Analysis** | GPT-4 Turbo | $10 input, $30 output |
| **Vision** | GPT-4 Vision | $10 input, $30 output |
| **Segmentation** | Claude 3 Opus | $15 input, $75 output |
| **Script** | GPT-4 Turbo | $10 input, $30 output |

### Override Models

```bash
# Use cheaper models for testing
LLM_MODEL_ANALYSIS=openai/gpt-3.5-turbo
LLM_MODEL_VISION=openai/gpt-3.5-turbo
LLM_MODEL_SEGMENTATION=openai/gpt-3.5-turbo
LLM_MODEL_SCRIPT=openai/gpt-3.5-turbo
```

## Cost Estimates

### Per PDF Processing

**Small PDF (10 pages):**
- ~30K tokens total
- Cost: **$0.30 - $0.90**

**Large PDF (50 pages):**
- ~130K tokens total
- Cost: **$1.30 - $3.90**

### Budget Options

Use GPT-3.5 or Claude Haiku for 10x cheaper:

```bash
LLM_MODEL_ANALYSIS=openai/gpt-3.5-turbo  # $0.50/$1.50 per 1M tokens
# or
LLM_MODEL_ANALYSIS=anthropic/claude-3-haiku  # $0.25/$1.25 per 1M tokens
```

## Available Models

### Premium (Best Quality)
- `openai/gpt-4-turbo-preview` - Best overall
- `anthropic/claude-3-opus` - Best reasoning
- `google/gemini-pro` - Good balance

### Standard (Good Quality)
- `openai/gpt-3.5-turbo` - Fast & reliable
- `anthropic/claude-3-sonnet` - Balanced
- `google/gemini-pro` - Competitive

### Budget (Fast & Cheap)
- `anthropic/claude-3-haiku` - Very fast
- `meta-llama/llama-3-70b-instruct` - Open source
- `mistralai/mistral-medium` - Good value

See all models: [https://openrouter.ai/models](https://openrouter.ai/models)

## Usage in Code

```typescript
import { llmService, getRecommendedModel } from './services/llm';

// Use recommended model
const model = getRecommendedModel('analysis');
const response = await llmService.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Analyze this content...' }
  ],
  model,
});

// Or specify a model
const response = await llmService.chat({
  messages: [...],
  model: 'anthropic/claude-3-opus',
  temperature: 0.7,
  maxTokens: 4096,
});
```

## Monitoring

### View Usage

1. Visit [https://openrouter.ai/activity](https://openrouter.ai/activity)
2. See requests, costs, and model usage
3. Set budget alerts

### CloudWatch Logs

```bash
# View LLM requests
sam logs -n AnalyzerFunction --stack-name pdf-lecture-service-dev | grep "LLM"
```

## Troubleshooting

### "Invalid API Key"
```bash
# Test your key
curl https://openrouter.ai/api/v1/auth/key \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### "Insufficient credits"
Add credits at [https://openrouter.ai/credits](https://openrouter.ai/credits)

### "Model not found"
Check model name at [https://openrouter.ai/models](https://openrouter.ai/models)

Common mistake:
- ❌ `gpt-4-turbo` (missing provider prefix)
- ✅ `openai/gpt-4-turbo-preview` (correct)

## Migration from Direct APIs

### From OpenAI

```bash
# Before
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai

# After
OPENROUTER_API_KEY=sk-or-v1-...
LLM_PROVIDER=openrouter
LLM_MODEL_ANALYSIS=openai/gpt-4-turbo-preview  # Add prefix
```

### From Anthropic

```bash
# Before
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic

# After
OPENROUTER_API_KEY=sk-or-v1-...
LLM_PROVIDER=openrouter
LLM_MODEL_ANALYSIS=anthropic/claude-3-opus  # Add prefix
```

## Best Practices

1. **Start with recommended models** - They're optimized for each task
2. **Monitor costs** - Set up budget alerts in OpenRouter
3. **Use cheaper models for testing** - GPT-3.5 or Haiku
4. **Use premium models for production** - GPT-4 or Claude Opus
5. **Enable fallbacks** - OpenRouter handles this automatically

## Support

- **Full Guide:** See `docs/OPENROUTER_GUIDE.md`
- **OpenRouter Docs:** [https://openrouter.ai/docs](https://openrouter.ai/docs)
- **Discord:** [https://discord.gg/openrouter](https://discord.gg/openrouter)

---

**Ready to go!** 🚀

Get your API key: [https://openrouter.ai](https://openrouter.ai)

# Model Configuration Guide

## Overview

The PDF Lecture Service uses different LLM models for different stages of the pipeline. The configuration depends on which pipeline mode you're using.

## Pipeline Modes

### Vision-First Pipeline (RECOMMENDED) ✅

**Enable with**: `ENABLE_VISION_FIRST_PIPELINE=true`

This is the simplified, modern approach that combines analysis and segmentation into a single vision LLM call per page.

```
┌─────────────┐
│   PDF       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  VISION_MODEL                       │
│  (per page)                         │
│  - Analyzes visual layout           │
│  - Extracts text                    │
│  - Describes figures/tables/formulas│
│  - Creates logical segments         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  LLM_MODEL_SCRIPT                   │
│  - Generates lecture script         │
│  - Applies agent personality        │
│  - Adds timing estimates            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Audio TTS  │
└─────────────┘
```

**Models Used**:
- `VISION_MODEL` - Vision-capable model for analysis + segmentation
- `LLM_MODEL_SCRIPT` - Text model for script generation

**Models NOT Used**:
- ~~`LLM_MODEL_ANALYSIS`~~ - Not used
- ~~`LLM_MODEL_SEGMENTATION`~~ - Not used

### Legacy Multi-Step Pipeline

**Enable with**: `ENABLE_VISION_FIRST_PIPELINE=false`

This is the older, more complex approach with separate steps for each operation.

```
┌─────────────┐
│   PDF       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  LLM_MODEL_ANALYSIS                 │
│  - Extracts text                    │
│  - Detects figures/tables/formulas  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  LLM_MODEL_VISION (multiple calls)  │
│  - Analyzes each figure             │
│  - Interprets each table            │
│  - Explains each formula            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  LLM_MODEL_SEGMENTATION             │
│  - Organizes into segments          │
│  - Determines dependencies          │
│  - Orders logically                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  LLM_MODEL_SCRIPT                   │
│  - Generates lecture script         │
│  - Applies agent personality        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Audio TTS  │
└─────────────┘
```

**Models Used**:
- `LLM_MODEL_ANALYSIS` - Text extraction and element detection
- `LLM_MODEL_VISION` - Figure/table/formula analysis (multiple calls)
- `LLM_MODEL_SEGMENTATION` - Content organization
- `LLM_MODEL_SCRIPT` - Script generation

## Configuration Examples

### Vision-First (Recommended)

```bash
# Enable vision-first pipeline
ENABLE_VISION_FIRST_PIPELINE=true

# Vision model for analysis + segmentation
VISION_MODEL=google/gemini-2.0-flash-exp:free

# Script generation model
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free

# These are ignored in vision-first mode
# LLM_MODEL_ANALYSIS=...
# LLM_MODEL_SEGMENTATION=...
```

### Legacy Multi-Step

```bash
# Disable vision-first pipeline
ENABLE_VISION_FIRST_PIPELINE=false

# Analysis model
LLM_MODEL_ANALYSIS=x-ai/grok-4.1-fast:free

# Vision model (for figures/tables/formulas)
LLM_MODEL_VISION=google/gemini-2.0-flash-exp:free

# Segmentation model
LLM_MODEL_SEGMENTATION=x-ai/grok-4.1-fast:free

# Script generation model
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free
```

## Model Selection Guide

### For Vision-First Pipeline

#### VISION_MODEL

**Purpose**: Analyzes PDF pages visually, extracts all content, creates segments

**Requirements**:
- Must support vision/image input
- Good at understanding visual layouts
- Can describe figures, tables, formulas
- Can organize content logically

**Recommended Models**:
- `google/gemini-2.0-flash-exp:free` - Fast, free, excellent vision
- `google/gemini-pro-vision` - Paid, very good
- `anthropic/claude-3-5-sonnet` - Paid, excellent reasoning
- `openai/gpt-4-vision-preview` - Paid, very good

**Free Options**:
- ✅ `google/gemini-2.0-flash-exp:free` - Best free option
- ✅ `google/gemini-pro-vision:free` - Good alternative

#### LLM_MODEL_SCRIPT

**Purpose**: Generates lecture scripts with personality

**Requirements**:
- Good at creative writing
- Can follow personality instructions
- Can explain complex concepts simply
- Good at maintaining consistent tone

**Recommended Models**:
- `meta-llama/llama-3.3-70b-instruct:free` - Free, creative
- `openai/gpt-4-turbo-preview` - Paid, excellent
- `anthropic/claude-3-opus` - Paid, very creative
- `x-ai/grok-4.1-fast:free` - Free, good

**Free Options**:
- ✅ `meta-llama/llama-3.3-70b-instruct:free` - Best free option
- ✅ `x-ai/grok-4.1-fast:free` - Good alternative
- ✅ `google/gemini-2.0-flash-exp:free` - Also works well

### For Legacy Pipeline

See `.env.example` for legacy model recommendations.

## Cost Optimization

### Free Tier Strategy

Use all free models:

```bash
VISION_MODEL=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free
```

**Pros**: $0 cost  
**Cons**: Rate limits, slower, may be less accurate

### Balanced Strategy

Use free vision, paid script:

```bash
VISION_MODEL=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview
```

**Pros**: Good quality, lower cost  
**Cons**: Still has vision rate limits

### Premium Strategy

Use paid models for everything:

```bash
VISION_MODEL=anthropic/claude-3-5-sonnet
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview
```

**Pros**: Best quality, higher rate limits  
**Cons**: Higher cost per PDF

## Performance Comparison

### Vision-First vs. Legacy

| Metric | Vision-First | Legacy |
|--------|-------------|--------|
| **API Calls** | 1 per page + 1 for script | 1 + N figures + 1 + 1 |
| **Processing Time** | ~30-60s | ~60-120s |
| **Accuracy** | Higher (sees layout) | Lower (text only) |
| **Cost** | Lower (fewer calls) | Higher (more calls) |
| **Complexity** | Simple | Complex |

### Model Speed Comparison

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `gemini-2.0-flash-exp:free` | ⚡⚡⚡ Fast | ⭐⭐⭐ Good | 💰 Free |
| `llama-3.3-70b:free` | ⚡⚡ Medium | ⭐⭐⭐ Good | 💰 Free |
| `grok-4.1-fast:free` | ⚡⚡⚡ Fast | ⭐⭐ OK | 💰 Free |
| `gpt-4-turbo` | ⚡ Slow | ⭐⭐⭐⭐ Excellent | 💰💰💰 Expensive |
| `claude-3-5-sonnet` | ⚡⚡ Medium | ⭐⭐⭐⭐ Excellent | 💰💰 Moderate |

## Troubleshooting

### "Model not found" Error

**Problem**: The specified model doesn't exist or isn't available

**Solution**:
1. Check OpenRouter model list: https://openrouter.ai/models
2. Verify model name spelling
3. Ensure model supports required features (vision for VISION_MODEL)

### Rate Limit Errors

**Problem**: Hitting rate limits on free models

**Solution**:
1. Increase `OPENROUTER_MIN_REQUEST_INTERVAL_MS` to 2000 or higher
2. Use paid models for higher limits
3. Process PDFs during off-peak hours

### Poor Quality Output

**Problem**: Generated content is low quality

**Solution**:
1. Try a different model (e.g., switch from Grok to Llama)
2. Upgrade to paid models (GPT-4, Claude)
3. Adjust temperature settings in code

### Vision Model Not Working

**Problem**: Vision model fails to analyze images

**Solution**:
1. Ensure model supports vision (has "vision" in name or description)
2. Check image size limits (we resize to 2000x2000)
3. Try a different vision model

## Summary

**For most users**: Use vision-first pipeline with free models

```bash
ENABLE_VISION_FIRST_PIPELINE=true
VISION_MODEL=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free
```

This provides the best balance of simplicity, cost, and quality.

**For production**: Consider paid models for better quality and higher rate limits

```bash
ENABLE_VISION_FIRST_PIPELINE=true
VISION_MODEL=anthropic/claude-3-5-sonnet
LLM_MODEL_SCRIPT=openai/gpt-4-turbo-preview
```

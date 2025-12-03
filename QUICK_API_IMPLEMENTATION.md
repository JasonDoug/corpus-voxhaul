# Quick API Implementation Guide

## TL;DR

**Current Status:**
- ✅ AWS Polly TTS is **already implemented** - just set `TTS_PROVIDER=polly`
- ❌ LLM calls (OpenAI/Anthropic) are **placeholders** - need implementation
- ✅ All infrastructure is ready to deploy

**Quickest Path to Working System:**
1. Use AWS Polly for TTS (no code changes needed)
2. Implement OpenAI API calls (3 files to update)
3. Deploy

---

## Option 1: Deploy NOW with Mock APIs (Testing)

**Use this to test infrastructure without API costs**

```bash
# No API keys needed
# Everything works except actual content generation
bash scripts/quick-deploy.sh dev
```

**What works:**
- PDF upload ✅
- Job tracking ✅
- Agent management ✅
- Status queries ✅

**What returns mock data:**
- Content analysis (returns placeholder descriptions)
- Script generation (returns generic script)
- Audio synthesis (returns fake audio)

---

## Option 2: Deploy with AWS Polly Only (Partial)

**Use this to test TTS without implementing LLM**

```bash
# Set TTS provider
export TTS_PROVIDER=polly

# Deploy
bash scripts/quick-deploy.sh dev
```

**What works:**
- Everything from Option 1 ✅
- Real audio synthesis with AWS Polly ✅

**What still returns mock data:**
- Content analysis
- Script generation

---

## Option 3: Full Implementation (Recommended)

### Step 1: Install OpenAI SDK

```bash
npm install openai
```

### Step 2: Implement LLM Calls

Create a new file `src/services/llm.ts`:

```typescript
import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Call GPT-4 Vision for image analysis
 */
export async function analyzeImageWithVision(
  imageData: string,
  prompt: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error('GPT-4 Vision API call failed', { error });
    throw error;
  }
}

/**
 * Call GPT-4 for text generation
 */
export async function generateTextWithGPT4(
  prompt: string,
  maxTokens: number = 2000
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error('GPT-4 API call failed', { error });
    throw error;
  }
}
```

### Step 3: Update Analyzer Service

In `src/services/analyzer.ts`, replace placeholder functions:

```typescript
// Add import at top
import { analyzeImageWithVision, generateTextWithGPT4 } from './llm';

// Replace generateFigureDescription
async function generateFigureDescription(
  imageData: string,
  pageNumber: number
): Promise<string> {
  const prompt = `Describe this scientific figure in detail. Explain what it shows, 
  key patterns or trends, and its significance. Be clear and accessible.`;
  
  return await analyzeImageWithVision(imageData, prompt);
}

// Replace generateTableInterpretation
async function generateTableInterpretation(
  tableData: { headers: string[]; rows: string[][] },
  pageNumber: number
): Promise<string> {
  const prompt = `Interpret this table data:
  Headers: ${tableData.headers.join(', ')}
  Data: ${JSON.stringify(tableData.rows)}
  
  Explain what the data shows, key trends, and significance.`;
  
  return await generateTextWithGPT4(prompt, 500);
}

// Replace generateFormulaExplanation
async function generateFormulaExplanation(
  latex: string,
  pageNumber: number
): Promise<string> {
  const prompt = `Explain this mathematical formula: ${latex}
  
  Describe what each variable represents and what the formula tells us.`;
  
  return await generateTextWithGPT4(prompt, 300);
}
```

### Step 4: Update Script Generator

In `src/services/script-generator.ts`, replace the placeholder:

```typescript
// Add import at top
import { generateTextWithGPT4 } from './llm';

// Replace callScriptGenerationLLM
async function callScriptGenerationLLM(prompt: string): Promise<string> {
  return await generateTextWithGPT4(prompt, 4000);
}
```

### Step 5: Update Segmenter

In `src/services/segmenter.ts`, add similar implementation:

```typescript
// Add import at top
import { generateTextWithGPT4 } from './llm';

// Find and replace the LLM call function
async function callSegmentationLLM(prompt: string): Promise<string> {
  return await generateTextWithGPT4(prompt, 2000);
}
```

### Step 6: Update package.json

```bash
# Already done if you ran npm install openai
```

### Step 7: Set Environment Variables

```bash
export OPENAI_API_KEY="your-openai-api-key"
export TTS_PROVIDER="polly"
```

### Step 8: Test Locally

```bash
# Start LocalStack
docker compose up -d

# Run tests
npm test

# Start local server
npm run dev
```

### Step 9: Deploy

```bash
bash scripts/quick-deploy.sh dev
```

---

## Alternative: Use Anthropic Claude

If you prefer Claude over GPT-4:

### Install Anthropic SDK

```bash
npm install @anthropic-ai/sdk
```

### Create `src/services/llm.ts` with Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateTextWithClaude(
  prompt: string,
  maxTokens: number = 2000
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';
  } catch (error) {
    logger.error('Claude API call failed', { error });
    throw error;
  }
}

// Note: Claude doesn't have vision API yet
// Use GPT-4 Vision for images, Claude for text
```

---

## Cost Estimates

### OpenAI GPT-4 Pricing
- GPT-4 Turbo: $0.01/1K input tokens, $0.03/1K output tokens
- GPT-4 Vision: $0.01/1K input tokens, $0.03/1K output tokens

### Typical 10-page PDF Processing
- Content analysis: ~5K tokens input, 2K output = $0.11
- Segmentation: ~3K tokens input, 1K output = $0.06
- Script generation: ~4K tokens input, 3K output = $0.13
- **Total LLM cost: ~$0.30 per PDF**

### AWS Polly Pricing
- $4.00 per 1 million characters
- Typical lecture: 5,000 characters = $0.02

### Total Cost per PDF
- **LLM + TTS: ~$0.32 per PDF**
- **100 PDFs/month: ~$32/month**
- Plus AWS infrastructure: ~$11-23/month
- **Total: ~$43-55/month for 100 PDFs**

---

## Testing Your Implementation

### 1. Test LLM Integration Locally

```typescript
// Create test file: src/services/llm.test.ts
import { generateTextWithGPT4 } from './llm';

test('GPT-4 generates text', async () => {
  const result = await generateTextWithGPT4('Explain photosynthesis in one sentence');
  expect(result.length).toBeGreaterThan(0);
  console.log('GPT-4 response:', result);
});
```

Run: `npm test -- llm.test.ts`

### 2. Test Full Pipeline

```bash
# Upload a test PDF
curl -X POST "$API_ENDPOINT/upload" \
  -H "x-api-key: YOUR_KEY" \
  -F "file=@test.pdf"

# Check status
curl -X GET "$API_ENDPOINT/status/JOB_ID" \
  -H "x-api-key: YOUR_KEY"
```

---

## Troubleshooting

### "OpenAI API key not found"
```bash
# Make sure it's exported
echo $OPENAI_API_KEY

# Or add to .env file
echo "OPENAI_API_KEY=your-key" >> .env
```

### "Rate limit exceeded"
- OpenAI has rate limits for new accounts
- Start with tier 1 ($5 credit)
- Upgrade to tier 2+ for production

### "AWS Polly voice not found"
- Check available voices: `aws polly describe-voices`
- Use standard voices: Joanna, Matthew, etc.
- Or use neural voices: add `Engine: 'neural'` in config

---

## Summary

**Fastest path to working system:**

1. ✅ Infrastructure is ready (no changes needed)
2. ✅ AWS Polly TTS is ready (just set env var)
3. ❌ Implement OpenAI calls (3 files, ~50 lines of code)
4. ✅ Deploy and test

**Time estimate:**
- OpenAI implementation: 30-60 minutes
- Testing: 15-30 minutes
- Deployment: 5-10 minutes
- **Total: ~1-2 hours to full working system**

**Cost estimate:**
- Development/testing: ~$5-10/month
- Production (100 PDFs/month): ~$50-100/month

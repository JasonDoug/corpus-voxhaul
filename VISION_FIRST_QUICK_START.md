# Vision-First Pipeline - Quick Start Guide

## What is it?

A simplified PDF analysis pipeline that uses vision LLMs to extract and segment content in one step, replacing the complex multi-step process.

## Quick Enable

Add to your `.env` file:
```env
ENABLE_VISION_FIRST_PIPELINE=true
VISION_MODEL=google/gemini-2.0-flash-exp:free
```

That's it! The system will now use the vision-first pipeline.

## How It Works

```
Old: PDF → 7 steps → Segments
New: PDF → Vision LLM per page → Segments
```

**Benefits:**
- ✅ Simpler (70% less code)
- ✅ More accurate (sees actual layout)
- ✅ Faster (parallel processing)
- ✅ Cheaper (fewer API calls)
- ✅ Free models available

## Test It

### Option 1: E2E Test Script
```bash
# Start server
npm run dev

# Run test (in another terminal)
node scripts/test-vision-first-pipeline.js
```

### Option 2: Unit Tests
```bash
npm test -- analyzer-vision.test.ts
```

### Option 3: Manual Test
```bash
# Upload a PDF
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{"file": [...], "filename": "test.pdf"}'

# Check status
curl http://localhost:3000/api/status/{jobId}
```

## Configuration Options

### Vision Models

**Free (Recommended):**
```env
VISION_MODEL=google/gemini-2.0-flash-exp:free
```

**Paid (Higher Quality):**
```env
VISION_MODEL=anthropic/claude-3-5-sonnet
VISION_MODEL=openai/gpt-4-vision-preview
```

### Fine-Tuning

```env
# Lower = more consistent, Higher = more creative
VISION_LLM_TEMPERATURE=0.3

# Max tokens per page analysis
VISION_LLM_MAX_TOKENS=4000
```

## Troubleshooting

### "Vision analysis failed"
- Check API key: `OPENROUTER_API_KEY` is set
- Try different model: Switch to `google/gemini-2.0-flash-exp:free`
- Check rate limits: Wait a few seconds and retry

### "Poor segment quality"
- Lower temperature: `VISION_LLM_TEMPERATURE=0.1`
- Try better model: `anthropic/claude-3-5-sonnet`
- Check PDF quality: Low-quality scans may not work well

### "Slow processing"
- Use faster model: `google/gemini-2.0-flash-exp:free`
- Check network: Slow network impacts API calls
- Reduce image size: Edit `pdf-img-convert` settings in code

## Disable Vision-First

To go back to the old pipeline:
```env
ENABLE_VISION_FIRST_PIPELINE=false
```

## More Info

- Full documentation: `docs/VISION_FIRST_PIPELINE.md`
- Implementation details: `VISION_FIRST_IMPLEMENTATION_SUMMARY.md`
- Design rationale: `VISION_FIRST_PIPELINE_DESIGN.md`

## Support

If you encounter issues:
1. Check the logs for error messages
2. Verify API key is valid
3. Try a different vision model
4. Open an issue with error details

---

**TL;DR**: Add `ENABLE_VISION_FIRST_PIPELINE=true` to `.env` and enjoy a simpler, better PDF analysis pipeline! 🚀

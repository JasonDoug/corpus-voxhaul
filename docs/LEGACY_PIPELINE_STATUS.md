# Legacy Pipeline Status

**Date**: December 3, 2025  
**Question**: Is the legacy pipeline still there if needed?

## Answer: YES ✅

The legacy multi-step pipeline is **fully intact and functional**. It can be enabled at any time by setting:

```bash
ENABLE_VISION_FIRST_PIPELINE=false
```

## Code Verification

### 1. Pipeline Routing (src/functions/analyzer.ts)

The analyzer function has a clear if/else branch:

```typescript
if (config.featureFlags.enableVisionFirstPipeline) {
  // Vision-first pipeline
  const segmentedContent = await analyzeContentVisionFirst(jobId);
  // ...
} else {
  // Legacy pipeline: separate analysis and segmentation steps
  logger.info('Using legacy multi-step pipeline', { jobId });
  
  const extractedContent = await analyzeContent(jobId);
  // ...
}
```

### 2. Legacy Services Still Exist

All legacy services are present and maintained:

**✅ src/services/analyzer.ts**
- `analyzeContent(jobId)` - Text extraction and element detection
- `analyzeFigures()` - Figure analysis with vision LLM
- `analyzeTables()` - Table interpretation
- `analyzeFormulas()` - Formula explanation
- `detectCitations()` - Citation detection

**✅ src/services/segmenter.ts**
- `segmentContent(jobId)` - Content organization into segments
- `callSegmentationLLM()` - LLM-based segmentation
- `buildDependencyGraph()` - Prerequisite analysis
- `topologicalSort()` - Logical ordering

**✅ src/services/script-generator.ts**
- Works with both pipelines (unchanged)

**✅ src/services/audio-synthesizer.ts**
- Works with both pipelines (unchanged)

### 3. Feature Flags Control Legacy Behavior

When legacy pipeline is enabled, these flags become active:

```bash
ENABLE_VISION_FIRST_PIPELINE=false  # Use legacy pipeline
ENABLE_REAL_SEGMENTATION=true       # Use real LLM for segmentation
ENABLE_IMAGE_EXTRACTION=true        # Extract images from PDF
ENABLE_REAL_SCRIPT_GENERATION=true  # Use real LLM for scripts
```

## How to Switch to Legacy Pipeline

### Step 1: Update .env

```bash
# Disable vision-first
ENABLE_VISION_FIRST_PIPELINE=false

# Enable legacy components
ENABLE_REAL_SEGMENTATION=true
ENABLE_IMAGE_EXTRACTION=true
ENABLE_REAL_SCRIPT_GENERATION=true

# Configure legacy models
LLM_MODEL_ANALYSIS=x-ai/grok-4.1-fast:free
LLM_MODEL_VISION=google/gemini-2.0-flash-exp:free
LLM_MODEL_SEGMENTATION=x-ai/grok-4.1-fast:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free
```

### Step 2: Restart Server

```bash
npm run dev
```

### Step 3: Verify

Check logs for:
```
Using legacy multi-step pipeline
```

## Pipeline Comparison

### Vision-First (Current Default)

```
┌─────────────┐
│   PDF       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  analyzeContentVisionFirst()        │
│  - Extract pages as images          │
│  - Vision LLM per page              │
│  - Creates segments directly        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  generateScript()                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Audio TTS  │
└─────────────┘
```

**API Calls**: ~N (pages) + 1 (script)

### Legacy Multi-Step

```
┌─────────────┐
│   PDF       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  analyzeContent()                   │
│  - Extract text                     │
│  - Detect elements                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  analyzeFigures()                   │
│  analyzeTables()                    │
│  analyzeFormulas()                  │
│  (Multiple vision LLM calls)        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  segmentContent()                   │
│  - LLM organizes content            │
│  - Build dependency graph           │
│  - Topological sort                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  generateScript()                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Audio TTS  │
└─────────────┘
```

**API Calls**: 1 (analysis) + M (figures/tables/formulas) + 1 (segmentation) + 1 (script)

## When to Use Legacy Pipeline

### Reasons to Use Legacy

1. **Debugging**: Separate steps make it easier to debug specific issues
2. **Granular Control**: Can tune each step independently
3. **Fallback**: If vision-first has issues
4. **Research**: Compare outputs between pipelines
5. **Specific Requirements**: Need separate analysis and segmentation

### Reasons to Use Vision-First (Recommended)

1. **Simpler**: Fewer steps, less complexity
2. **Faster**: Fewer API calls
3. **Cheaper**: Lower API costs
4. **More Accurate**: Vision model sees layout
5. **Better Context**: No information loss

## Testing Both Pipelines

You can easily test both pipelines with the same PDF:

### Test Vision-First
```bash
ENABLE_VISION_FIRST_PIPELINE=true
npm run dev
# Upload PDF, note results
```

### Test Legacy
```bash
ENABLE_VISION_FIRST_PIPELINE=false
npm run dev
# Upload same PDF, compare results
```

## Maintenance Status

### Vision-First Pipeline
- ✅ Actively maintained
- ✅ Recommended for production
- ✅ Receives new features
- ✅ Performance optimizations

### Legacy Pipeline
- ✅ Fully functional
- ✅ Bug fixes applied
- ⚠️ No new features planned
- ⚠️ May be deprecated in future

## Migration Path

If you're currently using legacy pipeline:

### Phase 1: Test Vision-First
```bash
# In development environment
ENABLE_VISION_FIRST_PIPELINE=true
```

### Phase 2: Compare Results
- Process same PDFs with both pipelines
- Compare segment quality
- Compare script quality
- Measure processing time and cost

### Phase 3: Switch Production
```bash
# In production environment
ENABLE_VISION_FIRST_PIPELINE=true
```

### Phase 4: Monitor
- Watch for any issues
- Can quickly rollback if needed:
  ```bash
  ENABLE_VISION_FIRST_PIPELINE=false
  ```

## Summary

**Status**: ✅ Legacy pipeline is **fully functional and available**

**How to Enable**: Set `ENABLE_VISION_FIRST_PIPELINE=false`

**Code Location**:
- Routing: `src/functions/analyzer.ts`
- Analysis: `src/services/analyzer.ts`
- Segmentation: `src/services/segmenter.ts`

**Maintenance**: Functional but not actively developed

**Recommendation**: Use vision-first unless you have specific reasons to use legacy

The legacy pipeline is kept as a **safety net** and for **backwards compatibility**, but vision-first is the recommended approach for new deployments.

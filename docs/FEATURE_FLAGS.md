# Feature Flags Guide

## Overview

The PDF Lecture Service uses feature flags to control which implementation is used for different parts of the pipeline. This allows for gradual rollout of new features and easy rollback if issues arise.

## Current Feature Flags

### 1. ENABLE_VISION_FIRST_PIPELINE

**Status**: ✅ **RECOMMENDED** - Should be enabled  
**Default**: `true`  
**Location**: `src/functions/analyzer.ts`

**Purpose**: Controls which pipeline architecture is used for content analysis and segmentation.

#### When Enabled (true)

Uses the **vision-first pipeline** - a simplified, modern approach:

```
PDF → Vision LLM (per page) → Segments → Script → Audio
     └─ Analysis + Segmentation combined
```

**What happens**:
1. PDF pages are extracted as images
2. Vision LLM analyzes each page and creates segments in one call
3. Skips separate segmentation step
4. Goes directly to script generation

**Benefits**:
- ✅ Simpler: 1 vision call per page vs 5+ separate steps
- ✅ Faster: Fewer API calls, less processing time
- ✅ Cheaper: Fewer API calls = lower cost
- ✅ More accurate: Vision model sees actual layout
- ✅ Better context: No information loss

**Code Path**:
```typescript
if (config.featureFlags.enableVisionFirstPipeline) {
  const segmentedContent = await analyzeContentVisionFirst(jobId);
  // Marks both analysis AND segmentation as complete
  // Goes directly to script generation
}
```

#### When Disabled (false)

Uses the **legacy multi-step pipeline**:

```
PDF → Text Extraction → Element Detection → Vision Analysis (N calls) → Segmentation → Script → Audio
```

**What happens**:
1. Text is extracted from PDF
2. Figures, tables, formulas are detected
3. Each element is analyzed separately with vision LLM
4. Content is organized into segments
5. Script is generated

**Drawbacks**:
- ❌ Complex: Many separate steps
- ❌ Slower: More API calls
- ❌ More expensive: More API calls
- ❌ Less accurate: Text-only extraction loses layout info

**Code Path**:
```typescript
else {
  const extractedContent = await analyzeContent(jobId);
  // Marks only analysis as complete
  // Triggers separate segmentation step
}
```

**Recommendation**: Keep this **enabled** unless you need the legacy pipeline for specific reasons.

---

### 2. ENABLE_REAL_SEGMENTATION

**Status**: ⚠️ **LEGACY** - Only used if vision-first is disabled  
**Default**: `true`  
**Location**: `src/services/segmenter.ts`

**Purpose**: Controls whether real LLM is used for segmentation (legacy pipeline only).

#### When Enabled (true)

Uses real LLM API to organize content into segments:

```typescript
if (!config.featureFlags.enableRealSegmentation) {
  // Return mock segments
}
// Otherwise, call real LLM
const response = await llmService.chat({...});
```

**What happens**:
- Sends extracted content to LLM
- LLM identifies topics and creates segments
- Returns structured segment data

#### When Disabled (false)

Uses mock implementation:
- Returns placeholder segments
- Useful for testing without API calls
- No real segmentation logic

**Note**: This flag is **ignored** when `ENABLE_VISION_FIRST_PIPELINE=true` because vision-first does segmentation as part of analysis.

**Recommendation**: Keep **enabled** if using legacy pipeline, otherwise doesn't matter.

---

### 3. ENABLE_REAL_SCRIPT_GENERATION

**Status**: ✅ **ACTIVE** - Used in both pipelines  
**Default**: `true`  
**Location**: `src/services/script-generator.ts`

**Purpose**: Controls whether real LLM is used for script generation.

#### When Enabled (true)

Uses real LLM API to generate lecture scripts:

```typescript
if (!config.featureFlags.enableRealScriptGeneration) {
  // Return mock script
}
// Otherwise, call real LLM
const scriptText = await llmService.chat({...});
```

**What happens**:
- Sends segments to LLM with agent personality
- LLM generates lecture script with appropriate tone
- Returns formatted script with timing

#### When Disabled (false)

Uses mock implementation:
- Returns placeholder script text
- Useful for testing without API calls
- No real script generation logic

**Recommendation**: Keep **enabled** for production use.

---

### 4. ENABLE_IMAGE_EXTRACTION

**Status**: ⚠️ **LEGACY** - Only used if vision-first is disabled  
**Default**: `true`  
**Location**: `src/services/analyzer.ts`

**Purpose**: Controls whether images are extracted from PDF for vision analysis (legacy pipeline only).

#### When Enabled (true)

Extracts images from PDF for vision LLM analysis:

```typescript
if (!config.featureFlags.enableImageExtraction) {
  // Return placeholder image data
}
// Otherwise, extract real images
const imageData = await extractImageFromPDF(pdfBuffer, pageNumber);
```

**What happens**:
- Extracts figures/diagrams as images
- Sends to vision LLM for description
- Returns real image descriptions

#### When Disabled (false)

Uses placeholder images:
- Returns dummy image data
- Useful for testing without image processing
- No real image extraction

**Note**: This flag is **ignored** when `ENABLE_VISION_FIRST_PIPELINE=true` because vision-first always extracts page images.

**Recommendation**: Keep **enabled** if using legacy pipeline, otherwise doesn't matter.

---

## Feature Flag Matrix

| Flag | Vision-First Pipeline | Legacy Pipeline | Recommendation |
|------|----------------------|-----------------|----------------|
| `ENABLE_VISION_FIRST_PIPELINE` | ✅ Controls pipeline | N/A | **Enable** |
| `ENABLE_REAL_SEGMENTATION` | ❌ Ignored | ✅ Controls segmentation | Enable if using legacy |
| `ENABLE_REAL_SCRIPT_GENERATION` | ✅ Controls script gen | ✅ Controls script gen | **Enable** |
| `ENABLE_IMAGE_EXTRACTION` | ❌ Ignored | ✅ Controls image extraction | Enable if using legacy |

## Configuration Examples

### Recommended (Production)

```bash
# Use vision-first pipeline with real LLM calls
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=true

# These are ignored in vision-first mode
ENABLE_REAL_SEGMENTATION=true
ENABLE_IMAGE_EXTRACTION=true
```

### Testing (No API Calls)

```bash
# Use vision-first but mock script generation
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=false

# These are ignored
ENABLE_REAL_SEGMENTATION=false
ENABLE_IMAGE_EXTRACTION=false
```

### Legacy Pipeline (Not Recommended)

```bash
# Use old multi-step pipeline
ENABLE_VISION_FIRST_PIPELINE=false
ENABLE_REAL_SEGMENTATION=true
ENABLE_REAL_SCRIPT_GENERATION=true
ENABLE_IMAGE_EXTRACTION=true
```

## Migration Path

The feature flags were originally introduced to enable gradual rollout of LLM integration:

### Phase 1: Mock Everything (Initial Development)
```bash
ENABLE_REAL_SEGMENTATION=false
ENABLE_REAL_SCRIPT_GENERATION=false
ENABLE_IMAGE_EXTRACTION=false
```

### Phase 2: Enable Real LLM Calls (Integration)
```bash
ENABLE_REAL_SEGMENTATION=true
ENABLE_REAL_SCRIPT_GENERATION=true
ENABLE_IMAGE_EXTRACTION=true
```

### Phase 3: Vision-First Pipeline (Current)
```bash
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=true
# Other flags become irrelevant
```

## Future Considerations

### Should We Remove Legacy Flags?

**Arguments for removal**:
- Simplifies configuration
- Reduces code complexity
- Vision-first is clearly superior

**Arguments for keeping**:
- Backwards compatibility
- Allows testing without API calls
- Provides fallback if vision-first has issues

**Current Decision**: Keep flags for now, but clearly document that some are legacy/ignored.

### Potential New Flags

Future flags that might be useful:

1. **ENABLE_PARALLEL_PAGE_ANALYSIS**
   - Process multiple pages in parallel
   - Trade-off: Speed vs. rate limits

2. **ENABLE_SEGMENT_MERGING**
   - Merge related segments across pages
   - Trade-off: Accuracy vs. complexity

3. **ENABLE_ADAPTIVE_RATE_LIMITING**
   - Automatically adjust rate limits based on headers
   - Trade-off: Optimization vs. complexity

## Troubleshooting

### "Segmentation not working"

**Problem**: Segments are empty or mock data

**Check**:
1. Is `ENABLE_VISION_FIRST_PIPELINE=true`? (Should be)
2. Is `VISION_MODEL` set correctly?
3. Check logs for vision LLM errors

### "Script generation returns mock data"

**Problem**: Scripts are placeholder text

**Check**:
1. Is `ENABLE_REAL_SCRIPT_GENERATION=true`?
2. Is `LLM_MODEL_SCRIPT` set correctly?
3. Check logs for LLM errors

### "Using legacy pipeline unexpectedly"

**Problem**: Seeing separate analysis and segmentation steps

**Check**:
1. Is `ENABLE_VISION_FIRST_PIPELINE=true`?
2. Check logs for "Using vision-first pipeline" message
3. Verify .env file is being loaded

## Summary

**Current State**:
- ✅ Vision-first pipeline is the default and recommended approach
- ✅ Only 2 flags matter: `ENABLE_VISION_FIRST_PIPELINE` and `ENABLE_REAL_SCRIPT_GENERATION`
- ⚠️ Legacy flags (`ENABLE_REAL_SEGMENTATION`, `ENABLE_IMAGE_EXTRACTION`) are kept for backwards compatibility but ignored in vision-first mode

**Recommended Configuration**:
```bash
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=true
```

That's it! The other flags can be left at their defaults but won't affect behavior.

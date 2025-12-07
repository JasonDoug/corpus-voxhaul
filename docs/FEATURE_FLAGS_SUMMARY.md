# Feature Flags Summary

**Date**: December 3, 2025  
**Question**: What role are the feature flags playing now?

## Quick Answer

With the vision-first pipeline enabled (default), **only 2 feature flags matter**:

1. ✅ **ENABLE_VISION_FIRST_PIPELINE** - Controls pipeline architecture (should be `true`)
2. ✅ **ENABLE_REAL_SCRIPT_GENERATION** - Controls script generation (should be `true`)

The other flags are **legacy** and **ignored** in vision-first mode:
- ~~ENABLE_REAL_SEGMENTATION~~ - Only used in legacy pipeline
- ~~ENABLE_IMAGE_EXTRACTION~~ - Only used in legacy pipeline

## Detailed Breakdown

### Active Flags (Used in Vision-First Pipeline)

#### 1. ENABLE_VISION_FIRST_PIPELINE
**Purpose**: Chooses between vision-first (modern) vs. multi-step (legacy) pipeline

**When true** (recommended):
```
PDF → Vision LLM (per page) → Script → Audio
     └─ Analysis + Segmentation combined
```

**When false** (legacy):
```
PDF → Text Extract → Element Detect → Vision (N calls) → Segment → Script → Audio
```

**Impact**: Determines entire pipeline architecture

---

#### 2. ENABLE_REAL_SCRIPT_GENERATION
**Purpose**: Controls whether real LLM is used for script generation

**When true**: Uses real LLM with agent personality  
**When false**: Returns mock script (for testing)

**Impact**: Affects script quality in both pipelines

---

### Legacy Flags (Ignored in Vision-First Mode)

#### 3. ENABLE_REAL_SEGMENTATION
**Purpose**: Controls LLM usage for segmentation (legacy pipeline only)

**Status**: ⚠️ **Ignored** when vision-first is enabled  
**Reason**: Vision-first does segmentation as part of analysis

---

#### 4. ENABLE_IMAGE_EXTRACTION
**Purpose**: Controls image extraction from PDF (legacy pipeline only)

**Status**: ⚠️ **Ignored** when vision-first is enabled  
**Reason**: Vision-first always extracts page images

---

## Configuration Matrix

| Scenario | Vision-First | Script Gen | Segmentation | Image Extract | Result |
|----------|-------------|------------|--------------|---------------|--------|
| **Production (Recommended)** | ✅ true | ✅ true | ❌ ignored | ❌ ignored | Modern pipeline, real LLM |
| **Testing (No API)** | ✅ true | ❌ false | ❌ ignored | ❌ ignored | Modern pipeline, mock script |
| **Legacy Pipeline** | ❌ false | ✅ true | ✅ true | ✅ true | Old pipeline, all real |

## Why This Design?

### Historical Context

The flags were introduced for **gradual LLM integration rollout**:

1. **Phase 1**: All mocked (no API calls during development)
2. **Phase 2**: Enable real LLM calls one by one
3. **Phase 3**: Introduce vision-first pipeline (current)

### Current State

Now that vision-first is stable and superior:
- Vision-first is the default
- Legacy flags are kept for backwards compatibility
- But they're effectively unused in the recommended configuration

## Should We Clean This Up?

### Option 1: Keep All Flags (Current)
**Pros**: Backwards compatible, allows testing, provides fallback  
**Cons**: Confusing, some flags are ignored

### Option 2: Remove Legacy Flags
**Pros**: Simpler, clearer  
**Cons**: Breaks backwards compatibility, removes testing flexibility

### Option 3: Deprecate But Keep
**Pros**: Clear intent, maintains compatibility  
**Cons**: Still have unused code

**Current Decision**: Keep all flags but clearly document which are active vs. legacy.

## Recommendations

### For New Users
Just use the defaults:
```bash
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=true
```

Don't worry about the other flags.

### For Existing Users
If you're using legacy pipeline (`ENABLE_VISION_FIRST_PIPELINE=false`):
- Consider migrating to vision-first
- It's simpler, faster, cheaper, and more accurate
- See `docs/MODEL_CONFIGURATION.md` for migration guide

### For Testing
To test without API calls:
```bash
ENABLE_VISION_FIRST_PIPELINE=true
ENABLE_REAL_SCRIPT_GENERATION=false
```

This will use vision-first architecture but mock the script generation.

## Documentation

Full details in:
- `docs/FEATURE_FLAGS.md` - Complete feature flag guide
- `docs/MODEL_CONFIGURATION.md` - Pipeline architecture and model selection
- `.env.example` - Configuration examples

## Summary

**TL;DR**: 
- Only 2 flags matter: `ENABLE_VISION_FIRST_PIPELINE` and `ENABLE_REAL_SCRIPT_GENERATION`
- Both should be `true` for production
- Legacy flags are kept for compatibility but ignored in vision-first mode
- The system is simpler than it looks!

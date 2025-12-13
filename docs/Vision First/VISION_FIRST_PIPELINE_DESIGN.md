# Vision-First Pipeline Design

## Problem Statement

The current pipeline is over-engineered with too many steps:
1. Text extraction (pdf-parse)
2. Element position detection (regex)
3. Figure analysis (vision LLM)
4. Table analysis (text LLM)
5. Formula analysis (text LLM)
6. Citation detection (regex)
7. Content segmentation (text LLM)

**Issues:**
- 5+ separate LLM calls per document
- Complex orchestration
- Loss of visual context (text-only analysis)
- Prone to errors (pdf-parse reports 0 pages)
- Difficult to maintain

## Solution: Vision-First Approach

**Single vision LLM call per page** that extracts everything at once.

### Architecture

```
PDF → Extract Pages as Images → Vision LLM (per page) → Aggregated Segments
```

### Per-Page Analysis

```typescript
async function analyzePageWithVision(pageImage: Buffer, pageNumber: number): Promise<PageAnalysis> {
  const prompt = `You are an expert educational content analyzer. Analyze this PDF page which is material for a lecture.

STEP 1: VISUAL ANALYSIS
- Identify any diagrams, charts, figures, tables, or visual schemas
- Convert the visual data in these elements into textual descriptions
- Note any mathematical formulas or equations
- Identify any citations or references

STEP 2: CONCEPTUAL SEGMENT GENERATION
- Organize the content (text + visual descriptions) into logical units of knowledge
- Each segment represents a distinct topic or concept on this page
- Order them logically

STEP 3: OUTPUT
Return strictly a JSON array of segment objects with this schema:
{
  "segments": [
    {
      "id": number,
      "title": "string",
      "description": "string (include ALL visual context - figures, tables, formulas converted to text)"
    }
  ]
}

Example:
{
  "segments": [
    {
      "id": 1,
      "title": "Introduction to Thermodynamics",
      "description": "Explaining the basic definition of thermodynamics. The slide shows a diagram of a heat engine with a hot reservoir at the top, cold reservoir at the bottom, and arrows showing energy flow of 100J in, 60J work out, and 40J heat rejected."
    },
    {
      "id": 2,
      "title": "The First Law",
      "description": "Discussing conservation of energy. The equation shown is ΔU = Q - W, where ΔU is change in internal energy, Q is heat added, and W is work done by the system."
    }
  ]
}

Do not wrap in markdown code blocks. Return only the raw JSON.`;

  const response = await visionLLM.analyze(pageImage, prompt);
  return JSON.parse(response);
}
```

### Aggregation

```typescript
async function analyzeDocument(pdfBuffer: Buffer): Promise<SegmentedContent> {
  // Extract all pages as images
  const pageImages = await extractPagesAsImages(pdfBuffer);
  
  // Analyze each page with vision LLM
  const pageAnalyses = await Promise.all(
    pageImages.map((image, index) => 
      analyzePageWithVision(image, index + 1)
    )
  );
  
  // Aggregate segments from all pages
  const allSegments = pageAnalyses.flatMap(p => p.segments);
  
  // Merge adjacent segments with same topic (optional)
  const mergedSegments = mergeRelatedSegments(allSegments);
  
  // Assign final ordering
  mergedSegments.forEach((segment, index) => {
    segment.order = index + 1;
  });
  
  return {
    segments: mergedSegments
  };
}
```

## Benefits

### 1. Simplicity
- **Before**: 7 separate steps with complex orchestration
- **After**: 1 vision call per page + simple aggregation

### 2. Fewer API Calls & Simpler Data
- **Before**: 1 text extraction + N figures + M tables + K formulas + 1 segmentation = 3+ calls, complex data structures
- **After**: P pages = P calls, single simple segments array

### 3. Better Context
- Vision model sees actual layout, fonts, emphasis, spatial relationships
- Understands visual hierarchy (headings, subheadings, bullet points)
- Can see figures in context with surrounding text

### 4. More Accurate
- No loss of information from text-only extraction
- Handles complex layouts (multi-column, sidebars, callouts)
- Better figure descriptions (sees the actual image, not just position)

### 5. Natural Segmentation
- Segments based on visual page structure
- Respects natural topic boundaries
- No arbitrary page count formulas

## Configuration

### Environment Variables

```env
# Vision Model Selection (flexible)
VISION_MODEL=google/gemini-2.0-flash-exp:free
# Alternatives:
# VISION_MODEL=anthropic/claude-3-5-sonnet
# VISION_MODEL=openai/gpt-4-vision-preview

# Enable vision-first pipeline
ENABLE_VISION_FIRST_PIPELINE=true

# Vision LLM settings
VISION_LLM_TEMPERATURE=0.3
VISION_LLM_MAX_TOKENS=4000
```

### Model Flexibility

The system should support any vision-capable model:
- Google Gemini (free tier available)
- Anthropic Claude 3.5 Sonnet
- OpenAI GPT-4 Vision
- Any OpenRouter vision model

## Data Model Simplification

### Before (Complex)

```typescript
interface ExtractedContent {
  pages: PageContent[];
  figures: Figure[];
  tables: Table[];
  formulas: Formula[];
  citations: Citation[];
}

interface PageContent {
  pageNumber: number;
  text: string;
  elements: ElementReference[];
}

interface SegmentedContent {
  segments: ContentSegment[];
}

interface ContentSegment {
  id: string;
  title: string;
  order: number;
  contentBlocks: ContentBlock[];  // Complex nested structure
  prerequisites: string[];
}
```

### After (Simple)

```typescript
interface SegmentedContent {
  segments: Segment[];
}

interface Segment {
  id: number;
  title: string;
  description: string;  // Contains ALL content as text (figures, tables, formulas converted)
  pageNumber: number;
  order: number;
}
```

**Key Insight**: The vision LLM converts everything to text in the description field:
- Figures → "The diagram shows a heat engine with..."
- Tables → "The table presents data with columns X, Y, Z showing values..."
- Formulas → "The equation is E = mc², where E is energy..."
- Citations → "Reference to Smith et al. (2020) on quantum mechanics..."

No need for separate tracking!

## Implementation Plan

### Phase 1: Core Vision Analysis
1. Create `analyzePageWithVision()` function
2. Implement per-page image extraction (already have pdf-img-convert)
3. Create vision LLM prompt
4. Parse and validate JSON response

### Phase 2: Aggregation
1. Implement `analyzeDocument()` orchestration
2. Aggregate segments from all pages (simple flatMap)
3. Optional: Merge related segments across pages
4. Assign final ordering

### Phase 3: Integration
1. Replace old analyzer + segmenter with new vision-first approach
2. Simplify data models - just segments array, no figures/tables/formulas/citations
3. Update script generator to use segment.description directly
4. Remove all the complex ContentBlock, ElementReference, etc. types
5. Update tests

### Phase 4: Configuration
1. Add environment variables
2. Make vision model selection flexible
3. Add feature flag for gradual rollout

## Migration Strategy

### Option A: Clean Break (Recommended)
- Remove old analyzer and segmenter entirely
- Simpler codebase
- Easier to maintain
- Less confusion

### Option B: Gradual Migration
- Keep old pipeline as fallback
- Feature flag to toggle between approaches
- More complex but safer

**Recommendation**: Option A (clean break) because:
- Vision-first is simpler and better
- No reason to maintain complex legacy code
- Easier to test and debug
- Less code to maintain

## Testing

### Unit Tests
- Test vision LLM prompt generation
- Test JSON parsing and validation
- Test segment aggregation logic
- Test error handling

### Integration Tests
- Test with real PDFs of varying complexity
- Verify segments are logical and complete
- Verify figures, tables, formulas are extracted
- Compare quality vs. old approach

### Property Tests
- Segment completeness (all content covered)
- Segment ordering (logical flow)
- No duplicate content
- All pages processed

## Performance Considerations

### API Costs
- **Per-page approach**: P pages × vision model cost
- **Typical paper (10 pages)**: 10 vision calls
- **With free Gemini**: $0
- **With paid models**: ~$0.10-0.50 per paper

### Processing Time
- **Per-page parallel processing**: ~2-5 seconds per page
- **10-page paper**: ~20-50 seconds total (parallelized)
- **Similar to current approach** but simpler

### Optimization Opportunities
- Parallel processing of pages (already planned)
- Caching for repeated documents
- Batch processing for very long documents (if needed)

## Risks & Mitigation

### Risk 1: Vision Model Quality
- **Risk**: Vision model might miss details
- **Mitigation**: Test with diverse PDFs, compare to current approach
- **Fallback**: Can always add text extraction as supplement

### Risk 2: API Rate Limits
- **Risk**: Many pages = many API calls
- **Mitigation**: Implement rate limiting, retry logic
- **Fallback**: Process pages sequentially if needed

### Risk 3: Cost
- **Risk**: Vision models might be expensive
- **Mitigation**: Use free models (Gemini), make model configurable
- **Fallback**: Batch pages if cost is issue

## Success Criteria

✅ Segments are logical and complete  
✅ Figures, tables, formulas extracted accurately  
✅ Simpler codebase (fewer lines of code)  
✅ Fewer API calls than current approach  
✅ Better or equal quality vs. current approach  
✅ Configurable vision model selection  
✅ All tests passing  

## Timeline Estimate

- **Phase 1 (Core)**: 2-3 hours
- **Phase 2 (Aggregation)**: 1-2 hours
- **Phase 3 (Integration)**: 2-3 hours
- **Phase 4 (Config)**: 1 hour
- **Testing**: 2-3 hours

**Total**: ~8-12 hours of focused work

## Conclusion

The vision-first approach is a significant simplification that:
- Reduces complexity
- Improves accuracy
- Maintains or reduces cost
- Makes the system easier to understand and maintain

This is the right architectural direction for the PDF Lecture Service.

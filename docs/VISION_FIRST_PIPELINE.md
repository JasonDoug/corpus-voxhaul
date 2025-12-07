# Vision-First Pipeline

## Overview

The Vision-First Pipeline is a simplified architecture that replaces the complex multi-step content analysis and segmentation process with a single vision LLM call per page.

## Architecture Comparison

### Old Pipeline (Complex)
```
PDF → Text Extraction → Element Detection → Figure Analysis → Table Analysis → 
Formula Analysis → Citation Detection → Content Segmentation → Script Generation
```

**Issues:**
- 5+ separate LLM calls per document
- Complex orchestration and error handling
- Loss of visual context (text-only analysis)
- Prone to errors (e.g., pdf-parse reporting 0 pages)
- Difficult to maintain

### New Pipeline (Simple)
```
PDF → Extract Pages as Images → Vision LLM (per page) → Aggregated Segments → 
Script Generation
```

**Benefits:**
- **Simpler**: 1 vision call per page vs 5+ separate steps
- **Better Context**: Vision model sees actual layout, fonts, emphasis, spatial relationships
- **More Accurate**: No loss of information from text-only extraction
- **Natural Segmentation**: Based on visual page structure
- **Fewer API Calls**: P pages vs 3+ calls per document

## How It Works

### 1. Page Extraction
Each page of the PDF is converted to a high-resolution image (2000x2000px) using `pdf-img-convert`.

### 2. Vision Analysis
For each page, a vision LLM analyzes the image and:
- Identifies diagrams, charts, figures, tables, visual schemas
- Converts visual data into textual descriptions
- Notes mathematical formulas and equations
- Identifies citations and references
- Organizes content into logical segments

### 3. Aggregation
Segments from all pages are aggregated into a single `SegmentedContent` structure ready for script generation.

## Configuration

### Environment Variables

```env
# Enable vision-first pipeline
ENABLE_VISION_FIRST_PIPELINE=true

# Vision model selection (flexible)
VISION_MODEL=google/gemini-2.0-flash-exp:free

# Vision LLM settings
VISION_LLM_TEMPERATURE=0.3
VISION_LLM_MAX_TOKENS=4000
```

### Supported Models

The system supports any vision-capable model:
- **Google Gemini** (free tier available): `google/gemini-2.0-flash-exp:free`
- **Anthropic Claude 3.5 Sonnet**: `anthropic/claude-3-5-sonnet`
- **OpenAI GPT-4 Vision**: `openai/gpt-4-vision-preview`
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
  id: string;
  title: string;
  order: number;
  contentBlocks: ContentBlock[];
  prerequisites: string[];
}

interface ContentBlock {
  type: 'text';
  content: string;  // Contains ALL content as text (figures, tables, formulas converted)
  pageReference: number;
}
```

**Key Insight**: The vision LLM converts everything to text in the description field:
- Figures → "The diagram shows a heat engine with..."
- Tables → "The table presents data with columns X, Y, Z showing values..."
- Formulas → "The equation is E = mc², where E is energy..."
- Citations → "Reference to Smith et al. (2020) on quantum mechanics..."

No need for separate tracking of figures, tables, formulas, and citations!

## Usage

### Enabling the Pipeline

1. Set the environment variable:
   ```bash
   ENABLE_VISION_FIRST_PIPELINE=true
   ```

2. Optionally configure the vision model:
   ```bash
   VISION_MODEL=google/gemini-2.0-flash-exp:free
   ```

3. Upload a PDF as usual - the system will automatically use the vision-first pipeline

### Testing

Run the vision-first E2E test:
```bash
node scripts/test-vision-first-pipeline.js
```

Or run the unit tests:
```bash
npm test -- analyzer-vision.test.ts
```

## Performance

### API Costs
- **Per-page approach**: P pages × vision model cost
- **Typical paper (10 pages)**: 10 vision calls
- **With free Gemini**: $0
- **With paid models**: ~$0.10-0.50 per paper

### Processing Time
- **Per-page parallel processing**: ~2-5 seconds per page
- **10-page paper**: ~20-50 seconds total (parallelized)
- **Similar to current approach** but simpler

## Migration

The vision-first pipeline is enabled via feature flag, so you can:

1. **Gradual Rollout**: Enable for a subset of requests
2. **A/B Testing**: Compare quality between old and new pipelines
3. **Clean Break**: Enable for all requests (recommended)

### Recommended Approach

Enable the vision-first pipeline for all requests:
```bash
ENABLE_VISION_FIRST_PIPELINE=true
```

The old pipeline code remains in place but is not used when the feature flag is enabled.

## Troubleshooting

### Vision Model Errors

If you encounter errors with the vision model:

1. **Check API Key**: Ensure `OPENROUTER_API_KEY` is set
2. **Try Different Model**: Switch to a different vision model
3. **Check Rate Limits**: Some models have rate limits
4. **Verify Image Size**: Images are optimized to 2000x2000px

### Quality Issues

If segment quality is poor:

1. **Adjust Temperature**: Lower temperature (0.1-0.3) for more consistent output
2. **Try Different Model**: Some models are better at vision tasks
3. **Check PDF Quality**: Low-quality scans may not work well

### Performance Issues

If processing is slow:

1. **Use Faster Model**: Try `google/gemini-2.0-flash-exp:free`
2. **Reduce Image Size**: Lower the resolution in `pdf-img-convert`
3. **Check Network**: Slow network can impact API calls

## Future Enhancements

Potential improvements to the vision-first pipeline:

1. **Segment Merging**: Merge related segments across pages
2. **Caching**: Cache vision analysis results for repeated documents
3. **Batch Processing**: Process multiple pages in a single API call (if supported)
4. **Quality Scoring**: Add quality metrics for segment extraction
5. **Multi-Language**: Support for non-English documents

## Conclusion

The vision-first pipeline is a significant simplification that:
- Reduces complexity
- Improves accuracy
- Maintains or reduces cost
- Makes the system easier to understand and maintain

This is the recommended approach for the PDF Lecture Service.

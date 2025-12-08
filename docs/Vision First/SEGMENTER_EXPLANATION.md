# How the Content Segmenter Works

## Overview

The Content Segmenter is responsible for taking extracted PDF content and organizing it into logical learning segments. It uses an LLM to analyze the content and create a structured flow that makes sense for educational purposes.

## Architecture

```
ExtractedContent → buildContentSummary() → LLM Prompt → LLM API → JSON Response → Parse & Validate → SegmentedContent
```

## Step-by-Step Process

### 1. Input: ExtractedContent

The segmenter receives an `ExtractedContent` object containing:
- **pages**: Array of PageContent (text + element references)
- **figures**: Array of Figure objects with descriptions
- **tables**: Array of Table objects with interpretations  
- **formulas**: Array of Formula objects with explanations
- **citations**: Array of Citation objects

### 2. Build Content Summary

The `buildContentSummary()` function creates a comprehensive text representation for the LLM:

```typescript
function buildContentSummary(extractedContent: ExtractedContent): string
```

**Output Structure:**
```
=== DOCUMENT OVERVIEW ===
Total Pages: 6
Figures: 2
Tables: 1
Formulas: 3
Citations: 5
Estimated Complexity: Medium

=== FIGURE INVENTORY ===
- Figure abc123 (Page 2): Diagram of quantum entanglement setup
- Figure def456 (Page 4): Graph showing correlation measurements

=== TABLE INVENTORY ===
- Table xyz789 (Page 3): Experimental Results (5 rows)

=== FORMULA INVENTORY ===
- Formula f1 (Page 2): E = mc^2
- Formula f2 (Page 3): ψ(x,t) = ...

=== CITATION CONTEXT ===
Total Citations: 5
Key Citations:
- [c1] Einstein et al. (1935): Can Quantum-Mechanical Description...
...

=== PAGE SUMMARIES ===

--- Page 1 ---
Text: This paper investigates quantum entanglement phenomena...

--- Page 2 ---
Elements: Figures: abc123 | Formulas: f1
Text: The experimental setup consists of...

--- Page 3 ---
Elements: Tables: xyz789 | Formulas: f2
Text: Our results show strong correlations...
...

=== DETAILED FIGURE DESCRIPTIONS ===
[abc123] Page 2
Caption: Experimental setup
Description: The figure shows a laser beam directed at a BBO crystal...

=== DETAILED TABLE DESCRIPTIONS ===
[xyz789] Page 3
Headers: Measurement | Value | Error
Interpretation: The table presents experimental measurements...

=== DETAILED FORMULA DESCRIPTIONS ===
[f1] Page 2
LaTeX: E = mc^2
Explanation: This famous equation relates energy to mass...
```

### 3. Create LLM Prompt

The `createSegmentationPrompt()` function wraps the content summary with instructions:

```typescript
const prompt = `You are an expert at analyzing scientific documents and organizing them into logical learning segments.

I will provide you with the extracted content from a scientific PDF, including text, figures, tables, formulas, and citations.

Your task is to:
1. Identify distinct topics and concepts in the content
2. Group related concepts together into coherent segments
3. Create a logical narrative flow where concepts build upon each other
4. Identify prerequisite relationships (which concepts must be understood before others)
5. Provide a clear title for each segment

Content to analyze:
${contentSummary}

Please respond with a JSON object in the following format:
{
  "segments": [
    {
      "title": "Clear, descriptive title for the segment",
      "contentIndices": {
        "pageRanges": [[startPage, endPage], ...],
        "figureIds": ["id1", "id2", ...],
        "tableIds": ["id1", "id2", ...],
        "formulaIds": ["id1", "id2", ...],
        "citationIds": ["id1", "id2", ...]
      },
      "prerequisites": [0, 1, ...] // Indices of segments that should come before this one
    },
    ...
  ]
}

Guidelines:
- Create as many segments as needed to organize the content into logical, cohesive topics
- Each segment should represent a distinct concept or theme that can be understood as a unit
- Segments should flow logically from foundational to advanced concepts
- Prerequisites should only reference earlier segments (lower indices)
- Include all relevant figures, tables, formulas for each segment
- Ensure all content is assigned to at least one segment
- Aim for segments that are substantial enough to be meaningful but focused enough to be digestible

Respond ONLY with the JSON object, no additional text.`;
```

### Simplified Approach: Trust the LLM

**Philosophy:** The LLM is smart enough to determine the appropriate number of segments based on the content structure. No need for complex formulas.

**The prompt simply asks the LLM to:**
1. Identify distinct topics and concepts
2. Group related concepts together
3. Create logical flow from foundational to advanced
4. Make segments substantial but digestible

**Why this works better:**
- LLM understands natural topic boundaries in the content
- Different documents have different structures (some have clear sections, others don't)
- Removes arbitrary constraints that might force unnatural segmentation
- Scales automatically - short papers get fewer segments, long papers get more
- Adapts to content complexity naturally

**Expected behavior:**
- Short paper (5-10 pages): 3-6 segments based on natural topics
- Medium paper (20-30 pages): 8-15 segments based on sections/concepts
- Long paper (50+ pages): 15-30+ segments based on chapters/major topics
- The LLM decides based on actual content structure, not page count formulas

### 4. Call LLM API

The `callSegmentationLLM()` function sends the prompt to the configured LLM:

**Current Configuration:**
- **Model**: `x-ai/grok-4.1-fast:free` (from environment variable)
- **Provider**: OpenRouter
- **Temperature**: 0.3 (low for consistent, structured output)
- **Max Tokens**: 4000

**Retry Logic:**
- Retries up to 3 times on transient failures
- Exponential backoff between retries
- Validates JSON response structure

### 5. Parse LLM Response

The `parseSegmentationResponse()` function:

1. **Validates JSON structure**:
   - Checks for `segments` array
   - Ensures array is not empty
   - Validates each segment has required fields

2. **Validates each segment**:
   ```typescript
   {
     title: string (non-empty),
     contentIndices: {
       pageRanges: [[number, number], ...],
       figureIds: string[],
       tableIds: string[],
       formulaIds: string[],
       citationIds: string[]
     },
     prerequisites: number[] (valid indices)
   }
   ```

3. **Creates ContentSegment objects**:
   - Assigns unique IDs to each segment
   - Maps content indices to actual content blocks
   - Preserves prerequisite relationships

### 6. Apply Dependency-Based Ordering

The `applyDependencyOrdering()` function:

1. **Builds dependency graph** from prerequisites
2. **Performs topological sort** to ensure:
   - Prerequisites come before dependents
   - No circular dependencies
3. **Assigns final order numbers** to segments

### 7. Output: SegmentedContent

```typescript
interface SegmentedContent {
  segments: ContentSegment[];
}

interface ContentSegment {
  id: string;              // UUID
  title: string;           // "Introduction to Quantum Entanglement"
  order: number;           // 1, 2, 3, ...
  contentBlocks: ContentBlock[];
  prerequisites: string[]; // IDs of prerequisite segments
}

interface ContentBlock {
  type: 'text' | 'figure' | 'table' | 'formula' | 'citation';
  content: string | Figure | Table | Formula | Citation;
  pageReference: number;
}
```

## Current Bug: 0 Pages Issue

### Problem

When `pdf-parse` reports `totalPages = 0` (despite extracting text), the analyzer creates an empty `pages` array. This causes:

1. **Empty PAGE SUMMARIES section** in the content summary
2. **LLM receives minimal context** (just overview stats)
3. **LLM creates only 1 generic segment** or returns empty array

### Example of Bad Prompt

```
=== DOCUMENT OVERVIEW ===
Total Pages: 0          ← Problem!
Figures: 0
Tables: 0
Formulas: 0
Citations: 0
Estimated Complexity: Low

=== PAGE SUMMARIES ===
(empty - no pages to iterate over)  ← No content for LLM!
```

### Fix Implemented

In `src/services/analyzer.ts`:

```typescript
let totalPages = data.numpages;
const fullText = data.text;

// Handle case where pdf-parse reports 0 pages but we have text
if (totalPages === 0 && fullText.length > 0) {
  logger.warn('PDF reports 0 pages but has text content, estimating page count', {
    textLength: fullText.length,
  });
  // Estimate pages based on typical page length (~3000 chars per page)
  totalPages = Math.max(1, Math.ceil(fullText.length / 3000));
  logger.info('Estimated page count', { estimatedPages: totalPages });
}
```

**For "The Constitution of the Roman Republic.pdf":**
- Text length: 18,198 characters
- Estimated pages: `Math.ceil(18198 / 3000) = 7 pages`
- This should give the LLM enough context to create 3-8 segments

### Expected Behavior After Fix

With 7 pages of content, the LLM should receive:

```
=== DOCUMENT OVERVIEW ===
Total Pages: 7          ← Fixed!
...

=== PAGE SUMMARIES ===

--- Page 1 ---
Text: [First ~3000 chars of content]

--- Page 2 ---
Text: [Next ~3000 chars of content]

... (7 pages total)
```

This should result in **3-8 segments** as specified in the prompt guidelines.

## Why Segmentation Matters

Good segmentation is crucial for:

1. **Learning Flow**: Concepts build on each other logically
2. **Cognitive Load**: Bite-sized chunks are easier to understand
3. **Navigation**: Users can jump to specific topics
4. **Script Quality**: Better segments → better lecture scripts
5. **Audio Pacing**: Natural breaks between topics

## Configuration

**Environment Variables:**
```env
LLM_MODEL_SEGMENTATION=x-ai/grok-4.1-fast:free
LLM_PROVIDER=openrouter
ENABLE_REAL_SEGMENTATION=true
```

**Prompt Guidelines:**
- 3-8 segments (adjustable based on complexity)
- Each segment = cohesive topic
- Logical flow from foundational → advanced
- Prerequisites explicitly tracked

## Debugging Tips

1. **Check page count**: Look for `"pages":N` in analyzer logs
2. **Check prompt length**: Should be >2000 chars for good context
3. **Check LLM response**: Look for `"segmentCount":N` in logs
4. **Verify content summary**: Add logging to see what LLM receives
5. **Test with different PDFs**: Some formats work better than others

## Next Steps

1. **Verify fix works** by restarting server
2. **Test with multiple PDFs** to ensure robustness
3. **Consider alternative PDF parsers** if pdf-parse continues to have issues
4. **Add validation** to ensure 3-8 segments are created (fail if only 1)
5. **Improve prompt** if LLM consistently creates too few segments

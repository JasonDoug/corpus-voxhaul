// Vision-First Content Analyzer
// Simplified pipeline that uses vision LLM to extract everything at once
//
// ARCHITECTURE:
// PDF → Extract Pages as Images → Vision LLM (per page) → Aggregated Segments
//
// Benefits:
// - Simpler: 1 vision call per page vs 5+ separate steps
// - Better context: Vision model sees actual layout and visual elements
// - More accurate: No loss of information from text-only extraction
// - Natural segmentation: Based on visual page structure

import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { SegmentedContent, ContentSegment } from '../models/content';
import { llmService } from './llm';
import { recordLLMCallMetrics } from '../utils/llm-metrics';
import * as crypto from 'crypto';

/**
 * Page analysis result from vision LLM
 */
interface PageAnalysis {
  segments: Array<{
    id: number;
    title: string;
    description: string;
  }>;
}

/**
 * Extract all pages from PDF as images by reading from S3
 * Assumes images were already converted by the Python PDF-to-images Lambda
 */
async function extractPagesAsImages(jobId: string): Promise<string[]> {
  try {
    logger.info('Loading page images from S3', { jobId });

    const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

    const bucket = process.env.S3_BUCKET_PDFS;
    const prefix = `${jobId}_pages/`;

    // List all page images for this job
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });
    
    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      throw new Error(`No page images found in S3 for job ${jobId}`);
    }

    // Sort by page number (assuming format: jobId_pages/page_1.png, page_2.png, etc.)
    const imageKeys = listResponse.Contents
      .map((obj: any) => obj.Key)
      .filter((key: string) => key.endsWith('.png'))
      .sort();

    logger.info('Found page images in S3', {
      jobId,
      pageCount: imageKeys.length,
    });

    // Helper to convert stream to buffer
    async function streamToBuffer(stream: any): Promise<Buffer> {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }

    // Download each image and convert to base64 data URL
    const imageDataUrls: string[] = [];
    for (const key of imageKeys) {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      
      const imageResponse = await s3Client.send(getCommand);
      const buffer = await streamToBuffer(imageResponse.Body);
      const base64 = buffer.toString('base64');
      imageDataUrls.push(`data:image/png;base64,${base64}`);
    }

    logger.info('Pages loaded as images', {
      jobId,
      pageCount: imageDataUrls.length,
    });

    return imageDataUrls;
  } catch (error) {
    logger.error('Failed to load page images from S3', { error, jobId });
    throw new Error(`Failed to load page images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze a single page with vision LLM
 * Returns segments found on that page
 */
async function analyzePageWithVision(
  pageImage: string,
  pageNumber: number,
  correlationId?: string
): Promise<PageAnalysis> {
  const startTime = Date.now();
  const requestId = correlationId || crypto.randomUUID();

  // Get vision model from environment or use default
  const model = process.env.VISION_MODEL || 'google/gemini-2.0-flash-exp:free';

  logger.info('Analyzing page with vision LLM', {
    correlationId: requestId,
    pageNumber,
    model,
  });

  const prompt = `You are an expert educational content analyzer. Your task is to analyze the provided PDF page image, which is material for a university-level lecture, and organize it into logical, distinct segments for script generation.

---

## Instructions

**PRIMARY OBJECTIVE: DYNAMIC CONCEPTUAL SCALING.**
Produce the *absolute minimum number of segments* necessary to cover the distinct concepts.

**CRITICAL RULE: AGGRESSIVE MERGING**
1.  **Consolidate by Topic:** If a topic spans multiple paragraphs, the entire page, or even continues from previous context, create ONLY ONE segment.
2.  **No Arbitrary Limits:** Do not target a specific number of segments. If the page is one big concept, use 1 segment. If it has 3 distinct, unrelated topics, use 3. **Err heavily on the side of MERGING.**
3.  **No Sub-Segmentation:** Do NOT create separate segments for definitions, examples, or minor sub-sections. Merge them into the main segment.

**STEP 1: ANALYZE WHAT IS ACTUALLY PRESENT**
- Extract ALL text content from the page (headings, body text, footnotes, captions).
- IF the page contains diagrams, charts, figures, tables, mathematical formulas, or equations, describe them accurately.
- IF the page contains citations or references, include them.
- ONLY describe visual elements that are actually visible in the image. Do NOT invent or assume content.

**STEP 2: CONCEPTUAL SEGMENT GENERATION**
- **Consolidate** all related content into the fewest possible segments.
- For each segment, the 'description' field must contain the actual content from the page.
- Be factual and precise - describe only what you can see.

---

**STEP 3: OUTPUT**
Return strictly a JSON object with this schema. Do NOT wrap it in markdown code blocks. Return ONLY the raw JSON object.

\`\`\`json
{
  "segments": [
    {
      "id": number,
      "title": "string (A clear title for the concept)",
      "description": "string (A comprehensive description of the content on this page. If visual elements are present, describe them. Otherwise, focus on the text content.)"
    }
  ]
}
\`\`\`

**Example for a text-only page:**

\`\`\`json
{
  "segments": [
    {
      "id": 1,
      "title": "Introduction to Thermodynamics",
      "description": "This section defines thermodynamics as the study of energy transformations and introduces three primary state variables: Pressure (P), Volume (V), and Temperature (T). The ideal gas law PV = nRT relates these variables for ideal gases."
    }
  ]
}
\`\`\`

IMPORTANT: 
- Do NOT wrap in markdown code blocks
- Return ONLY the raw JSON object
- Be accurate - describe only what is actually visible
- Do NOT invent diagrams, figures, or other visual elements that are not present
- Include ALL text content from the page in the descriptions
`;

  try {
    const response = await llmService.vision({
      imageUrl: pageImage,
      prompt,
      model,
      maxTokens: config.vision.maxTokens,
    });

    const duration = Date.now() - startTime;

    logger.info('Vision LLM response received', {
      correlationId: requestId,
      pageNumber,
      duration,
      responseLength: response.length,
    });

    // Extract and parse JSON
    const parsed = cleanAndParseJson(response);

    // Validate structure
    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error('Invalid response structure: missing segments array');
    }

    for (const segment of parsed.segments) {
      if (typeof segment.id !== 'number' || !segment.title || !segment.description) {
        throw new Error('Invalid segment structure: missing required fields');
      }
    }

    logger.info('Page analysis completed', {
      correlationId: requestId,
      pageNumber,
      segmentCount: parsed.segments.length,
      duration,
    });

    // Record metrics
    recordLLMCallMetrics({
      operation: 'vision_page_analysis',
      model,
      provider: llmService.getProvider(),
      promptTokens: Math.ceil(prompt.length / 4), // Rough estimate
      completionTokens: Math.ceil(response.length / 4),
      totalTokens: Math.ceil((prompt.length + response.length) / 4),
      durationMs: duration,
      success: true,
    });

    return parsed;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Explicitly serialize the error object for better logging
    const serializedError = {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      // Include any custom properties from RateLimitError or other custom errors
      ...(error && typeof error === 'object' && 'retryable' in error ? { retryable: (error as any).retryable } : {}),
      ...(error && typeof error === 'object' && 'retryAfter' in error ? { retryAfter: (error as any).retryAfter } : {}),
    };

    logger.error('Vision page analysis failed', {
      correlationId: requestId,
      pageNumber,
      error: serializedError, // Log the serialized error
      duration,
      errorMessage: serializedError.message,
    });

    // Record failure metrics
    recordLLMCallMetrics({
      operation: 'vision_page_analysis',
      model,
      provider: llmService.getProvider(),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: duration,
      success: false,
      errorType: serializedError.message, // Use the serialized error message
    });

    throw error;
  }
}

/**
 * Merge related segments across pages (optional optimization)
 * For now, we keep it simple and don't merge
 */
function mergeRelatedSegments(segments: ContentSegment[]): ContentSegment[] {
  // Simple approach: no merging, just return as-is
  // In the future, could use LLM to identify segments with same topic across pages
  return segments;
}

/**
 * Main function to analyze PDF using vision-first approach
 * Returns segmented content ready for script generation
 */
export async function analyzeContentVisionFirst(
  jobId: string,
  correlationId?: string
): Promise<SegmentedContent> {
  const requestId = correlationId || crypto.randomUUID();

  try {
    logger.info('Starting vision-first content analysis', {
      correlationId: requestId,
      jobId,
    });

    // Extract all pages as images from S3
    // (assumes Python Lambda already converted PDF to images)
    const pageImages = await extractPagesAsImages(jobId);

    logger.info('Analyzing pages with vision LLM', {
      correlationId: requestId,
      pageCount: pageImages.length,
    });

    // Analyze each page with vision LLM (sequentially to avoid rate limits)
    const pageAnalyses: PageAnalysis[] = [];

    for (let i = 0; i < pageImages.length; i++) {
      const image = pageImages[i];
      const pageNum = i + 1;

      logger.info(`Processing page ${pageNum} of ${pageImages.length}`, { correlationId: requestId });

      const analysis = await analyzePageWithVision(image, pageNum, `${requestId}-page-${pageNum}`);
      pageAnalyses.push(analysis);

      // Add delay between pages to respect rate limits
      if (i < pageImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Aggregate segments from all pages
    let allSegments: ContentSegment[] = [];
    let segmentCounter = 0;

    for (let pageIndex = 0; pageIndex < pageAnalyses.length; pageIndex++) {
      const pageAnalysis = pageAnalyses[pageIndex];
      const pageNumber = pageIndex + 1;

      for (const rawSegment of pageAnalysis.segments) {
        segmentCounter++;

        allSegments.push({
          id: crypto.randomUUID(),
          title: rawSegment.title,
          order: segmentCounter,
          contentBlocks: [
            {
              type: 'text',
              content: rawSegment.description,
              pageReference: pageNumber,
            },
          ],
          prerequisites: [], // Vision-first doesn't compute prerequisites
        });
      }
    }

    // Optional: Merge related segments across pages
    const mergedSegments = mergeRelatedSegments(allSegments);

    // Assign final ordering
    mergedSegments.forEach((segment, index) => {
      segment.order = index + 1;
    });

    const result: SegmentedContent = {
      segments: mergedSegments,
    };

    logger.info('Vision-first content analysis completed', {
      correlationId: requestId,
      jobId,
      totalPages: pageImages.length,
      totalSegments: mergedSegments.length,
    });

    return result;
  } catch (error) {
    // Explicitly serialize the error object for better logging
    const serializedError = {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...(error && typeof error === 'object' && 'retryable' in error ? { retryable: (error as any).retryable } : {}),
      ...(error && typeof error === 'object' && 'retryAfter' in error ? { retryAfter: (error as any).retryAfter } : {}),
    };

    logger.error('Vision-first content analysis failed', {
      correlationId: requestId,
      jobId,
      error: serializedError, // Log the serialized error
    });
    throw error;
  }
}

/**
 * Helper to clean and parse JSON from LLM response
 * Handles markdown code blocks, surrounding text, and unescaped control characters
 */
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();

  // 1. Extract JSON block if marked with markdown
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }

  // 2. Find the first '{' and last '}' to strip surrounding text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Sanitize JSON string to handle unescaped control characters
  // LLMs sometimes return JSON with unescaped newlines, tabs, etc. in strings
  let sanitized = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (char === '\\') {
        isEscaped = !isEscaped;
        sanitized += char;
      } else if (char === '"' && !isEscaped) {
        inString = false;
        sanitized += char;
      } else if (char === '\n') {
        sanitized += '\\n'; // Escape newline
      } else if (char === '\r') {
        sanitized += '\\r'; // Escape carriage return
      } else if (char === '\t') {
        sanitized += '\\t'; // Escape tab
      } else {
        isEscaped = false;
        sanitized += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      sanitized += char;
    }
  }

  return JSON.parse(sanitized);
}

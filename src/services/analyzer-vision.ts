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

// Dynamic imports for modules with ESM/CJS issues
const { v4: uuidv4 } = require('uuid');

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
    
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3();
    
    const bucket = process.env.S3_BUCKET_PDFS;
    const prefix = `${jobId}_pages/`;
    
    // List all page images for this job
    const listResponse = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: prefix,
    }).promise();
    
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
    
    // Download each image and convert to base64 data URL
    const imageDataUrls: string[] = [];
    for (const key of imageKeys) {
      const imageResponse = await s3.getObject({
        Bucket: bucket,
        Key: key,
      }).promise();
      
      const base64 = imageResponse.Body.toString('base64');
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
  const requestId = correlationId || uuidv4();
  
  // Get vision model from environment or use default
  const model = process.env.VISION_MODEL || 'google/gemini-2.0-flash-exp:free';
  
  logger.info('Analyzing page with vision LLM', {
    correlationId: requestId,
    pageNumber,
    model,
  });
  
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
- If the page has a single unified topic, create one segment
- If the page covers multiple distinct concepts, create multiple segments

STEP 3: OUTPUT
Return strictly a JSON object with this schema:
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

IMPORTANT: 
- Do NOT wrap in markdown code blocks
- Return ONLY the raw JSON object
- Include ALL text content from the page in the descriptions
- Convert ALL visual elements (figures, tables, formulas) to text descriptions
- Be comprehensive - don't leave out any content`;

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
    
    // Parse JSON response
    // Remove markdown code blocks if present
    let jsonText = response.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed: PageAnalysis = JSON.parse(jsonText);
    
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
  const requestId = correlationId || uuidv4();
  
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
          id: uuidv4(),
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

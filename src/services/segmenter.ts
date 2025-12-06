// Content Segmenter service - Organize extracted content into logical topic segments
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { ExtractedContent, SegmentedContent, ContentSegment, ContentBlock } from '../models/content';
import { llmService, getRecommendedModel } from './llm';
import { recordLLMCallMetrics } from '../utils/llm-metrics';

const { v4: uuidv4 } = require('uuid');

/**
 * Create a prompt for the LLM to segment content into logical topics
 */
export function createSegmentationPrompt(extractedContent: ExtractedContent): string {
  // Build a comprehensive text representation of the content
  const contentSummary = buildContentSummary(extractedContent);
  
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

  return prompt;
}

/**
 * Build a summary of extracted content for the LLM prompt
 * Enhanced to provide comprehensive document overview with inventory and context
 */
function buildContentSummary(extractedContent: ExtractedContent): string {
  const parts: string[] = [];
  
  // DOCUMENT OVERVIEW - High-level statistics
  parts.push('=== DOCUMENT OVERVIEW ===');
  parts.push(`Total Pages: ${extractedContent.pages.length}`);
  parts.push(`Figures: ${extractedContent.figures.length}`);
  parts.push(`Tables: ${extractedContent.tables.length}`);
  parts.push(`Formulas: ${extractedContent.formulas.length}`);
  parts.push(`Citations: ${extractedContent.citations.length}`);
  
  // Calculate estimated complexity
  const totalElements = extractedContent.figures.length + 
                       extractedContent.tables.length + 
                       extractedContent.formulas.length;
  const complexity = totalElements > 15 ? 'High' : totalElements > 8 ? 'Medium' : 'Low';
  parts.push(`Estimated Complexity: ${complexity}`);
  
  // ELEMENT INVENTORY - Quick reference of all visual elements
  if (extractedContent.figures.length > 0) {
    parts.push('\n=== FIGURE INVENTORY ===');
    extractedContent.figures.forEach(figure => {
      const caption = figure.caption || 'No caption';
      parts.push(`- Figure ${figure.id} (Page ${figure.pageNumber}): ${caption}`);
    });
  }
  
  if (extractedContent.tables.length > 0) {
    parts.push('\n=== TABLE INVENTORY ===');
    extractedContent.tables.forEach(table => {
      const headerSummary = table.headers.length > 0 
        ? table.headers.slice(0, 3).join(', ') + (table.headers.length > 3 ? '...' : '')
        : 'No headers';
      parts.push(`- Table ${table.id} (Page ${table.pageNumber}): ${headerSummary} (${table.rows.length} rows)`);
    });
  }
  
  if (extractedContent.formulas.length > 0) {
    parts.push('\n=== FORMULA INVENTORY ===');
    extractedContent.formulas.forEach(formula => {
      // Truncate long LaTeX for inventory
      const latexPreview = formula.latex.length > 50 
        ? formula.latex.substring(0, 50) + '...'
        : formula.latex;
      parts.push(`- Formula ${formula.id} (Page ${formula.pageNumber}): ${latexPreview}`);
    });
  }
  
  // CITATION CONTEXT - Key references
  if (extractedContent.citations.length > 0) {
    parts.push('\n=== CITATION CONTEXT ===');
    parts.push(`Total Citations: ${extractedContent.citations.length}`);
    
    // Show first few citations as examples
    const citationsToShow = Math.min(5, extractedContent.citations.length);
    parts.push(`Key Citations (showing ${citationsToShow} of ${extractedContent.citations.length}):`);
    
    extractedContent.citations.slice(0, citationsToShow).forEach(citation => {
      if (citation.authors && citation.year && citation.title) {
        const authorStr = citation.authors.length > 2
          ? `${citation.authors[0]} et al.`
          : citation.authors.join(', ');
        parts.push(`- [${citation.id}] ${authorStr} (${citation.year}): ${citation.title}`);
      } else {
        parts.push(`- [${citation.id}] ${citation.text}`);
      }
    });
    
    if (extractedContent.citations.length > citationsToShow) {
      parts.push(`... and ${extractedContent.citations.length - citationsToShow} more citations`);
    }
  }
  
  // PAGE SUMMARIES - Detailed content by page
  parts.push('\n=== PAGE SUMMARIES ===');
  extractedContent.pages.forEach(page => {
    parts.push(`\n--- Page ${page.pageNumber} ---`);
    
    // Add element references for this page
    const pageElements: string[] = [];
    
    // Find figures on this page
    const pageFigures = extractedContent.figures.filter(f => f.pageNumber === page.pageNumber);
    if (pageFigures.length > 0) {
      pageElements.push(`Figures: ${pageFigures.map(f => f.id).join(', ')}`);
    }
    
    // Find tables on this page
    const pageTables = extractedContent.tables.filter(t => t.pageNumber === page.pageNumber);
    if (pageTables.length > 0) {
      pageElements.push(`Tables: ${pageTables.map(t => t.id).join(', ')}`);
    }
    
    // Find formulas on this page
    const pageFormulas = extractedContent.formulas.filter(f => f.pageNumber === page.pageNumber);
    if (pageFormulas.length > 0) {
      pageElements.push(`Formulas: ${pageFormulas.map(f => f.id).join(', ')}`);
    }
    
    if (pageElements.length > 0) {
      parts.push(`Elements: ${pageElements.join(' | ')}`);
    }
    
    // Add text content (truncated for very long pages)
    const maxTextLength = 600;
    if (page.text.length > maxTextLength) {
      const truncated = page.text.substring(0, maxTextLength);
      // Try to truncate at sentence boundary
      const lastPeriod = truncated.lastIndexOf('.');
      const text = lastPeriod > maxTextLength * 0.7 
        ? truncated.substring(0, lastPeriod + 1)
        : truncated;
      parts.push(`Text: ${text}...[truncated, ${page.text.length - text.length} chars remaining]`);
    } else {
      parts.push(`Text: ${page.text}`);
    }
  });
  
  // DETAILED ELEMENT DESCRIPTIONS
  if (extractedContent.figures.length > 0) {
    parts.push('\n=== DETAILED FIGURE DESCRIPTIONS ===');
    extractedContent.figures.forEach(figure => {
      parts.push(`\n[${figure.id}] Page ${figure.pageNumber}`);
      if (figure.caption) {
        parts.push(`Caption: ${figure.caption}`);
      }
      parts.push(`Description: ${figure.description}`);
    });
  }
  
  if (extractedContent.tables.length > 0) {
    parts.push('\n=== DETAILED TABLE DESCRIPTIONS ===');
    extractedContent.tables.forEach(table => {
      parts.push(`\n[${table.id}] Page ${table.pageNumber}`);
      parts.push(`Headers: ${table.headers.join(' | ')}`);
      parts.push(`Rows: ${table.rows.length}`);
      parts.push(`Interpretation: ${table.interpretation}`);
    });
  }
  
  if (extractedContent.formulas.length > 0) {
    parts.push('\n=== DETAILED FORMULA DESCRIPTIONS ===');
    extractedContent.formulas.forEach(formula => {
      parts.push(`\n[${formula.id}] Page ${formula.pageNumber}`);
      parts.push(`LaTeX: ${formula.latex}`);
      parts.push(`Explanation: ${formula.explanation}`);
    });
  }
  
  return parts.join('\n');
}

/**
 * Interface for LLM segmentation response
 */
interface LLMSegmentResponse {
  title: string;
  contentIndices: {
    pageRanges: number[][];
    figureIds: string[];
    tableIds: string[];
    formulaIds: string[];
    citationIds: string[];
  };
  prerequisites: number[];
}

interface LLMSegmentationResponse {
  segments: LLMSegmentResponse[];
}

/**
 * Build a dependency graph from segment prerequisites
 * Returns an adjacency list representation
 */
export function buildDependencyGraph(segments: LLMSegmentResponse[]): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  
  // Initialize graph with all segment indices
  for (let i = 0; i < segments.length; i++) {
    graph.set(i, []);
  }
  
  // Add edges from prerequisites to dependents
  segments.forEach((segment, index) => {
    segment.prerequisites.forEach(prereqIndex => {
      // Validate prerequisite index
      if (prereqIndex >= 0 && prereqIndex < segments.length && prereqIndex !== index) {
        const dependents = graph.get(prereqIndex) || [];
        dependents.push(index);
        graph.set(prereqIndex, dependents);
      }
    });
  });
  
  return graph;
}

/**
 * Detect cycles in the dependency graph using DFS
 * Returns true if a cycle is detected
 */
export function hasCycle(graph: Map<number, number[]>, nodeCount: number): boolean {
  const visited = new Set<number>();
  const recursionStack = new Set<number>();
  
  function dfs(node: number): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a back edge - cycle detected
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  // Check all nodes (graph might be disconnected)
  for (let i = 0; i < nodeCount; i++) {
    if (!visited.has(i)) {
      if (dfs(i)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Perform topological sort on the dependency graph
 * Returns an ordered array of segment indices
 * Throws an error if a cycle is detected
 */
export function topologicalSort(segments: LLMSegmentResponse[]): number[] {
  const graph = buildDependencyGraph(segments);
  
  // Check for cycles
  if (hasCycle(graph, segments.length)) {
    logger.warn('Circular dependencies detected in segments, using fallback ordering');
    // Fallback: return original order
    return segments.map((_, index) => index);
  }
  
  // Kahn's algorithm for topological sort
  const inDegree = new Map<number, number>();
  
  // Initialize in-degrees
  for (let i = 0; i < segments.length; i++) {
    inDegree.set(i, 0);
  }
  
  // Calculate in-degrees
  segments.forEach((segment, index) => {
    segment.prerequisites.forEach(prereqIndex => {
      if (prereqIndex >= 0 && prereqIndex < segments.length && prereqIndex !== index) {
        inDegree.set(index, (inDegree.get(index) || 0) + 1);
      }
    });
  });
  
  // Queue of nodes with no incoming edges
  const queue: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (inDegree.get(i) === 0) {
      queue.push(i);
    }
  }
  
  const sorted: number[] = [];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    
    // Reduce in-degree for all dependents
    const dependents = graph.get(node) || [];
    dependents.forEach(dependent => {
      const newInDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newInDegree);
      
      if (newInDegree === 0) {
        queue.push(dependent);
      }
    });
  }
  
  // If sorted doesn't contain all nodes, there's a cycle (shouldn't happen due to earlier check)
  if (sorted.length !== segments.length) {
    logger.warn('Topological sort incomplete, using fallback ordering');
    return segments.map((_, index) => index);
  }
  
  return sorted;
}

/**
 * Parse LLM response and convert to ContentSegment structures
 */
export function parseSegmentationResponse(
  llmResponse: LLMSegmentationResponse,
  extractedContent: ExtractedContent
): ContentSegment[] {
  const segments: ContentSegment[] = [];
  
  // Apply topological sort to get correct ordering
  const sortedIndices = topologicalSort(llmResponse.segments);
  
  sortedIndices.forEach((originalIndex, newOrder) => {
    const llmSegment = llmResponse.segments[originalIndex];
    
    // Build content blocks for this segment
    const contentBlocks: ContentBlock[] = [];
    
    // Add text content from page ranges
    llmSegment.contentIndices.pageRanges.forEach(([startPage, endPage]) => {
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const page = extractedContent.pages.find(p => p.pageNumber === pageNum);
        if (page && page.text.trim()) {
          contentBlocks.push({
            type: 'text',
            content: page.text,
            pageReference: pageNum,
          });
        }
      }
    });
    
    // Add figures
    llmSegment.contentIndices.figureIds.forEach(figureId => {
      const figure = extractedContent.figures.find(f => f.id === figureId);
      if (figure) {
        contentBlocks.push({
          type: 'figure',
          content: figure,
          pageReference: figure.pageNumber,
        });
      }
    });
    
    // Add tables
    llmSegment.contentIndices.tableIds.forEach(tableId => {
      const table = extractedContent.tables.find(t => t.id === tableId);
      if (table) {
        contentBlocks.push({
          type: 'table',
          content: table,
          pageReference: table.pageNumber,
        });
      }
    });
    
    // Add formulas
    llmSegment.contentIndices.formulaIds.forEach(formulaId => {
      const formula = extractedContent.formulas.find(f => f.id === formulaId);
      if (formula) {
        contentBlocks.push({
          type: 'formula',
          content: formula,
          pageReference: formula.pageNumber,
        });
      }
    });
    
    // Add citations
    llmSegment.contentIndices.citationIds.forEach(citationId => {
      const citation = extractedContent.citations.find(c => c.id === citationId);
      if (citation) {
        contentBlocks.push({
          type: 'citation',
          content: citation,
          pageReference: 0, // Citations don't have a specific page
        });
      }
    });
    
    // Map prerequisites to new ordering
    const mappedPrerequisites = llmSegment.prerequisites
      .map(oldIndex => sortedIndices.indexOf(oldIndex))
      .filter(newIndex => newIndex !== -1 && newIndex < newOrder);
    
    const segment: ContentSegment = {
      id: uuidv4(),
      title: llmSegment.title,
      order: newOrder,
      contentBlocks,
      prerequisites: mappedPrerequisites.map(idx => segments[idx]?.id).filter(Boolean),
    };
    
    segments.push(segment);
  });
  
  return segments;
}

/**
 * Mock implementation for segmentation (used when feature flag is disabled)
 */
async function mockSegmentationLLM(_prompt: string): Promise<LLMSegmentationResponse> {
  logger.info('Using mock segmentation (feature flag disabled)');
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Return a simple mock segmentation
  return {
    segments: [
      {
        title: 'Introduction and Background',
        contentIndices: {
          pageRanges: [[1, 2]],
          figureIds: [],
          tableIds: [],
          formulaIds: [],
          citationIds: [],
        },
        prerequisites: [],
      },
      {
        title: 'Main Content',
        contentIndices: {
          pageRanges: [[3, 5]],
          figureIds: [],
          tableIds: [],
          formulaIds: [],
          citationIds: [],
        },
        prerequisites: [0],
      },
      {
        title: 'Conclusion',
        contentIndices: {
          pageRanges: [[6, 6]],
          figureIds: [],
          tableIds: [],
          formulaIds: [],
          citationIds: [],
        },
        prerequisites: [1],
      },
    ],
  };
}

/**
 * Call LLM API to segment content
 * Uses the existing LLM service to analyze content and create logical segments
 * Exported for testing purposes
 */
export async function callSegmentationLLM(prompt: string, correlationId?: string): Promise<LLMSegmentationResponse> {
  // Check feature flag
  if (!config.featureFlags.enableRealSegmentation) {
    logger.info('Real segmentation disabled by feature flag, using mock implementation', {
      correlationId,
    });
    return mockSegmentationLLM(prompt);
  }
  
  const startTime = Date.now();
  const requestId = correlationId || uuidv4();
  let model: string | undefined;
  
  try {
    model = getRecommendedModel('segmentation', llmService.getProvider());
    
    logger.info('Calling LLM for content segmentation', {
      correlationId: requestId,
      model,
      provider: llmService.getProvider(),
      promptLength: prompt.length,
    });
    
    // The llmService.chat already includes retry logic via withRetry
    // We'll track attempts through error handling
    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing scientific documents and organizing content into logical segments.

Your task is to:
1. Identify distinct topics and concepts in the content
2. Group related concepts together
3. Determine prerequisite relationships between segments
4. Create a logical narrative flow

Return your response as JSON matching this exact structure:
{
  "segments": [
    {
      "title": "string",
      "contentIndices": {
        "pageRanges": [[startPage, endPage]],
        "figureIds": ["id1", "id2"],
        "tableIds": ["id1"],
        "formulaIds": ["id1"],
        "citationIds": ["id1"]
      },
      "prerequisites": [segmentIndex1, segmentIndex2]
    }
  ]
}

Respond ONLY with valid JSON, no additional text.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model,
      temperature: 0.7,
      maxTokens: 2000,
    });
    
    const apiCallDuration = Date.now() - startTime;
    
    logger.info('LLM API call completed', {
      correlationId: requestId,
      model,
      duration: apiCallDuration,
      responseLength: response.content.length,
      tokensUsed: response.usage?.totalTokens,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
    });
    
    // Record operation-specific metrics
    if (response.usage) {
      recordLLMCallMetrics({
        operation: 'segmentation',
        model: response.model,
        provider: llmService.getProvider(),
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        durationMs: apiCallDuration,
        success: true,
      });
    }
    
    // Parse JSON response
    let segmentationData: LLMSegmentationResponse;
    try {
      segmentationData = JSON.parse(response.content);
    } catch (parseError) {
      // Log detailed information about JSON parsing failure
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
      const responsePreview = response.content.substring(0, 500);
      const responseSuffix = response.content.length > 500 
        ? `...[truncated, total length: ${response.content.length}]` 
        : '';
      
      logger.error('Failed to parse LLM response as JSON', {
        error: errorMessage,
        parseError: parseError,
        model,
        responsePreview: responsePreview + responseSuffix,
        responseLength: response.content.length,
        tokensUsed: response.usage?.totalTokens,
      });
      
      throw new Error(
        `LLM returned invalid JSON response. Parse error: ${errorMessage}. ` +
        `Response preview: ${responsePreview.substring(0, 100)}...`
      );
    }
    
    // Validate structure
    if (!segmentationData.segments || !Array.isArray(segmentationData.segments)) {
      logger.error('Invalid segmentation response structure', {
        model,
        hasSegments: !!segmentationData.segments,
        segmentsType: typeof segmentationData.segments,
        responseKeys: Object.keys(segmentationData),
      });
      
      throw new Error(
        'Invalid segmentation response: missing or invalid segments array. ' +
        `Expected array, got ${typeof segmentationData.segments}`
      );
    }
    
    if (segmentationData.segments.length === 0) {
      logger.error('Empty segments array in response', {
        model,
        response: segmentationData,
      });
      
      throw new Error('Invalid segmentation response: segments array is empty');
    }
    
    // Validate each segment
    for (let i = 0; i < segmentationData.segments.length; i++) {
      const segment = segmentationData.segments[i];
      
      // Validate title
      if (!segment.title || typeof segment.title !== 'string') {
        logger.error('Invalid segment title', {
          segmentIndex: i,
          hasTitle: !!segment.title,
          titleType: typeof segment.title,
          segment,
        });
        
        throw new Error(
          `Invalid segment ${i}: missing or invalid title. ` +
          `Expected string, got ${typeof segment.title}`
        );
      }
      
      if (segment.title.trim().length === 0) {
        logger.error('Empty segment title', {
          segmentIndex: i,
          title: segment.title,
        });
        
        throw new Error(`Invalid segment ${i}: title cannot be empty`);
      }
      
      // Validate contentIndices exists
      if (!segment.contentIndices) {
        logger.error('Missing contentIndices', {
          segmentIndex: i,
          segmentKeys: Object.keys(segment),
        });
        
        throw new Error(`Invalid segment ${i}: missing contentIndices`);
      }
      
      // Validate contentIndices structure - pageRanges
      if (!Array.isArray(segment.contentIndices.pageRanges)) {
        logger.error('Invalid pageRanges structure', {
          segmentIndex: i,
          pageRangesType: typeof segment.contentIndices.pageRanges,
        });
        
        throw new Error(
          `Invalid segment ${i}: contentIndices.pageRanges must be an array. ` +
          `Got ${typeof segment.contentIndices.pageRanges}`
        );
      }
      
      // Validate each page range
      for (let j = 0; j < segment.contentIndices.pageRanges.length; j++) {
        const range = segment.contentIndices.pageRanges[j];
        
        if (!Array.isArray(range) || range.length !== 2) {
          logger.error('Invalid page range format', {
            segmentIndex: i,
            rangeIndex: j,
            range,
            isArray: Array.isArray(range),
            length: Array.isArray(range) ? range.length : 'N/A',
          });
          
          throw new Error(
            `Invalid segment ${i}: pageRanges[${j}] must be an array of [startPage, endPage]. ` +
            `Got ${Array.isArray(range) ? `array of length ${range.length}` : typeof range}`
          );
        }
        
        const [startPage, endPage] = range;
        
        if (typeof startPage !== 'number' || typeof endPage !== 'number') {
          logger.error('Invalid page range types', {
            segmentIndex: i,
            rangeIndex: j,
            startPageType: typeof startPage,
            endPageType: typeof endPage,
            range,
          });
          
          throw new Error(
            `Invalid segment ${i}: pageRanges[${j}] must contain numbers. ` +
            `Got [${typeof startPage}, ${typeof endPage}]`
          );
        }
        
        if (startPage < 1 || endPage < 1) {
          logger.error('Invalid page numbers', {
            segmentIndex: i,
            rangeIndex: j,
            startPage,
            endPage,
          });
          
          throw new Error(
            `Invalid segment ${i}: pageRanges[${j}] page numbers must be >= 1. ` +
            `Got [${startPage}, ${endPage}]`
          );
        }
        
        if (startPage > endPage) {
          logger.error('Invalid page range order', {
            segmentIndex: i,
            rangeIndex: j,
            startPage,
            endPage,
          });
          
          throw new Error(
            `Invalid segment ${i}: pageRanges[${j}] startPage cannot be greater than endPage. ` +
            `Got [${startPage}, ${endPage}]`
          );
        }
      }
      
      // Validate contentIndices structure - ensure all required arrays exist
      segment.contentIndices.figureIds = segment.contentIndices.figureIds || [];
      segment.contentIndices.tableIds = segment.contentIndices.tableIds || [];
      segment.contentIndices.formulaIds = segment.contentIndices.formulaIds || [];
      segment.contentIndices.citationIds = segment.contentIndices.citationIds || [];
      
      // Validate that all ID arrays are actually arrays
      const idArrays = [
        { name: 'figureIds', value: segment.contentIndices.figureIds },
        { name: 'tableIds', value: segment.contentIndices.tableIds },
        { name: 'formulaIds', value: segment.contentIndices.formulaIds },
        { name: 'citationIds', value: segment.contentIndices.citationIds },
      ];
      
      for (const { name, value } of idArrays) {
        if (!Array.isArray(value)) {
          logger.error('Invalid ID array type', {
            segmentIndex: i,
            arrayName: name,
            actualType: typeof value,
          });
          
          throw new Error(
            `Invalid segment ${i}: contentIndices.${name} must be an array. ` +
            `Got ${typeof value}`
          );
        }
        
        // Validate that all IDs are strings
        for (let k = 0; k < value.length; k++) {
          if (typeof value[k] !== 'string') {
            logger.error('Invalid ID type in array', {
              segmentIndex: i,
              arrayName: name,
              idIndex: k,
              idType: typeof value[k],
              idValue: value[k],
            });
            
            throw new Error(
              `Invalid segment ${i}: contentIndices.${name}[${k}] must be a string. ` +
              `Got ${typeof value[k]}`
            );
          }
        }
      }
      
      // Validate prerequisites
      if (!Array.isArray(segment.prerequisites)) {
        logger.error('Invalid prerequisites type', {
          segmentIndex: i,
          prerequisitesType: typeof segment.prerequisites,
        });
        
        throw new Error(
          `Invalid segment ${i}: prerequisites must be an array. ` +
          `Got ${typeof segment.prerequisites}`
        );
      }
      
      // Validate that prerequisites are valid indices
      for (let k = 0; k < segment.prerequisites.length; k++) {
        const prereqIndex = segment.prerequisites[k];
        
        if (typeof prereqIndex !== 'number') {
          logger.error('Invalid prerequisite type', {
            segmentIndex: i,
            prerequisiteIndex: k,
            prerequisiteType: typeof prereqIndex,
            prerequisiteValue: prereqIndex,
          });
          
          throw new Error(
            `Invalid segment ${i}: prerequisites[${k}] must be a number. ` +
            `Got ${typeof prereqIndex}`
          );
        }
        
        if (!Number.isInteger(prereqIndex)) {
          logger.error('Non-integer prerequisite index', {
            segmentIndex: i,
            prerequisiteIndex: k,
            prerequisiteValue: prereqIndex,
          });
          
          throw new Error(
            `Invalid segment ${i}: prerequisite indices must be integers. ` +
            `Got ${prereqIndex}`
          );
        }
        
        if (prereqIndex < 0) {
          logger.error('Negative prerequisite index', {
            segmentIndex: i,
            prerequisiteIndex: k,
            prerequisiteValue: prereqIndex,
          });
          
          throw new Error(
            `Invalid segment ${i}: prerequisite indices must be non-negative. ` +
            `Got ${prereqIndex}`
          );
        }
        
        if (prereqIndex >= segmentationData.segments.length) {
          logger.error('Prerequisite index out of bounds', {
            segmentIndex: i,
            prerequisiteIndex: k,
            prerequisiteValue: prereqIndex,
            maxValidIndex: segmentationData.segments.length - 1,
            totalSegments: segmentationData.segments.length,
          });
          
          throw new Error(
            `Invalid segment ${i}: prerequisite index ${prereqIndex} is out of bounds. ` +
            `Valid range: 0-${segmentationData.segments.length - 1}`
          );
        }
        
        if (prereqIndex === i) {
          logger.error('Self-referential prerequisite', {
            segmentIndex: i,
            prerequisiteIndex: k,
            prerequisiteValue: prereqIndex,
          });
          
          throw new Error(
            `Invalid segment ${i}: segment cannot be a prerequisite of itself`
          );
        }
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    logger.info('Segmentation completed successfully', {
      correlationId: requestId,
      segmentCount: segmentationData.segments.length,
      model,
      totalDuration,
      tokensUsed: response.usage?.totalTokens,
    });
    
    return segmentationData;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    // Categorize and log error with full context
    const errorType = categorizeSegmentationError(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Record failure metrics
    recordLLMCallMetrics({
      operation: 'segmentation',
      model: model || 'unknown',
      provider: llmService.getProvider(),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: totalDuration,
      success: false,
      errorType,
    });
    
    logger.error('Segmentation LLM call failed', {
      correlationId: requestId,
      errorType,
      errorMessage,
      errorStack,
      model,
      provider: llmService.getProvider(),
      duration: totalDuration,
      promptLength: prompt.length,
      // Include original error for debugging
      originalError: error,
    });
    
    // Re-throw with appropriate error type
    if (errorType === 'JSON_PARSE_ERROR') {
      throw new Error(`Segmentation failed: ${errorMessage}`);
    } else if (errorType === 'VALIDATION_ERROR') {
      throw new Error(`Segmentation validation failed: ${errorMessage}`);
    } else if (errorType === 'API_ERROR') {
      throw new Error(`LLM API error during segmentation: ${errorMessage}`);
    } else {
      throw new Error(`Failed to segment content: ${errorMessage}`);
    }
  }
}

/**
 * Categorize segmentation errors for better error handling and monitoring
 */
function categorizeSegmentationError(error: any): string {
  if (!error) {
    return 'UNKNOWN_ERROR';
  }
  
  const errorMessage = error.message?.toLowerCase() || '';
  
  // JSON parsing errors
  if (error instanceof SyntaxError || errorMessage.includes('json') || errorMessage.includes('parse')) {
    return 'JSON_PARSE_ERROR';
  }
  
  // Validation errors
  if (errorMessage.includes('invalid') || errorMessage.includes('missing') || errorMessage.includes('must be')) {
    return 'VALIDATION_ERROR';
  }
  
  // API errors
  if (errorMessage.includes('api error') || errorMessage.includes('status') || errorMessage.includes('rate limit')) {
    return 'API_ERROR';
  }
  
  // Network errors
  if (errorMessage.includes('timeout') || errorMessage.includes('connection') || errorMessage.includes('network')) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * Main segmentation function
 * Retrieves extracted content, segments it, and stores the result
 */
export async function segmentContent(jobId: string): Promise<SegmentedContent> {
  const startTime = Date.now();
  const correlationId = `seg-${jobId}-${uuidv4()}`;
  
  try {
    logger.info('Starting content segmentation', { 
      jobId,
      correlationId,
    });
    
    // Import dynamodb functions here to avoid circular dependencies
    const { getContent, updateContent } = require('./dynamodb');
    
    // Retrieve extracted content from database
    let contentRecord;
    try {
      contentRecord = await getContent(jobId);
    } catch (dbError) {
      logger.error('Failed to retrieve content from database', {
        jobId,
        error: dbError,
        errorMessage: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
      throw new Error(`Database error: Failed to retrieve content for job ${jobId}`);
    }
    
    if (!contentRecord) {
      logger.error('Content record not found', { jobId });
      throw new Error(`No content record found for job: ${jobId}`);
    }
    
    if (!contentRecord.extractedContent) {
      logger.error('Extracted content missing from record', {
        jobId,
        recordKeys: Object.keys(contentRecord),
      });
      throw new Error(`No extracted content found for job: ${jobId}`);
    }
    
    const extractedContent = contentRecord.extractedContent;
    
    logger.info('Retrieved extracted content', {
      jobId,
      pageCount: extractedContent.pages.length,
      figureCount: extractedContent.figures.length,
      tableCount: extractedContent.tables.length,
      formulaCount: extractedContent.formulas.length,
      citationCount: extractedContent.citations.length,
    });
    
    // Create segmentation prompt
    let prompt: string;
    try {
      prompt = createSegmentationPrompt(extractedContent);
      logger.info('Created segmentation prompt', {
        jobId,
        promptLength: prompt.length,
      });
    } catch (promptError) {
      logger.error('Failed to create segmentation prompt', {
        jobId,
        error: promptError,
        errorMessage: promptError instanceof Error ? promptError.message : 'Unknown error',
      });
      throw new Error(`Failed to create segmentation prompt: ${promptError instanceof Error ? promptError.message : 'Unknown error'}`);
    }
    
    // Call LLM for segmentation (includes retry logic)
    let llmResponse: LLMSegmentationResponse;
    try {
      llmResponse = await callSegmentationLLM(prompt, correlationId);
    } catch (llmError) {
      logger.error('LLM segmentation call failed after retries', {
        jobId,
        correlationId,
        error: llmError,
        errorMessage: llmError instanceof Error ? llmError.message : 'Unknown error',
      });
      // Re-throw with context
      throw new Error(`LLM segmentation failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`);
    }
    
    // Parse LLM response and apply dependency-based ordering
    let segments;
    try {
      segments = parseSegmentationResponse(llmResponse, extractedContent);
      logger.info('Parsed segmentation response', {
        jobId,
        segmentCount: segments.length,
      });
    } catch (parseError) {
      logger.error('Failed to parse segmentation response', {
        jobId,
        error: parseError,
        errorMessage: parseError instanceof Error ? parseError.message : 'Unknown error',
        segmentCount: llmResponse.segments.length,
      });
      throw new Error(`Failed to parse segmentation response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    const segmentedContent: SegmentedContent = {
      segments,
    };
    
    // Store segmented content in database
    try {
      await updateContent(jobId, {
        segmentedContent,
      });
      logger.info('Stored segmented content in database', {
        jobId,
        segmentCount: segments.length,
      });
    } catch (dbError) {
      logger.error('Failed to store segmented content in database', {
        jobId,
        error: dbError,
        errorMessage: dbError instanceof Error ? dbError.message : 'Unknown error',
        segmentCount: segments.length,
      });
      throw new Error(`Database error: Failed to store segmented content for job ${jobId}`);
    }
    
    const totalDuration = Date.now() - startTime;
    
    logger.info('Content segmentation completed successfully', {
      jobId,
      segmentCount: segments.length,
      totalDuration,
    });
    
    return segmentedContent;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    logger.error('Content segmentation failed', {
      jobId,
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      duration: totalDuration,
    });
    
    throw error;
  }
}

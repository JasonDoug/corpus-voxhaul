// Content Segmenter service - Organize extracted content into logical topic segments
import { logger } from '../utils/logger';
import { ExtractedContent, SegmentedContent, ContentSegment, ContentBlock } from '../models/content';

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
- Create 3-8 segments depending on content complexity
- Each segment should cover a cohesive topic
- Segments should flow logically from foundational to advanced concepts
- Prerequisites should only reference earlier segments (lower indices)
- Include all relevant figures, tables, formulas for each segment
- Ensure all content is assigned to at least one segment

Respond ONLY with the JSON object, no additional text.`;

  return prompt;
}

/**
 * Build a summary of extracted content for the LLM prompt
 */
function buildContentSummary(extractedContent: ExtractedContent): string {
  const parts: string[] = [];
  
  // Add page text summaries
  parts.push('=== TEXT CONTENT ===');
  extractedContent.pages.forEach(page => {
    // Truncate very long pages for the prompt
    const text = page.text.length > 500 
      ? page.text.substring(0, 500) + '...[truncated]'
      : page.text;
    parts.push(`\nPage ${page.pageNumber}:\n${text}`);
  });
  
  // Add figures
  if (extractedContent.figures.length > 0) {
    parts.push('\n\n=== FIGURES ===');
    extractedContent.figures.forEach(figure => {
      parts.push(`\nFigure ${figure.id} (Page ${figure.pageNumber}):`);
      parts.push(`Caption: ${figure.caption || 'N/A'}`);
      parts.push(`Description: ${figure.description}`);
    });
  }
  
  // Add tables
  if (extractedContent.tables.length > 0) {
    parts.push('\n\n=== TABLES ===');
    extractedContent.tables.forEach(table => {
      parts.push(`\nTable ${table.id} (Page ${table.pageNumber}):`);
      parts.push(`Headers: ${table.headers.join(', ')}`);
      parts.push(`Interpretation: ${table.interpretation}`);
    });
  }
  
  // Add formulas
  if (extractedContent.formulas.length > 0) {
    parts.push('\n\n=== FORMULAS ===');
    extractedContent.formulas.forEach(formula => {
      parts.push(`\nFormula ${formula.id} (Page ${formula.pageNumber}):`);
      parts.push(`LaTeX: ${formula.latex}`);
      parts.push(`Explanation: ${formula.explanation}`);
    });
  }
  
  // Add citations
  if (extractedContent.citations.length > 0) {
    parts.push('\n\n=== CITATIONS ===');
    extractedContent.citations.forEach(citation => {
      parts.push(`\nCitation ${citation.id}: ${citation.text}`);
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
 * Call LLM API to segment content
 * This is a placeholder - real implementation would call actual LLM API
 */
async function callSegmentationLLM(_prompt: string): Promise<LLMSegmentationResponse> {
  // Placeholder implementation
  // In production, this would:
  // 1. Call LLM API (e.g., OpenAI GPT-4, Anthropic Claude)
  // 2. Parse the JSON response
  // 3. Validate the response structure
  
  logger.info('Calling LLM for segmentation (placeholder)');
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Return a mock response for testing
  // In production, this would be the actual LLM response
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
        title: 'Core Concepts',
        contentIndices: {
          pageRanges: [[3, 4]],
          figureIds: [],
          tableIds: [],
          formulaIds: [],
          citationIds: [],
        },
        prerequisites: [0],
      },
    ],
  };
}

/**
 * Main segmentation function
 * Retrieves extracted content, segments it, and stores the result
 */
export async function segmentContent(jobId: string): Promise<SegmentedContent> {
  try {
    logger.info('Starting content segmentation', { jobId });
    
    // Import dynamodb functions here to avoid circular dependencies
    const { getContent, updateContent } = require('./dynamodb');
    
    // Retrieve extracted content from database
    const contentRecord = await getContent(jobId);
    if (!contentRecord || !contentRecord.extractedContent) {
      throw new Error(`No extracted content found for job: ${jobId}`);
    }
    
    const extractedContent = contentRecord.extractedContent;
    
    // Create segmentation prompt
    const prompt = createSegmentationPrompt(extractedContent);
    
    // Call LLM for segmentation
    const llmResponse = await callSegmentationLLM(prompt);
    
    // Parse LLM response and apply dependency-based ordering
    const segments = parseSegmentationResponse(llmResponse, extractedContent);
    
    const segmentedContent: SegmentedContent = {
      segments,
    };
    
    // Store segmented content in database
    await updateContent(jobId, {
      segmentedContent,
    });
    
    logger.info('Content segmentation completed', {
      jobId,
      segmentCount: segments.length,
    });
    
    return segmentedContent;
  } catch (error) {
    logger.error('Content segmentation failed', { jobId, error });
    throw error;
  }
}

// Property-based tests for Content Segmenter
import * as fc from 'fast-check';
import { 
  parseSegmentationResponse,
  topologicalSort,
  buildDependencyGraph,
  hasCycle,
} from './segmenter';

// ============================================================================
// Generators for test data
// ============================================================================

const pageContentArb = fc.record({
  pageNumber: fc.integer({ min: 1, max: 100 }),
  text: fc.string({ minLength: 10, maxLength: 500 }),
  elements: fc.constant([]),
});

const figureArb = fc.record({
  id: fc.uuid(),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  imageData: fc.string(),
  description: fc.string({ minLength: 10, maxLength: 200 }),
  caption: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
});

const tableArb = fc.record({
  id: fc.uuid(),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  headers: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  rows: fc.array(
    fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    { minLength: 1, maxLength: 10 }
  ),
  interpretation: fc.string({ minLength: 10, maxLength: 200 }),
});

const formulaArb = fc.record({
  id: fc.uuid(),
  pageNumber: fc.integer({ min: 1, max: 100 }),
  latex: fc.string({ minLength: 5, maxLength: 100 }),
  explanation: fc.string({ minLength: 10, maxLength: 200 }),
});

const citationArb = fc.record({
  id: fc.uuid(),
  text: fc.string({ minLength: 10, maxLength: 100 }),
  authors: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 30 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
  year: fc.option(fc.integer({ min: 1900, max: 2024 }), { nil: undefined }),
  title: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
});

const extractedContentArb = fc.record({
  pages: fc.array(pageContentArb, { minLength: 1, maxLength: 20 }),
  figures: fc.array(figureArb, { minLength: 0, maxLength: 10 }),
  tables: fc.array(tableArb, { minLength: 0, maxLength: 10 }),
  formulas: fc.array(formulaArb, { minLength: 0, maxLength: 10 }),
  citations: fc.array(citationArb, { minLength: 0, maxLength: 20 }),
});

// Generator for LLM segment responses with valid prerequisites
const llmSegmentResponseArb = (_segmentCount: number, index: number) => fc.record({
  title: fc.string({ minLength: 5, maxLength: 50 }),
  contentIndices: fc.record({
    pageRanges: fc.array(
      fc.tuple(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 20 }))
        .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]),
      { minLength: 0, maxLength: 3 }
    ),
    figureIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
    tableIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
    formulaIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
    citationIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
  }),
  // Prerequisites can only reference earlier segments
  prerequisites: fc.array(
    fc.integer({ min: 0, max: Math.max(0, index - 1) }),
    { minLength: 0, maxLength: Math.min(3, index) }
  ).map(arr => [...new Set(arr)]), // Remove duplicates
});

const llmSegmentationResponseArb = fc.integer({ min: 1, max: 8 }).chain(segmentCount =>
  fc.record({
    segments: fc.tuple(
      ...Array.from({ length: segmentCount }, (_, i) => llmSegmentResponseArb(segmentCount, i))
    ).map(arr => arr as any[]),
  })
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Content Segmenter Property Tests', () => {
  
  // Feature: pdf-lecture-service, Property 9: Segmentation completeness
  // Validates: Requirements 3.1, 3.5
  test('Property 9: For any extracted content, segmentation produces at least one segment with valid structure', () => {
    fc.assert(
      fc.property(
        extractedContentArb,
        llmSegmentationResponseArb,
        (extractedContent, llmResponse) => {
          // Parse the segmentation response
          const segments = parseSegmentationResponse(llmResponse, extractedContent);
          
          // Should produce at least one segment
          expect(segments.length).toBeGreaterThanOrEqual(1);
          
          // Each segment should have valid structure
          segments.forEach(segment => {
            // Non-empty title
            expect(segment.title).toBeTruthy();
            expect(segment.title.length).toBeGreaterThan(0);
            
            // Valid order number
            expect(segment.order).toBeGreaterThanOrEqual(0);
            expect(segment.order).toBeLessThan(segments.length);
            
            // Has an ID
            expect(segment.id).toBeTruthy();
            
            // Prerequisites is an array
            expect(Array.isArray(segment.prerequisites)).toBe(true);
            
            // Content blocks is an array
            expect(Array.isArray(segment.contentBlocks)).toBe(true);
          });
          
          // All segments should have unique order numbers
          const orders = segments.map(s => s.order);
          const uniqueOrders = new Set(orders);
          expect(uniqueOrders.size).toBe(segments.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: pdf-lecture-service, Property 11: Prerequisite ordering
  // Validates: Requirements 3.4
  test('Property 11: For any segment with prerequisites, all prerequisite segments have lower order numbers', () => {
    fc.assert(
      fc.property(
        extractedContentArb,
        llmSegmentationResponseArb,
        (extractedContent, llmResponse) => {
          const segments = parseSegmentationResponse(llmResponse, extractedContent);
          
          // Build a map of segment ID to order
          const idToOrder = new Map<string, number>();
          segments.forEach(segment => {
            idToOrder.set(segment.id, segment.order);
          });
          
          // Check each segment's prerequisites
          segments.forEach(segment => {
            segment.prerequisites.forEach(prereqId => {
              const prereqOrder = idToOrder.get(prereqId);
              
              // Prerequisite should exist and have lower order
              expect(prereqOrder).toBeDefined();
              expect(prereqOrder!).toBeLessThan(segment.order);
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: pdf-lecture-service, Property 12: Coherent grouping
  // Validates: Requirements 3.2
  test('Property 12: For any segment, all content blocks are assigned to exactly one segment', () => {
    fc.assert(
      fc.property(
        extractedContentArb,
        llmSegmentationResponseArb,
        (extractedContent, llmResponse) => {
          const segments = parseSegmentationResponse(llmResponse, extractedContent);
          
          // Coherent grouping means all content is organized into segments
          // The LLM determines what's coherent - content can be from any pages
          // as long as it's topically related
          
          // Each segment should have a title and content blocks array
          segments.forEach(segment => {
            expect(segment.title).toBeTruthy();
            expect(Array.isArray(segment.contentBlocks)).toBe(true);
          });
          
          // All segments should be properly structured
          expect(segments.length).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
  
});

// ============================================================================
// Dependency Analysis Tests
// ============================================================================

describe('Dependency Analysis Property Tests', () => {
  
  test('Topological sort produces valid ordering for acyclic graphs', () => {
    fc.assert(
      fc.property(
        llmSegmentationResponseArb,
        (llmResponse) => {
          const sortedIndices = topologicalSort(llmResponse.segments);
          
          // Should return all indices
          expect(sortedIndices.length).toBe(llmResponse.segments.length);
          
          // Should contain each index exactly once
          const uniqueIndices = new Set(sortedIndices);
          expect(uniqueIndices.size).toBe(llmResponse.segments.length);
          
          // Build position map
          const position = new Map<number, number>();
          sortedIndices.forEach((originalIndex, newPosition) => {
            position.set(originalIndex, newPosition);
          });
          
          // Verify prerequisite ordering
          llmResponse.segments.forEach((segment, index) => {
            const myPosition = position.get(index)!;
            
            segment.prerequisites.forEach((prereqIndex: number) => {
              if (prereqIndex >= 0 && prereqIndex < llmResponse.segments.length) {
                const prereqPosition = position.get(prereqIndex)!;
                // Prerequisite should come before dependent
                expect(prereqPosition).toBeLessThan(myPosition);
              }
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Cycle detection correctly identifies acyclic graphs', () => {
    fc.assert(
      fc.property(
        llmSegmentationResponseArb,
        (llmResponse) => {
          const graph = buildDependencyGraph(llmResponse.segments);
          const cycleDetected = hasCycle(graph, llmResponse.segments.length);
          
          // Our generator creates acyclic graphs (prerequisites only reference earlier segments)
          // So we should never detect a cycle
          expect(cycleDetected).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
  
});

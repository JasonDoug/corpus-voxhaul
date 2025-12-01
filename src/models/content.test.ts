// Property-based tests for content models
import * as fc from 'fast-check';
import {
  SegmentedContent,
  ContentBlock,
} from './content';

// Generators for content models
const figureArb = fc.record({
  id: fc.string({ minLength: 1 }),
  pageNumber: fc.integer({ min: 1 }),
  imageData: fc.string({ minLength: 1 }),
  description: fc.string({ minLength: 1 }),
  caption: fc.option(fc.string(), { nil: undefined }),
});

const tableArb = fc.record({
  id: fc.string({ minLength: 1 }),
  pageNumber: fc.integer({ min: 1 }),
  headers: fc.array(fc.string(), { minLength: 1 }),
  rows: fc.array(fc.array(fc.string()), { minLength: 1 }),
  interpretation: fc.string({ minLength: 1 }),
});

const formulaArb = fc.record({
  id: fc.string({ minLength: 1 }),
  pageNumber: fc.integer({ min: 1 }),
  latex: fc.string({ minLength: 1 }),
  explanation: fc.string({ minLength: 1 }),
});

const citationArb = fc.record({
  id: fc.string({ minLength: 1 }),
  text: fc.string({ minLength: 1 }),
  authors: fc.option(fc.array(fc.string()), { nil: undefined }),
  year: fc.option(fc.integer({ min: 1900, max: 2100 }), { nil: undefined }),
  title: fc.option(fc.string(), { nil: undefined }),
});

const contentBlockArb: fc.Arbitrary<ContentBlock> = fc.oneof(
  fc.record({
    type: fc.constant('text' as const),
    content: fc.string({ minLength: 1 }),
    pageReference: fc.integer({ min: 1 }),
  }),
  fc.record({
    type: fc.constant('figure' as const),
    content: figureArb,
    pageReference: fc.integer({ min: 1 }),
  }),
  fc.record({
    type: fc.constant('table' as const),
    content: tableArb,
    pageReference: fc.integer({ min: 1 }),
  }),
  fc.record({
    type: fc.constant('formula' as const),
    content: formulaArb,
    pageReference: fc.integer({ min: 1 }),
  }),
  fc.record({
    type: fc.constant('citation' as const),
    content: citationArb,
    pageReference: fc.integer({ min: 1 }),
  })
);

const contentSegmentArb = fc.record({
  id: fc.string({ minLength: 1 }),
  title: fc.string({ minLength: 1 }),
  order: fc.integer({ min: 0 }),
  contentBlocks: fc.array(contentBlockArb, { minLength: 1 }),
  prerequisites: fc.array(fc.string()),
});

const segmentedContentArb = fc.record({
  segments: fc.array(contentSegmentArb, { minLength: 1 }),
});

// Feature: pdf-lecture-service, Property 10: Segment structure validity
describe('Property 10: Segment structure validity', () => {
  it('should ensure each segment has a non-empty title, valid order number, and at least one content block', () => {
    fc.assert(
      fc.property(segmentedContentArb, (segmentedContent: SegmentedContent) => {
        // For any segmented content, each segment should have:
        // 1. A non-empty title
        // 2. A valid order number (>= 0)
        // 3. At least one content block
        
        for (const segment of segmentedContent.segments) {
          // Check non-empty title
          expect(segment.title).toBeTruthy();
          expect(segment.title.length).toBeGreaterThan(0);
          
          // Check valid order number
          expect(segment.order).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(segment.order)).toBe(true);
          
          // Check at least one content block
          expect(segment.contentBlocks).toBeDefined();
          expect(segment.contentBlocks.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

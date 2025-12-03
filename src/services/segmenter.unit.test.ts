// Unit tests for Content Segmenter
import {
  topologicalSort,
  buildDependencyGraph,
  hasCycle,
  createSegmentationPrompt,
} from './segmenter';
import { ExtractedContent } from '../models/content';

describe('Content Segmenter Unit Tests', () => {
  
  describe('Topological Sort', () => {
    
    test('handles simple linear dependency chain', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
        { title: 'C', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [1] },
      ];
      
      const sorted = topologicalSort(segments);
      
      expect(sorted).toEqual([0, 1, 2]);
    });
    
    test('handles multiple independent segments', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'C', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
      ];
      
      const sorted = topologicalSort(segments);
      
      // All segments are independent, so any order is valid
      expect(sorted.length).toBe(3);
      expect(new Set(sorted).size).toBe(3);
    });
    
    test('handles diamond dependency pattern', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
        { title: 'C', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
        { title: 'D', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [1, 2] },
      ];
      
      const sorted = topologicalSort(segments);
      
      // A must come first, D must come last
      expect(sorted[0]).toBe(0);
      expect(sorted[3]).toBe(3);
      // B and C can be in any order in the middle
      expect(sorted.slice(1, 3).sort()).toEqual([1, 2]);
    });
    
    test('handles circular dependencies with fallback', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [1] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
      ];
      
      const sorted = topologicalSort(segments);
      
      // Should fall back to original order when cycle detected
      expect(sorted).toEqual([0, 1]);
    });
    
    test('handles single segment', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
      ];
      
      const sorted = topologicalSort(segments);
      
      expect(sorted).toEqual([0]);
    });
    
  });
  
  describe('Dependency Graph', () => {
    
    test('builds correct adjacency list', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
        { title: 'C', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [0] },
      ];
      
      const graph = buildDependencyGraph(segments);
      
      expect(graph.get(0)).toEqual([1, 2]);
      expect(graph.get(1)).toEqual([]);
      expect(graph.get(2)).toEqual([]);
    });
    
    test('handles empty prerequisites', () => {
      const segments = [
        { title: 'A', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
        { title: 'B', contentIndices: { pageRanges: [], figureIds: [], tableIds: [], formulaIds: [], citationIds: [] }, prerequisites: [] },
      ];
      
      const graph = buildDependencyGraph(segments);
      
      expect(graph.get(0)).toEqual([]);
      expect(graph.get(1)).toEqual([]);
    });
    
  });
  
  describe('Cycle Detection', () => {
    
    test('detects simple cycle', () => {
      const graph = new Map<number, number[]>();
      graph.set(0, [1]);
      graph.set(1, [0]);
      
      expect(hasCycle(graph, 2)).toBe(true);
    });
    
    test('detects no cycle in acyclic graph', () => {
      const graph = new Map<number, number[]>();
      graph.set(0, [1]);
      graph.set(1, [2]);
      graph.set(2, []);
      
      expect(hasCycle(graph, 3)).toBe(false);
    });
    
    test('detects cycle in complex graph', () => {
      const graph = new Map<number, number[]>();
      graph.set(0, [1]);
      graph.set(1, [2]);
      graph.set(2, [3]);
      graph.set(3, [1]); // Cycle: 1 -> 2 -> 3 -> 1
      
      expect(hasCycle(graph, 4)).toBe(true);
    });
    
    test('handles disconnected graph', () => {
      const graph = new Map<number, number[]>();
      graph.set(0, [1]);
      graph.set(1, []);
      graph.set(2, [3]);
      graph.set(3, []);
      
      expect(hasCycle(graph, 4)).toBe(false);
    });
    
  });
  
  describe('Segmentation Prompt', () => {
    
    test('creates prompt with all content types', () => {
      const extractedContent: ExtractedContent = {
        pages: [
          { pageNumber: 1, text: 'Introduction text', elements: [] },
          { pageNumber: 2, text: 'Methods text', elements: [] },
        ],
        figures: [
          { id: 'fig1', pageNumber: 1, imageData: 'data', description: 'A chart', caption: 'Figure 1' },
        ],
        tables: [
          { id: 'tab1', pageNumber: 2, headers: ['A', 'B'], rows: [['1', '2']], interpretation: 'Data table' },
        ],
        formulas: [
          { id: 'form1', pageNumber: 1, latex: 'E=mc^2', explanation: 'Energy equation' },
        ],
        citations: [
          { id: 'cit1', text: 'Smith et al. (2020)', authors: ['Smith'], year: 2020 },
        ],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      // Check for enhanced prompt structure
      expect(prompt).toContain('DOCUMENT OVERVIEW');
      expect(prompt).toContain('Total Pages: 2');
      expect(prompt).toContain('PAGE SUMMARIES');
      expect(prompt).toContain('Page 1');
      expect(prompt).toContain('Introduction text');
      expect(prompt).toContain('FIGURE INVENTORY');
      expect(prompt).toContain('Figure 1');
      expect(prompt).toContain('DETAILED FIGURE DESCRIPTIONS');
      expect(prompt).toContain('A chart');
      expect(prompt).toContain('TABLE INVENTORY');
      expect(prompt).toContain('DETAILED TABLE DESCRIPTIONS');
      expect(prompt).toContain('Data table');
      expect(prompt).toContain('FORMULA INVENTORY');
      expect(prompt).toContain('DETAILED FORMULA DESCRIPTIONS');
      expect(prompt).toContain('E=mc^2');
      expect(prompt).toContain('CITATION CONTEXT');
      expect(prompt).toContain('Smith et al. (2020)');
    });
    
    test('handles content with no figures or tables', () => {
      const extractedContent: ExtractedContent = {
        pages: [
          { pageNumber: 1, text: 'Simple text', elements: [] },
        ],
        figures: [],
        tables: [],
        formulas: [],
        citations: [],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      // Check for enhanced prompt structure
      expect(prompt).toContain('DOCUMENT OVERVIEW');
      expect(prompt).toContain('PAGE SUMMARIES');
      expect(prompt).toContain('Simple text');
      // Should not contain inventory sections when no elements exist
      expect(prompt).not.toContain('FIGURE INVENTORY');
      expect(prompt).not.toContain('TABLE INVENTORY');
    });
    
    test('truncates very long page text', () => {
      const longText = 'a'.repeat(1000);
      const extractedContent: ExtractedContent = {
        pages: [
          { pageNumber: 1, text: longText, elements: [] },
        ],
        figures: [],
        tables: [],
        formulas: [],
        citations: [],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      // Should truncate the long text with enhanced format
      expect(prompt).toContain('[truncated');
      expect(prompt).toContain('chars remaining]');
      // The full text should not be in the prompt
      expect(prompt).not.toContain(longText);
    });
    
  });
  
});

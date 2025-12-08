// Unit tests for LLM integration in Content Segmenter
// Tests prompt construction, JSON parsing, validation, and error handling
import { createSegmentationPrompt, callSegmentationLLM } from './segmenter';
import { ExtractedContent } from '../models/content';
import * as llmModule from './llm';

// Mock the LLM service
jest.mock('./llm', () => ({
  llmService: {
    chat: jest.fn(),
    getProvider: jest.fn(() => 'openrouter'),
  },
  getRecommendedModel: jest.fn(() => 'anthropic/claude-3-opus'),
}));

describe('Segmentation LLM Integration Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Test 1: Prompt Construction
  // ============================================================================
  
  describe('Prompt Construction', () => {
    
    test('creates comprehensive prompt with all content types', () => {
      const extractedContent: ExtractedContent = {
        pages: [
          { pageNumber: 1, text: 'Introduction to quantum mechanics', elements: [] },
          { pageNumber: 2, text: 'Wave-particle duality explained', elements: [] },
        ],
        figures: [
          { 
            id: 'fig1', 
            pageNumber: 1, 
            imageData: 'data:image/png;base64,test', 
            description: 'Quantum wave function', 
            caption: 'Figure 1: Wave function' 
          },
        ],
        tables: [
          { 
            id: 'tab1', 
            pageNumber: 2, 
            headers: ['Property', 'Value'], 
            rows: [['Mass', '9.1e-31 kg']], 
            interpretation: 'Electron properties' 
          },
        ],
        formulas: [
          { 
            id: 'form1', 
            pageNumber: 1, 
            latex: 'E = mc^2', 
            explanation: 'Energy-mass equivalence' 
          },
        ],
        citations: [
          { 
            id: 'cit1', 
            text: 'Einstein (1905)', 
            authors: ['Einstein'], 
            year: 1905,
            title: 'On the Electrodynamics of Moving Bodies'
          },
        ],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      // Verify all sections are present
      expect(prompt).toContain('DOCUMENT OVERVIEW');
      expect(prompt).toContain('Total Pages: 2');
      expect(prompt).toContain('Figures: 1');
      expect(prompt).toContain('Tables: 1');
      expect(prompt).toContain('Formulas: 1');
      expect(prompt).toContain('Citations: 1');
      
      expect(prompt).toContain('FIGURE INVENTORY');
      expect(prompt).toContain('fig1');
      expect(prompt).toContain('Figure 1: Wave function');
      
      expect(prompt).toContain('TABLE INVENTORY');
      expect(prompt).toContain('tab1');
      expect(prompt).toContain('Property, Value');
      
      expect(prompt).toContain('FORMULA INVENTORY');
      expect(prompt).toContain('form1');
      expect(prompt).toContain('E = mc^2'); // Note: space added by implementation
      
      expect(prompt).toContain('CITATION CONTEXT');
      expect(prompt).toContain('Einstein (1905)');
      
      expect(prompt).toContain('PAGE SUMMARIES');
      expect(prompt).toContain('Page 1');
      expect(prompt).toContain('Introduction to quantum mechanics');
    });

    
    test('handles minimal content with only pages', () => {
      const extractedContent: ExtractedContent = {
        pages: [
          { pageNumber: 1, text: 'Simple document', elements: [] },
        ],
        figures: [],
        tables: [],
        formulas: [],
        citations: [],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      expect(prompt).toContain('DOCUMENT OVERVIEW');
      expect(prompt).toContain('Total Pages: 1');
      expect(prompt).toContain('Figures: 0');
      expect(prompt).toContain('PAGE SUMMARIES');
      expect(prompt).toContain('Simple document');
      
      // Should not contain inventory sections for empty arrays
      expect(prompt).not.toContain('FIGURE INVENTORY');
      expect(prompt).not.toContain('TABLE INVENTORY');
    });
    
    test('truncates very long page text appropriately', () => {
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
      
      expect(prompt).toContain('[truncated');
      expect(prompt).toContain('chars remaining]');
      // Prompt should be significantly shorter than including full text
      // The prompt includes template text, so we check it's less than full text + reasonable overhead
      expect(prompt.length).toBeLessThan(longText.length + 2000);
    });
    
    test('includes complexity estimation', () => {
      const extractedContent: ExtractedContent = {
        pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
        figures: Array(10).fill(null).map((_, i) => ({
          id: `fig${i}`,
          pageNumber: 1,
          imageData: 'data',
          description: 'desc',
        })),
        tables: Array(5).fill(null).map((_, i) => ({
          id: `tab${i}`,
          pageNumber: 1,
          headers: ['A'],
          rows: [['1']],
          interpretation: 'test',
        })),
        formulas: [],
        citations: [],
      };
      
      const prompt = createSegmentationPrompt(extractedContent);
      
      // 10 figures + 5 tables = 15 elements
      // According to implementation: >15 = High, >8 = Medium, else Low
      // 15 is not > 15, so it's Medium
      expect(prompt).toContain('Estimated Complexity: Medium');
    });
  });

  
  // ============================================================================
  // Test 2: JSON Parsing with Valid Responses
  // ============================================================================
  
  describe('JSON Parsing with Valid Responses', () => {
    
    test('parses valid LLM response with single segment', async () => {
      const validResponse = {
        segments: [
          {
            title: 'Introduction',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: ['fig1'],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(validResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      const result = await callSegmentationLLM('test prompt');
      
      expect(result).toEqual(validResponse);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].title).toBe('Introduction');
    });
    
    test('parses valid LLM response with multiple segments and prerequisites', async () => {
      const validResponse = {
        segments: [
          {
            title: 'Basics',
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
            title: 'Advanced Topics',
            contentIndices: {
              pageRanges: [[3, 5]],
              figureIds: ['fig1', 'fig2'],
              tableIds: ['tab1'],
              formulaIds: ['form1'],
              citationIds: ['cit1'],
            },
            prerequisites: [0],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(validResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      });
      
      const result = await callSegmentationLLM('test prompt');
      
      expect(result.segments).toHaveLength(2);
      expect(result.segments[1].prerequisites).toEqual([0]);
      expect(result.segments[1].contentIndices.figureIds).toEqual(['fig1', 'fig2']);
    });

    
    test('handles response with optional fields missing (filled with defaults)', async () => {
      const responseWithMissingOptionals = {
        segments: [
          {
            title: 'Section 1',
            contentIndices: {
              pageRanges: [[1, 1]],
              // Missing optional arrays - should be filled with empty arrays
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(responseWithMissingOptionals),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      const result = await callSegmentationLLM('test prompt');
      
      // Validation should fill in missing arrays
      expect(result.segments[0].contentIndices.figureIds).toEqual([]);
      expect(result.segments[0].contentIndices.tableIds).toEqual([]);
      expect(result.segments[0].contentIndices.formulaIds).toEqual([]);
      expect(result.segments[0].contentIndices.citationIds).toEqual([]);
    });
  });

  
  // ============================================================================
  // Test 3: Validation Logic
  // ============================================================================
  
  describe('Validation Logic', () => {
    
    test('rejects response with missing segments array', async () => {
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify({ data: 'invalid' }),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segmentation response: missing or invalid segments array');
    });
    
    test('rejects response with non-array segments', async () => {
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify({ segments: 'not an array' }),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segmentation response: missing or invalid segments array');
    });
    
    test('rejects response with empty segments array', async () => {
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify({ segments: [] }),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segmentation response: segments array is empty');
    });
    
    test('rejects segment with missing title', async () => {
      const invalidResponse = {
        segments: [
          {
            // Missing title
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segment 0: missing or invalid title');
    });

    
    test('rejects segment with empty title', async () => {
      const invalidResponse = {
        segments: [
          {
            title: '   ', // Empty/whitespace title
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segment 0: title cannot be empty');
    });
    
    test('rejects segment with missing contentIndices', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            // Missing contentIndices
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Invalid segment 0: missing contentIndices');
    });
    
    test('rejects segment with invalid pageRanges structure', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: 'not an array',
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('contentIndices.pageRanges must be an array');
    });

    
    test('rejects invalid page range format', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[1]], // Should be [start, end]
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('pageRanges[0] must be an array of [startPage, endPage]');
    });
    
    test('rejects page range with invalid page numbers', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[0, 5]], // Pages must be >= 1
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('page numbers must be >= 1');
    });
    
    test('rejects page range where start > end', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[5, 2]], // Start > end
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('startPage cannot be greater than endPage');
    });

    
    test('rejects non-array ID fields', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: 'not an array',
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('contentIndices.figureIds must be an array');
    });
    
    test('rejects non-string IDs in ID arrays', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [123], // Should be strings
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('contentIndices.figureIds[0] must be a string');
    });
    
    test('rejects non-array prerequisites', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Valid Title',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: 'not an array',
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('prerequisites must be an array');
    });

    
    test('rejects non-number prerequisite indices', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Segment 1',
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
            title: 'Segment 2',
            contentIndices: {
              pageRanges: [[3, 4]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: ['not a number'],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('prerequisites[0] must be a number');
    });
    
    test('rejects negative prerequisite indices', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Segment 1',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [-1],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('prerequisite indices must be non-negative');
    });
    
    test('rejects out-of-bounds prerequisite indices', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Segment 1',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [5], // Only 1 segment exists
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('prerequisite index 5 is out of bounds');
    });

    
    test('rejects self-referential prerequisites', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Segment 1',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [0], // Self-reference
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('segment cannot be a prerequisite of itself');
    });
  });

  
  // ============================================================================
  // Test 4: Error Handling
  // ============================================================================
  
  describe('Error Handling', () => {
    
    test('handles JSON parsing errors gracefully', async () => {
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: 'This is not valid JSON {broken',
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('LLM returned invalid JSON response');
    });
    
    test('handles LLM API errors', async () => {
      (llmModule.llmService.chat as jest.Mock).mockRejectedValue(
        new Error('API rate limit exceeded')
      );
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('LLM API error during segmentation');
    });
    
    test('handles network timeout errors', async () => {
      (llmModule.llmService.chat as jest.Mock).mockRejectedValue(
        new Error('Request timeout after 30s')
      );
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('Failed to segment content');
    });
    
    test('provides detailed error context for validation failures', async () => {
      const invalidResponse = {
        segments: [
          {
            title: 'Test',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [99], // Out of bounds
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(invalidResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(callSegmentationLLM('test prompt'))
        .rejects.toThrow('prerequisite index 99 is out of bounds');
    });
  });

  
  // ============================================================================
  // Test 5: LLM Service Integration
  // ============================================================================
  
  describe('LLM Service Integration', () => {
    
    test('calls LLM service with correct parameters', async () => {
      const validResponse = {
        segments: [
          {
            title: 'Test Segment',
            contentIndices: {
              pageRanges: [[1, 2]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(validResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await callSegmentationLLM('test prompt content');
      
      expect(llmModule.llmService.chat).toHaveBeenCalledTimes(1);
      
      const callArgs = (llmModule.llmService.chat as jest.Mock).mock.calls[0][0];
      
      // Verify request structure
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toBe('test prompt content');
      
      // Verify parameters
      expect(callArgs.model).toBe('anthropic/claude-3-opus');
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.maxTokens).toBe(2000);
    });
    
    test('uses recommended model from getRecommendedModel', async () => {
      const validResponse = {
        segments: [
          {
            title: 'Test',
            contentIndices: {
              pageRanges: [[1, 1]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(validResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await callSegmentationLLM('test');
      
      expect(llmModule.getRecommendedModel).toHaveBeenCalledWith(
        'segmentation',
        'openrouter'
      );
    });
    
    test('includes system prompt with segmentation instructions', async () => {
      const validResponse = {
        segments: [
          {
            title: 'Test',
            contentIndices: {
              pageRanges: [[1, 1]],
              figureIds: [],
              tableIds: [],
              formulaIds: [],
              citationIds: [],
            },
            prerequisites: [],
          },
        ],
      };
      
      (llmModule.llmService.chat as jest.Mock).mockResolvedValue({
        content: JSON.stringify(validResponse),
        model: 'anthropic/claude-3-opus',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await callSegmentationLLM('test');
      
      const callArgs = (llmModule.llmService.chat as jest.Mock).mock.calls[0][0];
      const systemPrompt = callArgs.messages[0].content;
      
      // Verify system prompt contains key instructions
      expect(systemPrompt).toContain('expert at analyzing scientific documents');
      expect(systemPrompt).toContain('logical segments');
      expect(systemPrompt).toContain('JSON');
      expect(systemPrompt).toContain('segments');
      expect(systemPrompt).toContain('contentIndices');
      expect(systemPrompt).toContain('prerequisites');
    });
  });
});

// Error handling tests for Content Segmenter
import { segmentContent } from './segmenter';
import { llmService } from './llm';
import { logger } from '../utils/logger';

// Mock dependencies
jest.mock('./llm');
jest.mock('../utils/logger');
jest.mock('./dynamodb', () => ({
  getContent: jest.fn(),
  updateContent: jest.fn(),
}));

const mockLLMService = llmService as jest.Mocked<typeof llmService>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Content Segmenter Error Handling', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockLLMService.getProvider = jest.fn().mockReturnValue('openrouter');
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.warn = jest.fn();
  });
  
  describe('JSON Parsing Errors', () => {
    
    test('handles invalid JSON response from LLM', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      // Mock LLM to return invalid JSON
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: 'This is not valid JSON',
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('LLM returned invalid JSON response');
      
      // Verify error was logged with details
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse LLM response as JSON',
        expect.objectContaining({
          responsePreview: expect.any(String),
          responseLength: expect.any(Number),
        })
      );
    });
    
    test('handles JSON with missing segments array', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      // Mock LLM to return JSON without segments
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({ data: 'something else' }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('missing or invalid segments array');
      
      // Verify error was logged with structure details
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid segmentation response structure',
        expect.objectContaining({
          hasSegments: false,
          segmentsType: 'undefined',
        })
      );
    });
    
    test('handles empty segments array', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      // Mock LLM to return empty segments
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({ segments: [] }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('segments array is empty');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Empty segments array in response',
        expect.objectContaining({
          response: expect.objectContaining({
            segments: [],
          }),
        })
      );
    });
    
  });
  
  describe('Validation Errors', () => {
    
    test('handles segment with missing title', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              // Missing title
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
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('missing or invalid title');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid segment title',
        expect.objectContaining({
          segmentIndex: 0,
        })
      );
    });
    
    test('handles segment with invalid page range', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
              contentIndices: {
                pageRanges: [[5, 1]], // Invalid: start > end
                figureIds: [],
                tableIds: [],
                formulaIds: [],
                citationIds: [],
              },
              prerequisites: [],
            },
          ],
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('startPage cannot be greater than endPage');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid page range order',
        expect.objectContaining({
          segmentIndex: 0,
          startPage: 5,
          endPage: 1,
        })
      );
    });
    
    test('handles segment with invalid prerequisite index', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
              contentIndices: {
                pageRanges: [[1, 1]],
                figureIds: [],
                tableIds: [],
                formulaIds: [],
                citationIds: [],
              },
              prerequisites: [5], // Out of bounds
            },
          ],
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('prerequisite index 5 is out of bounds');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Prerequisite index out of bounds',
        expect.objectContaining({
          segmentIndex: 0,
          prerequisiteValue: 5,
        })
      );
    });
    
    test('handles segment with self-referential prerequisite', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
              contentIndices: {
                pageRanges: [[1, 1]],
                figureIds: [],
                tableIds: [],
                formulaIds: [],
                citationIds: [],
              },
              prerequisites: [0], // Self-reference
            },
          ],
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('segment cannot be a prerequisite of itself');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Self-referential prerequisite',
        expect.objectContaining({
          segmentIndex: 0,
        })
      );
    });
    
    test('handles segment with invalid ID types', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
              contentIndices: {
                pageRanges: [[1, 1]],
                figureIds: [123], // Should be string, not number
                tableIds: [],
                formulaIds: [],
                citationIds: [],
              },
              prerequisites: [],
            },
          ],
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('must be a string');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid ID type in array',
        expect.objectContaining({
          segmentIndex: 0,
          arrayName: 'figureIds',
        })
      );
    });
    
  });
  
  describe('Database Errors', () => {
    
    test('handles database retrieval failure', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('Database error: Failed to retrieve content');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to retrieve content from database',
        expect.objectContaining({
          jobId: 'test-job-id',
          errorMessage: 'Database connection failed',
        })
      );
    });
    
    test('handles missing content record', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue(null);
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('No content record found');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Content record not found',
        expect.objectContaining({
          jobId: 'test-job-id',
        })
      );
    });
    
    test('handles database storage failure', async () => {
      const { getContent, updateContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
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
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      updateContent.mockRejectedValue(new Error('Database write failed'));
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('Database error: Failed to store segmented content');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store segmented content in database',
        expect.objectContaining({
          jobId: 'test-job-id',
          errorMessage: 'Database write failed',
        })
      );
    });
    
  });
  
  describe('API Errors', () => {
    
    test('handles LLM API failure', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockRejectedValue(new Error('API rate limit exceeded'));
      
      await expect(segmentContent('test-job-id')).rejects.toThrow('LLM segmentation failed');
      
      // Verify the first error log from callSegmentationLLM
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Segmentation LLM call failed',
        expect.objectContaining({
          errorType: 'API_ERROR',
          errorMessage: 'API rate limit exceeded',
        })
      );
    });
    
  });
  
  describe('Logging and Metrics', () => {
    
    test('logs detailed information on success', async () => {
      const { getContent, updateContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [{ id: 'fig1', pageNumber: 1, imageData: 'data', description: 'test', caption: 'test' }],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          segments: [
            {
              title: 'Test Segment',
              contentIndices: {
                pageRanges: [[1, 1]],
                figureIds: ['fig1'],
                tableIds: [],
                formulaIds: [],
                citationIds: [],
              },
              prerequisites: [],
            },
          ],
        }),
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      updateContent.mockResolvedValue({});
      
      await segmentContent('test-job-id');
      
      // Verify comprehensive logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieved extracted content',
        expect.objectContaining({
          jobId: 'test-job-id',
          pageCount: 1,
          figureCount: 1,
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Calling LLM for content segmentation',
        expect.objectContaining({
          provider: 'openrouter',
          promptLength: expect.any(Number),
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Content segmentation completed successfully',
        expect.objectContaining({
          jobId: 'test-job-id',
          segmentCount: 1,
          totalDuration: expect.any(Number),
        })
      );
    });
    
    test('logs error context on failure', async () => {
      const { getContent } = require('./dynamodb');
      
      getContent.mockResolvedValue({
        extractedContent: {
          pages: [{ pageNumber: 1, text: 'Test', elements: [] }],
          figures: [],
          tables: [],
          formulas: [],
          citations: [],
        },
      });
      
      mockLLMService.chat = jest.fn().mockResolvedValue({
        content: 'Invalid JSON',
        model: 'test-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      
      await expect(segmentContent('test-job-id')).rejects.toThrow();
      
      // Verify error logging includes context
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Segmentation LLM call failed',
        expect.objectContaining({
          errorType: 'JSON_PARSE_ERROR',
          provider: 'openrouter',
          promptLength: expect.any(Number),
        })
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Content segmentation failed',
        expect.objectContaining({
          jobId: 'test-job-id',
          duration: expect.any(Number),
        })
      );
    });
    
  });
  
});

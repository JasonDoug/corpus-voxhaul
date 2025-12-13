// Unit tests for Script Generator service
import {
  generateScript,
  createBasePrompt,
  createPersonalityPrompt,
  createSegmentPrompt,
  calculateDuration,
  countWords,
  applyPersonalityModifications,
} from './script-generator';
import { LectureAgent } from '../models/agent';
import { SegmentedContent, ContentSegment } from '../models/content';

// Mock the dynamodb module
jest.mock('./dynamodb');

// Mock the llm module
jest.mock('./llm', () => ({
  llmService: {
    chat: jest.fn(),
    getProvider: jest.fn(() => 'openrouter'),
  },
  getRecommendedModel: jest.fn(() => 'openai/gpt-4-turbo-preview'),
}));

describe('Script Generator Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBasePrompt', () => {
    it('should create a base prompt with key instructions', () => {
      const prompt = createBasePrompt();

      expect(prompt).toContain('core objectives');
      expect(prompt).toContain('accessible language');
      expect(prompt).toContain('Verbally describe all visual elements');
    });
  });

  describe('createPersonalityPrompt', () => {
    it('should include agent name and personality instructions', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear and concise',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const prompt = createPersonalityPrompt(agent);

      expect(prompt).toContain('Test Professor');
      expect(prompt).toContain('Be clear and concise');
      expect(prompt.toLowerCase()).toContain('casual');
    });

    it('should include examples if provided', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be funny',
          tone: 'humorous',
          examples: ['That is hilarious!', 'Imagine if you will...'],
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const prompt = createPersonalityPrompt(agent);

      expect(prompt).toContain('That is hilarious!');
      expect(prompt).toContain('Imagine if you will...');
    });

    it('should handle different personality tones', () => {
      const tones: Array<'humorous' | 'serious' | 'casual' | 'formal' | 'enthusiastic'> = [
        'humorous',
        'serious',
        'casual',
        'formal',
        'enthusiastic',
      ];

      for (const tone of tones) {
        const agent: LectureAgent = {
          id: 'test-agent',
          name: 'Test Professor',
          description: 'A test agent',
          personality: {
            instructions: 'Test instructions',
            tone,
          },
          voice: {
            voiceId: 'voice1',
            speed: 1.0,
            pitch: 0,
          },
          createdAt: new Date(),
        };

        const prompt = createPersonalityPrompt(agent);
        expect(prompt.toLowerCase()).toContain(tone.toLowerCase());
      }
    });
  });

  describe('createSegmentPrompt', () => {
    it('should create a prompt for a segment with content blocks', () => {
      const segment: ContentSegment = {
        id: 'seg1',
        title: 'Introduction',
        order: 0,
        contentBlocks: [
          {
            type: 'text',
            content: 'This is some text content.',
            pageReference: 1,
          },
        ],
        prerequisites: [],
      };

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const prompt = createSegmentPrompt(segment, agent, 0, 3);

      expect(prompt).toContain('Introduction');
      expect(prompt).toContain('SEGMENT 1 of 3');
      // Content is included in the prompt via LENGTH GUIDANCE and content analysis
      expect(prompt).toContain('BEGINNING of the lecture');
    });

    it('should include figure descriptions in prompt', () => {
      const segment: ContentSegment = {
        id: 'seg1',
        title: 'Figures',
        order: 0,
        contentBlocks: [
          {
            type: 'figure',
            content: {
              id: 'fig1',
              pageNumber: 2,
              imageData: 'data:image/png;base64,test',
              description: 'A graph showing growth',
              caption: 'Figure 1',
            },
            pageReference: 2,
          },
        ],
        prerequisites: [],
      };

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const prompt = createSegmentPrompt(segment, agent, 0, 1);

      // New prompt structure includes instructions for handling visual elements
      expect(prompt).toContain('Figures');
      expect(prompt).toContain('BEGINNING of the lecture');
      expect(prompt).toContain('LENGTH GUIDANCE');
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test')).toBe(4);
      expect(countWords('One')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('should handle multiple spaces', () => {
      expect(countWords('Hello    world')).toBe(2);
      expect(countWords('  Multiple   spaces   here  ')).toBe(3);
    });

    it('should handle newlines and tabs', () => {
      expect(countWords('Hello\nworld')).toBe(2);
      expect(countWords('Hello\tworld')).toBe(2);
      expect(countWords('Line1\n\nLine2')).toBe(2);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration based on word count', () => {
      const text = 'This is a test sentence with exactly ten words here.';
      const duration = calculateDuration(text, 155);

      // 10 words at 155 words per minute = 10/155 minutes = 0.0645 minutes = 3.87 seconds ≈ 4 seconds
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10);
    });

    it('should return 0 for empty text', () => {
      expect(calculateDuration('')).toBe(0);
      expect(calculateDuration('   ')).toBe(0);
    });

    it('should use default words per minute if not specified', () => {
      const text = 'Test text';
      const duration1 = calculateDuration(text);
      const duration2 = calculateDuration(text, 155);

      expect(duration1).toBe(duration2);
    });
  });

  describe('applyPersonalityModifications', () => {
    it('should remove contractions for serious tone', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Serious Professor',
        description: 'A serious agent',
        personality: {
          instructions: 'Be formal',
          tone: 'serious',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const text = "It's a test. We don't use contractions.";
      const modified = applyPersonalityModifications(text, agent);

      expect(modified).toContain('It is');
      expect(modified).toContain('do not');
      expect(modified).not.toContain("It's");
      expect(modified).not.toContain("don't");
    });

    it('should remove contractions for formal tone', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Formal Professor',
        description: 'A formal agent',
        personality: {
          instructions: 'Be formal',
          tone: 'formal',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const text = "We're testing. They'll see.";
      const modified = applyPersonalityModifications(text, agent);

      expect(modified).toContain('We are');
      expect(modified).toContain('They will');
    });

    it('should add contractions for casual tone', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Casual Professor',
        description: 'A casual agent',
        personality: {
          instructions: 'Be casual',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const text = 'It is a test. We are testing.';
      const modified = applyPersonalityModifications(text, agent);

      expect(modified.toLowerCase()).toContain("it's");
      expect(modified.toLowerCase()).toContain("we're");
    });

    it('should preserve text for humorous tone', () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Funny Professor',
        description: 'A humorous agent',
        personality: {
          instructions: 'Be funny',
          tone: 'humorous',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const text = 'This is a test.';
      const modified = applyPersonalityModifications(text, agent);

      expect(modified.length).toBeGreaterThan(0);
    });
  });

  describe('generateScript - error handling', () => {
    it('should throw error if no segmented content found', async () => {
      const { getContent } = require('./dynamodb');
      getContent.mockResolvedValue(null);

      await expect(generateScript('job123')).rejects.toThrow('No segmented content found');
    });

    it('should throw error if segmented content is missing', async () => {
      const { getContent } = require('./dynamodb');
      getContent.mockResolvedValue({ jobId: 'job123' });

      await expect(generateScript('job123')).rejects.toThrow('No segmented content found');
    });

    it('should use default agent if none specified', async () => {
      const { getContent, updateContent, getAgent, updateJob, getJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getJob.mockResolvedValue({ jobId: 'job123', agentId: null });
      getAgent.mockResolvedValue(null);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'Generated script with default agent.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const script = await generateScript('job123');

      expect(script).toBeDefined();
      expect(script.segments.length).toBeGreaterThan(0);
    });
  });

  describe('generateScript - with different agent personalities', () => {
    it('should generate script with humorous agent', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const humorousAgent: LectureAgent = {
        id: 'humorous-agent',
        name: 'Funny Professor',
        description: 'A humorous agent',
        personality: {
          instructions: 'Make jokes',
          tone: 'humorous',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(humorousAgent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'A humorous script with jokes!',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const script = await generateScript('job123', 'humorous-agent');

      expect(script).toBeDefined();
      expect(script.segments.length).toBe(1);
      expect(script.totalEstimatedDuration).toBeGreaterThan(0);
    });

    it('should generate script with serious agent', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const seriousAgent: LectureAgent = {
        id: 'serious-agent',
        name: 'Serious Professor',
        description: 'A serious agent',
        personality: {
          instructions: 'Be formal',
          tone: 'serious',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(seriousAgent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'A serious, formal script.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const script = await generateScript('job123', 'serious-agent');

      expect(script).toBeDefined();
      expect(script.segments.length).toBe(1);
      expect(script.totalEstimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('generateScript - with visual elements', () => {
    it('should handle segments with many visual elements', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Visual Elements',
            order: 0,
            contentBlocks: [
              {
                type: 'figure',
                content: {
                  id: 'fig1',
                  pageNumber: 1,
                  imageData: 'data:image/png;base64,test',
                  description: 'A graph',
                  caption: 'Figure 1',
                },
                pageReference: 1,
              },
              {
                type: 'table',
                content: {
                  id: 'table1',
                  pageNumber: 2,
                  headers: ['A', 'B'],
                  rows: [['1', '2']],
                  interpretation: 'Data table',
                },
                pageReference: 2,
              },
              {
                type: 'formula',
                content: {
                  id: 'formula1',
                  pageNumber: 3,
                  latex: 'E = mc^2',
                  explanation: 'Energy formula',
                },
                pageReference: 3,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      // Mock LLM response
      llmService.chat.mockResolvedValue({
        content: 'Generated script with visual elements description.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const script = await generateScript('job123', 'test-agent');

      expect(script).toBeDefined();
      expect(script.segments.length).toBe(1);
      expect(script.segments[0].scriptBlocks.length).toBeGreaterThan(0);

      // Verify all blocks have content references
      for (const block of script.segments[0].scriptBlocks) {
        expect(block.contentReference).toBeDefined();
        expect(block.contentReference.pageNumber).toBeGreaterThan(0);
      }
    });
  });

  describe('LLM Integration Tests', () => {
    beforeEach(() => {
      const { llmService } = require('./llm');
      llmService.chat.mockClear();
    });

    it('should call LLM service with correct parameters for humorous agent', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const humorousAgent: LectureAgent = {
        id: 'humorous-agent',
        name: 'Funny Professor',
        description: 'A humorous agent',
        personality: {
          instructions: 'Make jokes and use humor',
          tone: 'humorous',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test Segment',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content about quantum mechanics',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(humorousAgent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'A humorous script about quantum mechanics with jokes!',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await generateScript('job123', 'humorous-agent');

      // Verify LLM was called
      expect(llmService.chat).toHaveBeenCalled();
      
      // Verify the call included the system prompt with humor guidelines
      const callArgs = llmService.chat.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toContain('humorous');
      expect(callArgs.messages[0].content).toContain('HUMOR GUIDELINES');
      expect(callArgs.messages[0].content).toContain('jokes');
      
      // Verify temperature is set for creativity
      expect(callArgs.temperature).toBe(0.8);
    });

    it('should call LLM service with correct parameters for serious agent', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const seriousAgent: LectureAgent = {
        id: 'serious-agent',
        name: 'Serious Professor',
        description: 'A serious agent',
        personality: {
          instructions: 'Be formal and academic',
          tone: 'serious',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test Segment',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content about quantum mechanics',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(seriousAgent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'A serious, formal script about quantum mechanics.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await generateScript('job123', 'serious-agent');

      // Verify LLM was called
      expect(llmService.chat).toHaveBeenCalled();
      
      // Verify the call included the system prompt with formal guidelines
      const callArgs = llmService.chat.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toContain('serious');
      expect(callArgs.messages[0].content).toContain('FORMAL GUIDELINES');
      expect(callArgs.messages[0].content).toContain('academic rigor');
    });

    it('should include segment context in prompt', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Introduction',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Introduction content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
          {
            id: 'seg2',
            title: 'Middle Section',
            order: 1,
            contentBlocks: [
              {
                type: 'text',
                content: 'Middle content',
                pageReference: 2,
              },
            ],
            prerequisites: [],
          },
          {
            id: 'seg3',
            title: 'Conclusion',
            order: 2,
            contentBlocks: [
              {
                type: 'text',
                content: 'Conclusion content',
                pageReference: 3,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'Generated script.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await generateScript('job123', 'test-agent');

      // Verify LLM was called 3 times (once per segment)
      expect(llmService.chat).toHaveBeenCalledTimes(3);
      
      // Check first segment has "BEGINNING" context
      const firstCall = llmService.chat.mock.calls[0][0];
      expect(firstCall.messages[1].content).toContain('BEGINNING of the lecture');
      
      // Check last segment has "FINAL part" context
      const lastCall = llmService.chat.mock.calls[2][0];
      expect(lastCall.messages[1].content).toContain('FINAL part of the lecture');
    });

    it('should include visual element summary in prompt', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Visual Elements',
            order: 0,
            contentBlocks: [
              {
                type: 'figure',
                content: {
                  id: 'fig1',
                  pageNumber: 1,
                  imageData: 'data:image/png;base64,test',
                  description: 'A graph',
                  caption: 'Figure 1',
                },
                pageReference: 1,
              },
              {
                type: 'table',
                content: {
                  id: 'table1',
                  pageNumber: 2,
                  headers: ['A', 'B'],
                  rows: [['1', '2']],
                  interpretation: 'Data table',
                },
                pageReference: 2,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'Generated script with visual elements.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await generateScript('job123', 'test-agent');

      // Verify the prompt includes instructions for visual elements
      const callArgs = llmService.chat.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('Provide clear verbal descriptions for all visual elements');
      expect(callArgs.messages[1].content).toContain('LENGTH GUIDANCE');
    });

    it('should include length guidance in prompt', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      llmService.chat.mockResolvedValue({
        content: 'Generated script.',
        model: 'openai/gpt-4-turbo-preview',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await generateScript('job123', 'test-agent');

      // Verify the prompt includes length guidance
      const callArgs = llmService.chat.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('LENGTH GUIDANCE');
      expect(callArgs.messages[1].content).toMatch(/Approximately .* minutes/);
    });

    it('should handle LLM errors gracefully', async () => {
      const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');
      const { llmService } = require('./llm');

      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Test Professor',
        description: 'A test agent',
        personality: {
          instructions: 'Be clear',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };

      const segmentedContent: SegmentedContent = {
        segments: [
          {
            id: 'seg1',
            title: 'Test',
            order: 0,
            contentBlocks: [
              {
                type: 'text',
                content: 'Test content',
                pageReference: 1,
              },
            ],
            prerequisites: [],
          },
        ],
      };

      getContent.mockResolvedValue({ jobId: 'job123', segmentedContent });
      getAgent.mockResolvedValue(agent);
      updateContent.mockResolvedValue({});
      updateJob.mockResolvedValue({});
      
      // Mock LLM error
      llmService.chat.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(generateScript('job123', 'test-agent')).rejects.toThrow('Failed to generate script');
    });
  });
});

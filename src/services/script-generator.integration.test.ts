// Integration tests for Script Generator with real LLM API
// Tests that different agents produce different scripts and validates personality differences
import { createSegmentPrompt } from './script-generator';
import { LectureAgent } from '../models/agent';
import { ContentSegment } from '../models/content';
import { llmService } from './llm';

/**
 * Integration tests for script generation with real LLM API
 * 
 * These tests verify:
 * 1. Different agents produce different script styles
 * 2. Scripts reflect actual content from segments
 * 3. Personality differences are measurable
 * 4. Real LLM API integration works end-to-end
 * 
 * Validates: Requirements 2.2, 2.3, 2.4, 2.5, 5.2
 * 
 * NOTE: These tests require real API keys to be set in environment variables.
 * Set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY before running.
 * 
 * To run only integration tests:
 *   npm test -- script-generator.integration.test.ts
 */

describe('Script Generation Integration Tests with Real LLM', () => {
  
  // Skip tests if no API keys are available (check for non-mock keys)
  const hasRealApiKey = (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'test-key-mock') || 
                        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key-mock') || 
                        (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'test-key-mock');
  
  const describeOrSkip = hasRealApiKey ? describe : describe.skip;
  
  describeOrSkip('Real LLM API Integration', () => {
    
    // Increase timeout for real API calls
    jest.setTimeout(60000);
    
    // Sample segment for testing
    const quantumSegment: ContentSegment = {
      id: 'seg1',
      title: 'Introduction to Quantum Mechanics',
      order: 0,
      contentBlocks: [
        {
          type: 'text',
          content: 'Quantum mechanics is a fundamental theory in physics that describes the behavior of matter and energy at atomic and subatomic scales. Unlike classical physics, quantum mechanics introduces concepts like wave-particle duality and quantum superposition.',
          pageReference: 1,
        },
        {
          type: 'figure',
          content: {
            id: 'fig1',
            pageNumber: 1,
            imageData: 'data:image/png;base64,test',
            description: 'A diagram showing the double-slit experiment demonstrating wave-particle duality. When particles pass through two slits, they create an interference pattern on a screen, showing wave-like behavior.',
            caption: 'Figure 1: Double-slit experiment',
          },
          pageReference: 1,
        },
        {
          type: 'formula',
          content: {
            id: 'form1',
            pageNumber: 1,
            latex: 'E = h\\nu',
            explanation: 'The energy of a photon is proportional to its frequency, where h is Planck\'s constant',
          },
          pageReference: 1,
        },
      ],
      prerequisites: [],
    };
    
    /**
     * Test 1: Humorous agent produces different script than serious agent
     * Validates: Requirements 2.2, 2.4, 2.5, 5.2
     */
    test('generates different scripts for humorous vs serious agents', async () => {
      const humorousAgent: LectureAgent = {
        id: 'humorous-agent',
        name: 'Dr. Funny',
        description: 'A humorous science communicator',
        personality: {
          instructions: 'Make science fun and entertaining. Use jokes, puns, and playful analogies to explain concepts.',
          tone: 'humorous',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
      
      const seriousAgent: LectureAgent = {
        id: 'serious-agent',
        name: 'Prof. Formal',
        description: 'A serious academic lecturer',
        personality: {
          instructions: 'Maintain academic rigor and formal language. Focus on precision and accuracy.',
          tone: 'serious',
        },
        voice: {
          voiceId: 'voice2',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
      
      // Generate prompts for both agents
      const humorousPrompt = createSegmentPrompt(quantumSegment, humorousAgent, 0, 1);
      const seriousPrompt = createSegmentPrompt(quantumSegment, seriousAgent, 0, 1);
      
      // Call real LLM API for both
      const humorousResponse = await llmService.chat({
        messages: [
          { role: 'system', content: humorousPrompt.split('\n\n')[0] },
          { role: 'user', content: humorousPrompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const seriousResponse = await llmService.chat({
        messages: [
          { role: 'system', content: seriousPrompt.split('\n\n')[0] },
          { role: 'user', content: seriousPrompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const humorousScript = humorousResponse.content;
      const seriousScript = seriousResponse.content;
      
      // Verify both scripts were generated
      expect(humorousScript).toBeDefined();
      expect(seriousScript).toBeDefined();
      expect(humorousScript.length).toBeGreaterThan(100);
      expect(seriousScript.length).toBeGreaterThan(100);
      
      // Verify scripts are different
      expect(humorousScript).not.toBe(seriousScript);
      
      // Check for personality markers
      // Humorous script should have more informal language
      const humorousLower = humorousScript.toLowerCase();
      const seriousLower = seriousScript.toLowerCase();
      
      // Count contractions (more common in humorous/casual tone)
      const contractionPattern = /\b(it's|that's|we're|you're|don't|can't|won't|isn't|aren't)\b/gi;
      const humorousContractions = (humorousScript.match(contractionPattern) || []).length;
      const seriousContractions = (seriousScript.match(contractionPattern) || []).length;
      
      // Humorous should have more contractions OR serious should have fewer
      // (allowing for some variation in LLM output)
      const contractionDifference = humorousContractions - seriousContractions;
      
      // Check for exclamation marks (more common in humorous tone)
      const humorousExclamations = (humorousScript.match(/!/g) || []).length;
      const seriousExclamations = (seriousScript.match(/!/g) || []).length;
      
      // Check for playful words in humorous script
      const playfulWords = ['imagine', 'picture', 'think about', 'cool', 'amazing', 'fascinating', 'fun'];
      const humorousPlayfulCount = playfulWords.filter(word => humorousLower.includes(word)).length;
      
      // Check for formal words in serious script
      const formalWords = ['furthermore', 'moreover', 'consequently', 'therefore', 'thus', 'hence'];
      const seriousFormalCount = formalWords.filter(word => seriousLower.includes(word)).length;
      
      // At least one personality indicator should be different
      const hasPersonalityDifference = 
        contractionDifference > 0 ||
        humorousExclamations > seriousExclamations ||
        humorousPlayfulCount > 0 ||
        seriousFormalCount > 0;
      
      expect(hasPersonalityDifference).toBe(true);
    });
    
    /**
     * Test 2: Scripts reference actual content from segment
     * Validates: Requirements 2.3, 5.2
     */
    test('generates scripts that reference actual segment content', async () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Dr. Test',
        description: 'A test agent',
        personality: {
          instructions: 'Explain concepts clearly and reference all visual elements.',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
      
      const prompt = createSegmentPrompt(quantumSegment, agent, 0, 1);
      
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: prompt.split('\n\n')[0] },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const script = response.content;
      
      // Verify script was generated
      expect(script).toBeDefined();
      expect(script.length).toBeGreaterThan(100);
      
      // Check that script references key concepts from the segment
      const scriptLower = script.toLowerCase();
      
      // Should mention quantum mechanics
      expect(
        scriptLower.includes('quantum') || 
        scriptLower.includes('mechanics')
      ).toBe(true);
      
      // Should reference the figure (double-slit experiment or wave-particle duality)
      expect(
        scriptLower.includes('double-slit') ||
        scriptLower.includes('double slit') ||
        scriptLower.includes('wave') ||
        scriptLower.includes('particle') ||
        scriptLower.includes('interference')
      ).toBe(true);
      
      // Should reference the formula or energy concept
      expect(
        scriptLower.includes('energy') ||
        scriptLower.includes('photon') ||
        scriptLower.includes('frequency') ||
        scriptLower.includes('planck')
      ).toBe(true);
    });
    
    /**
     * Test 3: Different content produces different scripts
     * Validates: Requirements 2.3, 5.2
     */
    test('generates different scripts for different content', async () => {
      const agent: LectureAgent = {
        id: 'test-agent',
        name: 'Dr. Test',
        description: 'A test agent',
        personality: {
          instructions: 'Explain concepts clearly.',
          tone: 'casual',
        },
        voice: {
          voiceId: 'voice1',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
      
      const mlSegment: ContentSegment = {
        id: 'seg2',
        title: 'Neural Networks Basics',
        order: 0,
        contentBlocks: [
          {
            type: 'text',
            content: 'Artificial neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes organized in layers that process information.',
            pageReference: 1,
          },
          {
            type: 'table',
            content: {
              id: 'tab1',
              pageNumber: 1,
              headers: ['Layer', 'Neurons', 'Activation'],
              rows: [
                ['Input', '784', 'None'],
                ['Hidden', '128', 'ReLU'],
                ['Output', '10', 'Softmax'],
              ],
              interpretation: 'Architecture of a simple neural network for digit classification',
            },
            pageReference: 1,
          },
        ],
        prerequisites: [],
      };
      
      // Generate scripts for both segments
      const quantumPrompt = createSegmentPrompt(quantumSegment, agent, 0, 1);
      const mlPrompt = createSegmentPrompt(mlSegment, agent, 0, 1);
      
      const quantumResponse = await llmService.chat({
        messages: [
          { role: 'system', content: quantumPrompt.split('\n\n')[0] },
          { role: 'user', content: quantumPrompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const mlResponse = await llmService.chat({
        messages: [
          { role: 'system', content: mlPrompt.split('\n\n')[0] },
          { role: 'user', content: mlPrompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const quantumScript = quantumResponse.content;
      const mlScript = mlResponse.content;
      
      // Verify both scripts were generated
      expect(quantumScript).toBeDefined();
      expect(mlScript).toBeDefined();
      expect(quantumScript.length).toBeGreaterThan(100);
      expect(mlScript.length).toBeGreaterThan(100);
      
      // Verify scripts are different
      expect(quantumScript).not.toBe(mlScript);
      
      // Verify quantum script mentions quantum concepts
      const quantumLower = quantumScript.toLowerCase();
      expect(
        quantumLower.includes('quantum') ||
        quantumLower.includes('wave') ||
        quantumLower.includes('particle')
      ).toBe(true);
      
      // Verify ML script mentions neural network concepts
      const mlLower = mlScript.toLowerCase();
      expect(
        mlLower.includes('neural') ||
        mlLower.includes('network') ||
        mlLower.includes('layer') ||
        mlLower.includes('neuron')
      ).toBe(true);
      
      // Verify they don't overlap too much
      // Quantum script shouldn't mention neural networks
      expect(
        quantumLower.includes('neural network') ||
        quantumLower.includes('neural networks')
      ).toBe(false);
      
      // ML script shouldn't mention quantum mechanics
      expect(
        mlLower.includes('quantum mechanics') ||
        mlLower.includes('quantum physics')
      ).toBe(false);
    });
    
    /**
     * Test 4: Enthusiastic agent shows enthusiasm
     * Validates: Requirements 2.2, 2.5, 5.2
     */
    test('generates enthusiastic script with enthusiastic agent', async () => {
      const enthusiasticAgent: LectureAgent = {
        id: 'enthusiastic-agent',
        name: 'Dr. Excited',
        description: 'An enthusiastic science communicator',
        personality: {
          instructions: 'Express excitement and passion about scientific discoveries. Use dynamic, engaging language.',
          tone: 'enthusiastic',
        },
        voice: {
          voiceId: 'voice3',
          speed: 1.1,
          pitch: 2,
        },
        createdAt: new Date(),
      };
      
      const prompt = createSegmentPrompt(quantumSegment, enthusiasticAgent, 0, 1);
      
      const response = await llmService.chat({
        messages: [
          { role: 'system', content: prompt.split('\n\n')[0] },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        maxTokens: 2000,
      });
      
      const script = response.content;
      
      // Verify script was generated
      expect(script).toBeDefined();
      expect(script.length).toBeGreaterThan(100);
      
      // Check for enthusiasm markers
      const scriptLower = script.toLowerCase();
      const enthusiasmWords = [
        'amazing', 'incredible', 'fascinating', 'remarkable', 'extraordinary',
        'exciting', 'wonderful', 'fantastic', 'brilliant', 'stunning'
      ];
      
      const enthusiasmCount = enthusiasmWords.filter(word => scriptLower.includes(word)).length;
      
      // Should have at least one enthusiasm marker
      expect(enthusiasmCount).toBeGreaterThan(0);
      
      // Should have exclamation marks
      const exclamations = (script.match(/!/g) || []).length;
      expect(exclamations).toBeGreaterThan(0);
    });
  });
  
  // Provide helpful message when tests are skipped
  if (!hasRealApiKey) {
    test.skip('Integration tests skipped - no API key found', () => {
      console.log('\n⚠️  Script generation integration tests skipped');
      console.log('To run these tests, set one of the following environment variables:');
      console.log('  - OPENROUTER_API_KEY');
      console.log('  - OPENAI_API_KEY');
      console.log('  - ANTHROPIC_API_KEY');
      console.log('\nExample:');
      console.log('  OPENROUTER_API_KEY=your_key npm test -- script-generator.integration.test.ts\n');
    });
  }
});

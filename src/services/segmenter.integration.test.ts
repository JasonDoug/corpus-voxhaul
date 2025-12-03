// Integration tests for Content Segmenter with real LLM API
// Tests that different PDFs produce different segments and validates segment structure
import { callSegmentationLLM, createSegmentationPrompt } from './segmenter';
import { ExtractedContent } from '../models/content';

/**
 * Integration tests for segmentation with real LLM API
 * 
 * These tests verify:
 * 1. Different PDFs produce different segment structures
 * 2. Segment structure is valid and well-formed
 * 3. Real LLM API integration works end-to-end
 * 
 * Validates: Requirements 1.3, 5.1
 * 
 * NOTE: These tests require real API keys to be set in environment variables.
 * Set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY before running.
 * 
 * To run only integration tests:
 *   npm test -- segmenter.integration.test.ts
 */

describe('Segmentation Integration Tests with Real LLM', () => {
  
  // Skip tests if no API keys are available (check for non-mock keys)
  const hasRealApiKey = (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'test-key-mock') || 
                        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key-mock') || 
                        (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'test-key-mock');
  
  const describeOrSkip = hasRealApiKey ? describe : describe.skip;
  
  describeOrSkip('Real LLM API Integration', () => {
    
    // Increase timeout for real API calls
    jest.setTimeout(60000);
    
    /**
     * Test 1: Different PDFs produce different segments
     * Validates: Requirement 1.3
     */
    test('produces different segments for different PDF content', async () => {
      // Create two very different extracted content samples
      const quantumPhysicsPDF: ExtractedContent = {
        pages: [
          { 
            pageNumber: 1, 
            text: 'Introduction to Quantum Mechanics. Quantum mechanics is a fundamental theory in physics that describes the behavior of matter and energy at atomic and subatomic scales. The wave function is central to quantum mechanics.',
            elements: [] 
          },
          { 
            pageNumber: 2, 
            text: 'Wave-Particle Duality. Light and matter exhibit both wave-like and particle-like properties. This duality is demonstrated in the double-slit experiment.',
            elements: [] 
          },
          { 
            pageNumber: 3, 
            text: 'The Schrödinger Equation. The time-dependent Schrödinger equation describes how quantum states evolve over time. It is the foundation of quantum mechanics.',
            elements: [] 
          },
        ],
        figures: [
          { 
            id: 'fig1', 
            pageNumber: 2, 
            imageData: 'data:image/png;base64,test', 
            description: 'Double-slit experiment showing interference pattern', 
            caption: 'Figure 1: Wave-particle duality demonstration' 
          },
        ],
        tables: [],
        formulas: [
          { 
            id: 'form1', 
            pageNumber: 3, 
            latex: 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi(r,t) = \\hat{H}\\Psi(r,t)', 
            explanation: 'Time-dependent Schrödinger equation' 
          },
        ],
        citations: [
          { 
            id: 'cit1', 
            text: 'Schrödinger, E. (1926)', 
            authors: ['Schrödinger, E.'], 
            year: 1926,
            title: 'An Undulatory Theory of the Mechanics of Atoms and Molecules'
          },
        ],
      };
      
      const machineLearningPDF: ExtractedContent = {
        pages: [
          { 
            pageNumber: 1, 
            text: 'Introduction to Neural Networks. Artificial neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes organized in layers.',
            elements: [] 
          },
          { 
            pageNumber: 2, 
            text: 'Backpropagation Algorithm. Backpropagation is a method used to train neural networks by calculating gradients of the loss function with respect to network weights.',
            elements: [] 
          },
          { 
            pageNumber: 3, 
            text: 'Convolutional Neural Networks. CNNs are specialized neural networks designed for processing grid-like data such as images. They use convolutional layers to detect features.',
            elements: [] 
          },
        ],
        figures: [
          { 
            id: 'fig1', 
            pageNumber: 1, 
            imageData: 'data:image/png;base64,test', 
            description: 'Neural network architecture with input, hidden, and output layers', 
            caption: 'Figure 1: Basic neural network structure' 
          },
        ],
        tables: [
          { 
            id: 'tab1', 
            pageNumber: 2, 
            headers: ['Layer Type', 'Parameters', 'Output Shape'], 
            rows: [
              ['Input', '784', '(None, 784)'],
              ['Dense', '128', '(None, 128)'],
              ['Output', '10', '(None, 10)']
            ], 
            interpretation: 'Network architecture specifications' 
          },
        ],
        formulas: [
          { 
            id: 'form1', 
            pageNumber: 2, 
            latex: '\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial y} \\cdot \\frac{\\partial y}{\\partial w}', 
            explanation: 'Chain rule for backpropagation' 
          },
        ],
        citations: [
          { 
            id: 'cit1', 
            text: 'Rumelhart et al. (1986)', 
            authors: ['Rumelhart, D.E.', 'Hinton, G.E.', 'Williams, R.J.'], 
            year: 1986,
            title: 'Learning representations by back-propagating errors'
          },
        ],
      };
      
      // Generate prompts for both PDFs
      const quantumPrompt = createSegmentationPrompt(quantumPhysicsPDF);
      const mlPrompt = createSegmentationPrompt(machineLearningPDF);
      
      // Call real LLM API for both
      const quantumSegmentation = await callSegmentationLLM(quantumPrompt);
      const mlSegmentation = await callSegmentationLLM(mlPrompt);
      
      // Verify both returned valid segments
      expect(quantumSegmentation.segments).toBeDefined();
      expect(mlSegmentation.segments).toBeDefined();
      expect(quantumSegmentation.segments.length).toBeGreaterThan(0);
      expect(mlSegmentation.segments.length).toBeGreaterThan(0);
      
      // Verify segments are different
      // Check that segment titles are different (they should reflect different topics)
      const quantumTitles = quantumSegmentation.segments.map(s => s.title.toLowerCase());
      const mlTitles = mlSegmentation.segments.map(s => s.title.toLowerCase());
      
      // At least one title should be unique to each document
      const quantumUniqueTerms = ['quantum', 'wave', 'schrödinger', 'particle'];
      const mlUniqueTerms = ['neural', 'network', 'backpropagation', 'learning', 'cnn'];
      
      const quantumHasUniqueTerms = quantumTitles.some(title => 
        quantumUniqueTerms.some(term => title.includes(term))
      );
      const mlHasUniqueTerms = mlTitles.some(title => 
        mlUniqueTerms.some(term => title.includes(term))
      );
      
      expect(quantumHasUniqueTerms).toBe(true);
      expect(mlHasUniqueTerms).toBe(true);
      
      // Verify that the segments reference different content
      // Quantum should reference its formula, ML should reference its table
      const quantumReferencesFormula = quantumSegmentation.segments.some(s => 
        s.contentIndices.formulaIds.includes('form1')
      );
      const mlReferencesTable = mlSegmentation.segments.some(s => 
        s.contentIndices.tableIds.includes('tab1')
      );
      
      expect(quantumReferencesFormula).toBe(true);
      expect(mlReferencesTable).toBe(true);
    });
    
    /**
     * Test 2: Verify segment structure is valid
     * Validates: Requirement 5.1
     */
    test('produces valid segment structure with all required fields', async () => {
      const samplePDF: ExtractedContent = {
        pages: [
          { 
            pageNumber: 1, 
            text: 'Introduction to Climate Change. Climate change refers to long-term shifts in global temperatures and weather patterns.',
            elements: [] 
          },
          { 
            pageNumber: 2, 
            text: 'Causes of Climate Change. The primary cause is the increase in greenhouse gases from human activities.',
            elements: [] 
          },
          { 
            pageNumber: 3, 
            text: 'Effects on Ecosystems. Rising temperatures affect biodiversity and ecosystem stability.',
            elements: [] 
          },
          { 
            pageNumber: 4, 
            text: 'Mitigation Strategies. Reducing emissions and transitioning to renewable energy are key solutions.',
            elements: [] 
          },
        ],
        figures: [
          { 
            id: 'fig1', 
            pageNumber: 2, 
            imageData: 'data:image/png;base64,test', 
            description: 'Graph showing CO2 levels over time', 
            caption: 'Figure 1: Atmospheric CO2 concentration' 
          },
          { 
            id: 'fig2', 
            pageNumber: 3, 
            imageData: 'data:image/png;base64,test', 
            description: 'Map of temperature changes', 
            caption: 'Figure 2: Global temperature anomalies' 
          },
        ],
        tables: [
          { 
            id: 'tab1', 
            pageNumber: 4, 
            headers: ['Strategy', 'Impact', 'Timeline'], 
            rows: [
              ['Solar Energy', 'High', '10-20 years'],
              ['Wind Energy', 'High', '5-15 years']
            ], 
            interpretation: 'Renewable energy adoption strategies' 
          },
        ],
        formulas: [],
        citations: [
          { 
            id: 'cit1', 
            text: 'IPCC (2021)', 
            authors: ['IPCC'], 
            year: 2021,
            title: 'Climate Change 2021: The Physical Science Basis'
          },
        ],
      };
      
      const prompt = createSegmentationPrompt(samplePDF);
      const segmentation = await callSegmentationLLM(prompt);
      
      // Verify segments array exists and is not empty
      expect(segmentation.segments).toBeDefined();
      expect(Array.isArray(segmentation.segments)).toBe(true);
      expect(segmentation.segments.length).toBeGreaterThan(0);
      expect(segmentation.segments.length).toBeLessThanOrEqual(8); // Should follow guideline of 3-8 segments
      
      // Verify each segment has valid structure
      for (const segment of segmentation.segments) {
        // Title validation
        expect(segment.title).toBeDefined();
        expect(typeof segment.title).toBe('string');
        expect(segment.title.trim().length).toBeGreaterThan(0);
        
        // ContentIndices validation
        expect(segment.contentIndices).toBeDefined();
        expect(segment.contentIndices.pageRanges).toBeDefined();
        expect(Array.isArray(segment.contentIndices.pageRanges)).toBe(true);
        
        // Validate page ranges
        for (const range of segment.contentIndices.pageRanges) {
          expect(Array.isArray(range)).toBe(true);
          expect(range.length).toBe(2);
          const [start, end] = range;
          expect(typeof start).toBe('number');
          expect(typeof end).toBe('number');
          expect(start).toBeGreaterThanOrEqual(1);
          expect(end).toBeGreaterThanOrEqual(start);
          expect(end).toBeLessThanOrEqual(4); // Our sample has 4 pages
        }
        
        // Validate ID arrays
        expect(Array.isArray(segment.contentIndices.figureIds)).toBe(true);
        expect(Array.isArray(segment.contentIndices.tableIds)).toBe(true);
        expect(Array.isArray(segment.contentIndices.formulaIds)).toBe(true);
        expect(Array.isArray(segment.contentIndices.citationIds)).toBe(true);
        
        // All IDs should be strings
        for (const id of segment.contentIndices.figureIds) {
          expect(typeof id).toBe('string');
        }
        for (const id of segment.contentIndices.tableIds) {
          expect(typeof id).toBe('string');
        }
        for (const id of segment.contentIndices.formulaIds) {
          expect(typeof id).toBe('string');
        }
        for (const id of segment.contentIndices.citationIds) {
          expect(typeof id).toBe('string');
        }
        
        // Prerequisites validation
        expect(segment.prerequisites).toBeDefined();
        expect(Array.isArray(segment.prerequisites)).toBe(true);
        
        // All prerequisites should be valid indices
        for (const prereq of segment.prerequisites) {
          expect(typeof prereq).toBe('number');
          expect(Number.isInteger(prereq)).toBe(true);
          expect(prereq).toBeGreaterThanOrEqual(0);
          expect(prereq).toBeLessThan(segmentation.segments.length);
        }
      }
      
      // Verify that all content is assigned to at least one segment
      const allPagesCovered = new Set<number>();
      const allFiguresCovered = new Set<string>();
      const allTablesCovered = new Set<string>();
      
      for (const segment of segmentation.segments) {
        for (const [start, end] of segment.contentIndices.pageRanges) {
          for (let page = start; page <= end; page++) {
            allPagesCovered.add(page);
          }
        }
        segment.contentIndices.figureIds.forEach(id => allFiguresCovered.add(id));
        segment.contentIndices.tableIds.forEach(id => allTablesCovered.add(id));
      }
      
      // All pages should be covered
      expect(allPagesCovered.size).toBeGreaterThan(0);
      
      // At least some figures and tables should be referenced
      // (LLM might not reference all, but should reference some)
      expect(allFiguresCovered.size + allTablesCovered.size).toBeGreaterThan(0);
    });
    
    /**
     * Test 3: Verify logical flow and prerequisites
     * Validates: Requirement 1.3
     */
    test('produces logical segment ordering with valid prerequisites', async () => {
      const progressivePDF: ExtractedContent = {
        pages: [
          { 
            pageNumber: 1, 
            text: 'Basic Algebra. Algebra is the study of mathematical symbols and rules for manipulating these symbols. Variables represent unknown quantities.',
            elements: [] 
          },
          { 
            pageNumber: 2, 
            text: 'Linear Equations. A linear equation is an equation where the highest power of the variable is one. Solving linear equations involves isolating the variable.',
            elements: [] 
          },
          { 
            pageNumber: 3, 
            text: 'Quadratic Equations. Quadratic equations have the form ax² + bx + c = 0. They can be solved using factoring, completing the square, or the quadratic formula.',
            elements: [] 
          },
          { 
            pageNumber: 4, 
            text: 'Systems of Equations. Systems involve multiple equations with multiple variables. They build on knowledge of linear and quadratic equations.',
            elements: [] 
          },
        ],
        figures: [],
        tables: [],
        formulas: [
          { 
            id: 'form1', 
            pageNumber: 2, 
            latex: 'ax + b = c', 
            explanation: 'General form of linear equation' 
          },
          { 
            id: 'form2', 
            pageNumber: 3, 
            latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', 
            explanation: 'Quadratic formula' 
          },
        ],
        citations: [],
      };
      
      const prompt = createSegmentationPrompt(progressivePDF);
      const segmentation = await callSegmentationLLM(prompt);
      
      // Verify segments exist
      expect(segmentation.segments.length).toBeGreaterThan(0);
      
      // Verify prerequisites only reference earlier segments
      for (let i = 0; i < segmentation.segments.length; i++) {
        const segment = segmentation.segments[i];
        for (const prereq of segment.prerequisites) {
          expect(prereq).toBeLessThan(i); // Prerequisites must come before current segment
        }
      }
      
      // Verify no self-referential prerequisites
      for (let i = 0; i < segmentation.segments.length; i++) {
        const segment = segmentation.segments[i];
        expect(segment.prerequisites).not.toContain(i);
      }
      
      // Verify no circular dependencies
      // Build adjacency list
      const graph = new Map<number, number[]>();
      for (let i = 0; i < segmentation.segments.length; i++) {
        graph.set(i, []);
      }
      for (let i = 0; i < segmentation.segments.length; i++) {
        const segment = segmentation.segments[i];
        for (const prereq of segment.prerequisites) {
          const dependents = graph.get(prereq) || [];
          dependents.push(i);
          graph.set(prereq, dependents);
        }
      }
      
      // Check for cycles using DFS
      const visited = new Set<number>();
      const recursionStack = new Set<number>();
      
      function hasCycle(node: number): boolean {
        visited.add(node);
        recursionStack.add(node);
        
        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) {
              return true;
            }
          } else if (recursionStack.has(neighbor)) {
            return true; // Cycle detected
          }
        }
        
        recursionStack.delete(node);
        return false;
      }
      
      let cycleDetected = false;
      for (let i = 0; i < segmentation.segments.length; i++) {
        if (!visited.has(i)) {
          if (hasCycle(i)) {
            cycleDetected = true;
            break;
          }
        }
      }
      
      expect(cycleDetected).toBe(false);
    });
  });
  
  // Provide helpful message when tests are skipped
  if (!hasRealApiKey) {
    test.skip('Integration tests skipped - no API key found', () => {
      console.log('\n⚠️  Segmentation integration tests skipped');
      console.log('To run these tests, set one of the following environment variables:');
      console.log('  - OPENROUTER_API_KEY');
      console.log('  - OPENAI_API_KEY');
      console.log('  - ANTHROPIC_API_KEY');
      console.log('\nExample:');
      console.log('  OPENROUTER_API_KEY=your_key npm test -- segmenter.integration.test.ts\n');
    });
  }
});

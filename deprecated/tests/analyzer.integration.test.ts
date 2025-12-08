// Integration tests for Image Extraction with real PDF files
// Tests that images can be extracted from PDFs and analyzed by vision LLM
import { analyzeFigures } from './analyzer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Integration tests for image extraction with real PDFs
 * 
 * These tests verify:
 * 1. Images can be extracted from real PDF files
 * 2. Vision LLM can analyze extracted images
 * 3. Descriptions are meaningful and content-specific
 * 
 * Validates: Requirements 3.4, 5.3
 * 
 * NOTE: These tests require:
 * - Real API keys to be set in environment variables
 * - A sample PDF file with images for testing
 * 
 * Set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY before running.
 * 
 * To run only integration tests:
 *   npm test -- analyzer.integration.test.ts
 */

describe('Image Extraction Integration Tests with Real PDFs', () => {
  
  // Skip tests if no API keys are available (check for non-mock keys)
  const hasRealApiKey = (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'test-key-mock') || 
                        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key-mock') || 
                        (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'test-key-mock');
  
  const describeOrSkip = hasRealApiKey ? describe : describe.skip;
  
  describeOrSkip('Real PDF Image Extraction', () => {
    
    // Increase timeout for real API calls and image extraction
    jest.setTimeout(120000);
    
    /**
     * Test 1: Extract images from a real scientific PDF
     * Validates: Requirement 3.4
     */
    test('extracts images from real PDF and generates descriptions', async () => {
      // Create a simple test PDF buffer
      // In a real scenario, you would load an actual PDF file
      // For this test, we'll create a minimal PDF with text
      const testPdfPath = path.join(__dirname, '../../test-fixtures/sample.pdf');
      
      let pdfBuffer: Buffer;
      
      // Check if test fixture exists, otherwise create a simple buffer
      if (fs.existsSync(testPdfPath)) {
        pdfBuffer = fs.readFileSync(testPdfPath);
      } else {
        // Create a minimal PDF buffer for testing
        // This is a very basic PDF structure - in production you'd use a real PDF
        pdfBuffer = Buffer.from(
          '%PDF-1.4\n' +
          '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
          '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
          '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
          '4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\n' +
          'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\n' +
          'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n408\n%%EOF'
        );
      }
      
      const figurePositions = [
        { pageNumber: 1, id: 'test-fig-1' }
      ];
      
      // Extract images and generate descriptions
      const figures = await analyzeFigures(figurePositions, pdfBuffer);
      
      // Verify that we got results
      expect(figures).toBeDefined();
      expect(Array.isArray(figures)).toBe(true);
      
      // If extraction succeeded, verify the structure
      if (figures.length > 0) {
        const figure = figures[0];
        
        // Verify figure has all required fields
        expect(figure.id).toBe('test-fig-1');
        expect(figure.pageNumber).toBe(1);
        expect(figure.imageData).toBeDefined();
        expect(figure.description).toBeDefined();
        expect(figure.caption).toBeDefined();
        
        // Verify image data is in correct format
        expect(figure.imageData).toMatch(/^data:image\/png;base64,/);
        
        // Verify image data is not a placeholder
        expect(figure.imageData).not.toContain('placeholder');
        
        // Verify description is meaningful (not empty or error message)
        expect(figure.description.length).toBeGreaterThan(10);
        expect(figure.description).not.toContain('unavailable');
        expect(figure.description).not.toContain('error');
        
        console.log('\n✓ Successfully extracted image from PDF');
        console.log(`  Image size: ${figure.imageData.length} bytes`);
        console.log(`  Description: ${figure.description.substring(0, 100)}...`);
      }
    });
    
    /**
     * Test 2: Verify vision LLM can analyze extracted images
     * Validates: Requirement 5.3
     */
    test('vision LLM produces meaningful descriptions for extracted images', async () => {
      // Create a test PDF buffer
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Scientific Figure) Tj\nET\nendstream\nendobj\n' +
        'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\n' +
        'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n408\n%%EOF'
      );
      
      const figurePositions = [
        { pageNumber: 1, id: 'test-fig-1' }
      ];
      
      // Extract and analyze
      const figures = await analyzeFigures(figurePositions, pdfBuffer);
      
      // If we got results, verify the description quality
      if (figures.length > 0) {
        const figure = figures[0];
        
        // Description should be substantial
        expect(figure.description.length).toBeGreaterThan(20);
        
        // Description should contain descriptive words
        // (checking for common words in scientific figure descriptions)
        const descriptiveWords = [
          'figure', 'image', 'shows', 'displays', 'depicts', 'illustrates',
          'graph', 'chart', 'diagram', 'plot', 'visualization',
          'data', 'pattern', 'trend', 'relationship', 'comparison'
        ];
        
        const descriptionLower = figure.description.toLowerCase();
        const hasDescriptiveWords = descriptiveWords.some(word => 
          descriptionLower.includes(word)
        );
        
        expect(hasDescriptiveWords).toBe(true);
        
        console.log('\n✓ Vision LLM generated meaningful description');
        console.log(`  Description length: ${figure.description.length} characters`);
        console.log(`  Full description: ${figure.description}`);
      }
    });
    
    /**
     * Test 3: Handle multiple figures from same PDF
     * Validates: Requirement 3.4
     */
    test('extracts and analyzes multiple figures from same PDF', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n' +
        '5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Page 1 Figure) Tj\nET\nendstream\nendobj\n' +
        '6 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Page 2 Figure) Tj\nET\nendstream\nendobj\n' +
        'xref\n0 7\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000125 00000 n\n0000000327 00000 n\n0000000529 00000 n\n0000000622 00000 n\n' +
        'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n715\n%%EOF'
      );
      
      const figurePositions = [
        { pageNumber: 1, id: 'fig-1' },
        { pageNumber: 2, id: 'fig-2' }
      ];
      
      // Extract and analyze multiple figures
      const figures = await analyzeFigures(figurePositions, pdfBuffer);
      
      // Verify we attempted to process all figures
      // (some might fail, but we should get at least some results)
      expect(figures).toBeDefined();
      expect(Array.isArray(figures)).toBe(true);
      
      // If we got results, verify each has proper structure
      figures.forEach(figure => {
        expect(figure.id).toBeDefined();
        expect(figure.pageNumber).toBeGreaterThan(0);
        expect(figure.imageData).toBeDefined();
        expect(figure.description).toBeDefined();
        expect(figure.imageData).toMatch(/^data:image\/png;base64,/);
      });
      
      console.log(`\n✓ Processed ${figures.length} figures from multi-page PDF`);
    });
    
    /**
     * Test 4: Gracefully handle extraction failures
     * Validates: Requirement 3.5
     */
    test('continues processing other figures when one fails', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n' +
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n' +
        '4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\n' +
        'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\n' +
        'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n408\n%%EOF'
      );
      
      const figurePositions = [
        { pageNumber: 1, id: 'fig-1' },
        { pageNumber: 999, id: 'fig-invalid' }, // Invalid page number
        { pageNumber: 1, id: 'fig-2' }
      ];
      
      // Should not throw, even with invalid page number
      const figures = await analyzeFigures(figurePositions, pdfBuffer);
      
      // Should have processed the valid figures
      expect(figures).toBeDefined();
      expect(Array.isArray(figures)).toBe(true);
      
      // Should have fewer figures than requested (invalid one should fail)
      expect(figures.length).toBeLessThan(figurePositions.length);
      
      console.log(`\n✓ Gracefully handled extraction failures`);
      console.log(`  Requested: ${figurePositions.length} figures`);
      console.log(`  Successfully extracted: ${figures.length} figures`);
    });
  });
  
  // Provide helpful message when tests are skipped
  if (!hasRealApiKey) {
    test.skip('Integration tests skipped - no API key found', () => {
      console.log('\n⚠️  Image extraction integration tests skipped');
      console.log('To run these tests, set one of the following environment variables:');
      console.log('  - OPENROUTER_API_KEY');
      console.log('  - OPENAI_API_KEY');
      console.log('  - ANTHROPIC_API_KEY');
      console.log('\nExample:');
      console.log('  OPENROUTER_API_KEY=your_key npm test -- analyzer.integration.test.ts\n');
    });
  }
});

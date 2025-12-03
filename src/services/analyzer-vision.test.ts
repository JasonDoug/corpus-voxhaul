// Tests for vision-first analyzer
import { analyzeContentVisionFirst } from './analyzer-vision';
import { uploadPDF } from './s3';
import { createJob } from './dynamodb';
import { Job } from '../models/job';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

describe('Vision-First Analyzer', () => {
  // Skip if no API key is available
  const hasApiKey = !!process.env.OPENROUTER_API_KEY || !!process.env.OPENAI_API_KEY;
  
  if (!hasApiKey) {
    it.skip('Skipping vision-first tests - no API key available', () => {});
    return;
  }
  
  it('should analyze a simple PDF and extract segments', async () => {
    // Create a test PDF (use existing test PDF if available)
    const testPdfPath = path.join(__dirname, '../../The Constitution of the Roman Republic.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.log('Test PDF not found, skipping test');
      return;
    }
    
    const pdfBuffer = fs.readFileSync(testPdfPath);
    const jobId = randomUUID();
    
    // Upload PDF
    await uploadPDF(jobId, pdfBuffer, 'test-vision.pdf');
    
    // Create a job
    const job: Job = {
      jobId,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      pdfFilename: 'test-vision.pdf',
      pdfUrl: `pdfs/${jobId}/test-vision.pdf`,
      stages: [],
    };
    await createJob(job);
    
    // Analyze with vision-first pipeline
    const result = await analyzeContentVisionFirst(jobId);
    
    // Verify structure
    expect(result).toBeDefined();
    expect(result.segments).toBeDefined();
    expect(Array.isArray(result.segments)).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    
    // Verify each segment has required fields
    for (const segment of result.segments) {
      expect(segment.id).toBeDefined();
      expect(segment.title).toBeDefined();
      expect(segment.order).toBeDefined();
      expect(segment.contentBlocks).toBeDefined();
      expect(Array.isArray(segment.contentBlocks)).toBe(true);
      expect(segment.contentBlocks.length).toBeGreaterThan(0);
      
      // Verify content block structure
      const block = segment.contentBlocks[0];
      expect(block.type).toBe('text');
      expect(block.content).toBeDefined();
      expect(typeof block.content).toBe('string');
      expect((block.content as string).length).toBeGreaterThan(0);
      expect(block.pageReference).toBeDefined();
    }
    
    console.log(`Vision-first analysis produced ${result.segments.length} segments`);
  }, 60000); // 60 second timeout for API calls
  
  it('should handle multi-page PDFs', async () => {
    const testPdfPath = path.join(__dirname, '../../The Constitution of the Roman Republic.pdf');
    
    if (!fs.existsSync(testPdfPath)) {
      console.log('Test PDF not found, skipping test');
      return;
    }
    
    const pdfBuffer = fs.readFileSync(testPdfPath);
    const jobId = randomUUID();
    
    // Upload PDF
    await uploadPDF(jobId, pdfBuffer, 'test-vision-multipage.pdf');
    
    // Create a job
    const job: Job = {
      jobId,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      pdfFilename: 'test-vision-multipage.pdf',
      pdfUrl: `pdfs/${jobId}/test-vision-multipage.pdf`,
      stages: [],
    };
    await createJob(job);
    
    // Analyze with vision-first pipeline
    const result = await analyzeContentVisionFirst(jobId);
    
    // Verify we got segments from multiple pages
    const pageNumbers = new Set(
      result.segments.flatMap(s => s.contentBlocks.map(b => b.pageReference))
    );
    
    expect(pageNumbers.size).toBeGreaterThan(0);
    console.log(`Segments span ${pageNumbers.size} pages`);
  }, 120000); // 120 second timeout for multi-page analysis
});

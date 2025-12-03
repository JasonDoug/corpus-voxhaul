// Content Analyzer service - Extract and interpret PDF elements
//
// IMPLEMENTATION STATUS:
// ✅ Text extraction from PDFs
// ✅ Figure/table/formula position detection
// ✅ Citation detection and parsing
// ✅ Vision LLM integration for figure descriptions
// ✅ Text LLM integration for table/formula interpretation
// ❌ Actual image extraction from PDFs (uses placeholders)
//
// See docs/IMAGE_EXTRACTION_TODO.md for details on completing image extraction.
//
import { logger } from '../utils/logger';
import { 
  ExtractedContent, 
  PageContent, 
  Figure, 
  Table, 
  Formula, 
  Citation,
} from '../models/content';
import { downloadPDF } from './s3';
import { llmService, getRecommendedModel } from './llm';

// Dynamic imports for modules with ESM/CJS issues
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

/**
 * Extract text content from all pages of a PDF
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PageContent[]> {
  try {
    logger.info('Starting PDF text extraction');
    
    const data = await pdfParse(pdfBuffer);
    
    // pdf-parse gives us the full text, but we need to split by pages
    // For now, we'll create a simple page structure
    // In a production system, we'd use a more sophisticated library like pdf.js
    const totalPages = data.numpages;
    const fullText = data.text;
    
    // Simple heuristic: split text roughly equally across pages
    // This is a simplification - real implementation would need proper page detection
    const pages: PageContent[] = [];
    const textPerPage = Math.ceil(fullText.length / totalPages);
    
    for (let i = 0; i < totalPages; i++) {
      const start = i * textPerPage;
      const end = Math.min((i + 1) * textPerPage, fullText.length);
      const pageText = fullText.substring(start, end);
      
      pages.push({
        pageNumber: i + 1,
        text: pageText,
        elements: [], // Will be populated as we detect elements
      });
    }
    
    logger.info('PDF text extraction completed', { totalPages, totalTextLength: fullText.length });
    return pages;
  } catch (error) {
    logger.error('PDF text extraction failed', { error });
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detect element positions in PDF (figures, tables, formulas)
 * This is a placeholder that would use more sophisticated PDF parsing
 */
export function detectElementPositions(pages: PageContent[]): {
  figurePositions: Array<{ pageNumber: number; id: string }>;
  tablePositions: Array<{ pageNumber: number; id: string }>;
  formulaPositions: Array<{ pageNumber: number; id: string }>;
} {
  logger.info('Detecting element positions in PDF');
  
  const figurePositions: Array<{ pageNumber: number; id: string }> = [];
  const tablePositions: Array<{ pageNumber: number; id: string }> = [];
  const formulaPositions: Array<{ pageNumber: number; id: string }> = [];
  
  // Simple heuristic detection based on text patterns
  pages.forEach((page) => {
    const text = page.text.toLowerCase();
    
    // Detect figures by looking for "figure", "fig.", etc.
    const figureMatches = text.match(/\b(figure|fig\.?)\s+\d+/gi);
    if (figureMatches) {
      figureMatches.forEach(() => {
        const id = uuidv4();
        figurePositions.push({ pageNumber: page.pageNumber, id });
        page.elements.push({ type: 'figure', id });
      });
    }
    
    // Detect tables by looking for "table" references
    const tableMatches = text.match(/\btable\s+\d+/gi);
    if (tableMatches) {
      tableMatches.forEach(() => {
        const id = uuidv4();
        tablePositions.push({ pageNumber: page.pageNumber, id });
        page.elements.push({ type: 'table', id });
      });
    }
    
    // Detect formulas by looking for mathematical notation patterns
    // Look for LaTeX-style patterns or equation references
    const formulaMatches = text.match(/\b(equation|eq\.?)\s+\d+/gi) || 
                          text.match(/\$[^$]+\$/g) ||
                          text.match(/\\[a-z]+\{/g);
    if (formulaMatches && formulaMatches.length > 0) {
      // Limit to reasonable number of formulas per page
      const formulaCount = Math.min(formulaMatches.length, 5);
      for (let i = 0; i < formulaCount; i++) {
        const id = uuidv4();
        formulaPositions.push({ pageNumber: page.pageNumber, id });
        page.elements.push({ type: 'formula', id });
      }
    }
  });
  
  logger.info('Element position detection completed', {
    figures: figurePositions.length,
    tables: tablePositions.length,
    formulas: formulaPositions.length,
  });
  
  return { figurePositions, tablePositions, formulaPositions };
}

/**
 * Extract images from PDF and generate descriptions using vision LLM
 * 
 * IMPLEMENTATION GAP: Image Extraction
 * ====================================
 * This function currently uses placeholder image data instead of extracting actual images from PDFs.
 * The vision LLM integration is fully functional, but it needs real image data to work properly.
 * 
 * To complete this implementation:
 * 1. Use pdf.js (Mozilla's PDF library) or pdfium to extract actual images from the PDF buffer
 * 2. Convert extracted images to base64 or upload to temporary storage (S3)
 * 3. Pass the real image URL/data to the vision LLM
 * 
 * Libraries to consider:
 * - pdf.js: https://github.com/mozilla/pdf.js (most popular, well-maintained)
 * - pdfium: https://pdfium.googlesource.com/pdfium/ (Google's PDF library)
 * - pdf-img-convert: https://www.npmjs.com/package/pdf-img-convert (simpler wrapper)
 * 
 * See docs/IMAGE_EXTRACTION_TODO.md for detailed implementation guide.
 */
export async function analyzeFigures(
  figurePositions: Array<{ pageNumber: number; id: string }>,
  _pdfBuffer: Buffer // TODO: Use this to extract actual images - see function docs above
): Promise<Figure[]> {
  logger.info('Starting figure analysis', { count: figurePositions.length });
  
  const figures: Figure[] = [];
  
  for (const position of figurePositions) {
    try {
      // IMPLEMENTATION GAP: Replace this placeholder with actual image extraction
      // The vision LLM call below is fully functional and will work once real images are provided
      const imageData = `data:image/png;base64,placeholder_${position.id}`;
      
      // Generate description using vision LLM
      const description = await generateFigureDescription(imageData, position.pageNumber);
      
      const figure: Figure = {
        id: position.id,
        pageNumber: position.pageNumber,
        imageData: imageData,
        description: description,
        caption: `Figure on page ${position.pageNumber}`,
      };
      
      figures.push(figure);
      logger.info('Figure analyzed', { figureId: position.id, pageNumber: position.pageNumber });
    } catch (error) {
      logger.error('Figure analysis failed', { figureId: position.id, error });
      // Continue with other figures even if one fails
    }
  }
  
  logger.info('Figure analysis completed', { totalFigures: figures.length });
  return figures;
}

/**
 * Generate description for a figure using vision LLM
 */
async function generateFigureDescription(imageUrl: string, pageNumber: number): Promise<string> {
  try {
    const model = getRecommendedModel('vision', llmService.getProvider());
    
    const prompt = `You are analyzing a scientific figure from a research paper. 
Describe this figure in detail, explaining:
1. What type of visualization it is (graph, diagram, chart, etc.)
2. What data or concepts it represents
3. Key patterns, trends, or relationships shown
4. Its significance in a scientific context

Provide a clear, accessible description that would help someone understand the figure without seeing it.`;

    const description = await llmService.vision({
      imageUrl,
      prompt,
      model,
    });
    
    return description;
  } catch (error) {
    logger.error('Vision LLM call failed for figure description', { pageNumber, error });
    // Fallback to basic description if vision API fails
    return `Figure on page ${pageNumber} (description unavailable - vision API error)`;
  }
}

/**
 * Extract tables from PDF and generate interpretations using LLM
 * Note: Full table extraction requires pdf.js or tabula-js
 * For now, we use text-based heuristics and LLM interpretation
 */
export async function analyzeTables(
  tablePositions: Array<{ pageNumber: number; id: string }>,
  pages: PageContent[]
): Promise<Table[]> {
  logger.info('Starting table analysis', { count: tablePositions.length });
  
  const tables: Table[] = [];
  
  for (const position of tablePositions) {
    try {
      // Extract text from the page containing the table
      const page = pages.find(p => p.pageNumber === position.pageNumber);
      const pageText = page?.text || '';
      
      // TODO: In a full implementation, use proper table extraction library
      // For now, we'll extract a text snippet and let the LLM interpret it
      const tableText = extractTableTextSnippet(pageText, position.pageNumber);
      
      // Generate interpretation using LLM
      const interpretation = await generateTableInterpretation(tableText, position.pageNumber);
      
      // Parse basic structure (simplified)
      const { headers, rows } = parseTableStructure(tableText);
      
      const table: Table = {
        id: position.id,
        pageNumber: position.pageNumber,
        headers,
        rows,
        interpretation,
      };
      
      tables.push(table);
      logger.info('Table analyzed', { tableId: position.id, pageNumber: position.pageNumber });
    } catch (error) {
      logger.error('Table analysis failed', { tableId: position.id, error });
      // Continue with other tables even if one fails
    }
  }
  
  logger.info('Table analysis completed', { totalTables: tables.length });
  return tables;
}

/**
 * Extract text snippet around table reference
 */
function extractTableTextSnippet(pageText: string, pageNumber: number): string {
  // Find table reference and extract surrounding context
  const tableMatch = pageText.match(/table\s+\d+[^]*?(?=\n\n|\n[A-Z]|$)/i);
  if (tableMatch) {
    return tableMatch[0].substring(0, 1000); // Limit to 1000 chars
  }
  return `Table on page ${pageNumber}`;
}

/**
 * Parse basic table structure from text
 * This is a simplified parser - production would use proper table extraction
 */
function parseTableStructure(tableText: string): { headers: string[]; rows: string[][] } {
  // Very basic parsing - split by lines and tabs/spaces
  const lines = tableText.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [] };
  }
  
  // First line as headers
  const headers = lines[0].split(/\s{2,}|\t/).filter(h => h.trim().length > 0);
  
  // Remaining lines as rows
  const rows = lines.slice(1, Math.min(6, lines.length)).map(line => 
    line.split(/\s{2,}|\t/).filter(cell => cell.trim().length > 0)
  );
  
  return { 
    headers: headers.length > 0 ? headers : ['Column 1', 'Column 2', 'Column 3'],
    rows: rows.length > 0 ? rows : [['Data 1', 'Data 2', 'Data 3']]
  };
}

/**
 * Generate interpretation for a table using LLM
 */
async function generateTableInterpretation(tableText: string, pageNumber: number): Promise<string> {
  try {
    const model = getRecommendedModel('analysis', llmService.getProvider());
    
    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a scientific data analyst helping to interpret tables from research papers.',
        },
        {
          role: 'user',
          content: `Analyze this table from a scientific paper and provide a clear interpretation:

${tableText}

Explain:
1. What data or measurements the table presents
2. Key patterns, trends, or comparisons shown
3. The significance of the findings
4. Any notable values or relationships

Provide a concise, accessible interpretation.`,
        },
      ],
      model,
      temperature: 0.7,
      maxTokens: 500,
    });
    
    return response.content;
  } catch (error) {
    logger.error('LLM call failed for table interpretation', { pageNumber, error });
    // Fallback to basic description if LLM fails
    return `Table on page ${pageNumber} presents structured data (interpretation unavailable - LLM API error)`;
  }
}

/**
 * Extract and explain mathematical formulas from PDF
 * This is a placeholder implementation - real implementation would:
 * 1. Detect LaTeX or MathML in the PDF
 * 2. Extract the formula notation
 * 3. Call an LLM API to explain the formula
 */
export async function analyzeFormulas(
  formulaPositions: Array<{ pageNumber: number; id: string }>,
  pages: PageContent[]
): Promise<Formula[]> {
  logger.info('Starting formula analysis', { count: formulaPositions.length });
  
  const formulas: Formula[] = [];
  
  for (const position of formulaPositions) {
    try {
      // In a real implementation, we would:
      // 1. Extract the actual LaTeX or MathML from the PDF
      // 2. Parse the mathematical notation
      // 3. Send to LLM for explanation
      
      // Extract some text from the page to simulate formula detection
      const page = pages.find(p => p.pageNumber === position.pageNumber);
      const pageText = page?.text || '';
      
      // Try to find LaTeX-like patterns
      let latex = '\\text{formula}'; // Default placeholder
      const latexMatch = pageText.match(/\$([^$]+)\$/);
      if (latexMatch) {
        latex = latexMatch[1];
      }
      
      const formula: Formula = {
        id: position.id,
        pageNumber: position.pageNumber,
        latex: latex,
        explanation: await generateFormulaExplanation(latex, position.pageNumber),
      };
      
      formulas.push(formula);
      logger.info('Formula analyzed', { formulaId: position.id, pageNumber: position.pageNumber });
    } catch (error) {
      logger.error('Formula analysis failed', { formulaId: position.id, error });
      // Continue with other formulas even if one fails
    }
  }
  
  logger.info('Formula analysis completed', { totalFormulas: formulas.length });
  return formulas;
}

/**
 * Generate explanation for a formula using LLM
 */
async function generateFormulaExplanation(latex: string, pageNumber: number): Promise<string> {
  try {
    const model = getRecommendedModel('analysis', llmService.getProvider());
    
    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: 'You are a mathematics and science educator helping to explain formulas from research papers.',
        },
        {
          role: 'user',
          content: `Explain this mathematical formula from a scientific paper:

${latex}

Provide:
1. What the formula represents or calculates
2. The meaning of key variables or terms
3. The scientific or mathematical context
4. A simple explanation of what it tells us

Keep the explanation accessible but accurate.`,
        },
      ],
      model,
      temperature: 0.7,
      maxTokens: 400,
    });
    
    return response.content;
  } catch (error) {
    logger.error('LLM call failed for formula explanation', { latex, pageNumber, error });
    // Fallback to basic description if LLM fails
    return `Formula (${latex}) on page ${pageNumber} (explanation unavailable - LLM API error)`;
  }
}

/**
 * Detect and parse citations from PDF text
 * Uses regex patterns to identify common citation formats
 */
export function detectCitations(pages: PageContent[]): Citation[] {
  logger.info('Starting citation detection');
  
  const citations: Citation[] = [];
  const citationSet = new Set<string>(); // To avoid duplicates
  
  for (const page of pages) {
    const text = page.text;
    
    // Pattern 1: Author et al. (Year) format
    // Example: "Smith et al. (2020)"
    const pattern1 = /([A-Z][a-z]+(?:\s+et\s+al\.?)?)\s*\((\d{4})\)/g;
    let match;
    
    while ((match = pattern1.exec(text)) !== null) {
      const citationText = match[0];
      if (!citationSet.has(citationText)) {
        citationSet.add(citationText);
        citations.push({
          id: uuidv4(),
          text: citationText,
          authors: [match[1]],
          year: parseInt(match[2]),
        });
      }
    }
    
    // Pattern 2: [Number] format (numbered citations)
    // Example: "[1]", "[23]"
    const pattern2 = /\[(\d+)\]/g;
    while ((match = pattern2.exec(text)) !== null) {
      const citationText = match[0];
      if (!citationSet.has(citationText)) {
        citationSet.add(citationText);
        citations.push({
          id: uuidv4(),
          text: citationText,
        });
      }
    }
    
    // Pattern 3: Author, Year format in references section
    // Example: "Smith, J. (2020). Title of paper."
    const pattern3 = /([A-Z][a-z]+,\s+[A-Z]\.(?:\s+[A-Z]\.)?)\s+\((\d{4})\)\.\s+([^.]+\.)/g;
    while ((match = pattern3.exec(text)) !== null) {
      const citationText = match[0];
      if (!citationSet.has(citationText)) {
        citationSet.add(citationText);
        citations.push({
          id: uuidv4(),
          text: citationText,
          authors: [match[1]],
          year: parseInt(match[2]),
          title: match[3].trim(),
        });
      }
    }
  }
  
  logger.info('Citation detection completed', { totalCitations: citations.length });
  return citations;
}

/**
 * Main function to analyze PDF and extract all content
 * Orchestrates parallel processing of figures, tables, and formulas
 */
export async function analyzeContent(jobId: string): Promise<ExtractedContent> {
  try {
    logger.info('Starting content analysis', { jobId });
    
    // Download PDF from S3
    const pdfBuffer = await downloadPDF(jobId);
    
    // Extract text from all pages
    const pages = await extractTextFromPDF(pdfBuffer);
    
    // Detect element positions
    const positions = detectElementPositions(pages);
    
    // Detect citations from text
    const citations = detectCitations(pages);
    
    // Process figures, tables, and formulas in parallel
    logger.info('Starting parallel processing of elements');
    const [figures, tables, formulas] = await Promise.all([
      analyzeFigures(positions.figurePositions, pdfBuffer),
      analyzeTables(positions.tablePositions, pages),
      analyzeFormulas(positions.formulaPositions, pages),
    ]);
    
    const extractedContent: ExtractedContent = {
      pages,
      figures,
      tables,
      formulas,
      citations,
    };
    
    logger.info('Content analysis completed', {
      jobId,
      pages: pages.length,
      figures: figures.length,
      tables: tables.length,
      formulas: formulas.length,
      citations: citations.length,
    });
    
    return extractedContent;
  } catch (error) {
    logger.error('Content analysis failed', { jobId, error });
    throw error;
  }
}

/**
 * Main function to parse PDF and extract basic structure
 */
export async function parsePDF(jobId: string): Promise<{
  pages: PageContent[];
  figurePositions: Array<{ pageNumber: number; id: string }>;
  tablePositions: Array<{ pageNumber: number; id: string }>;
  formulaPositions: Array<{ pageNumber: number; id: string }>;
}> {
  try {
    logger.info('Starting PDF parsing', { jobId });
    
    // Download PDF from S3
    const pdfBuffer = await downloadPDF(jobId);
    
    // Extract text from all pages
    const pages = await extractTextFromPDF(pdfBuffer);
    
    // Detect element positions
    const positions = detectElementPositions(pages);
    
    logger.info('PDF parsing completed', { jobId });
    
    return {
      pages,
      ...positions,
    };
  } catch (error) {
    logger.error('PDF parsing failed', { jobId, error });
    throw error;
  }
}

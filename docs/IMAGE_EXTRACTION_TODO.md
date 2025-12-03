# Image Extraction Implementation Gap

## Status: ⚠️ Incomplete

The PDF Content Analyzer has a **fully functional LLM integration** for analyzing figures using vision models (GPT-4 Vision, Claude Vision, etc.), but it currently uses **placeholder image data** instead of extracting actual images from PDFs.

## What Works ✅

- ✅ Vision LLM integration (OpenRouter, OpenAI, Anthropic)
- ✅ Figure position detection (text-based heuristics)
- ✅ LLM prompt engineering for figure descriptions
- ✅ Error handling and retry logic
- ✅ Parallel processing of multiple figures
- ✅ Storage and retrieval of figure metadata

## What's Missing ❌

- ❌ **Actual image extraction from PDF files**
- ❌ Image format conversion (PDF → PNG/JPEG)
- ❌ Image quality optimization for vision APIs
- ❌ Handling of embedded vs. referenced images

## Current Behavior

When a figure is detected in a PDF:

1. ✅ The system identifies the page number and creates a unique ID
2. ❌ **Creates placeholder image data**: `data:image/png;base64,placeholder_${id}`
3. ✅ Calls the vision LLM with the placeholder (which won't produce useful results)
4. ✅ Stores the description in the database

## Required Implementation

### Option 1: Using pdf.js (Recommended)

**pdf.js** is Mozilla's PDF rendering library, widely used and well-maintained.

```typescript
import * as pdfjsLib from 'pdfjs-dist';

async function extractImagesFromPDF(pdfBuffer: Buffer, pageNumber: number): Promise<string[]> {
  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdf = await loadingTask.promise;
  
  // Get the specific page
  const page = await pdf.getPage(pageNumber);
  
  // Get the page's operations
  const ops = await page.getOperatorList();
  
  const images: string[] = [];
  
  // Extract images from the operations
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const imageName = ops.argsArray[i][0];
      
      // Get the image object
      const image = await page.objs.get(imageName);
      
      // Convert to base64
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      
      const imageData = ctx.createImageData(image.width, image.height);
      imageData.data.set(image.data);
      ctx.putImageData(imageData, 0, 0);
      
      const base64 = canvas.toDataURL('image/png');
      images.push(base64);
    }
  }
  
  return images;
}
```

**Installation:**
```bash
npm install pdfjs-dist
```

**Pros:**
- Most popular PDF library in JavaScript
- Well-documented and maintained
- Handles complex PDF structures
- Can render entire pages as images

**Cons:**
- Requires canvas API (need to use node-canvas in Node.js)
- Larger bundle size
- More complex API

### Option 2: Using pdf-img-convert (Simpler)

**pdf-img-convert** is a simpler wrapper that converts PDF pages to images.

```typescript
import { convert } from 'pdf-img-convert';

async function extractPageAsImage(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
  // Convert specific page to image
  const images = await convert(pdfBuffer, {
    page_numbers: [pageNumber],
    base64: true,
    width: 2000, // High resolution for vision models
    height: 2000,
  });
  
  // Return the first (and only) image
  return `data:image/png;base64,${images[0]}`;
}
```

**Installation:**
```bash
npm install pdf-img-convert
```

**Pros:**
- Very simple API
- Automatically handles image conversion
- Returns base64 directly
- Good for extracting entire pages

**Cons:**
- Extracts entire page, not individual figures
- Less control over image extraction
- May include text and other elements

### Option 3: Using pdfium (Google's Library)

**pdfium** is Google's PDF rendering engine, used in Chrome.

```typescript
import { PDFDocument } from 'pdfium';

async function extractImagesWithPdfium(pdfBuffer: Buffer, pageNumber: number): Promise<string[]> {
  const doc = await PDFDocument.load(pdfBuffer);
  const page = doc.getPage(pageNumber - 1); // 0-indexed
  
  const images: string[] = [];
  const imageCount = page.getImageCount();
  
  for (let i = 0; i < imageCount; i++) {
    const image = page.getImage(i);
    const bitmap = image.getBitmap();
    
    // Convert bitmap to base64
    const base64 = bitmap.toBase64('png');
    images.push(`data:image/png;base64,${base64}`);
  }
  
  return images;
}
```

**Installation:**
```bash
npm install @hyzyla/pdfium
```

**Pros:**
- Fast and efficient
- Used by Google Chrome
- Good image extraction capabilities

**Cons:**
- Less documentation
- Smaller community
- May require native bindings

## Recommended Approach

### Phase 1: Quick Win (Use pdf-img-convert)

For a quick implementation that works immediately:

1. Install `pdf-img-convert`
2. Extract entire page as image when figure is detected
3. Send page image to vision LLM
4. Let the LLM identify and describe the figure within the page

**Pros:** Fast to implement, works immediately
**Cons:** Less precise, higher API costs (larger images)

### Phase 2: Precise Extraction (Use pdf.js)

For production-quality implementation:

1. Install `pdf.js` and `node-canvas`
2. Extract individual images from PDF structure
3. Match extracted images to detected figure positions
4. Send only the specific figure image to vision LLM

**Pros:** More accurate, lower API costs, better quality
**Cons:** More complex implementation

## Implementation Steps

### Step 1: Update `analyzeFigures` function

```typescript
export async function analyzeFigures(
  figurePositions: Array<{ pageNumber: number; id: string }>,
  pdfBuffer: Buffer
): Promise<Figure[]> {
  logger.info('Starting figure analysis', { count: figurePositions.length });
  
  const figures: Figure[] = [];
  
  for (const position of figurePositions) {
    try {
      // STEP 1: Extract actual image from PDF
      const imageData = await extractImageFromPDF(pdfBuffer, position.pageNumber);
      
      // STEP 2: Optionally upload to S3 for temporary storage
      // const imageUrl = await uploadImageToS3(imageData, position.id);
      
      // STEP 3: Generate description using vision LLM (already implemented!)
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
```

### Step 2: Add image extraction helper

```typescript
/**
 * Extract image from PDF page
 * Choose implementation based on your needs (see options above)
 */
async function extractImageFromPDF(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
  // Option 1: Simple page extraction (quick win)
  return await extractPageAsImage(pdfBuffer, pageNumber);
  
  // Option 2: Precise image extraction (production)
  // const images = await extractImagesFromPDF(pdfBuffer, pageNumber);
  // return images[0]; // Return first image on page
}
```

### Step 3: Test with real PDFs

```typescript
// Test with a real scientific PDF
const testPdfBuffer = fs.readFileSync('test-paper.pdf');
const figures = await analyzeFigures(
  [{ pageNumber: 1, id: 'test-fig-1' }],
  testPdfBuffer
);

console.log('Figure description:', figures[0].description);
// Should now contain actual analysis from vision LLM!
```

## Vision API Considerations

### Image Size Optimization

Vision APIs have token limits based on image size. Optimize images before sending:

```typescript
async function optimizeImageForVisionAPI(base64Image: string): Promise<string> {
  // Resize to max 2000x2000 (good balance of quality and cost)
  // Compress to reduce token usage
  // Convert to JPEG if PNG is too large
  
  // Use sharp or jimp for image processing
  const buffer = Buffer.from(base64Image.split(',')[1], 'base64');
  const optimized = await sharp(buffer)
    .resize(2000, 2000, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  return `data:image/jpeg;base64,${optimized.toString('base64')}`;
}
```

### Cost Estimation

- **GPT-4 Vision**: ~$0.01-0.03 per image (depending on size)
- **Claude Vision**: ~$0.01-0.02 per image
- **Optimization**: Smaller images = lower costs

## Testing Strategy

### Unit Tests

```typescript
describe('Image Extraction', () => {
  it('should extract images from PDF', async () => {
    const pdfBuffer = await loadTestPDF();
    const images = await extractImagesFromPDF(pdfBuffer, 1);
    
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toMatch(/^data:image\/(png|jpeg);base64,/);
  });
  
  it('should handle PDFs with no images', async () => {
    const pdfBuffer = await loadTextOnlyPDF();
    const images = await extractImagesFromPDF(pdfBuffer, 1);
    
    expect(images.length).toBe(0);
  });
});
```

### Integration Tests

```typescript
describe('Figure Analysis with Real Images', () => {
  it('should generate meaningful descriptions', async () => {
    const pdfBuffer = await loadScientificPDF();
    const figures = await analyzeFigures(
      [{ pageNumber: 1, id: 'test-1' }],
      pdfBuffer
    );
    
    expect(figures[0].description).not.toContain('placeholder');
    expect(figures[0].description.length).toBeGreaterThan(50);
  });
});
```

## Timeline Estimate

- **Quick Win (pdf-img-convert)**: 2-4 hours
- **Production (pdf.js)**: 1-2 days
- **Testing & Optimization**: 1 day

## Related Files

- `src/services/analyzer.ts` - Main analyzer implementation
- `src/services/llm.ts` - Vision LLM integration (already complete)
- `src/models/content.ts` - Figure data model

## Questions?

If you need help implementing this, consider:

1. What's your priority: speed or precision?
2. What's your budget for vision API calls?
3. Do you need to extract individual figures or can you send entire pages?

Choose your approach based on these answers!

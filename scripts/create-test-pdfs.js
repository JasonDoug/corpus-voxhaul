#!/usr/bin/env node
/**
 * Create Test PDFs with Graduating Difficulty
 * 
 * Creates 5 PDFs:
 * 1. Simple text only
 * 2. Text with citations and formulas
 * 3. Text with footnotes and references
 * 4. Text with figures and diagrams
 * 5. Complex with charts, graphs, tables
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createPDF1_SimpleText() {
  console.log('Creating PDF 1: Simple Text Only...');
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  
  // Title
  page.drawText('Introduction to Machine Learning', {
    x: 50,
    y: height - 50,
    size: 20,
    font: boldFont,
  });
  
  // Abstract
  page.drawText('Abstract', {
    x: 50,
    y: height - 100,
    size: 14,
    font: boldFont,
  });
  
  const abstract = `Machine learning is a subset of artificial intelligence that enables
computers to learn from data without being explicitly programmed. This
paper provides an introduction to fundamental concepts in machine learning
including supervised learning, unsupervised learning, and reinforcement
learning. We discuss key algorithms and their applications in real-world
scenarios.`;
  
  drawWrappedText(page, abstract, 50, height - 130, width - 100, 10, font);
  
  // Introduction
  page.drawText('1. Introduction', {
    x: 50,
    y: height - 250,
    size: 14,
    font: boldFont,
  });
  
  const intro = `Machine learning has revolutionized how we approach problem-solving in
computer science. By allowing systems to learn patterns from data, we can
create intelligent applications that improve over time. The field has grown
exponentially in recent years, driven by increases in computational power
and the availability of large datasets.`;
  
  drawWrappedText(page, intro, 50, height - 280, width - 100, 10, font);
  
  // Supervised Learning
  page.drawText('2. Supervised Learning', {
    x: 50,
    y: height - 400,
    size: 14,
    font: boldFont,
  });
  
  const supervised = `Supervised learning involves training a model on labeled data. The algorithm
learns to map inputs to outputs based on example input-output pairs. Common
applications include classification tasks like spam detection and regression
tasks like price prediction. The model's performance is evaluated using
metrics such as accuracy, precision, and recall.`;
  
  drawWrappedText(page, supervised, 50, height - 430, width - 100, 10, font);
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join('test-pdfs', '1-simple-text.pdf'), pdfBytes);
  console.log('✓ Created: test-pdfs/1-simple-text.pdf');
}

async function createPDF2_WithCitationsFormulas() {
  console.log('\nCreating PDF 2: With Citations and Formulas...');
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const { width, height } = page.getSize();
  
  let yPos = height - 50;
  
  // Title
  page.drawText('Neural Networks and Backpropagation', {
    x: 50,
    y: yPos,
    size: 20,
    font: boldFont,
  });
  yPos -= 60;
  
  // Abstract with citation
  page.drawText('Abstract', {
    x: 50,
    y: yPos,
    size: 14,
    font: boldFont,
  });
  yPos -= 30;
  
  const abstract = `Neural networks have become the foundation of modern deep learning
(LeCun et al., 2015). This paper explores the backpropagation algorithm,
which enables efficient training of multi-layer networks through gradient
descent (Rumelhart et al., 1986).`;
  
  yPos = drawWrappedText(page, abstract, 50, yPos, width - 100, 10, font);
  yPos -= 40;
  
  // Mathematical formulation
  page.drawText('1. Mathematical Foundation', {
    x: 50,
    y: yPos,
    size: 14,
    font: boldFont,
  });
  yPos -= 30;
  
  const mathText = `The activation function for a neuron can be expressed as:`;
  yPos = drawWrappedText(page, mathText, 50, yPos, width - 100, 10, font);
  yPos -= 30;
  
  // Formula
  page.drawText('y = f(w * x + b)', {
    x: 100,
    y: yPos,
    size: 12,
    font: italicFont,
  });
  yPos -= 30;
  
  const formulaExplain = `where w represents weights, x is the input vector, b is the bias term,
and f is the activation function (Goodfellow et al., 2016).`;
  yPos = drawWrappedText(page, formulaExplain, 50, yPos, width - 100, 10, font);
  yPos -= 40;
  
  // Loss function
  page.drawText('The mean squared error loss is defined as:', {
    x: 50,
    y: yPos,
    size: 10,
    font,
  });
  yPos -= 25;
  
  page.drawText('L = (1/n) * sum((y_pred - y_true)^2)', {
    x: 100,
    y: yPos,
    size: 12,
    font: italicFont,
  });
  yPos -= 40;
  
  // References section
  page.drawText('References', {
    x: 50,
    y: yPos,
    size: 14,
    font: boldFont,
  });
  yPos -= 25;
  
  const refs = [
    'LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444.',
    'Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986). Learning representations by back-propagating errors.',
    'Goodfellow, I., Bengio, Y., & Courville, A. (2016). Deep Learning. MIT Press.',
  ];
  
  refs.forEach(ref => {
    yPos = drawWrappedText(page, ref, 50, yPos, width - 100, 10, font);
    yPos -= 15;
  });
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join('test-pdfs', '2-citations-formulas.pdf'), pdfBytes);
  console.log('✓ Created: test-pdfs/2-citations-formulas.pdf');
}

async function createPDF3_WithFootnotes() {
  console.log('\nCreating PDF 3: With Footnotes and References...');
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const smallFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  
  let yPos = height - 50;
  
  // Title
  page.drawText('Convolutional Neural Networks', {
    x: 50,
    y: yPos,
    size: 20,
    font: boldFont,
  });
  yPos -= 60;
  
  // Content with footnote markers
  const content1 = `Convolutional Neural Networks (CNNs) are specialized neural networks
designed for processing grid-like data such as images[1]. The architecture
consists of convolutional layers that apply filters to detect features[2].`;
  yPos = drawWrappedText(page, content1, 50, yPos, width - 100, 10, font);
  yPos -= 30;
  
  page.drawText('1.1 Convolutional Layers', {
    x: 50,
    y: yPos,
    size: 14,
    font: boldFont,
  });
  yPos -= 25;
  
  const content2 = `Each convolutional layer applies multiple filters to the input[3]. These
filters learn to detect specific patterns such as edges, textures, and
more complex features in deeper layers. The convolution operation can be
mathematically expressed as a dot product between the filter and local
regions of the input[4].`;
  yPos = drawWrappedText(page, content2, 50, yPos, width - 100, 10, font);
  yPos -= 40;
  
  // Footnotes at bottom
  page.drawLine({
    start: { x: 50, y: 120 },
    end: { x: width - 50, y: 120 },
    thickness: 0.5,
  });
  
  const footnotes = [
    '[1] First introduced by LeCun et al. in 1998 for handwritten digit recognition.',
    '[2] Also known as feature maps or activation maps.',
    '[3] Typically 32, 64, or 128 filters per layer in modern architectures.',
    '[4] This operation preserves spatial relationships in the data.',
  ];
  
  let footnoteY = 100;
  footnotes.forEach(footnote => {
    page.drawText(footnote, {
      x: 50,
      y: footnoteY,
      size: 8,
      font: smallFont,
    });
    footnoteY -= 15;
  });
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join('test-pdfs', '3-footnotes-references.pdf'), pdfBytes);
  console.log('✓ Created: test-pdfs/3-footnotes-references.pdf');
}

// Helper function to draw wrapped text
function drawWrappedText(page, text, x, y, maxWidth, fontSize, font) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  words.forEach(word => {
    const testLine = line + word + ' ';
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth > maxWidth && line !== '') {
      page.drawText(line.trim(), { x, y: currentY, size: fontSize, font });
      line = word + ' ';
      currentY -= fontSize + 5;
    } else {
      line = testLine;
    }
  });
  
  if (line.trim() !== '') {
    page.drawText(line.trim(), { x, y: currentY, size: fontSize, font });
    currentY -= fontSize + 5;
  }
  
  return currentY;
}

async function main() {
  console.log('Creating Test PDFs with Graduating Difficulty\n');
  console.log('='.repeat(60));
  
  await createPDF1_SimpleText();
  await createPDF2_WithCitationsFormulas();
  await createPDF3_WithFootnotes();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Created 3 test PDFs');
  console.log('\nNote: PDFs 4 and 5 (with figures/charts) require image');
  console.log('embedding which is complex with pdf-lib. Consider using');
  console.log('real scientific PDFs from arXiv for those tests.');
}

main().catch(console.error);

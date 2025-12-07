#!/usr/bin/env node

/**
 * End-to-End Test for Vision-First Pipeline
 * 
 * This script tests the complete vision-first pipeline:
 * 1. Upload a PDF
 * 2. Analyze with vision-first approach (combines analysis + segmentation)
 * 3. Generate script
 * 4. Synthesize audio
 * 5. Verify playback data
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ${message}`, 'blue');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadPDF() {
  logStep('1', 'Uploading PDF');
  
  // Read test PDF
  const pdfPath = path.join(__dirname, '../The Constitution of the Roman Republic.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error('Test PDF not found');
  }
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  logInfo(`PDF size: ${pdfBuffer.length} bytes`);
  
  // Upload
  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: Array.from(pdfBuffer),
      filename: 'test-vision-first.pdf',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }
  
  const data = await response.json();
  logSuccess(`Upload successful`);
  logInfo(`Job ID: ${data.jobId}`);
  
  return data.jobId;
}

async function analyzeWithVisionFirst(jobId) {
  logStep('2', 'Analyzing with Vision-First Pipeline');
  
  const response = await fetch(`${BASE_URL}/api/analyze/${jobId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }
  
  const data = await response.json();
  logSuccess(`Vision-first analysis completed`);
  logInfo(`Status: ${data.status}`);
  
  if (data.segmentedContent) {
    logInfo(`Segments: ${data.segmentedContent.segments}`);
  }
  
  return data;
}

async function waitForStatus(jobId, targetStatus, maxWaitMs = 120000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${BASE_URL}/api/status/${jobId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get status');
    }
    
    const data = await response.json();
    
    if (data.status === targetStatus) {
      return data;
    }
    
    if (data.status === 'failed') {
      throw new Error(`Job failed: ${data.error}`);
    }
    
    logInfo(`Current status: ${data.status}`);
    await sleep(2000);
  }
  
  throw new Error(`Timeout waiting for status: ${targetStatus}`);
}

async function generateScript(jobId) {
  logStep('3', 'Generating Script');
  
  const response = await fetch(`${BASE_URL}/api/script/${jobId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Script generation failed: ${error}`);
  }
  
  const data = await response.json();
  logSuccess(`Script generation completed`);
  logInfo(`Status: ${data.status}`);
  
  if (data.lectureScript) {
    logInfo(`Script segments: ${data.lectureScript.segments}`);
    logInfo(`Estimated duration: ${data.lectureScript.totalEstimatedDuration}s`);
  }
  
  return data;
}

async function synthesizeAudio(jobId) {
  logStep('4', 'Synthesizing Audio');
  
  const response = await fetch(`${BASE_URL}/api/audio/${jobId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Audio synthesis failed: ${error}`);
  }
  
  const data = await response.json();
  logSuccess(`Audio synthesis completed`);
  logInfo(`Status: ${data.status}`);
  
  if (data.audioOutput) {
    logInfo(`Audio URL: ${data.audioOutput.audioUrl}`);
    logInfo(`Duration: ${data.audioOutput.duration}s`);
    logInfo(`Word timings: ${data.audioOutput.wordTimingCount}`);
  }
  
  return data;
}

async function verifyPlayback(jobId) {
  logStep('5', 'Verifying Playback Data');
  
  const response = await fetch(`${BASE_URL}/api/player/${jobId}`);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Playback verification failed: ${error}`);
  }
  
  const data = await response.json();
  logSuccess(`Playback data retrieved`);
  
  // Verify structure
  if (!data.pdfUrl) throw new Error('Missing PDF URL');
  if (!data.script) throw new Error('Missing script');
  if (!data.audioUrl) throw new Error('Missing audio URL');
  if (!data.wordTimings) throw new Error('Missing word timings');
  
  logInfo(`PDF URL: ${data.pdfUrl}`);
  logInfo(`Script segments: ${data.script.segments.length}`);
  logInfo(`Audio URL: ${data.audioUrl}`);
  logInfo(`Word timings: ${data.wordTimings.length}`);
  
  return data;
}

async function main() {
  log('\n=== Vision-First Pipeline E2E Test ===\n', 'yellow');
  
  try {
    // Step 1: Upload PDF
    const jobId = await uploadPDF();
    
    // Step 2: Analyze with vision-first (combines analysis + segmentation)
    await analyzeWithVisionFirst(jobId);
    
    // Wait for script generation to be ready
    logInfo('Waiting for script generation stage...');
    await waitForStatus(jobId, 'generating_script', 60000);
    
    // Step 3: Generate script
    await generateScript(jobId);
    
    // Step 4: Synthesize audio
    await synthesizeAudio(jobId);
    
    // Step 5: Verify playback
    await verifyPlayback(jobId);
    
    log('\n=== All Tests Passed! ===\n', 'green');
    log('Vision-first pipeline is working correctly!', 'green');
    
    process.exit(0);
  } catch (error) {
    logError(`\nTest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

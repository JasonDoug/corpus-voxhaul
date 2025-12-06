#!/usr/bin/env node
/**
 * Performance and Cost Validation Script
 * 
 * This script measures processing time for each pipeline stage and validates costs.
 * 
 * Task: 20.6 Performance and cost validation
 * Requirements: All
 */

require('dotenv').config();
const http = require('http');
const { PDFDocument } = require('pdf-lib');

const BASE_URL = 'http://localhost:3000';
const POLL_INTERVAL = 1000; // 1 second for more granular timing
const MAX_WAIT_TIME = 600000; // 10 minutes

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${colors.bright}=== ${step} ===${colors.reset}`, colors.cyan);
  log(message);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logMetric(label, value, unit = '') {
  log(`  ${label}: ${colors.bright}${value}${unit}${colors.reset}`, colors.blue);
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Create a test scientific PDF with specified number of pages
 */
async function createTestPDF(numPages = 12) {
  const pdfDoc = await PDFDocument.create();
  
  for (let i = 0; i < numPages; i++) {
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();

    if (i === 0) {
      // Title page
      page.drawText('Quantum Entanglement in Photonic Systems', {
        x: 50,
        y: height - 50,
        size: 18,
      });

      page.drawText('Abstract', {
        x: 50,
        y: height - 100,
        size: 14,
      });

      const abstractText = `This paper investigates quantum entanglement phenomena in photonic systems.
We demonstrate that entangled photon pairs can be generated using spontaneous
parametric down-conversion (SPDC) in nonlinear crystals. Our experimental
results show strong correlations between photon polarizations, confirming
the non-local nature of quantum mechanics. The Bell inequality violations
observed in our experiments provide strong evidence for quantum non-locality.`;

      page.drawText(abstractText, {
        x: 50,
        y: height - 130,
        size: 10,
        maxWidth: width - 100,
      });
    } else {
      // Content pages
      page.drawText(`${i}. Section ${i}`, {
        x: 50,
        y: height - 50,
        size: 14,
      });

      const contentText = `This section discusses various aspects of quantum entanglement.
Quantum mechanics predicts that measurements on entangled particles are
correlated regardless of the distance between them. This phenomenon has
been experimentally verified numerous times and forms the basis for
quantum information technologies such as quantum cryptography and
quantum computing. The mathematical formalism involves tensor products
of Hilbert spaces and density matrices. Key concepts include:
- Superposition of quantum states
- Measurement and wave function collapse
- EPR paradox and Bell's theorem
- Quantum decoherence and environmental interactions
- Applications in quantum communication protocols`;

      page.drawText(contentText, {
        x: 50,
        y: height - 80,
        size: 10,
        maxWidth: width - 100,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Create test agent
 */
async function createAgent() {
  const agent = {
    name: 'Performance Test Agent',
    description: 'Agent for performance testing',
    personality: {
      instructions: 'Explain concepts clearly and concisely.',
      tone: 'serious',
    },
    voice: {
      voiceId: 'en-US-Neural2-J',
      speed: 1.0,
      pitch: 0,
    },
  };

  const response = await makeRequest('POST', '/api/agents', agent);
  
  if (response.status !== 201) {
    throw new Error(`Failed to create agent: ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  constructor() {
    this.metrics = {
      upload: { start: 0, end: 0, duration: 0 },
      analyze: { start: 0, end: 0, duration: 0 },
      segment: { start: 0, end: 0, duration: 0 },
      script: { start: 0, end: 0, duration: 0 },
      audio: { start: 0, end: 0, duration: 0 },
      total: { start: 0, end: 0, duration: 0 },
    };
    this.costs = {
      llmCalls: 0,
      ttsCalls: 0,
      visionCalls: 0,
      total: 0,
    };
  }

  startStage(stage) {
    this.metrics[stage].start = Date.now();
  }

  endStage(stage) {
    this.metrics[stage].end = Date.now();
    this.metrics[stage].duration = this.metrics[stage].end - this.metrics[stage].start;
  }

  getDuration(stage) {
    return this.metrics[stage].duration;
  }

  getTotalDuration() {
    return this.metrics.total.duration;
  }

  printSummary() {
    logStep('Performance Summary', 'Processing times for each stage');
    
    logMetric('Upload', (this.metrics.upload.duration / 1000).toFixed(2), 's');
    logMetric('Content Analysis', (this.metrics.analyze.duration / 1000).toFixed(2), 's');
    logMetric('Content Segmentation', (this.metrics.segment.duration / 1000).toFixed(2), 's');
    logMetric('Script Generation', (this.metrics.script.duration / 1000).toFixed(2), 's');
    logMetric('Audio Synthesis', (this.metrics.audio.duration / 1000).toFixed(2), 's');
    log('  ' + '-'.repeat(40));
    logMetric('Total Pipeline Time', (this.metrics.total.duration / 1000).toFixed(2), 's');
    
    const totalMinutes = this.metrics.total.duration / 60000;
    logMetric('Total Pipeline Time', totalMinutes.toFixed(2), ' minutes');
    
    // Validate against requirements
    log('');
    if (totalMinutes < 6) {
      logSuccess(`✓ Total time (${totalMinutes.toFixed(2)}m) is under 6 minute target`);
    } else {
      logWarning(`⚠ Total time (${totalMinutes.toFixed(2)}m) exceeds 6 minute target`);
    }
    
    // Identify bottlenecks
    log('');
    log('Bottleneck Analysis:', colors.cyan);
    const stages = ['upload', 'analyze', 'segment', 'script', 'audio'];
    const sortedStages = stages
      .map(stage => ({ stage, duration: this.metrics[stage].duration }))
      .sort((a, b) => b.duration - a.duration);
    
    sortedStages.forEach((item, index) => {
      const percentage = (item.duration / this.metrics.total.duration * 100).toFixed(1);
      const label = index === 0 ? '🔴 Slowest' : index === 1 ? '🟡 Second' : '  ';
      log(`  ${label} ${item.stage.padEnd(10)}: ${(item.duration / 1000).toFixed(2)}s (${percentage}%)`);
    });
  }

  printCostSummary(costData) {
    logStep('Cost Summary', 'API costs breakdown');
    
    if (costData) {
      logMetric('Total LLM Calls', costData.totalCalls || 0);
      logMetric('Total Tokens', costData.totalTokens || 0);
      logMetric('Total Cost', `$${(costData.totalCost || 0).toFixed(4)}`);
      
      if (costData.callsByOperation) {
        log('');
        log('Calls by Operation:', colors.cyan);
        Object.entries(costData.callsByOperation).forEach(([op, count]) => {
          log(`  ${op}: ${count} calls`);
        });
      }
      
      // Validate against requirements
      log('');
      const totalCost = costData.totalCost || 0;
      if (totalCost < 0.50) {
        logSuccess(`✓ Total cost ($${totalCost.toFixed(4)}) is under $0.50 target`);
      } else {
        logWarning(`⚠ Total cost ($${totalCost.toFixed(4)}) exceeds $0.50 target`);
      }
      
      if (totalCost === 0) {
        logSuccess('✓ Using free models - zero cost!');
      }
    } else {
      logWarning('Cost data not available from job');
      log('Note: Cost tracking is implemented in src/utils/llm-metrics.ts');
      log('Check server logs for detailed cost information');
    }
  }
}

/**
 * Upload PDF and measure time
 */
async function uploadPDF(agentId, pdfBuffer, tracker) {
  logStep('Stage 1', 'Uploading PDF');
  
  tracker.startStage('upload');
  
  const uploadData = {
    file: {
      type: 'Buffer',
      data: Array.from(pdfBuffer),
    },
    filename: 'performance-test.pdf',
    agentId,
  };

  const response = await makeRequest('POST', '/api/upload', uploadData);
  
  tracker.endStage('upload');
  
  if (response.status !== 200) {
    throw new Error(`Upload failed: ${JSON.stringify(response.body)}`);
  }

  logSuccess(`Upload complete in ${(tracker.getDuration('upload') / 1000).toFixed(2)}s`);
  logSuccess(`Job ID: ${response.body.jobId}`);
  
  return response.body.jobId;
}

/**
 * Run analysis stage and measure time
 */
async function runAnalysis(jobId, tracker) {
  logStep('Stage 2', 'Content Analysis');
  
  tracker.startStage('analyze');
  
  const response = await makeRequest('POST', `/api/analyze/${jobId}`);
  
  tracker.endStage('analyze');
  
  if (response.status !== 200) {
    throw new Error(`Analysis failed: ${JSON.stringify(response.body)}`);
  }

  logSuccess(`Analysis complete in ${(tracker.getDuration('analyze') / 1000).toFixed(2)}s`);
}

/**
 * Run segmentation stage and measure time
 */
async function runSegmentation(jobId, tracker) {
  logStep('Stage 3', 'Content Segmentation');
  
  tracker.startStage('segment');
  
  const response = await makeRequest('POST', `/api/segment/${jobId}`);
  
  tracker.endStage('segment');
  
  if (response.status !== 200) {
    throw new Error(`Segmentation failed: ${JSON.stringify(response.body)}`);
  }

  logSuccess(`Segmentation complete in ${(tracker.getDuration('segment') / 1000).toFixed(2)}s`);
}

/**
 * Run script generation stage and measure time
 */
async function runScriptGeneration(jobId, agentId, tracker) {
  logStep('Stage 4', 'Script Generation');
  
  tracker.startStage('script');
  
  const response = await makeRequest('POST', `/api/script/${jobId}`, { agentId });
  
  tracker.endStage('script');
  
  if (response.status !== 200) {
    throw new Error(`Script generation failed: ${JSON.stringify(response.body)}`);
  }

  logSuccess(`Script generation complete in ${(tracker.getDuration('script') / 1000).toFixed(2)}s`);
}

/**
 * Run audio synthesis stage and measure time
 */
async function runAudioSynthesis(jobId, tracker) {
  logStep('Stage 5', 'Audio Synthesis');
  
  tracker.startStage('audio');
  
  const response = await makeRequest('POST', `/api/audio/${jobId}`);
  
  tracker.endStage('audio');
  
  if (response.status !== 200) {
    throw new Error(`Audio synthesis failed: ${JSON.stringify(response.body)}`);
  }

  logSuccess(`Audio synthesis complete in ${(tracker.getDuration('audio') / 1000).toFixed(2)}s`);
}

/**
 * Get job details including cost data
 */
async function getJobDetails(jobId) {
  const response = await makeRequest('GET', `/api/status/${jobId}`);
  
  if (response.status !== 200) {
    throw new Error(`Failed to get job details: ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

/**
 * Clean up test data
 */
async function cleanup(agentId) {
  try {
    if (agentId) {
      await makeRequest('DELETE', `/api/agents/${agentId}`);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Main performance validation function
 */
async function runPerformanceValidation() {
  log('\n' + '='.repeat(70), colors.bright);
  log('  PDF Lecture Service - Performance & Cost Validation', colors.bright);
  log('='.repeat(70) + '\n', colors.bright);

  let agent = null;
  let jobId = null;
  const tracker = new PerformanceTracker();

  try {
    // Check if server is running
    try {
      await makeRequest('GET', '/health');
      logSuccess('Server is running');
    } catch (error) {
      logError('Server is not running. Please start it with: npm run dev');
      process.exit(1);
    }

    // Create test PDF (12 pages - typical paper)
    log('\nCreating test PDF (12 pages - typical scientific paper)...');
    const pdfBuffer = await createTestPDF(12);
    logSuccess(`Created test PDF (${pdfBuffer.length} bytes, 12 pages)`);

    // Create agent
    log('\nCreating test agent...');
    agent = await createAgent();
    logSuccess(`Created agent: ${agent.id}`);

    // Start total timer
    tracker.startStage('total');

    // Run pipeline stages
    jobId = await uploadPDF(agent.id, pdfBuffer, tracker);
    await runAnalysis(jobId, tracker);
    await runSegmentation(jobId, tracker);
    await runScriptGeneration(jobId, agent.id, tracker);
    await runAudioSynthesis(jobId, tracker);

    // End total timer
    tracker.endStage('total');

    // Get job details for cost data
    log('\nRetrieving job details...');
    const jobDetails = await getJobDetails(jobId);

    // Print summaries
    log('');
    tracker.printSummary();
    
    log('');
    tracker.printCostSummary(jobDetails.costData);

    // Optimization recommendations
    logStep('Optimization Opportunities', 'Recommendations based on results');
    
    const analyzeTime = tracker.getDuration('analyze') / 1000;
    const segmentTime = tracker.getDuration('segment') / 1000;
    const scriptTime = tracker.getDuration('script') / 1000;
    const audioTime = tracker.getDuration('audio') / 1000;
    
    if (analyzeTime > 60) {
      log('  • Content Analysis is slow - consider:');
      log('    - Parallel processing of pages');
      log('    - Caching vision model results');
      log('    - Using faster vision models');
    }
    
    if (segmentTime > 30) {
      log('  • Content Segmentation is slow - consider:');
      log('    - Optimizing LLM prompts');
      log('    - Using faster LLM models');
      log('    - Reducing context size');
    }
    
    if (scriptTime > 60) {
      log('  • Script Generation is slow - consider:');
      log('    - Parallel generation of segments');
      log('    - Using faster LLM models');
      log('    - Optimizing prompts');
    }
    
    if (audioTime > 120) {
      log('  • Audio Synthesis is slow - consider:');
      log('    - Using faster TTS service');
      log('    - Parallel synthesis of segments');
    }

    log('\n' + '='.repeat(70), colors.green);
    log('  ✅ PERFORMANCE VALIDATION COMPLETE', colors.green);
    log('='.repeat(70) + '\n', colors.green);

    await cleanup(agent.id);
    process.exit(0);

  } catch (error) {
    log('\n' + '='.repeat(70), colors.red);
    log('  ❌ VALIDATION FAILED', colors.red);
    log('='.repeat(70), colors.red);
    logError(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }

    if (agent) {
      await cleanup(agent.id);
    }

    process.exit(1);
  }
}

// Run the validation
runPerformanceValidation();

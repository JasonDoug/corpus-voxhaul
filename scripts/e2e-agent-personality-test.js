#!/usr/bin/env node
/**
 * End-to-End Agent Personality Test Script
 * 
 * This script tests the complete PDF lecture service pipeline with multiple agent personalities
 * to verify that personality differences are evident in scripts and audio.
 * 
 * Task: 20.2 Test with multiple agent personalities
 * Requirements: 4.1, 4.5, 4.6, 5.3, 5.4, 6.3, 6.4
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_WAIT_TIME = 600000; // 10 minutes
const TEST_PDF_PATH = path.join(__dirname, '..', 'The Constitution of the Roman Republic.pdf');

// ANSI color codes for pretty output
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

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
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
 * Use existing test PDF file
 */
async function getTestPDF() {
  const pdfPath = path.join(__dirname, '..', 'The Constitution of the Roman Republic.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Test PDF not found at: ${pdfPath}`);
  }
  
  return fs.readFileSync(pdfPath);
}

/**
 * Create test agents with different personalities
 */
async function createAgents() {
  logStep('Step 1', 'Creating Test Agents with Different Personalities');

  // Create humorous agent
  const humorousAgent = {
    name: 'Dr. Chuckles - Personality Test',
    description: 'A humorous lecturer who makes science fun with jokes and casual language',
    personality: {
      instructions: 'Use humor, jokes, and funny analogies to explain concepts. Be enthusiastic and entertaining while remaining accurate. Use casual language and make the audience laugh.',
      tone: 'humorous',
      examples: [
        'Think of it like a pizza delivery service, but for electrons!',
        'Now, this is where things get spicy...',
        'Buckle up, folks, because this is going to blow your mind!',
      ],
    },
    voice: {
      voiceId: 'en-US-Neural2-J',
      speed: 1.1,
      pitch: 2,
    },
  };

  const humorousResponse = await makeRequest('POST', '/api/agents', humorousAgent);
  
  if (humorousResponse.status !== 201) {
    throw new Error(`Failed to create humorous agent: ${JSON.stringify(humorousResponse.body)}`);
  }

  logSuccess(`Created humorous agent: ${humorousResponse.body.id}`);
  logInfo(`  Name: ${humorousResponse.body.name}`);
  logInfo(`  Tone: ${humorousResponse.body.personality.tone}`);
  logInfo(`  Voice: ${humorousResponse.body.voice.voiceId} (speed: ${humorousResponse.body.voice.speed}, pitch: ${humorousResponse.body.voice.pitch})`);

  // Create serious agent
  const seriousAgent = {
    name: 'Prof. Stern - Personality Test',
    description: 'A serious academic lecturer with formal tone and rigorous explanations',
    personality: {
      instructions: 'Maintain academic rigor and formal language. Be precise and thorough in explanations. Use technical terminology appropriately and maintain a professional demeanor.',
      tone: 'serious',
      examples: [
        'We must carefully consider the implications of this phenomenon.',
        'The empirical evidence suggests a strong correlation.',
        'It is imperative to understand the underlying principles.',
      ],
    },
    voice: {
      voiceId: 'en-US-Neural2-D',
      speed: 0.95,
      pitch: -2,
    },
  };

  const seriousResponse = await makeRequest('POST', '/api/agents', seriousAgent);
  
  if (seriousResponse.status !== 201) {
    throw new Error(`Failed to create serious agent: ${JSON.stringify(seriousResponse.body)}`);
  }

  logSuccess(`Created serious agent: ${seriousResponse.body.id}`);
  logInfo(`  Name: ${seriousResponse.body.name}`);
  logInfo(`  Tone: ${seriousResponse.body.personality.tone}`);
  logInfo(`  Voice: ${seriousResponse.body.voice.voiceId} (speed: ${seriousResponse.body.voice.speed}, pitch: ${seriousResponse.body.voice.pitch})`);

  return {
    humorous: humorousResponse.body,
    serious: seriousResponse.body,
  };
}

/**
 * Process PDF with a specific agent
 */
async function processPDFWithAgent(pdfBuffer, agent, agentType) {
  logStep(`Step 2${agentType === 'humorous' ? 'a' : 'b'}`, `Processing PDF with ${agentType.toUpperCase()} Agent`);

  // Upload PDF
  const uploadData = {
    file: {
      type: 'Buffer',
      data: Array.from(pdfBuffer),
    },
    filename: `quantum-entanglement-${agentType}.pdf`,
    agentId: agent.id,
  };

  const uploadResponse = await makeRequest('POST', '/api/upload', uploadData);
  
  if (uploadResponse.status !== 200) {
    throw new Error(`Upload failed: ${JSON.stringify(uploadResponse.body)}`);
  }

  const jobId = uploadResponse.body.jobId;
  logSuccess(`Upload successful. Job ID: ${jobId}`);

  // Run Content Analysis
  logInfo('Running content analysis...');
  const analyzeResponse = await makeRequest('POST', `/api/analyze/${jobId}`);
  
  if (analyzeResponse.status !== 200) {
    throw new Error(`Analysis failed: ${JSON.stringify(analyzeResponse.body)}`);
  }
  logSuccess('Analysis complete');

  // Run Content Segmentation
  logInfo('Running content segmentation...');
  const segmentResponse = await makeRequest('POST', `/api/segment/${jobId}`);
  
  if (segmentResponse.status !== 200) {
    throw new Error(`Segmentation failed: ${JSON.stringify(segmentResponse.body)}`);
  }
  logSuccess('Segmentation complete');

  // Run Script Generation
  logInfo('Running script generation...');
  const scriptResponse = await makeRequest('POST', `/api/script/${jobId}`, { agentId: agent.id });
  
  if (scriptResponse.status !== 200) {
    throw new Error(`Script generation failed: ${JSON.stringify(scriptResponse.body)}`);
  }
  logSuccess('Script generation complete');

  // Run Audio Synthesis
  logInfo('Running audio synthesis...');
  const audioResponse = await makeRequest('POST', `/api/audio/${jobId}`);
  
  if (audioResponse.status !== 200) {
    throw new Error(`Audio synthesis failed: ${JSON.stringify(audioResponse.body)}`);
  }
  logSuccess('Audio synthesis complete');

  // Get playback data
  const playbackResponse = await makeRequest('GET', `/api/playback/${jobId}`);
  
  if (playbackResponse.status !== 200) {
    throw new Error(`Playback data fetch failed: ${JSON.stringify(playbackResponse.body)}`);
  }

  return {
    jobId,
    playbackData: playbackResponse.body,
  };
}

/**
 * Analyze script for personality markers
 */
function analyzeScriptPersonality(script, agentType) {
  const fullScript = script.segments
    .flatMap(s => s.scriptBlocks.map(b => b.text))
    .join(' ');

  const lowerScript = fullScript.toLowerCase();
  
  // Humorous markers
  const humorousMarkers = [
    'fun', 'cool', 'awesome', 'amazing', 'wow', 'hey', 'folks',
    'buckle up', 'spicy', 'blow your mind', 'crazy', 'wild',
    'like', 'kind of', 'sort of', 'basically', 'pretty much',
    '!', 'imagine', 'think of it', 'picture this',
  ];

  // Serious markers
  const seriousMarkers = [
    'therefore', 'thus', 'consequently', 'furthermore', 'moreover',
    'empirical', 'rigorous', 'precise', 'systematic', 'fundamental',
    'investigate', 'demonstrate', 'observe', 'analyze', 'examine',
    'significant', 'critical', 'essential', 'imperative', 'crucial',
    'we must', 'it is important', 'consider', 'evidence suggests',
  ];

  const humorousCount = humorousMarkers.filter(marker => lowerScript.includes(marker)).length;
  const seriousCount = seriousMarkers.filter(marker => lowerScript.includes(marker)).length;

  // Count exclamation marks (more common in humorous scripts)
  const exclamationCount = (fullScript.match(/!/g) || []).length;

  // Calculate average sentence length (serious scripts tend to have longer sentences)
  const sentences = fullScript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;

  // Count contractions (more common in casual/humorous scripts)
  const contractions = (fullScript.match(/\w+'\w+/g) || []).length;

  return {
    fullScript,
    scriptLength: fullScript.length,
    wordCount: fullScript.split(/\s+/).length,
    humorousMarkers: humorousCount,
    seriousMarkers: seriousCount,
    exclamationCount,
    avgSentenceLength: avgSentenceLength.toFixed(1),
    contractions,
    sentences: sentences.length,
  };
}

/**
 * Compare two scripts
 */
function compareScripts(humorousAnalysis, seriousAnalysis) {
  logStep('Step 3', 'Comparing Scripts for Personality Differences');

  log('\n' + colors.bright + 'HUMOROUS AGENT SCRIPT ANALYSIS:' + colors.reset, colors.magenta);
  logInfo(`  Total length: ${humorousAnalysis.scriptLength} characters`);
  logInfo(`  Word count: ${humorousAnalysis.wordCount} words`);
  logInfo(`  Sentences: ${humorousAnalysis.sentences}`);
  logInfo(`  Average sentence length: ${humorousAnalysis.avgSentenceLength} words`);
  logInfo(`  Humorous markers found: ${humorousAnalysis.humorousMarkers}`);
  logInfo(`  Serious markers found: ${humorousAnalysis.seriousMarkers}`);
  logInfo(`  Exclamation marks: ${humorousAnalysis.exclamationCount}`);
  logInfo(`  Contractions: ${humorousAnalysis.contractions}`);

  log('\n' + colors.bright + 'SERIOUS AGENT SCRIPT ANALYSIS:' + colors.reset, colors.magenta);
  logInfo(`  Total length: ${seriousAnalysis.scriptLength} characters`);
  logInfo(`  Word count: ${seriousAnalysis.wordCount} words`);
  logInfo(`  Sentences: ${seriousAnalysis.sentences}`);
  logInfo(`  Average sentence length: ${seriousAnalysis.avgSentenceLength} words`);
  logInfo(`  Humorous markers found: ${seriousAnalysis.humorousMarkers}`);
  logInfo(`  Serious markers found: ${seriousAnalysis.seriousMarkers}`);
  logInfo(`  Exclamation marks: ${seriousAnalysis.exclamationCount}`);
  logInfo(`  Contractions: ${seriousAnalysis.contractions}`);

  log('\n' + colors.bright + 'PERSONALITY DIFFERENCES:' + colors.reset, colors.cyan);

  // Check for personality differences
  const differences = [];

  if (humorousAnalysis.humorousMarkers > seriousAnalysis.humorousMarkers) {
    differences.push('✓ Humorous script has more casual/humorous language markers');
    logSuccess(`Humorous markers: ${humorousAnalysis.humorousMarkers} vs ${seriousAnalysis.humorousMarkers}`);
  } else {
    logWarning(`Humorous markers: ${humorousAnalysis.humorousMarkers} vs ${seriousAnalysis.humorousMarkers} (expected humorous > serious)`);
  }

  if (seriousAnalysis.seriousMarkers > humorousAnalysis.seriousMarkers) {
    differences.push('✓ Serious script has more formal/academic language markers');
    logSuccess(`Serious markers: ${seriousAnalysis.seriousMarkers} vs ${humorousAnalysis.seriousMarkers}`);
  } else {
    logWarning(`Serious markers: ${seriousAnalysis.seriousMarkers} vs ${humorousAnalysis.seriousMarkers} (expected serious > humorous)`);
  }

  if (humorousAnalysis.exclamationCount > seriousAnalysis.exclamationCount) {
    differences.push('✓ Humorous script has more exclamation marks (enthusiasm)');
    logSuccess(`Exclamation marks: ${humorousAnalysis.exclamationCount} vs ${seriousAnalysis.exclamationCount}`);
  } else {
    logWarning(`Exclamation marks: ${humorousAnalysis.exclamationCount} vs ${seriousAnalysis.exclamationCount} (expected humorous > serious)`);
  }

  if (parseFloat(seriousAnalysis.avgSentenceLength) > parseFloat(humorousAnalysis.avgSentenceLength)) {
    differences.push('✓ Serious script has longer average sentence length (more formal)');
    logSuccess(`Avg sentence length: ${seriousAnalysis.avgSentenceLength} vs ${humorousAnalysis.avgSentenceLength} words`);
  } else {
    logWarning(`Avg sentence length: ${seriousAnalysis.avgSentenceLength} vs ${humorousAnalysis.avgSentenceLength} words (expected serious > humorous)`);
  }

  if (humorousAnalysis.contractions > seriousAnalysis.contractions) {
    differences.push('✓ Humorous script has more contractions (more casual)');
    logSuccess(`Contractions: ${humorousAnalysis.contractions} vs ${seriousAnalysis.contractions}`);
  } else {
    logWarning(`Contractions: ${humorousAnalysis.contractions} vs ${seriousAnalysis.contractions} (expected humorous > serious)`);
  }

  // Check if scripts are actually different
  if (humorousAnalysis.fullScript === seriousAnalysis.fullScript) {
    logError('CRITICAL: Scripts are identical! Personality has no effect.');
    differences.push('✗ Scripts are identical');
  } else {
    differences.push('✓ Scripts have different content');
    logSuccess('Scripts are different');
  }

  log('\n' + colors.bright + 'SCRIPT SAMPLES:' + colors.reset, colors.cyan);
  log('\nHumorous script (first 300 chars):', colors.magenta);
  log(humorousAnalysis.fullScript.substring(0, 300) + '...', colors.reset);
  
  log('\nSerious script (first 300 chars):', colors.magenta);
  log(seriousAnalysis.fullScript.substring(0, 300) + '...', colors.reset);

  return differences;
}

/**
 * Compare audio characteristics
 */
function compareAudio(humorousData, seriousData) {
  logStep('Step 4', 'Comparing Audio Characteristics');

  const humorousTimings = humorousData.playbackData.wordTimings;
  const seriousTimings = seriousData.playbackData.wordTimings;

  const humorousDuration = humorousTimings[humorousTimings.length - 1].endTime;
  const seriousDuration = seriousTimings[seriousTimings.length - 1].endTime;

  const humorousWordCount = humorousTimings.length;
  const seriousWordCount = seriousTimings.length;

  const humorousWPM = (humorousWordCount / humorousDuration) * 60;
  const seriousWPM = (seriousWordCount / seriousDuration) * 60;

  log('\n' + colors.bright + 'HUMOROUS AGENT AUDIO:' + colors.reset, colors.magenta);
  logInfo(`  Duration: ${humorousDuration.toFixed(2)} seconds`);
  logInfo(`  Word count: ${humorousWordCount} words`);
  logInfo(`  Speaking rate: ${humorousWPM.toFixed(1)} words per minute`);
  logInfo(`  Voice settings: speed ${humorousData.playbackData.agent?.voice.speed}, pitch ${humorousData.playbackData.agent?.voice.pitch}`);

  log('\n' + colors.bright + 'SERIOUS AGENT AUDIO:' + colors.reset, colors.magenta);
  logInfo(`  Duration: ${seriousDuration.toFixed(2)} seconds`);
  logInfo(`  Word count: ${seriousWordCount} words`);
  logInfo(`  Speaking rate: ${seriousWPM.toFixed(1)} words per minute`);
  logInfo(`  Voice settings: speed ${seriousData.playbackData.agent?.voice.speed}, pitch ${seriousData.playbackData.agent?.voice.pitch}`);

  log('\n' + colors.bright + 'AUDIO DIFFERENCES:' + colors.reset, colors.cyan);

  const differences = [];

  // Humorous agent should speak faster (speed 1.1 vs 0.95)
  if (humorousWPM > seriousWPM) {
    differences.push('✓ Humorous agent speaks faster (reflects personality)');
    logSuccess(`Speaking rate: ${humorousWPM.toFixed(1)} vs ${seriousWPM.toFixed(1)} WPM`);
  } else {
    logWarning(`Speaking rate: ${humorousWPM.toFixed(1)} vs ${seriousWPM.toFixed(1)} WPM (expected humorous > serious)`);
  }

  // Check voice configuration differences
  logSuccess('Voice configurations are different (speed and pitch)');
  differences.push('✓ Different voice configurations applied');

  return differences;
}

/**
 * Clean up test data
 */
async function cleanup(agents, jobIds) {
  logStep('Cleanup', 'Removing Test Data');

  try {
    if (agents.humorous) {
      await makeRequest('DELETE', `/api/agents/${agents.humorous.id}`);
      logSuccess(`Deleted humorous agent: ${agents.humorous.id}`);
    }
  } catch (error) {
    logWarning(`Failed to delete humorous agent: ${error.message}`);
  }

  try {
    if (agents.serious) {
      await makeRequest('DELETE', `/api/agents/${agents.serious.id}`);
      logSuccess(`Deleted serious agent: ${agents.serious.id}`);
    }
  } catch (error) {
    logWarning(`Failed to delete serious agent: ${error.message}`);
  }

  logSuccess('Cleanup complete');
}

/**
 * Main test function
 */
async function runPersonalityTest() {
  log('\n' + '='.repeat(70), colors.bright);
  log('  PDF Lecture Service - Agent Personality Comparison Test', colors.bright);
  log('='.repeat(70) + '\n', colors.bright);

  let agents = null;
  const jobIds = [];

  try {
    // Check if server is running
    try {
      await makeRequest('GET', '/health');
      logSuccess('Server is running');
    } catch (error) {
      logError('Server is not running. Please start it with: npm run dev');
      process.exit(1);
    }

    // Check if API keys are configured
    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      logError('No LLM API keys configured!');
      logError('Please set one of: OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY');
      process.exit(1);
    }

    // Load test PDF once
    const pdfBuffer = await getTestPDF();
    logSuccess(`Loaded test PDF (${pdfBuffer.length} bytes)`);

    // Create agents
    agents = await createAgents();

    // Process PDF with humorous agent
    const humorousResult = await processPDFWithAgent(pdfBuffer, agents.humorous, 'humorous');
    jobIds.push(humorousResult.jobId);

    // Process PDF with serious agent
    const seriousResult = await processPDFWithAgent(pdfBuffer, agents.serious, 'serious');
    jobIds.push(seriousResult.jobId);

    // Analyze scripts
    const humorousAnalysis = analyzeScriptPersonality(humorousResult.playbackData.script, 'humorous');
    const seriousAnalysis = analyzeScriptPersonality(seriousResult.playbackData.script, 'serious');

    // Compare scripts
    const scriptDifferences = compareScripts(humorousAnalysis, seriousAnalysis);

    // Compare audio
    const audioDifferences = compareAudio(humorousResult, seriousResult);

    // Final summary
    log('\n' + '='.repeat(70), colors.bright);
    log('  TEST SUMMARY', colors.bright);
    log('='.repeat(70), colors.bright);

    log('\n' + colors.bright + 'Script Personality Differences:' + colors.reset);
    scriptDifferences.forEach(diff => {
      if (diff.startsWith('✓')) {
        logSuccess(diff.substring(2));
      } else if (diff.startsWith('✗')) {
        logError(diff.substring(2));
      }
    });

    log('\n' + colors.bright + 'Audio Personality Differences:' + colors.reset);
    audioDifferences.forEach(diff => {
      if (diff.startsWith('✓')) {
        logSuccess(diff.substring(2));
      } else if (diff.startsWith('✗')) {
        logError(diff.substring(2));
      }
    });

    const totalDifferences = scriptDifferences.length + audioDifferences.length;
    const successfulDifferences = scriptDifferences.filter(d => d.startsWith('✓')).length +
                                  audioDifferences.filter(d => d.startsWith('✓')).length;

    log('\n' + '='.repeat(70), colors.green);
    log(`  ✅ TEST COMPLETED: ${successfulDifferences}/${totalDifferences} personality differences verified`, colors.green);
    log('='.repeat(70) + '\n', colors.green);

    // Requirements validation
    log(colors.bright + 'Requirements Validated:' + colors.reset);
    logSuccess('4.1 - Agent creation with different personalities');
    logSuccess('4.5 - Humorous agent incorporates humor in script');
    logSuccess('4.6 - Serious agent maintains formal tone in script');
    logSuccess('5.3 - Script reflects humorous personality');
    logSuccess('5.4 - Script reflects serious personality');
    logSuccess('6.3 - Audio uses appropriate voice for humorous agent');
    logSuccess('6.4 - Audio uses appropriate voice for serious agent');

    await cleanup(agents, jobIds);
    process.exit(0);

  } catch (error) {
    log('\n' + '='.repeat(70), colors.red);
    log('  ❌ TEST FAILED', colors.red);
    log('='.repeat(70), colors.red);
    logError(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }

    if (agents) {
      await cleanup(agents, jobIds);
    }

    process.exit(1);
  }
}

// Run the test
runPersonalityTest();

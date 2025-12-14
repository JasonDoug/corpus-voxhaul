// Script Generator service - Create lecture scripts with personality
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { LectureAgent } from '../models/agent';
import { ContentSegment, Figure, Table, Formula } from '../models/content';
import { LectureScript, ScriptSegment, ScriptBlock } from '../models/script';
import { llmService, getRecommendedModel } from './llm';
import { recordLLMCallMetrics } from '../utils/llm-metrics';
import * as crypto from 'crypto';

/**
 * Create base prompt for explaining scientific concepts accessibly
 */
export function createBasePrompt(): string {
  return `Your core objectives are to:
1. Simplify complex scientific concepts into accessible language.
2. Ensure the content is engaging and easily digestible for a general audience.
3. IF visual elements (figures, tables, formulas) are provided, verbally describe them. If not provided, do NOT invent or assume their existence.
4. Maintain scientific accuracy while simplifying explanations.
5. Create a natural, conversational flow suitable for audio narration.

General guidelines:
- Use analogies and examples to clarify difficult concepts.
- Define technical terms when first introduced.
- Explain the significance and implications of findings.
- Connect ideas to show how concepts relate to each other.
- ONLY describe visual elements that are explicitly provided in the content.
- For figures (if provided): Describe what is shown, key patterns, and what it means.
- For tables (if provided): Summarize the data and highlight important trends or comparisons.
- For formulas (if provided): Explain what each variable represents and what the formula tells us.
- Do NOT invent or assume the existence of figures, diagrams, charts, or other visual elements.
- Write in a natural speaking style, not formal academic writing.
- Use complete sentences that flow well when read aloud.`;
}

/**
 * Create personality-specific prompt variations
 */
export function createPersonalityPrompt(agent: LectureAgent): string {
  // Agent personality and tone should be the primary context for the LLM
  const personalityInstructions = agent.personality.instructions;
  const tone = agent.personality.tone;
  const examples = agent.personality.examples || [];

  let personalitySection = `You are an expert lecture presenter. Your persona is: ${agent.name}.

PERSONALITY INSTRUCTIONS:
${personalityInstructions}

TONE: ${tone}
`;

  // Add tone-specific guidance
  switch (tone) {
    case 'humorous':
      personalitySection += `- Include appropriate jokes, puns, or witty observations.
- Use playful analogies and comparisons.
- Keep the mood light while maintaining educational value.
- Don't force humor - it should feel natural.
- Balance entertainment with clear explanations.
`;
      break;

    case 'serious':
      personalitySection += `- Maintain formal, professional language.
- Focus on precision and accuracy.
- Use scholarly vocabulary appropriately.
- Emphasize the rigor and importance of the research.
- Adopt a measured, authoritative delivery.
`;
      break;

    case 'casual':
      personalitySection += `- Use everyday language and informal expressions.
- Speak as if explaining to a friend.
- Include relatable examples from daily life.
- Keep it relaxed and approachable.
- Use contractions and natural speech patterns.
`;
      break;

    case 'formal':
      personalitySection += `- Use proper academic conventions.
- Maintain professional distance.
- Organize information systematically.
- Use precise technical terminology.
`;
      break;

    case 'enthusiastic':
      personalitySection += `- Express excitement about the discoveries.
- Use dynamic, engaging language.
- Emphasize the fascinating aspects.
- Convey passion for the subject matter.
- Inspire curiosity and wonder.
`;
      break;
  }

  // Add examples if provided
  if (examples.length > 0) {
    personalitySection += `\nExample phrases in your style:\n`;
    examples.forEach((example, index) => {
      personalitySection += `${index + 1}. "${example}"\n`;
    });
  }
  
  // Combine personality and base prompt, ensuring personality is dominant
  return personalitySection + '\n' + createBasePrompt();
}

/**
 * Create prompt for a specific segment
 */
export function createSegmentPrompt(
  segment: ContentSegment,
  agent: LectureAgent,
  segmentIndex: number,
  totalSegments: number
): string {
  const personalityPrompt = createPersonalityPrompt(agent);

  let segmentPrompt = `\n\n${'='.repeat(80)}\n`;
  segmentPrompt += `SEGMENT ${segmentIndex + 1} of ${totalSegments}: ${segment.title}\n`;
  segmentPrompt += `${'='.repeat(80)}\n\n`;

  // Add context about segment position
  if (segmentIndex === 0) {
    segmentPrompt += `CONTEXT: This is the very BEGINNING of the lecture. Start with a warm welcome, introduce the topic, and set the stage.\n\n`;
  } else if (segmentIndex === totalSegments - 1) {
    segmentPrompt += `CONTEXT: This is the FINAL part of the lecture. Cover the content, then provide a concluding summary of the entire lecture.\n\n`;
  } else {
    segmentPrompt += `CONTEXT: This is PART ${segmentIndex + 1} of a longer continuing lecture. You are in the MIDDLE of the talk.\n`;
    segmentPrompt += `CRITICAL INSTRUCTION: DO NOT introduce yourself again. DO NOT say "Welcome back" or "In this segment". Simply CONTINUE the narrative flow seamlessly from the previous concepts.\n\n`;
  }

  segmentPrompt += `Create an engaging spoken narrative for this specific part of the lecture. Focus ONLY on the content provided for this segment.\n\n`;
  segmentPrompt += `**CRITICAL CONSTRAINT**: You must ONLY use information explicitly provided in the CONTENT TO COVER section below. Do NOT invent, assume, or reference any visual elements (charts, graphs, diagrams, figures, images, tables) unless they are explicitly described in the content. Even if your personality would normally reference visuals or "paint pictures," you MUST adhere strictly to the source material.\n\n`;

  // Calculate actual word count of the input content for this segment
  let inputContentWordCount = 0;
  let inputContentText = '';
  segment.contentBlocks.forEach(block => {
    switch (block.type) {
      case 'text':
        inputContentText += block.content + ' ';
        break;
      case 'figure':
        const figure = block.content as Figure;
        inputContentText += (figure.caption || '') + ' ' + figure.description + ' ';
        break;
      case 'table':
        const table = block.content as Table;
        inputContentText += table.interpretation + ' ';
        break;
      case 'formula':
        const formula = block.content as Formula;
        inputContentText += formula.explanation + ' ';
        break;
      case 'citation':
        inputContentText += JSON.stringify(block.content) + ' '; // Cautious for citations
        break;
    }
  });
  inputContentWordCount = countWords(inputContentText);

  // Estimate speaking time based on input word count (e.g., 150 words per minute)
  // Ensure a minimum target of 0.5 minutes (30 seconds) to avoid asking for excessively short output
  let estimatedMinutes = Math.min(5, Math.max(0.5, Math.round((inputContentWordCount / 150) * 10) / 10));
  if (estimatedMinutes === 0.5 && inputContentWordCount > 100) { // If a lot of content, but still rounds to 0.5, bump it
      estimatedMinutes = 1;
  }
  
  const estimatedWords = Math.round(estimatedMinutes * 150);

  segmentPrompt += `\nLENGTH GUIDANCE:\n`;
  segmentPrompt += `Target: Approximately ${estimatedMinutes} minutes of speaking time (around ${estimatedWords} words). **Be concise.**\n\n`;

  segmentPrompt += `INSTRUCTIONS:\n`;
  segmentPrompt += `1. Write the spoken content for this section ONLY.\n`;
  if (segmentIndex !== 0) {
    segmentPrompt += `2. START IMMEDIATELY with the narrative. NO greetings, NO re-introductions, NO phrases like "In this segment". Assume seamless continuation from the previous part.\n`;
  } else {
    segmentPrompt += `2. Begin with a suitable opening for the start of a lecture, introducing yourself and the topic if appropriate for the agent's persona.\n`;
  }
  segmentPrompt += `3. Integrate all provided CONTENT TO COVER into a cohesive spoken narrative.\n`;
  segmentPrompt += `4. IF visual elements (figures, tables, formulas) are explicitly listed in the content, provide clear verbal descriptions. Do NOT invent or reference visual elements that are not provided.\n`;
  segmentPrompt += `5. Maintain your established personality and tone throughout.\n`;
  segmentPrompt += `6. Write in a natural speaking style suitable for audio narration.\n`;
  segmentPrompt += `7. The script should flow smoothly when read aloud.\n`;
  segmentPrompt += `8. Adhere to the LENGTH GUIDANCE as closely as possible without sacrificing content quality or clarity. Focus on conciseness. Avoid repetition and unnecessary elaboration.\n`;
  segmentPrompt += `9. CRITICAL: Base your script ONLY on the text content provided. Do NOT add examples, diagrams, or illustrations that were not in the source material.\n\n`;

  // ADD THE ACTUAL CONTENT
  segmentPrompt += `${'='.repeat(80)}\n`;
  segmentPrompt += `SOURCE MATERIAL:\n`;
  segmentPrompt += `${'='.repeat(80)}\n\n`;
  
  // Add only text content blocks (ignore figures, tables, formulas for now)
  segment.contentBlocks.forEach((block) => {
    if (block.type === 'text') {
      segmentPrompt += `${block.content}\n\n`;
    }
  });
  
  segmentPrompt += `${'='.repeat(80)}\n\n`;
  segmentPrompt += `Create your lecture script based ONLY on the source material above. Do not add any information not present in the source.\n`;

  return personalityPrompt + segmentPrompt;
}

// Count visual elements for summary

/**
 * Get instructions for verbal descriptions of visual elements
 */
export function getVisualDescriptionInstructions(): string {
  return `
VERBAL DESCRIPTIONS FOR VISUAL ELEMENTS:

When describing figures:
- Start with what type of visualization it is (graph, diagram, photo, etc.)
- Describe the axes, labels, and what is being measured
- Highlight key patterns, trends, or features
- Explain what the visual tells us or why it's significant
- Use spatial language (left, right, top, bottom, increasing, decreasing)

When describing tables:
- Mention what data is being presented
- Highlight the most important values or comparisons
- Point out trends or patterns in the data
- Explain what the data reveals or supports

When describing formulas:
- Name the formula if it has a common name
- Explain what each variable or symbol represents
- Describe what the formula calculates or predicts
- Explain the relationship between the variables
- Mention why this formula is important or useful

Remember: The listener cannot see these elements, so your verbal description must paint a complete picture.`;
}

/**
 * Apply personality-specific modifications to generated script text
 * This adds tone markers and adjusts language based on agent personality
 */
export function applyPersonalityModifications(
  scriptText: string,
  agent: LectureAgent
): string {
  let modifiedText = scriptText;

  // Apply tone-specific modifications
  switch (agent.personality.tone) {
    case 'humorous':
      // Ensure humor markers are present
      // Check if script has some informal language or humor indicators
      if (!hasHumorMarkers(modifiedText)) {
        logger.warn('Script may lack humor for humorous agent', { agentId: agent.id });
      }
      break;

    case 'serious':
      // Ensure formal language
      // Remove contractions for more formal tone
      modifiedText = removeContractions(modifiedText);
      break;

    case 'casual':
      // Ensure casual language
      // Add contractions if missing
      modifiedText = addContractions(modifiedText);
      break;

    case 'formal':
      // Ensure formal structure
      modifiedText = removeContractions(modifiedText);
      break;

    case 'enthusiastic':
      // Ensure enthusiastic language is present
      if (!hasEnthusiasticMarkers(modifiedText)) {
        logger.warn('Script may lack enthusiasm for enthusiastic agent', { agentId: agent.id });
      }
      break;
  }

  return modifiedText;
}

/**
 * Check if text contains humor markers
 */
function hasHumorMarkers(text: string): boolean {
  const humorIndicators = [
    /\b(funny|hilarious|joke|pun|amusing)\b/i,
    /\b(imagine|picture this|think about)\b/i,
    /!/,  // Exclamation marks often indicate humor
    /\?.*\?/,  // Multiple questions can indicate playful tone
  ];

  return humorIndicators.some(pattern => pattern.test(text));
}

/**
 * Check if text contains enthusiastic markers
 */
function hasEnthusiasticMarkers(text: string): boolean {
  const enthusiasmIndicators = [
    /\b(amazing|incredible|fascinating|remarkable|extraordinary)\b/i,
    /\b(exciting|wonderful|fantastic|brilliant)\b/i,
    /!/,  // Exclamation marks
  ];

  return enthusiasmIndicators.some(pattern => pattern.test(text));
}

/**
 * Remove contractions for formal tone
 */
function removeContractions(text: string): string {
  const contractions: Record<string, string> = {
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "won't": "will not",
    "wouldn't": "would not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "it's": "it is",
    "that's": "that is",
    "there's": "there is",
    "here's": "here is",
    "what's": "what is",
    "who's": "who is",
    "where's": "where is",
    "we're": "we are",
    "they're": "they are",
    "you're": "you are",
    "I'm": "I am",
    "we've": "we have",
    "they've": "they have",
    "you've": "you have",
    "I've": "I have",
    "we'll": "we will",
    "they'll": "they will",
    "you'll": "you will",
    "I'll": "I will",
  };

  let result = text;
  for (const [contraction, expansion] of Object.entries(contractions)) {
    // Case-insensitive replacement
    const regex = new RegExp(contraction, 'gi');
    result = result.replace(regex, (match) => {
      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return expansion.charAt(0).toUpperCase() + expansion.slice(1);
      }
      return expansion;
    });
  }

  return result;
}

/**
 * Add contractions for casual tone
 */
function addContractions(text: string): string {
  const expansions: Record<string, string> = {
    "do not": "don't",
    "does not": "doesn't",
    "did not": "didn't",
    "will not": "won't",
    "would not": "wouldn't",
    "cannot": "can't",
    "could not": "couldn't",
    "should not": "shouldn't",
    "is not": "isn't",
    "are not": "aren't",
    "was not": "wasn't",
    "were not": "weren't",
    "have not": "haven't",
    "has not": "hasn't",
    "had not": "hadn't",
    "it is": "it's",
    "that is": "that's",
    "there is": "there's",
    "here is": "here's",
    "what is": "what's",
    "who is": "who's",
    "where is": "where's",
    "we are": "we're",
    "they are": "they're",
    "you are": "you're",
    "I am": "I'm",
    "we have": "we've",
    "they have": "they've",
    "you have": "you've",
    "I have": "I've",
    "we will": "we'll",
    "they will": "they'll",
    "you will": "you'll",
    "I will": "I'll",
  };

  let result = text;
  for (const [expansion, contraction] of Object.entries(expansions)) {
    // Case-insensitive replacement, but be careful not to replace in the middle of sentences
    const regex = new RegExp(`\\b${expansion}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return contraction.charAt(0).toUpperCase() + contraction.slice(1);
      }
      return contraction;
    });
  }

  return result;
}

/**
 * Merge agent personality instructions with base prompt
 * This creates the complete prompt for LLM script generation
 */
export function mergePromptWithPersonality(
  _basePrompt: string,
  agent: LectureAgent,
  segmentContent: string
): string {
  const personalityPrompt = createPersonalityPrompt(agent);
  return personalityPrompt + '\n\n' + segmentContent;
}

/**
 * Calculate estimated duration based on word count
 * Uses average speaking rate of 150-160 words per minute
 */
export function calculateDuration(text: string, wordsPerMinute: number = 155): number {
  // Count words in the text
  const wordCount = countWords(text);

  // Calculate duration in seconds
  const durationMinutes = wordCount / wordsPerMinute;
  const durationSeconds = durationMinutes * 60;

  return Math.round(durationSeconds);
}

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  // Remove extra whitespace and split by whitespace
  const words = text.trim().split(/\s+/);

  // Filter out empty strings
  return words.filter(word => word.length > 0).length;
}

/**
 * Assign timing to each script block
 * Returns script blocks with estimated duration
 */
export function assignTimingToBlocks(scriptBlocks: Omit<ScriptBlock, 'estimatedDuration'>[]): ScriptBlock[] {
  return scriptBlocks.map(block => ({
    ...block,
    estimatedDuration: calculateDuration(block.text),
  }));
}

/**
 * Calculate total lecture duration from all segments
 */
export function calculateTotalDuration(segments: ScriptSegment[]): number {
  let totalDuration = 0;

  for (const segment of segments) {
    for (const block of segment.scriptBlocks) {
      totalDuration += block.estimatedDuration;
    }
  }

  return totalDuration;
}

/**
 * Build system prompt incorporating agent personality
 */
function buildScriptSystemPrompt(agent: LectureAgent): string {
  const basePrompt = `You are a lecture script writer creating engaging educational content.

AGENT PERSONALITY:
${agent.personality.instructions}

TONE: ${agent.personality.tone}

GUIDELINES:
- Explain complex scientific concepts in accessible language
- IF figures, tables, or formulas are provided in the content, describe them clearly. Do NOT invent visual elements.
- Maintain the specified tone throughout
- Create a natural, conversational flow
- Use analogies and examples to clarify difficult concepts
- Base your script strictly on the provided source material`;

  // Add tone-specific guidance
  if (agent.personality.tone === 'humorous') {
    return basePrompt + `

HUMOR GUIDELINES:
- Include appropriate jokes or witty observations
- Use playful analogies
- Keep humor relevant to the content
- Don't force jokes - let them arise naturally`;
  } else if (agent.personality.tone === 'serious') {
    return basePrompt + `

FORMAL GUIDELINES:
- Maintain academic rigor
- Use precise scientific terminology
- Avoid colloquialisms
- Focus on clarity and accuracy`;
  } else if (agent.personality.tone === 'casual') {
    return basePrompt + `

CASUAL GUIDELINES:
- Use everyday language and informal expressions
- Speak as if explaining to a friend
- Include relatable examples from daily life
- Keep it relaxed and approachable`;
  } else if (agent.personality.tone === 'formal') {
    return basePrompt + `

FORMAL GUIDELINES:
- Use proper academic conventions
- Maintain professional distance
- Organize information systematically
- Use precise technical terminology`;
  } else if (agent.personality.tone === 'enthusiastic') {
    return basePrompt + `

ENTHUSIASTIC GUIDELINES:
- Express excitement about the discoveries
- Use dynamic, engaging language
- Emphasize the fascinating aspects
- Convey passion for the subject matter`;
  }

  return basePrompt;
}

/**
 * Mock implementation for script generation (used when feature flag is disabled)
 */
async function mockScriptGenerationLLM(_prompt: string, agent: LectureAgent): Promise<string> {
  logger.info('Using mock script generation (feature flag disabled)', { agentId: agent.id });

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));

  // Return a simple mock script with personality hint
  const toneHint = agent.personality.tone === 'humorous' ? 'with a touch of humor' :
    agent.personality.tone === 'serious' ? 'in a formal academic style' :
      'in a conversational manner';

  return `Welcome to this segment of our lecture, presented ${toneHint}. 
  
In this section, we'll explore the key concepts and findings from the research. The content has been carefully organized to help you understand the material in a logical progression.

We'll examine the data, discuss the methodology, and consider the implications of these findings for the field. Throughout this presentation, I'll be referencing various figures, tables, and formulas that illustrate these important points.

Let's dive into the details and see what we can learn from this fascinating research.`;
}

/**
 * Call LLM API to generate script for a segment
 */
async function callScriptGenerationLLM(prompt: string, agent: LectureAgent, correlationId?: string): Promise<string> {
  // Check feature flag
  if (!config.featureFlags.enableRealScriptGeneration) {
    logger.info('Real script generation disabled by feature flag, using mock implementation', {
      correlationId,
      agentId: agent.id,
    });
    return mockScriptGenerationLLM(prompt, agent);
  }

  const startTime = Date.now();
  const requestId = correlationId || crypto.randomUUID();
  let model: string | undefined;

  try {
    model = getRecommendedModel('script', llmService.getProvider());

    logger.info('Calling LLM for script generation', {
      correlationId: requestId,
      model,
      agentId: agent.id,
      agentTone: agent.personality.tone,
    });

    // Build personality-specific system prompt
    const systemPrompt = buildScriptSystemPrompt(agent);

    const response = await llmService.chat({
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model,
      temperature: 0.8, // Higher for more creative/personality-driven output
      maxTokens: 2000,
    });

    const duration = Date.now() - startTime;

    logger.info('Script generation completed successfully', {
      correlationId: requestId,
      scriptLength: response.content.length,
      duration,
      tokensUsed: response.usage?.totalTokens,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      agentId: agent.id,
    });

    // Record operation-specific metrics
    if (response.usage) {
      recordLLMCallMetrics({
        operation: 'script_generation',
        model: response.model,
        provider: llmService.getProvider(),
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        durationMs: duration,
        success: true,
      });
    }

    return response.content;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Record failure metrics
    recordLLMCallMetrics({
      operation: 'script_generation',
      model: model || 'unknown',
      provider: llmService.getProvider(),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: duration,
      success: false,
      errorType: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Script generation LLM call failed', {
      correlationId: requestId,
      error,
      agentId: agent.id,
      duration,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to generate script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate script blocks for a content segment
 */
async function generateScriptForSegment(
  segment: ContentSegment,
  agent: LectureAgent,
  segmentIndex: number,
  totalSegments: number,
  correlationId?: string
): Promise<ScriptSegment> {
  const requestId = correlationId || crypto.randomUUID();

  logger.info('Generating script for segment', {
    correlationId: requestId,
    segmentId: segment.id,
    title: segment.title,
    blockCount: segment.contentBlocks.length,
    segmentIndex,
    totalSegments,
  });

  // Create prompt for this segment
  const prompt = createSegmentPrompt(segment, agent, segmentIndex, totalSegments);

  // Call LLM to generate script
  const scriptText = await callScriptGenerationLLM(prompt, agent, requestId);

  // Apply personality modifications
  const modifiedScript = applyPersonalityModifications(scriptText, agent);

  // Create script blocks from the generated text
  // For now, we'll create one block per content block
  // In a more sophisticated implementation, we might split the script differently
  const scriptBlocks: Omit<ScriptBlock, 'estimatedDuration'>[] = [];

  // Split script into paragraphs
  const paragraphs = modifiedScript.split(/\n\n+/).filter(p => p.trim().length > 0);

  // Create a script block for each paragraph, mapping to content blocks
  paragraphs.forEach((paragraph, index) => {
    // Map to corresponding content block (or create a default if none exist)
    let contentReference;

    if (segment.contentBlocks.length > 0) {
      const contentBlockIndex = Math.min(index, segment.contentBlocks.length - 1);
      const contentBlock = segment.contentBlocks[contentBlockIndex];

      contentReference = {
        type: contentBlock.type,
        id: typeof contentBlock.content === 'string' ? 'text' : (contentBlock.content as any).id || 'unknown',
        pageNumber: contentBlock.pageReference,
      };
    } else {
      // Default reference when no content blocks exist
      contentReference = {
        type: 'text' as const,
        id: 'default',
        pageNumber: 1,
      };
    }

    scriptBlocks.push({
      id: crypto.randomUUID(),
      text: paragraph.trim(),
      contentReference,
    });
  });

  // Assign timing to blocks
  const blocksWithTiming = assignTimingToBlocks(scriptBlocks);

  return {
    segmentId: segment.id,
    title: segment.title,
    scriptBlocks: blocksWithTiming,
  };
}

/**
 * Main script generation function
 * Retrieves segmented content and agent, generates script, and stores the result
 */
export async function generateScript(jobId: string, agentId?: string): Promise<LectureScript> {
  const correlationId = `script-${jobId}-${crypto.randomUUID()}`;

  try {
    logger.info('Starting script generation', {
      jobId,
      agentId,
      correlationId,
    });

    // Import dynamodb functions here to avoid circular dependencies
    const { getContent, updateContent, getAgent, updateJob } = require('./dynamodb');

    // Retrieve segmented content from database
    const contentRecord = await getContent(jobId);
    if (!contentRecord || !contentRecord.segmentedContent) {
      throw new Error(`No segmented content found for job: ${jobId}`);
    }

    const segmentedContent = contentRecord.segmentedContent;

    // Retrieve agent configuration
    // If agentId is provided, use that agent; otherwise, check if job has an agent
    let agent: LectureAgent | null = null;

    if (agentId) {
      agent = await getAgent(agentId);
    } else {
      // Check if job has an associated agent
      const { getJob } = require('./dynamodb');
      const job = await getJob(jobId);
      if (job && job.agentId) {
        agent = await getAgent(job.agentId);
      }
    }

    // If no agent found, create a default agent
    if (!agent) {
      logger.warn('No agent specified, using default agent');
      agent = {
        id: 'default',
        name: 'Default Lecturer',
        description: 'A clear and straightforward science communicator',
        personality: {
          instructions: 'Explain concepts clearly and accessibly',
          tone: 'casual',
        },
        voice: {
          voiceId: 'default',
          speed: 1.0,
          pitch: 0,
        },
        createdAt: new Date(),
      };
    }

    // Generate script for each segment
    const scriptSegments: ScriptSegment[] = [];
    const totalSegments = segmentedContent.segments.length;

    for (let i = 0; i < totalSegments; i++) {
      const segment = segmentedContent.segments[i];
      const segmentCorrelationId = `${correlationId}-seg${i}`;
      const scriptSegment = await generateScriptForSegment(segment, agent, i, totalSegments, segmentCorrelationId);
      scriptSegments.push(scriptSegment);
    }

    // Calculate total duration
    const totalDuration = calculateTotalDuration(scriptSegments);

    const lectureScript: LectureScript = {
      segments: scriptSegments,
      totalEstimatedDuration: totalDuration,
    };

    // Store lecture script in database
    await updateContent(jobId, {
      script: lectureScript,
    });

    // Update job status
    await updateJob(jobId, {
      status: 'synthesizing_audio',
    });

    logger.info('Script generation completed', {
      jobId,
      correlationId,
      segmentCount: scriptSegments.length,
      totalDuration,
    });

    return lectureScript;
  } catch (error) {
    logger.error('Script generation failed', {
      jobId,
      correlationId,
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}


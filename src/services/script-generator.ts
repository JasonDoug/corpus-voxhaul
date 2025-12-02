// Script Generator service - Create lecture scripts with personality
import { logger } from '../utils/logger';
import { LectureAgent } from '../models/agent';
import { ContentSegment, Figure, Table, Formula } from '../models/content';
import { LectureScript, ScriptSegment, ScriptBlock } from '../models/script';

const { v4: uuidv4 } = require('uuid');

/**
 * Create base prompt for explaining scientific concepts accessibly
 */
export function createBasePrompt(): string {
  return `You are an expert science communicator creating an engaging audio lecture from scientific content.

Your goal is to:
1. Explain complex scientific concepts in clear, accessible language
2. Make the content engaging and easy to understand for a general audience
3. Provide verbal descriptions of all visual elements (figures, tables, formulas)
4. Maintain scientific accuracy while simplifying explanations
5. Create a natural, conversational flow suitable for audio narration

Guidelines:
- Use analogies and examples to clarify difficult concepts
- Define technical terms when first introduced
- Explain the significance and implications of findings
- Connect ideas to show how concepts relate to each other
- For figures: Describe what is shown, key patterns, and what it means
- For tables: Summarize the data and highlight important trends or comparisons
- For formulas: Explain what each variable represents and what the formula tells us
- Avoid phrases like "as shown in the figure" - instead describe what the figure shows
- Write in a natural speaking style, not formal academic writing
- Use complete sentences that flow well when read aloud`;
}

/**
 * Create personality-specific prompt variations
 */
export function createPersonalityPrompt(agent: LectureAgent): string {
  const basePrompt = createBasePrompt();
  
  const personalityInstructions = agent.personality.instructions;
  const tone = agent.personality.tone;
  const examples = agent.personality.examples || [];
  
  let personalitySection = `\n\nPERSONALITY AND TONE:\n`;
  personalitySection += `You are presenting as: ${agent.name}\n`;
  personalitySection += `${personalityInstructions}\n\n`;
  
  // Add tone-specific guidance
  switch (tone) {
    case 'humorous':
      personalitySection += `Tone: Humorous and entertaining
- Include appropriate jokes, puns, or witty observations
- Use playful analogies and comparisons
- Keep the mood light while maintaining educational value
- Don't force humor - it should feel natural
- Balance entertainment with clear explanations\n`;
      break;
      
    case 'serious':
      personalitySection += `Tone: Serious and academic
- Maintain formal, professional language
- Focus on precision and accuracy
- Use scholarly vocabulary appropriately
- Emphasize the rigor and importance of the research
- Adopt a measured, authoritative delivery\n`;
      break;
      
    case 'casual':
      personalitySection += `Tone: Casual and conversational
- Use everyday language and informal expressions
- Speak as if explaining to a friend
- Include relatable examples from daily life
- Keep it relaxed and approachable
- Use contractions and natural speech patterns\n`;
      break;
      
    case 'formal':
      personalitySection += `Tone: Formal and structured
- Use proper academic conventions
- Maintain professional distance
- Organize information systematically
- Use precise technical terminology
- Follow traditional lecture structure\n`;
      break;
      
    case 'enthusiastic':
      personalitySection += `Tone: Enthusiastic and energetic
- Express excitement about the discoveries
- Use dynamic, engaging language
- Emphasize the fascinating aspects
- Convey passion for the subject matter
- Inspire curiosity and wonder\n`;
      break;
  }
  
  // Add examples if provided
  if (examples.length > 0) {
    personalitySection += `\nExample phrases in your style:\n`;
    examples.forEach((example, index) => {
      personalitySection += `${index + 1}. "${example}"\n`;
    });
  }
  
  return basePrompt + personalitySection;
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
  
  segmentPrompt += `Create an engaging lecture script for this segment. The script should be suitable for audio narration.\n\n`;
  
  // Add content blocks
  segmentPrompt += `CONTENT TO COVER:\n\n`;
  
  segment.contentBlocks.forEach((block, index) => {
    segmentPrompt += `--- Content Block ${index + 1} (Page ${block.pageReference}) ---\n`;
    
    switch (block.type) {
      case 'text':
        segmentPrompt += `Text content:\n${block.content}\n\n`;
        break;
        
      case 'figure':
        const figure = block.content as Figure;
        segmentPrompt += `Figure:\n`;
        segmentPrompt += `Caption: ${figure.caption || 'N/A'}\n`;
        segmentPrompt += `Description: ${figure.description}\n`;
        segmentPrompt += `[Provide a clear verbal description of this figure in your script]\n\n`;
        break;
        
      case 'table':
        const table = block.content as Table;
        segmentPrompt += `Table:\n`;
        segmentPrompt += `Headers: ${table.headers.join(', ')}\n`;
        segmentPrompt += `Interpretation: ${table.interpretation}\n`;
        segmentPrompt += `[Summarize the key data and trends from this table in your script]\n\n`;
        break;
        
      case 'formula':
        const formula = block.content as Formula;
        segmentPrompt += `Formula:\n`;
        segmentPrompt += `LaTeX: ${formula.latex}\n`;
        segmentPrompt += `Explanation: ${formula.explanation}\n`;
        segmentPrompt += `[Explain this formula verbally, describing what each part means]\n\n`;
        break;
        
      case 'citation':
        segmentPrompt += `Citation: ${JSON.stringify(block.content)}\n`;
        segmentPrompt += `[Reference this work naturally in your explanation]\n\n`;
        break;
    }
  });
  
  segmentPrompt += `\nINSTRUCTIONS:\n`;
  segmentPrompt += `1. Write a complete lecture script for this segment\n`;
  segmentPrompt += `2. Integrate all content blocks into a cohesive narrative\n`;
  segmentPrompt += `3. Provide verbal descriptions for all visual elements\n`;
  segmentPrompt += `4. Maintain your personality and tone throughout\n`;
  segmentPrompt += `5. Write in a natural speaking style suitable for audio\n`;
  segmentPrompt += `6. The script should flow smoothly when read aloud\n\n`;
  
  segmentPrompt += `Respond with ONLY the lecture script text, no additional formatting or metadata.\n`;
  
  return personalityPrompt + segmentPrompt;
}

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
 * Call LLM API to generate script for a segment
 * This is a placeholder - real implementation would call actual LLM API
 */
async function callScriptGenerationLLM(_prompt: string): Promise<string> {
  // Placeholder implementation
  // In production, this would:
  // 1. Call LLM API (e.g., OpenAI GPT-4, Anthropic Claude)
  // 2. Return the generated script text
  
  logger.info('Calling LLM for script generation (placeholder)');
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Return a mock script for testing
  // In production, this would be the actual LLM response
  return `Welcome to this segment of our lecture. Today we'll explore some fascinating concepts from the scientific literature. 

The research presents compelling evidence that advances our understanding of the field. Let me walk you through the key findings and what they mean for us.

First, let's consider the fundamental principles at play here. The data shows clear patterns that we can interpret and learn from. This is particularly interesting because it challenges some of our previous assumptions.

Looking at the figures presented in this work, we can see visual representations that help clarify these complex ideas. The graphs demonstrate trends that are both surprising and enlightening.

The tables provide us with concrete numbers that support the conclusions. When we examine this data carefully, we notice important relationships between the variables being studied.

The mathematical formulas give us a precise way to describe these phenomena. Each symbol represents a specific quantity, and together they form an equation that captures the essence of what's happening.

In conclusion, this segment has covered important ground in our understanding of the topic. These findings contribute significantly to the broader field of study.`;
}

/**
 * Generate script blocks for a content segment
 */
async function generateScriptForSegment(
  segment: ContentSegment,
  agent: LectureAgent,
  segmentIndex: number,
  totalSegments: number
): Promise<ScriptSegment> {
  logger.info('Generating script for segment', {
    segmentId: segment.id,
    title: segment.title,
    blockCount: segment.contentBlocks.length,
  });
  
  // Create prompt for this segment
  const prompt = createSegmentPrompt(segment, agent, segmentIndex, totalSegments);
  
  // Call LLM to generate script
  const scriptText = await callScriptGenerationLLM(prompt);
  
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
    // Map to corresponding content block (or first block if we have more paragraphs than content blocks)
    const contentBlockIndex = Math.min(index, segment.contentBlocks.length - 1);
    const contentBlock = segment.contentBlocks[contentBlockIndex];
    
    scriptBlocks.push({
      id: uuidv4(),
      text: paragraph.trim(),
      contentReference: {
        type: contentBlock.type,
        id: typeof contentBlock.content === 'string' ? 'text' : (contentBlock.content as any).id || 'unknown',
        pageNumber: contentBlock.pageReference,
      },
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
  try {
    logger.info('Starting script generation', { jobId, agentId });
    
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
      const scriptSegment = await generateScriptForSegment(segment, agent, i, totalSegments);
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
      segmentCount: scriptSegments.length,
      totalDuration,
    });
    
    return lectureScript;
  } catch (error) {
    logger.error('Script generation failed', { jobId, error });
    throw error;
  }
}


# Text-to-Speech (TTS) Configuration Guide

## Overview

The PDF Lecture Service uses Text-to-Speech (TTS) to convert lecture scripts into audio. The system currently supports:

1. **Mock TTS** - For development and testing (no API calls)
2. **AWS Polly** - Production-ready TTS with multiple engines

## Configuration

### Basic Setup

```bash
# Choose TTS provider
TTS_PROVIDER=polly  # or 'mock' for testing

# Configure Polly engine (if using Polly)
POLLY_ENGINE=neural  # generative, long-form, neural, or standard

# AWS credentials (required for Polly)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

## AWS Polly Engines

AWS Polly offers four different engines, each with different characteristics:

### 1. Generative Engine (Newest, Best Quality)

**Status**: ✨ **BEST QUALITY** - Most natural sounding

**Configuration**:
```bash
TTS_PROVIDER=polly
POLLY_ENGINE=generative
```

**Characteristics**:
- 🎯 **Quality**: Highest - Most human-like and natural
- 🎤 **Voices**: Limited selection (Ruth, Stephen, Gregory, Burcu)
- ⏱️ **Word Timings**: ❌ Not available (estimated instead)
- 🌍 **Regions**: Limited (us-east-1, us-west-2, eu-west-1)
- 💰 **Cost**: Higher than neural

**Pros**:
- Most natural and human-like speech
- Best for production where quality is paramount
- Excellent prosody and emotion
- Handles complex sentences well

**Cons**:
- No word-level timing data (system estimates timings)
- Limited voice selection
- Not available in all regions
- Higher cost

**Best For**:
- Production lectures where quality > timing precision
- Content where natural delivery is critical
- Audiences sensitive to robotic speech

**Example Voice Configuration**:
```typescript
{
  voiceId: 'Ruth',  // US English, female, conversational
  speed: 1.0,
  pitch: 0
}
```

---

### 2. Long-Form Engine (Optimized for Lectures)

**Status**: 📚 **LECTURE OPTIMIZED** - Best for long content

**Configuration**:
```bash
TTS_PROVIDER=polly
POLLY_ENGINE=long-form
```

**Characteristics**:
- 🎯 **Quality**: High - Consistent over long text
- 🎤 **Voices**: News-style voices (Matthew, Joanna, Lupe, Pedro)
- ⏱️ **Word Timings**: ✅ Available
- 🌍 **Regions**: Most regions
- 💰 **Cost**: Similar to neural

**Pros**:
- Optimized for long-form content (lectures, audiobooks)
- Maintains consistency over long text
- Word-level timing data available
- Good for educational content

**Cons**:
- Limited to news-style voices
- Less natural than generative
- Formal delivery style

**Best For**:
- Long lectures (>10 minutes)
- Educational content
- News-style delivery
- When word timing precision is needed

**Example Voice Configuration**:
```typescript
{
  voiceId: 'Matthew',  // US English, male, news-style
  speed: 1.0,
  pitch: 0
}
```

---

### 3. Neural Engine (Recommended Default)

**Status**: ⭐ **RECOMMENDED** - Best balance

**Configuration**:
```bash
TTS_PROVIDER=polly
POLLY_ENGINE=neural
```

**Characteristics**:
- 🎯 **Quality**: High - Natural and clear
- 🎤 **Voices**: Most voices available (50+ voices)
- ⏱️ **Word Timings**: ✅ Available
- 🌍 **Regions**: Most regions
- 💰 **Cost**: Moderate

**Pros**:
- Great quality, natural speech
- Most voices available
- Word-level timing data available
- Available in most regions
- Good balance of quality and features

**Cons**:
- Not quite as natural as generative
- Higher cost than standard

**Best For**:
- Production deployments
- When word timing precision is needed
- Wide voice selection needed
- Most use cases (recommended default)

**Example Voice Configuration**:
```typescript
{
  voiceId: 'Joanna',  // US English, female, conversational
  speed: 1.0,
  pitch: 0
}
```

**Popular Neural Voices**:
- **Joanna** - US English, female, conversational
- **Matthew** - US English, male, conversational
- **Salli** - US English, female, friendly
- **Kendra** - US English, female, professional
- **Joey** - US English, male, casual

---

### 4. Standard Engine (Basic Quality)

**Status**: 🔧 **DEVELOPMENT** - For testing

**Configuration**:
```bash
TTS_PROVIDER=polly
POLLY_ENGINE=standard
```

**Characteristics**:
- 🎯 **Quality**: Basic - Robotic sound
- 🎤 **Voices**: All voices available
- ⏱️ **Word Timings**: ✅ Available
- 🌍 **Regions**: All regions
- 💰 **Cost**: Lowest

**Pros**:
- All voices available
- Fastest synthesis
- Lowest cost
- Available everywhere

**Cons**:
- Robotic, less natural sound
- Lower quality
- Not suitable for production

**Best For**:
- Development and testing
- Cost optimization
- Quick prototyping
- When quality is not critical

**Example Voice Configuration**:
```typescript
{
  voiceId: 'Joanna',  // Any voice works
  speed: 1.0,
  pitch: 0
}
```

---

## Engine Comparison Matrix

| Feature | Generative | Long-Form | Neural | Standard |
|---------|-----------|-----------|--------|----------|
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Naturalness** | Most natural | Natural | Natural | Robotic |
| **Word Timings** | ❌ Estimated | ✅ Precise | ✅ Precise | ✅ Precise |
| **Voice Count** | ~4 voices | ~4 voices | 50+ voices | 60+ voices |
| **Regions** | Limited | Most | Most | All |
| **Cost** | Highest | Moderate | Moderate | Lowest |
| **Speed** | Medium | Medium | Medium | Fast |
| **Best For** | Quality | Lectures | Production | Testing |

## Voice Selection

### By Engine

**Generative Voices** (Limited but growing):
- Ruth (US English, female, conversational)
- Stephen (US English, male, conversational)
- Gregory (US English, male, British)
- Burcu (Turkish, female)

**Long-Form Voices** (News-style):
- Matthew (US English, male)
- Joanna (US English, female)
- Lupe (US Spanish, female)
- Pedro (US Spanish, male)

**Neural Voices** (Most selection):
- US English: Joanna, Matthew, Salli, Kendra, Joey, Justin, Ivy, Kimberly, Kevin, Ruth, Stephen
- British English: Amy, Emma, Brian, Arthur
- Australian English: Nicole, Russell
- Indian English: Aditi, Raveena
- And many more languages...

**Standard Voices** (All voices):
- All neural voices plus additional legacy voices

### Voice Configuration in Agent

When creating an agent, specify the voice:

```typescript
{
  name: 'Dr. Science',
  voice: {
    voiceId: 'Matthew',  // Choose based on engine
    speed: 1.0,          // 0.5 to 2.0 (1.0 = normal)
    pitch: 0             // -20 to 20 (0 = normal)
  }
}
```

## Regional Availability

### Generative Engine
- ✅ us-east-1 (N. Virginia)
- ✅ us-west-2 (Oregon)
- ✅ eu-west-1 (Ireland)
- ❌ Other regions (use neural instead)

### Long-Form, Neural, Standard
- ✅ Most AWS regions
- Check AWS Polly documentation for specific region support

## Word Timing Behavior

### With Word Timings (Long-Form, Neural, Standard)

The system gets precise word-level timing from Polly:

```typescript
{
  word: "quantum",
  startTime: 1.234,  // Precise timing from Polly
  endTime: 1.567,
  scriptBlockId: "block-123"
}
```

**Pros**:
- Precise synchronization
- Accurate highlighting
- Perfect audio-text alignment

### Without Word Timings (Generative)

The system estimates timings based on word count and speed:

```typescript
{
  word: "quantum",
  startTime: 1.200,  // Estimated based on speed
  endTime: 1.550,
  scriptBlockId: "block-123"
}
```

**Pros**:
- Still provides synchronization
- Good enough for most use cases

**Cons**:
- Less precise
- May drift slightly over long lectures
- Doesn't account for pauses or emphasis

## Configuration Examples

### Production (Best Quality)

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=generative
AWS_REGION=us-east-1

# Agent voice configuration
voiceId: 'Ruth'  # Generative voice
speed: 1.0
pitch: 0
```

### Production (Best Balance)

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=neural
AWS_REGION=us-east-1

# Agent voice configuration
voiceId: 'Joanna'  # Neural voice
speed: 1.0
pitch: 0
```

### Long Lectures

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=long-form
AWS_REGION=us-east-1

# Agent voice configuration
voiceId: 'Matthew'  # Long-form voice
speed: 1.0
pitch: 0
```

### Development/Testing

```bash
TTS_PROVIDER=mock
# No AWS credentials needed
```

### Cost Optimization

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=standard
AWS_REGION=us-east-1

# Agent voice configuration
voiceId: 'Joanna'  # Any voice works
speed: 1.1  # Slightly faster to reduce audio length
pitch: 0
```

## Cost Considerations

### Polly Pricing (as of 2024)

**Standard Engine**:
- $4.00 per 1 million characters
- Cheapest option

**Neural Engine**:
- $16.00 per 1 million characters
- 4x more expensive than standard

**Long-Form Engine**:
- $16.00 per 1 million characters
- Same as neural

**Generative Engine**:
- $30.00 per 1 million characters
- Most expensive, but best quality

### Cost Estimation

For a typical 10-page scientific paper:
- Script length: ~5,000 characters
- Cost with standard: $0.02
- Cost with neural: $0.08
- Cost with generative: $0.15

**Recommendation**: Use neural for production (good balance), standard for development.

## Troubleshooting

### "Voice not available for engine"

**Problem**: Selected voice doesn't support the chosen engine

**Solution**:
1. Check voice compatibility with engine
2. Use generative voices (Ruth, Stephen) for generative engine
3. Use news voices (Matthew, Joanna) for long-form
4. Most voices work with neural and standard

### "Region not supported"

**Problem**: Generative engine not available in your region

**Solution**:
1. Switch to us-east-1, us-west-2, or eu-west-1
2. Or use neural engine instead (available in more regions)

### "Word timings are inaccurate"

**Problem**: Highlighting doesn't sync well with audio

**Solution**:
1. If using generative: This is expected (timings are estimated)
2. If using neural/long-form: Check for Polly API errors in logs
3. Verify voice speed setting is correct

### "Audio quality is poor"

**Problem**: Speech sounds robotic

**Solution**:
1. Check you're not using standard engine
2. Upgrade to neural or generative
3. Try different voices
4. Adjust speed and pitch settings

## Migration Guide

### From Mock to Polly

```bash
# Before (development)
TTS_PROVIDER=mock

# After (production)
TTS_PROVIDER=polly
POLLY_ENGINE=neural
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### From Standard to Neural

```bash
# Before
POLLY_ENGINE=standard

# After
POLLY_ENGINE=neural
# No other changes needed
```

### From Neural to Generative

```bash
# Before
POLLY_ENGINE=neural
# Agent voice: Joanna

# After
POLLY_ENGINE=generative
# Agent voice: Ruth (must use generative voice)
AWS_REGION=us-east-1  # Ensure supported region
```

## Summary

**For most users**: Use neural engine

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=neural
```

**For best quality**: Use generative engine (accept estimated timings)

```bash
TTS_PROVIDER=polly
POLLY_ENGINE=generative
AWS_REGION=us-east-1
```

**For development**: Use mock provider

```bash
TTS_PROVIDER=mock
```

The system automatically handles engine-specific behavior, including word timing estimation for generative engine.

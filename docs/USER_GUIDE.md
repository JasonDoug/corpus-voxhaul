# PDF Lecture Service - User Guide

Welcome to the PDF Lecture Service! This guide will help you transform dense scientific PDFs into engaging audio lectures with synchronized playback.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Uploading PDFs](#uploading-pdfs)
3. [Managing Lecture Agents](#managing-lecture-agents)
4. [Monitoring Processing Status](#monitoring-processing-status)
5. [Using the Immersive Reader](#using-the-immersive-reader)
6. [Tips and Best Practices](#tips-and-best-practices)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Getting Started

### What is the PDF Lecture Service?

The PDF Lecture Service transforms scientific PDFs into audio lectures by:

1. **Analyzing** the PDF to extract text, figures, tables, formulas, and citations
2. **Segmenting** content into logical topics with natural flow
3. **Generating** a lecture script with your chosen presenter personality
4. **Synthesizing** audio with word-level timing
5. **Providing** an immersive reader with synchronized PDF and script highlighting

### System Requirements

- **Web Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **Internet Connection**: Required for uploading and streaming
- **PDF Files**: Scientific PDFs up to 100MB

### Accessing the Service

**Local Development:**
```
http://localhost:3000
```

**Production:**
```
https://api.your-domain.com
```

---

## Uploading PDFs

### Step 1: Prepare Your PDF

Ensure your PDF:
- Is a valid PDF file (not corrupted)
- Is under 100MB in size
- Contains scientific content (text, figures, tables, formulas)
- Is readable (not password-protected or heavily encrypted)

### Step 2: Upload via API

#### Using curl

```bash
# Convert PDF to base64
PDF_BASE64=$(base64 -i paper.pdf)

# Upload PDF
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"file\": \"$PDF_BASE64\",
    \"filename\": \"paper.pdf\",
    \"agentId\": \"agent-123\"
  }"
```

#### Using Python

```python
import requests
import base64

# Read and encode PDF
with open('paper.pdf', 'rb') as f:
    pdf_content = base64.b64encode(f.read()).decode('utf-8')

# Upload
response = requests.post('http://localhost:3000/api/upload', json={
    'file': pdf_content,
    'filename': 'paper.pdf',
    'agentId': 'agent-123'  # Optional
})

job_id = response.json()['jobId']
print(f'Job ID: {job_id}')
```

#### Using JavaScript

```javascript
const fs = require('fs');
const axios = require('axios');

// Read and encode PDF
const pdfBuffer = fs.readFileSync('paper.pdf');
const pdfBase64 = pdfBuffer.toString('base64');

// Upload
const response = await axios.post('http://localhost:3000/api/upload', {
  file: pdfBase64,
  filename: 'paper.pdf',
  agentId: 'agent-123'  // Optional
});

const jobId = response.data.jobId;
console.log(`Job ID: ${jobId}`);
```

### Step 3: Save Your Job ID

The upload response includes a unique job ID:

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "PDF uploaded successfully. Processing started."
}
```

**Save this job ID!** You'll need it to:
- Check processing status
- Access the playback interface
- Retrieve results

### What Happens After Upload?

The system automatically:
1. Validates your PDF
2. Stores it securely
3. Starts the processing pipeline
4. Analyzes content (30-120 seconds)
5. Segments into topics (10-30 seconds)
6. Generates lecture script (20-60 seconds)
7. Synthesizes audio (30-180 seconds)

**Total time:** 2-6 minutes for typical papers

---

## Managing Lecture Agents

Lecture agents are customizable presenter personalities that determine how your lecture sounds and feels.

### Understanding Agents

Each agent has:
- **Name**: Unique identifier (e.g., "Dr. Enthusiastic")
- **Description**: What makes this agent unique
- **Personality**: Instructions and tone for script generation
- **Voice**: TTS settings (voice ID, speed, pitch)

### Available Tones

- **Humorous**: Uses jokes, puns, and funny analogies
- **Serious**: Maintains formal academic tone
- **Casual**: Conversational and approachable
- **Formal**: Scholarly and precise
- **Enthusiastic**: Energetic and engaging

### Listing Available Agents

```bash
curl http://localhost:3000/api/agents
```

Response:
```json
{
  "agents": [
    {
      "id": "agent-123",
      "name": "Dr. Enthusiastic",
      "description": "An energetic professor who loves making science fun",
      "personality": {
        "instructions": "Explain concepts with enthusiasm and use relatable analogies",
        "tone": "enthusiastic"
      },
      "voice": {
        "voiceId": "en-US-Neural2-A",
        "speed": 1.1,
        "pitch": 2
      }
    }
  ]
}
```

### Creating a Custom Agent

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Humorous",
    "description": "A witty professor who uses humor to explain complex topics",
    "personality": {
      "instructions": "Use jokes, puns, and funny analogies to make concepts memorable. Keep it light but informative.",
      "tone": "humorous",
      "examples": [
        "Why did the photon check into a hotel? Because it was traveling light!",
        "This equation is like a recipe, but instead of cookies, we get knowledge!"
      ]
    },
    "voice": {
      "voiceId": "en-US-Neural2-C",
      "speed": 1.0,
      "pitch": 0
    }
  }'
```

### Voice Configuration

#### Voice ID

Choose from your TTS provider's available voices:
- **AWS Polly**: `Joanna`, `Matthew`, `Salli`, etc.
- **Google TTS**: `en-US-Neural2-A`, `en-US-Neural2-D`, etc.
- **ElevenLabs**: Custom voice IDs

#### Speed

- **0.5**: Very slow (good for complex topics)
- **0.75**: Slow
- **1.0**: Normal (recommended)
- **1.25**: Fast
- **2.0**: Very fast

#### Pitch

- **-20 to -10**: Lower pitch (more authoritative)
- **-5 to 5**: Normal range
- **10 to 20**: Higher pitch (more energetic)

### Updating an Agent

```bash
curl -X PUT http://localhost:3000/api/agents/agent-123 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "voice": {
      "speed": 1.2
    }
  }'
```

### Deleting an Agent

```bash
curl -X DELETE http://localhost:3000/api/agents/agent-123
```

### Agent Selection Tips

**For Complex Topics:**
- Use slower speed (0.9-1.0)
- Choose serious or formal tone
- Lower pitch for authority

**For Introductory Material:**
- Use normal to fast speed (1.0-1.2)
- Choose enthusiastic or casual tone
- Higher pitch for energy

**For Long Papers:**
- Use engaging personality to maintain interest
- Vary speed based on section complexity
- Consider creating multiple agents for different sections

---

## Monitoring Processing Status

### Checking Status

```bash
curl http://localhost:3000/api/status/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "analyzing",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:31:00.000Z",
  "pdfFilename": "research-paper.pdf",
  "agentId": "agent-123",
  "stages": [
    {
      "stage": "upload",
      "status": "completed",
      "startedAt": "2024-01-15T10:30:00.000Z",
      "completedAt": "2024-01-15T10:30:05.000Z"
    },
    {
      "stage": "analysis",
      "status": "in_progress",
      "startedAt": "2024-01-15T10:30:05.000Z"
    },
    {
      "stage": "segmentation",
      "status": "pending"
    },
    {
      "stage": "script_generation",
      "status": "pending"
    },
    {
      "stage": "audio_synthesis",
      "status": "pending"
    }
  ]
}
```

### Status Values

| Status | Description | Typical Duration |
|--------|-------------|------------------|
| `queued` | Job created, waiting to start | < 1 second |
| `analyzing` | Extracting content from PDF | 30-120 seconds |
| `segmenting` | Organizing into topics | 10-30 seconds |
| `generating_script` | Creating lecture script | 20-60 seconds |
| `synthesizing_audio` | Generating audio file | 30-180 seconds |
| `completed` | All processing finished | - |
| `failed` | Processing failed | - |

### Polling for Completion

#### Bash Script

```bash
#!/bin/bash

JOB_ID=$1
API_URL="http://localhost:3000"

while true; do
  STATUS=$(curl -s "$API_URL/api/status/$JOB_ID" | jq -r '.status')
  echo "$(date): Status = $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "Processing complete!"
    echo "Playback URL: $API_URL/api/player/$JOB_ID"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Processing failed!"
    curl -s "$API_URL/api/status/$JOB_ID" | jq '.error'
    break
  fi
  
  sleep 5
done
```

#### Python Script

```python
import time
import requests

def wait_for_completion(job_id, api_url='http://localhost:3000'):
    while True:
        response = requests.get(f'{api_url}/api/status/{job_id}')
        data = response.json()
        status = data['status']
        
        print(f"Status: {status}")
        
        if status == 'completed':
            print('Processing complete!')
            print(f"Playback URL: {api_url}/api/player/{job_id}")
            return True
        elif status == 'failed':
            print('Processing failed!')
            print(f"Error: {data.get('error', 'Unknown error')}")
            return False
        
        time.sleep(5)

# Usage
wait_for_completion('550e8400-e29b-41d4-a716-446655440000')
```

### Understanding Stage Progress

Each stage has its own status:
- **pending**: Not started yet
- **in_progress**: Currently processing
- **completed**: Finished successfully
- **failed**: Encountered an error

### Handling Errors

If status is `failed`, check the error message:

```bash
curl http://localhost:3000/api/status/job-id | jq '.error'
```

Common errors:
- **"PDF parsing failed"**: PDF may be corrupted or encrypted
- **"LLM API error"**: External service issue (retry)
- **"TTS API error"**: Audio synthesis failed (retry)
- **"Timeout"**: Processing took too long (contact support)

---

## Using the Immersive Reader

Once processing is complete, access the immersive reader to experience your audio lecture.

### Accessing the Player

```
http://localhost:3000/api/player/550e8400-e29b-41d4-a716-446655440000
```

### Player Interface

The immersive reader has three main sections:

```
┌─────────────────────────────────────────────────┐
│              Audio Controls                      │
│  [◄◄] [▶/❚❚] [►►]  ━━━━━━━━━━━━━━━━━━━━━━━━  │
│  0:00 / 7:30                                    │
└─────────────────────────────────────────────────┘
┌──────────────────┬──────────────────────────────┐
│                  │                              │
│   PDF Viewer     │    Lecture Script            │
│                  │                              │
│  [Page 1 of 10]  │  Welcome to our exploration  │
│                  │  of quantum mechanics...     │
│  [PDF Content]   │                              │
│                  │  [Highlighted text shows     │
│                  │   current word being spoken] │
│                  │                              │
│                  │  [Auto-scrolls to keep       │
│                  │   highlighted text visible]  │
│                  │                              │
└──────────────────┴──────────────────────────────┘
```

### Features

#### 1. Audio Playback

- **Play/Pause**: Click play button or press spacebar
- **Seek**: Click on progress bar or use arrow keys
- **Speed Control**: Adjust playback speed (0.5x to 2x)
- **Volume**: Adjust volume or mute

#### 2. Synchronized Highlighting

- **Script Highlighting**: Current word is highlighted in yellow
- **PDF Page Sync**: PDF automatically shows the relevant page
- **Auto-scroll**: Script view scrolls to keep highlighted text visible

#### 3. PDF Navigation

- **Page Navigation**: Use arrows or page numbers
- **Zoom**: Zoom in/out on PDF content
- **Element Highlighting**: Figures, tables, and formulas are highlighted when mentioned

#### 4. Script Display

- **Formatted Text**: Script is formatted for readability
- **Segment Titles**: Each topic section has a clear title
- **Visual Cues**: References to figures/tables are marked

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Rewind 5 seconds |
| `→` | Forward 5 seconds |
| `↑` | Increase volume |
| `↓` | Decrease volume |
| `M` | Mute/Unmute |
| `F` | Fullscreen |
| `0-9` | Jump to 0%-90% of audio |

### Tips for Best Experience

1. **Use headphones** for better audio quality
2. **Fullscreen mode** for immersive experience
3. **Adjust playback speed** based on complexity
4. **Pause and review** figures and tables
5. **Take notes** while listening
6. **Replay sections** as needed

### Sharing Playback Links

Share the player URL with others:
```
http://localhost:3000/api/player/550e8400-e29b-41d4-a716-446655440000
```

**Note:** Links expire after 30 days (configurable).

---

## Tips and Best Practices

### Choosing the Right PDF

**Best Results:**
- Well-formatted scientific papers
- Clear text (not scanned images)
- High-quality figures and tables
- Standard academic structure

**May Have Issues:**
- Scanned PDFs (OCR quality varies)
- Heavily encrypted PDFs
- PDFs with complex layouts
- Non-English content (if not supported)

### Optimizing Processing Time

**Faster Processing:**
- Smaller PDFs (< 20 pages)
- Fewer figures and tables
- Simple mathematical formulas
- Standard formatting

**Slower Processing:**
- Large PDFs (> 50 pages)
- Many high-resolution figures
- Complex tables and formulas
- Dense technical content

### Creating Effective Agents

**Good Personality Instructions:**
```
"Explain concepts using everyday analogies. When discussing complex 
topics, break them down into simple steps. Use a conversational tone 
as if teaching a curious friend."
```

**Poor Personality Instructions:**
```
"Be good."  // Too vague
```

**Good Examples:**
```
[
  "Think of this like a recipe - we're combining ingredients to create something new!",
  "Let's break this down step by step, just like solving a puzzle."
]
```

### Managing Multiple Jobs

Keep track of your jobs:

```bash
# Create a jobs log
echo "$(date),paper.pdf,$JOB_ID" >> jobs.csv

# Later, check all jobs
while IFS=, read -r date filename job_id; do
  status=$(curl -s "http://localhost:3000/api/status/$job_id" | jq -r '.status')
  echo "$filename: $status"
done < jobs.csv
```

---

## Troubleshooting

### Upload Issues

**Problem:** "File too large" error

**Solution:**
- Compress PDF using online tools
- Remove unnecessary pages
- Reduce image quality in PDF

**Problem:** "Invalid PDF" error

**Solution:**
- Verify PDF opens in a PDF reader
- Try re-saving PDF
- Convert from another format if needed

### Processing Issues

**Problem:** Job stuck in "analyzing" status

**Solution:**
- Wait up to 5 minutes
- Check status again
- If still stuck after 10 minutes, contact support

**Problem:** Job failed during processing

**Solution:**
- Check error message in status response
- Retry upload if error is retryable
- Try with a different agent
- Contact support with job ID

### Playback Issues

**Problem:** Audio not playing

**Solution:**
- Check browser console for errors
- Verify audio URL is accessible
- Try different browser
- Check internet connection

**Problem:** Highlighting not synchronized

**Solution:**
- Refresh the page
- Check if audio is actually playing
- Try seeking to different position
- Report issue with job ID

**Problem:** PDF not displaying

**Solution:**
- Check if PDF URL is accessible
- Try different browser
- Disable browser extensions
- Check browser console for errors

### Agent Issues

**Problem:** Can't create agent with desired name

**Solution:**
- Agent names must be unique
- Try a different name
- Delete old agent if no longer needed

**Problem:** Agent voice sounds wrong

**Solution:**
- Verify voice ID is correct for your TTS provider
- Adjust speed and pitch settings
- Test with different voice IDs
- Check TTS provider documentation

---

## FAQ

### General Questions

**Q: How long does processing take?**

A: Typically 2-6 minutes for a standard research paper (10-20 pages). Longer papers or those with many figures may take up to 15 minutes.

**Q: What file formats are supported?**

A: Only PDF files are currently supported. The PDF must be readable (not password-protected).

**Q: Is there a file size limit?**

A: Yes, PDFs must be under 100MB.

**Q: How long are results stored?**

A: Results are stored for 30 days by default. After that, they are automatically deleted.

**Q: Can I download the audio file?**

A: Yes, the audio URL in the playback data response can be used to download the MP3 file.

### Agent Questions

**Q: How many agents can I create?**

A: There's no hard limit, but we recommend creating 3-5 agents for different use cases.

**Q: Can I share agents with others?**

A: Agents are account-specific. Others would need to create their own agents with similar settings.

**Q: Can I change the agent after uploading?**

A: No, you need to upload the PDF again with a different agent selected.

**Q: What's the best agent for technical papers?**

A: Use a "serious" or "formal" tone with slower speed (0.9-1.0) for complex technical content.

### Processing Questions

**Q: Can I cancel a job?**

A: Currently, jobs cannot be cancelled once started. They will complete or fail automatically.

**Q: Why did my job fail?**

A: Check the error message in the status response. Common causes include corrupted PDFs, external API failures, or timeouts.

**Q: Can I process multiple PDFs simultaneously?**

A: Yes, you can upload multiple PDFs and they will be processed in parallel.

**Q: What happens if processing times out?**

A: The job will be marked as failed. You can retry by uploading the PDF again.

### Playback Questions

**Q: Can I adjust playback speed?**

A: Yes, use the speed control in the player interface (0.5x to 2x).

**Q: Does the player work on mobile?**

A: The player is optimized for desktop browsers. Mobile support may be limited.

**Q: Can I download the script as text?**

A: Currently, the script is only available through the playback interface. Download functionality may be added in the future.

**Q: Why isn't the PDF highlighting working?**

A: PDF highlighting requires bounding box data, which may not be available for all elements. Script highlighting always works.

---

## Getting Help

### Support Channels

- **Documentation**: Check this guide and the API documentation
- **GitHub Issues**: Report bugs or request features
- **Email**: support@your-domain.com
- **Community Forum**: [forum-url]

### Reporting Issues

When reporting issues, include:
1. Job ID (if applicable)
2. Error message (if any)
3. Steps to reproduce
4. Browser and version (for playback issues)
5. PDF characteristics (size, pages, content type)

### Feature Requests

We welcome feature requests! Please submit them via:
- GitHub Issues with "enhancement" label
- Community forum
- Email to support@your-domain.com

---

## What's Next?

Now that you know how to use the PDF Lecture Service:

1. **Upload your first PDF** and create a lecture
2. **Experiment with different agents** to find your preferred style
3. **Share feedback** to help us improve
4. **Explore advanced features** in the API documentation

Happy learning! 🎓🎧

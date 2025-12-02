# API Documentation

## Overview

The PDF Lecture Service provides a REST API for uploading scientific PDFs, managing lecture agents, and querying processing status. All endpoints return JSON responses.

## Base URL

**Local Development:** `http://localhost:3000`  
**Production:** `https://api.your-domain.com` (configured during deployment)

## Authentication

Production endpoints require an API key passed in the `x-api-key` header:

```
x-api-key: your-api-key-here
```

Local development does not require authentication.

## Common Response Format

### Success Response
```json
{
  "jobId": "string",
  "status": "string",
  "message": "string",
  ...additional fields
}
```

### Error Response
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "retryable": boolean,
  "details": {}
}
```

## Error Codes

| Code | Description | HTTP Status | Retryable |
|------|-------------|-------------|-----------|
| `FILE_TOO_LARGE` | PDF exceeds 100MB limit | 400 | No |
| `INVALID_PDF` | File is not a valid PDF | 400 | No |
| `UPLOAD_FAILED` | Upload to storage failed | 500 | Yes |
| `JOB_NOT_FOUND` | Job ID does not exist | 404 | No |
| `AGENT_NOT_FOUND` | Agent ID does not exist | 404 | No |
| `VALIDATION_ERROR` | Invalid input data | 400 | No |
| `INTERNAL_ERROR` | Unexpected server error | 500 | Yes |
| `EXTERNAL_SERVICE_ERROR` | LLM or TTS API failure | 502 | Yes |

---

## Endpoints

### Health Check

Check if the service is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "localMode": true
}
```

---

### Upload PDF

Upload a scientific PDF to start the processing pipeline.

**Endpoint:** `POST /api/upload`

**Request Body:**
```json
{
  "file": "base64-encoded-pdf-content",
  "filename": "research-paper.pdf",
  "agentId": "agent-123" // Optional: pre-select lecture agent
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | Buffer/Base64 | Yes | PDF file content |
| `filename` | string | Yes | Original filename |
| `agentId` | string | No | Pre-select agent for script generation |

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "PDF uploaded successfully. Processing started."
}
```

**Error Responses:**

**400 - File Too Large:**
```json
{
  "error": "File size exceeds 100MB limit",
  "code": "FILE_TOO_LARGE",
  "retryable": false
}
```

**400 - Invalid PDF:**
```json
{
  "error": "File is not a valid PDF document",
  "code": "INVALID_PDF",
  "retryable": false
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "JVBERi0xLjQKJeLjz9MK...",
    "filename": "paper.pdf"
  }'
```

---

### Query Job Status

Get the current processing status of a job.

**Endpoint:** `GET /api/status/:jobId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Unique job identifier |

**Success Response (200):**
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

**Job Status Values:**

| Status | Description |
|--------|-------------|
| `queued` | Job created, waiting to start |
| `analyzing` | Extracting content from PDF |
| `segmenting` | Organizing content into topics |
| `generating_script` | Creating lecture script |
| `synthesizing_audio` | Generating audio file |
| `completed` | All processing finished |
| `failed` | Processing failed (see error field) |

**Error Response (404):**
```json
{
  "error": "Job not found: invalid-job-id",
  "code": "JOB_NOT_FOUND",
  "retryable": false
}
```

**Example (curl):**
```bash
curl http://localhost:3000/api/status/550e8400-e29b-41d4-a716-446655440000
```

---

### List Lecture Agents

Get all available lecture agents.

**Endpoint:** `GET /api/agents`

**Success Response (200):**
```json
{
  "agents": [
    {
      "id": "agent-123",
      "name": "Dr. Enthusiastic",
      "description": "An energetic professor who loves making science fun",
      "personality": {
        "instructions": "Explain concepts with enthusiasm and use relatable analogies",
        "tone": "enthusiastic",
        "examples": [
          "Imagine this molecule as a tiny dance party!",
          "This is where things get really exciting!"
        ]
      },
      "voice": {
        "voiceId": "en-US-Neural2-A",
        "speed": 1.1,
        "pitch": 2
      },
      "createdAt": "2024-01-10T08:00:00.000Z"
    },
    {
      "id": "agent-456",
      "name": "Professor Serious",
      "description": "A formal academic who maintains scholarly rigor",
      "personality": {
        "instructions": "Maintain academic tone and precise terminology",
        "tone": "formal"
      },
      "voice": {
        "voiceId": "en-US-Neural2-D",
        "speed": 0.95,
        "pitch": -2
      },
      "createdAt": "2024-01-10T08:05:00.000Z"
    }
  ]
}
```

**Example (curl):**
```bash
curl http://localhost:3000/api/agents
```

---

### Get Agent by ID

Retrieve a specific lecture agent.

**Endpoint:** `GET /api/agents/:agentId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Unique agent identifier |

**Success Response (200):**
```json
{
  "id": "agent-123",
  "name": "Dr. Enthusiastic",
  "description": "An energetic professor who loves making science fun",
  "personality": {
    "instructions": "Explain concepts with enthusiasm and use relatable analogies",
    "tone": "enthusiastic",
    "examples": [
      "Imagine this molecule as a tiny dance party!"
    ]
  },
  "voice": {
    "voiceId": "en-US-Neural2-A",
    "speed": 1.1,
    "pitch": 2
  },
  "createdAt": "2024-01-10T08:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "error": "Agent not found: invalid-agent-id",
  "code": "AGENT_NOT_FOUND",
  "retryable": false
}
```

---

### Create Lecture Agent

Create a new lecture agent with custom personality and voice.

**Endpoint:** `POST /api/agents`

**Request Body:**
```json
{
  "name": "Dr. Humorous",
  "description": "A witty professor who uses humor to explain complex topics",
  "personality": {
    "instructions": "Use jokes, puns, and funny analogies to make concepts memorable",
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
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique agent name |
| `description` | string | Yes | Brief description of agent |
| `personality.instructions` | string | Yes | Instructions for script generation |
| `personality.tone` | string | Yes | One of: `humorous`, `serious`, `casual`, `formal`, `enthusiastic` |
| `personality.examples` | string[] | No | Example phrases in agent's style |
| `voice.voiceId` | string | Yes | TTS provider voice identifier |
| `voice.speed` | number | Yes | Speech rate (0.5 to 2.0) |
| `voice.pitch` | number | Yes | Voice pitch (-20 to 20) |

**Success Response (201):**
```json
{
  "id": "agent-789",
  "name": "Dr. Humorous",
  "description": "A witty professor who uses humor to explain complex topics",
  "personality": {
    "instructions": "Use jokes, puns, and funny analogies to make concepts memorable",
    "tone": "humorous",
    "examples": [
      "Why did the photon check into a hotel? Because it was traveling light!"
    ]
  },
  "voice": {
    "voiceId": "en-US-Neural2-C",
    "speed": 1.0,
    "pitch": 0
  },
  "createdAt": "2024-01-15T10:45:00.000Z"
}
```

**Error Response (400):**
```json
{
  "error": "Agent name must be unique",
  "code": "VALIDATION_ERROR",
  "retryable": false
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Humorous",
    "description": "A witty professor",
    "personality": {
      "instructions": "Use humor",
      "tone": "humorous"
    },
    "voice": {
      "voiceId": "en-US-Neural2-C",
      "speed": 1.0,
      "pitch": 0
    }
  }'
```

---

### Update Lecture Agent

Update an existing lecture agent.

**Endpoint:** `PUT /api/agents/:agentId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Unique agent identifier |

**Request Body:**
```json
{
  "description": "Updated description",
  "personality": {
    "instructions": "Updated instructions"
  },
  "voice": {
    "speed": 1.2
  }
}
```

All fields are optional. Only provided fields will be updated.

**Success Response (200):**
```json
{
  "id": "agent-123",
  "name": "Dr. Enthusiastic",
  "description": "Updated description",
  "personality": {
    "instructions": "Updated instructions",
    "tone": "enthusiastic"
  },
  "voice": {
    "voiceId": "en-US-Neural2-A",
    "speed": 1.2,
    "pitch": 2
  },
  "createdAt": "2024-01-10T08:00:00.000Z"
}
```

---

### Delete Lecture Agent

Delete a lecture agent.

**Endpoint:** `DELETE /api/agents/:agentId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Unique agent identifier |

**Success Response (204):**

No content returned.

**Example (curl):**
```bash
curl -X DELETE http://localhost:3000/api/agents/agent-123
```

---

### Get Playback Interface

Access the immersive reader playback interface for a completed job.

**Endpoint:** `GET /api/player/:jobId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Unique job identifier |

**Response:**

Returns HTML page with synchronized PDF and script viewer.

**Example:**
```
http://localhost:3000/api/player/550e8400-e29b-41d4-a716-446655440000
```

---

### Get Playback Data

Retrieve playback data for the immersive reader (used by frontend).

**Endpoint:** `GET /api/playback/:jobId`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Unique job identifier |

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "pdfUrl": "https://s3.amazonaws.com/bucket/pdfs/job-id/original.pdf",
  "audioUrl": "https://s3.amazonaws.com/bucket/audio/job-id/lecture.mp3",
  "script": {
    "segments": [
      {
        "segmentId": "seg-1",
        "title": "Introduction to Quantum Mechanics",
        "scriptBlocks": [
          {
            "id": "block-1",
            "text": "Welcome to our exploration of quantum mechanics...",
            "contentReference": {
              "type": "text",
              "id": "content-1",
              "pageNumber": 1
            },
            "estimatedDuration": 15.5
          }
        ]
      }
    ],
    "totalEstimatedDuration": 450.0
  },
  "wordTimings": [
    {
      "word": "Welcome",
      "startTime": 0.0,
      "endTime": 0.5,
      "scriptBlockId": "block-1"
    },
    {
      "word": "to",
      "startTime": 0.5,
      "endTime": 0.65,
      "scriptBlockId": "block-1"
    }
  ]
}
```

---

## Pipeline Processing Endpoints

These endpoints manually trigger pipeline stages (primarily for testing).

### Trigger Content Analysis

**Endpoint:** `POST /api/analyze/:jobId`

Manually trigger content analysis for a job.

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "segmenting",
  "message": "Content analysis completed"
}
```

---

### Trigger Content Segmentation

**Endpoint:** `POST /api/segment/:jobId`

Manually trigger content segmentation for a job.

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "generating_script",
  "message": "Content segmentation completed",
  "segmentedContent": {
    "segments": 5
  }
}
```

---

### Trigger Script Generation

**Endpoint:** `POST /api/script/:jobId`

Manually trigger script generation for a job.

**Request Body (optional):**
```json
{
  "agentId": "agent-123"
}
```

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "synthesizing_audio",
  "message": "Script generation completed",
  "lectureScript": {
    "segments": 5,
    "totalEstimatedDuration": 450.0
  }
}
```

---

### Trigger Audio Synthesis

**Endpoint:** `POST /api/audio/:jobId`

Manually trigger audio synthesis for a job.

**Success Response (200):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Audio synthesis completed",
  "audioOutput": {
    "audioUrl": "https://s3.amazonaws.com/bucket/audio/job-id/lecture.mp3",
    "duration": 450.0,
    "wordTimingCount": 3500
  }
}
```

---

## Rate Limits

**Local Development:** No rate limits

**Production:**
- 100 requests per minute per API key
- 10 concurrent PDF uploads per API key
- 429 status code returned when limit exceeded

---

## Webhooks (Future)

Webhook support for job completion notifications is planned for a future release.

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

// Upload PDF
async function uploadPDF(pdfBuffer: Buffer, filename: string) {
  const response = await axios.post(`${API_BASE}/api/upload`, {
    file: pdfBuffer.toString('base64'),
    filename,
  });
  return response.data.jobId;
}

// Check status
async function checkStatus(jobId: string) {
  const response = await axios.get(`${API_BASE}/api/status/${jobId}`);
  return response.data;
}

// Create agent
async function createAgent(agentData: any) {
  const response = await axios.post(`${API_BASE}/api/agents`, agentData);
  return response.data;
}

// Usage
const jobId = await uploadPDF(pdfBuffer, 'paper.pdf');
console.log('Job created:', jobId);

// Poll for completion
const interval = setInterval(async () => {
  const status = await checkStatus(jobId);
  console.log('Status:', status.status);
  
  if (status.status === 'completed') {
    clearInterval(interval);
    console.log('Processing complete!');
    console.log('Player URL:', `${API_BASE}/api/player/${jobId}`);
  }
}, 5000);
```

### Python

```python
import requests
import base64
import time

API_BASE = 'http://localhost:3000'

# Upload PDF
def upload_pdf(pdf_path, filename):
    with open(pdf_path, 'rb') as f:
        pdf_content = base64.b64encode(f.read()).decode('utf-8')
    
    response = requests.post(f'{API_BASE}/api/upload', json={
        'file': pdf_content,
        'filename': filename
    })
    return response.json()['jobId']

# Check status
def check_status(job_id):
    response = requests.get(f'{API_BASE}/api/status/{job_id}')
    return response.json()

# Usage
job_id = upload_pdf('paper.pdf', 'paper.pdf')
print(f'Job created: {job_id}')

# Poll for completion
while True:
    status = check_status(job_id)
    print(f"Status: {status['status']}")
    
    if status['status'] == 'completed':
        print('Processing complete!')
        print(f"Player URL: {API_BASE}/api/player/{job_id}")
        break
    
    time.sleep(5)
```

---

## Support

For issues or questions:
- GitHub Issues: [repository-url]
- Email: support@your-domain.com
- Documentation: [docs-url]

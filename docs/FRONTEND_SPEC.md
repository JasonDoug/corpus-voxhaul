# Frontend Development Specification

## Overview

This document provides complete specifications for building a web frontend for the PDF Lecture Service. It includes all API endpoints, request/response formats, data models, and implementation examples.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Base Configuration](#api-base-configuration)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [User Flows](#user-flows)
6. [UI Components](#ui-components)
7. [State Management](#state-management)
8. [Error Handling](#error-handling)

---

## Architecture Overview

### Application Structure

```
Frontend Application
├── Upload Page
│   ├── PDF File Selector
│   ├── Agent Selector (optional)
│   └── Upload Progress
├── Jobs Dashboard
│   ├── Job List
│   ├── Status Display
│   └── Progress Indicators
├── Agent Management
│   ├── Agent List
│   ├── Create Agent Form
│   └── Edit Agent Form
└── Immersive Reader
    ├── PDF Viewer
    ├── Script Display
    ├── Audio Player
    └── Synchronized Highlighting
```

### Technology Recommendations

- **Framework**: React, Vue, or Svelte
- **HTTP Client**: axios or fetch API
- **PDF Rendering**: PDF.js or react-pdf
- **Audio Player**: HTML5 Audio API or howler.js
- **State Management**: React Context, Zustand, or Pinia
- **Styling**: Tailwind CSS or Material-UI

---

## API Base Configuration

### Environment Variables

```javascript
// config.js
export const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
};

// For production with API key
export const API_CONFIG_PROD = {
  baseURL: 'https://api.your-domain.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.REACT_APP_API_KEY,
  }
};
```

### API Client Setup

```javascript
// api/client.js
import axios from 'axios';
import { API_CONFIG } from '../config';

const apiClient = axios.create(API_CONFIG);

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth tokens or custom headers
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Data Models

### TypeScript Interfaces

```typescript
// types/models.ts

// Job Status
export type JobStatus = 
  | 'queued'
  | 'analyzing'
  | 'segmenting'
  | 'generating_script'
  | 'synthesizing_audio'
  | 'completed'
  | 'failed';

export interface StageStatus {
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface Job {
  jobId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  pdfFilename: string;
  pdfUrl?: string;
  agentId?: string;
  stages: StageStatus[];
  error?: string;
}

// Agent Models
export type AgentTone = 'humorous' | 'serious' | 'casual' | 'formal' | 'enthusiastic';

export interface PersonalityConfig {
  instructions: string;
  tone: AgentTone;
  examples?: string[];
}

export interface VoiceConfig {
  voiceId: string;
  speed: number; // 0.5 to 2.0
  pitch: number; // -20 to 20
}

export interface LectureAgent {
  id: string;
  name: string;
  description: string;
  personality: PersonalityConfig;
  voice: VoiceConfig;
  createdAt: string;
}

// Playback Models
export interface ScriptBlock {
  id: string;
  text: string;
  contentReference: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'citation';
    id: string;
    pageNumber: number;
  };
  estimatedDuration: number;
}

export interface ScriptSegment {
  segmentId: string;
  title: string;
  scriptBlocks: ScriptBlock[];
}

export interface LectureScript {
  segments: ScriptSegment[];
  totalEstimatedDuration: number;
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  scriptBlockId: string;
}

export interface PlaybackData {
  jobId: string;
  pdfUrl: string;
  audioUrl: string;
  script: LectureScript;
  wordTimings: WordTiming[];
}

// Error Response
export interface ErrorResponse {
  error: string;
  code: string;
  retryable: boolean;
  details?: Record<string, any>;
}
```

---

## API Endpoints

### 1. Health Check

**Purpose**: Verify API is running

**Endpoint**: `GET /health`

**Request**: None

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "localMode": true
}
```

**Implementation**:
```javascript
// api/health.js
export async function checkHealth() {
  const response = await apiClient.get('/health');
  return response.data;
}
```

---

### 2. Upload PDF

**Purpose**: Upload a PDF file to start processing

**Endpoint**: `POST /api/upload`

**Request Body**:
```json
{
  "file": "base64-encoded-pdf-content",
  "filename": "research-paper.pdf",
  "agentId": "agent-123"
}
```

**Response** (Success - 200):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "PDF uploaded successfully. Processing started."
}
```

**Response** (Error - 400):
```json
{
  "error": "File size exceeds 100MB limit",
  "code": "FILE_TOO_LARGE",
  "retryable": false
}
```

**Implementation**:
```javascript
// api/upload.js
export async function uploadPDF(file, filename, agentId = null) {
  // Convert file to base64
  const base64 = await fileToBase64(file);
  
  const response = await apiClient.post('/api/upload', {
    file: base64,
    filename: filename,
    agentId: agentId
  });
  
  return response.data;
}

// Helper function
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data:application/pdf;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
```

**React Component Example**:
```jsx
// components/UploadForm.jsx
import React, { useState } from 'react';
import { uploadPDF } from '../api/upload';

export function UploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Validate file
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size must be under 100MB');
        return;
      }
      if (selectedFile.type !== 'application/pdf') {
        setError('File must be a PDF');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await uploadPDF(file, file.name, agentId || null);
      onUploadSuccess(result.jobId);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Select PDF File:</label>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>

      <div>
        <label>Agent (optional):</label>
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Leave empty for default"
          disabled={loading}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={!file || loading}>
        {loading ? 'Uploading...' : 'Upload PDF'}
      </button>
    </form>
  );
}
```

---

### 3. Query Job Status

**Purpose**: Get current processing status of a job

**Endpoint**: `GET /api/status/:jobId`

**Request**: None (jobId in URL)

**Response** (Success - 200):
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

**Response** (Error - 404):
```json
{
  "error": "Job not found: invalid-job-id",
  "code": "JOB_NOT_FOUND",
  "retryable": false
}
```

**Implementation**:
```javascript
// api/jobs.js
export async function getJobStatus(jobId) {
  const response = await apiClient.get(`/api/status/${jobId}`);
  return response.data;
}

// Poll for completion
export async function pollJobStatus(jobId, onUpdate, interval = 5000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        onUpdate(status);

        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error || 'Job failed'));
        } else {
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
```

**React Component Example**:
```jsx
// components/JobStatus.jsx
import React, { useState, useEffect } from 'react';
import { getJobStatus } from '../api/jobs';

export function JobStatus({ jobId, onComplete }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const data = await getJobStatus(jobId);
        setStatus(data);

        if (data.status === 'completed') {
          clearInterval(intervalId);
          onComplete(data);
        } else if (data.status === 'failed') {
          clearInterval(intervalId);
          setError(data.error || 'Processing failed');
        }
      } catch (err) {
        setError(err.message);
        clearInterval(intervalId);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 5000);

    return () => clearInterval(intervalId);
  }, [jobId, onComplete]);

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!status) {
    return <div>Loading...</div>;
  }

  return (
    <div className="job-status">
      <h3>Job Status: {status.status}</h3>
      <p>File: {status.pdfFilename}</p>
      
      <div className="stages">
        {status.stages.map((stage, index) => (
          <div key={index} className={`stage stage-${stage.status}`}>
            <span className="stage-name">{stage.stage}</span>
            <span className="stage-status">{stage.status}</span>
          </div>
        ))}
      </div>

      {status.status === 'completed' && (
        <button onClick={() => window.location.href = `/player/${jobId}`}>
          View Lecture
        </button>
      )}
    </div>
  );
}
```

---

### 4. List Agents

**Purpose**: Get all available lecture agents

**Endpoint**: `GET /api/agents`

**Request**: None

**Response** (Success - 200):
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
  ]
}
```

**Implementation**:
```javascript
// api/agents.js
export async function listAgents() {
  const response = await apiClient.get('/api/agents');
  return response.data.agents;
}
```

**React Component Example**:
```jsx
// components/AgentSelector.jsx
import React, { useState, useEffect } from 'react';
import { listAgents } from '../api/agents';

export function AgentSelector({ value, onChange }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const data = await listAgents();
        setAgents(data);
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  if (loading) {
    return <div>Loading agents...</div>;
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select an agent (optional)</option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name} - {agent.description}
        </option>
      ))}
    </select>
  );
}
```

---

### 5. Create Agent

**Purpose**: Create a new lecture agent

**Endpoint**: `POST /api/agents`

**Request Body**:
```json
{
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
  }
}
```

**Response** (Success - 201):
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

**Implementation**:
```javascript
// api/agents.js
export async function createAgent(agentData) {
  const response = await apiClient.post('/api/agents', agentData);
  return response.data;
}
```

**React Component Example**:
```jsx
// components/CreateAgentForm.jsx
import React, { useState } from 'react';
import { createAgent } from '../api/agents';

export function CreateAgentForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personality: {
      instructions: '',
      tone: 'casual',
      examples: []
    },
    voice: {
      voiceId: 'en-US-Neural2-A',
      speed: 1.0,
      pitch: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const agent = await createAgent(formData);
      onSuccess(agent);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Name:</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Description:</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Personality Instructions:</label>
        <textarea
          value={formData.personality.instructions}
          onChange={(e) => setFormData({
            ...formData,
            personality: {...formData.personality, instructions: e.target.value}
          })}
          required
        />
      </div>

      <div>
        <label>Tone:</label>
        <select
          value={formData.personality.tone}
          onChange={(e) => setFormData({
            ...formData,
            personality: {...formData.personality, tone: e.target.value}
          })}
        >
          <option value="humorous">Humorous</option>
          <option value="serious">Serious</option>
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="enthusiastic">Enthusiastic</option>
        </select>
      </div>

      <div>
        <label>Voice ID:</label>
        <input
          type="text"
          value={formData.voice.voiceId}
          onChange={(e) => setFormData({
            ...formData,
            voice: {...formData.voice, voiceId: e.target.value}
          })}
          required
        />
      </div>

      <div>
        <label>Speed (0.5 - 2.0):</label>
        <input
          type="number"
          min="0.5"
          max="2.0"
          step="0.1"
          value={formData.voice.speed}
          onChange={(e) => setFormData({
            ...formData,
            voice: {...formData.voice, speed: parseFloat(e.target.value)}
          })}
        />
      </div>

      <div>
        <label>Pitch (-20 to 20):</label>
        <input
          type="number"
          min="-20"
          max="20"
          value={formData.voice.pitch}
          onChange={(e) => setFormData({
            ...formData,
            voice: {...formData.voice, pitch: parseInt(e.target.value)}
          })}
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Agent'}
      </button>
    </form>
  );
}
```

---

### 6. Get Playback Data

**Purpose**: Retrieve all data needed for the immersive reader

**Endpoint**: `GET /api/playback/:jobId`

**Request**: None (jobId in URL)

**Response** (Success - 200):
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
            "text": "Welcome to our exploration of quantum mechanics. This fascinating field reveals the strange behavior of particles at the smallest scales.",
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

**Implementation**:
```javascript
// api/playback.js
export async function getPlaybackData(jobId) {
  const response = await apiClient.get(`/api/playback/${jobId}`);
  return response.data;
}
```

---

## User Flows

### Flow 1: Upload and Monitor PDF

```javascript
// Complete upload flow
async function uploadAndMonitor(file, agentId = null) {
  try {
    // Step 1: Upload PDF
    console.log('Uploading PDF...');
    const uploadResult = await uploadPDF(file, file.name, agentId);
    const jobId = uploadResult.jobId;
    console.log('Upload successful. Job ID:', jobId);

    // Step 2: Poll for completion
    console.log('Monitoring job status...');
    const finalStatus = await pollJobStatus(
      jobId,
      (status) => {
        console.log('Current status:', status.status);
        // Update UI with progress
      }
    );

    // Step 3: Navigate to player
    console.log('Processing complete!');
    window.location.href = `/player/${jobId}`;
    
  } catch (error) {
    console.error('Error:', error.message);
    // Show error to user
  }
}
```

### Flow 2: Create Agent and Upload with Agent

```javascript
// Complete agent creation and upload flow
async function createAgentAndUpload(agentData, file) {
  try {
    // Step 1: Create agent
    console.log('Creating agent...');
    const agent = await createAgent(agentData);
    console.log('Agent created:', agent.id);

    // Step 2: Upload PDF with agent
    console.log('Uploading PDF with agent...');
    const uploadResult = await uploadPDF(file, file.name, agent.id);
    const jobId = uploadResult.jobId;

    // Step 3: Monitor and complete
    await pollJobStatus(jobId, (status) => {
      console.log('Status:', status.status);
    });

    window.location.href = `/player/${jobId}`;
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

---

## UI Components

### Component 1: Immersive Reader

The immersive reader is the most complex component. Here's a complete implementation guide:

**HTML Structure**:
```html
<div class="immersive-reader">
  <!-- Audio Controls -->
  <div class="audio-controls">
    <button id="play-pause">▶</button>
    <input type="range" id="seek-bar" min="0" max="100" value="0">
    <span id="current-time">0:00</span>
    <span>/</span>
    <span id="total-time">0:00</span>
    <input type="range" id="volume" min="0" max="100" value="100">
  </div>

  <!-- Main Content -->
  <div class="content-container">
    <!-- PDF Viewer -->
    <div class="pdf-viewer">
      <canvas id="pdf-canvas"></canvas>
      <div class="pdf-controls">
        <button id="prev-page">◄</button>
        <span id="page-num">1</span>
        <span>/</span>
        <span id="page-count">1</span>
        <button id="next-page">►</button>
      </div>
    </div>

    <!-- Script Display -->
    <div class="script-viewer">
      <div id="script-content"></div>
    </div>
  </div>
</div>
```

**JavaScript Implementation**:
```javascript
// components/ImmersiveReader.js
import * as pdfjsLib from 'pdfjs-dist';

class ImmersiveReader {
  constructor(playbackData) {
    this.jobId = playbackData.jobId;
    this.pdfUrl = playbackData.pdfUrl;
    this.audioUrl = playbackData.audioUrl;
    this.script = playbackData.script;
    this.wordTimings = playbackData.wordTimings;
    
    this.audio = null;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.currentWordIndex = 0;
    
    this.init();
  }

  async init() {
    await this.loadPDF();
    await this.loadAudio();
    this.renderScript();
    this.setupEventListeners();
  }

  async loadPDF() {
    // Load PDF using PDF.js
    const loadingTask = pdfjsLib.getDocument(this.pdfUrl);
    this.pdfDoc = await loadingTask.promise;
    
    document.getElementById('page-count').textContent = this.pdfDoc.numPages;
    await this.renderPage(1);
  }

  async renderPage(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    this.currentPage = pageNum;
    document.getElementById('page-num').textContent = pageNum;
  }

  async loadAudio() {
    this.audio = new Audio(this.audioUrl);
    
    // Set up audio event listeners
    this.audio.addEventListener('loadedmetadata', () => {
      const duration = this.formatTime(this.audio.duration);
      document.getElementById('total-time').textContent = duration;
    });

    this.audio.addEventListener('timeupdate', () => {
      this.onTimeUpdate();
    });

    this.audio.addEventListener('ended', () => {
      document.getElementById('play-pause').textContent = '▶';
    });
  }

  renderScript() {
    const scriptContent = document.getElementById('script-content');
    scriptContent.innerHTML = '';

    this.script.segments.forEach(segment => {
      // Create segment title
      const title = document.createElement('h3');
      title.textContent = segment.title;
      title.className = 'segment-title';
      scriptContent.appendChild(title);

      // Create script blocks
      segment.scriptBlocks.forEach(block => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'script-block';
        blockDiv.id = `block-${block.id}`;
        blockDiv.dataset.pageNumber = block.contentReference.pageNumber;

        // Split text into words for highlighting
        const words = block.text.split(' ');
        words.forEach((word, index) => {
          const wordSpan = document.createElement('span');
          wordSpan.textContent = word + ' ';
          wordSpan.className = 'word';
          wordSpan.dataset.blockId = block.id;
          blockDiv.appendChild(wordSpan);
        });

        scriptContent.appendChild(blockDiv);
      });
    });
  }

  setupEventListeners() {
    // Play/Pause
    document.getElementById('play-pause').addEventListener('click', () => {
      if (this.audio.paused) {
        this.audio.play();
        document.getElementById('play-pause').textContent = '❚❚';
      } else {
        this.audio.pause();
        document.getElementById('play-pause').textContent = '▶';
      }
    });

    // Seek bar
    const seekBar = document.getElementById('seek-bar');
    seekBar.addEventListener('input', (e) => {
      const time = (e.target.value / 100) * this.audio.duration;
      this.audio.currentTime = time;
    });

    // Volume
    document.getElementById('volume').addEventListener('input', (e) => {
      this.audio.volume = e.target.value / 100;
    });

    // Page navigation
    document.getElementById('prev-page').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.renderPage(this.currentPage - 1);
      }
    });

    document.getElementById('next-page').addEventListener('click', () => {
      if (this.currentPage < this.pdfDoc.numPages) {
        this.renderPage(this.currentPage + 1);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('play-pause').click();
      }
    });
  }

  onTimeUpdate() {
    const currentTime = this.audio.currentTime;
    
    // Update time display
    document.getElementById('current-time').textContent = this.formatTime(currentTime);
    
    // Update seek bar
    const progress = (currentTime / this.audio.duration) * 100;
    document.getElementById('seek-bar').value = progress;

    // Find current word using binary search
    const wordIndex = this.findCurrentWord(currentTime);
    if (wordIndex !== this.currentWordIndex) {
      this.highlightWord(wordIndex);
      this.currentWordIndex = wordIndex;
    }
  }

  findCurrentWord(time) {
    // Binary search for efficiency
    let left = 0;
    let right = this.wordTimings.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const timing = this.wordTimings[mid];

      if (time >= timing.startTime && time <= timing.endTime) {
        return mid;
      } else if (time < timing.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return left > 0 ? left - 1 : 0;
  }

  highlightWord(wordIndex) {
    // Remove previous highlight
    document.querySelectorAll('.word.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    if (wordIndex >= this.wordTimings.length) return;

    const timing = this.wordTimings[wordIndex];
    
    // Find and highlight the word
    const block = document.getElementById(`block-${timing.scriptBlockId}`);
    if (block) {
      const words = block.querySelectorAll('.word');
      
      // Find the matching word in the block
      for (let i = 0; i < words.length; i++) {
        const wordText = words[i].textContent.trim();
        if (wordText === timing.word) {
          words[i].classList.add('highlighted');
          
          // Scroll to keep word visible
          words[i].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
          
          // Update PDF page if needed
          const pageNumber = parseInt(block.dataset.pageNumber);
          if (pageNumber !== this.currentPage) {
            this.renderPage(pageNumber);
          }
          
          break;
        }
      }
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Usage
async function initPlayer(jobId) {
  try {
    const playbackData = await getPlaybackData(jobId);
    const reader = new ImmersiveReader(playbackData);
  } catch (error) {
    console.error('Failed to load playback data:', error);
  }
}
```

**CSS Styling**:
```css
/* styles/immersive-reader.css */
.immersive-reader {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: #ffffff;
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.audio-controls button {
  padding: 0.5rem 1rem;
  background: #4a9eff;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
}

.audio-controls button:hover {
  background: #3a8eef;
}

#seek-bar {
  flex: 1;
  height: 6px;
}

.content-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  flex: 1;
  overflow: hidden;
}

.pdf-viewer {
  display: flex;
  flex-direction: column;
  background: #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  overflow: auto;
}

#pdf-canvas {
  max-width: 100%;
  height: auto;
}

.pdf-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.script-viewer {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  overflow-y: auto;
}

.segment-title {
  color: #4a9eff;
  margin: 1.5rem 0 1rem 0;
  font-size: 1.3rem;
}

.script-block {
  margin-bottom: 1.5rem;
  line-height: 1.8;
  font-size: 1.1rem;
}

.word {
  transition: background-color 0.1s ease;
}

.word.highlighted {
  background-color: #ffeb3b;
  color: #000;
  padding: 2px 4px;
  border-radius: 3px;
}

/* Responsive design */
@media (max-width: 768px) {
  .content-container {
    grid-template-columns: 1fr;
  }
}
```

---

## State Management

### Recommended State Structure

```javascript
// store/index.js (using Zustand or similar)
import create from 'zustand';

export const useAppStore = create((set, get) => ({
  // Jobs state
  jobs: [],
  currentJob: null,
  
  // Agents state
  agents: [],
  selectedAgent: null,
  
  // UI state
  loading: false,
  error: null,
  
  // Actions
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
  setCurrentJob: (job) => set({ currentJob: job }),
  
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  // Async actions
  uploadPDF: async (file, agentId) => {
    set({ loading: true, error: null });
    try {
      const result = await uploadPDF(file, file.name, agentId);
      get().addJob(result);
      return result.jobId;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  
  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const agents = await listAgents();
      set({ agents });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));
```

### Using State in Components

```jsx
// components/UploadPage.jsx
import React from 'react';
import { useAppStore } from '../store';

export function UploadPage() {
  const { uploadPDF, loading, error, selectedAgent } = useAppStore();
  const [file, setFile] = React.useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const jobId = await uploadPDF(file, selectedAgent);
      // Navigate to status page
      window.location.href = `/status/${jobId}`;
    } catch (err) {
      // Error is already in state
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
```

---

## Error Handling

### Global Error Handler

```javascript
// utils/errorHandler.js
export class APIError extends Error {
  constructor(message, code, retryable, details) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function handleAPIError(error) {
  if (error.response) {
    // Server responded with error
    const { error: message, code, retryable, details } = error.response.data;
    return new APIError(message, code, retryable, details);
  } else if (error.request) {
    // Request made but no response
    return new APIError(
      'No response from server. Please check your connection.',
      'NETWORK_ERROR',
      true
    );
  } else {
    // Something else happened
    return new APIError(
      error.message,
      'UNKNOWN_ERROR',
      false
    );
  }
}

// Add to axios interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = handleAPIError(error);
    return Promise.reject(apiError);
  }
);
```

### Error Display Component

```jsx
// components/ErrorDisplay.jsx
import React from 'react';

export function ErrorDisplay({ error, onRetry, onDismiss }) {
  if (!error) return null;

  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <div className="error-content">
        <h3>Error</h3>
        <p>{error.message}</p>
        {error.code && <code>Error Code: {error.code}</code>}
      </div>
      <div className="error-actions">
        {error.retryable && onRetry && (
          <button onClick={onRetry}>Retry</button>
        )}
        {onDismiss && (
          <button onClick={onDismiss}>Dismiss</button>
        )}
      </div>
    </div>
  );
}
```

### Retry Logic

```javascript
// utils/retry.js
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1 || !error.retryable) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
try {
  const result = await retryWithBackoff(() => uploadPDF(file, filename));
} catch (error) {
  console.error('Failed after retries:', error);
}
```

---

## Complete Example Application

### App.jsx (Main Application)

```jsx
// App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { UploadPage } from './pages/UploadPage';
import { StatusPage } from './pages/StatusPage';
import { AgentsPage } from './pages/AgentsPage';
import { PlayerPage } from './pages/PlayerPage';
import { Navigation } from './components/Navigation';

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/status/:jobId" element={<StatusPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/player/:jobId" element={<PlayerPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

### HomePage.jsx

```jsx
// pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="home-page">
      <h1>PDF Lecture Service</h1>
      <p>Transform scientific PDFs into engaging audio lectures</p>
      
      <div className="features">
        <div className="feature">
          <h3>📄 Upload PDF</h3>
          <p>Upload any scientific PDF up to 100MB</p>
        </div>
        <div className="feature">
          <h3>🤖 Choose Agent</h3>
          <p>Select from multiple presenter personalities</p>
        </div>
        <div className="feature">
          <h3>🎧 Listen & Learn</h3>
          <p>Synchronized audio with PDF and script</p>
        </div>
      </div>

      <Link to="/upload" className="cta-button">
        Get Started
      </Link>
    </div>
  );
}
```

### UploadPage.jsx (Complete)

```jsx
// pages/UploadPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPDF } from '../api/upload';
import { listAgents } from '../api/agents';
import { AgentSelector } from '../components/AgentSelector';
import { ErrorDisplay } from '../components/ErrorDisplay';

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;

    // Validate file
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError({ message: 'File size must be under 100MB', retryable: false });
      return;
    }
    if (selectedFile.type !== 'application/pdf') {
      setError({ message: 'File must be a PDF', retryable: false });
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError({ message: 'Please select a file', retryable: false });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await uploadPDF(file, file.name, agentId || null);
      navigate(`/status/${result.jobId}`);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <h1>Upload PDF</h1>

      <form onSubmit={handleSubmit}>
        {/* Drag and Drop Area */}
        <div
          className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="file-info">
              <p>📄 {file.name}</p>
              <p className="file-size">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="remove-file"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p>Drag and drop your PDF here</p>
              <p>or</p>
              <label className="file-input-label">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                Choose File
              </label>
            </>
          )}
        </div>

        {/* Agent Selection */}
        <div className="form-group">
          <label>Lecture Agent (Optional)</label>
          <AgentSelector value={agentId} onChange={setAgentId} />
          <p className="help-text">
            Select an agent to customize the lecture style, or leave empty for default
          </p>
        </div>

        {/* Error Display */}
        <ErrorDisplay
          error={error}
          onRetry={() => handleSubmit({ preventDefault: () => {} })}
          onDismiss={() => setError(null)}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || loading}
          className="submit-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Uploading...
            </>
          ) : (
            'Upload and Process'
          )}
        </button>
      </form>
    </div>
  );
}
```

### StatusPage.jsx (Complete)

```jsx
// pages/StatusPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobStatus } from '../api/jobs';

export function StatusPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const data = await getJobStatus(jobId);
        setStatus(data);

        if (data.status === 'completed') {
          clearInterval(intervalId);
        } else if (data.status === 'failed') {
          clearInterval(intervalId);
          setError(data.error || 'Processing failed');
        }
      } catch (err) {
        setError(err.message);
        clearInterval(intervalId);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 5000);

    return () => clearInterval(intervalId);
  }, [jobId]);

  if (error) {
    return (
      <div className="status-page error">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/upload')}>
          Upload Another PDF
        </button>
      </div>
    );
  }

  if (!status) {
    return <div className="status-page loading">Loading...</div>;
  }

  const getStatusIcon = (stageStatus) => {
    switch (stageStatus) {
      case 'completed': return '✓';
      case 'in_progress': return '⟳';
      case 'failed': return '✗';
      default: return '○';
    }
  };

  const getProgressPercentage = () => {
    const completed = status.stages.filter(s => s.status === 'completed').length;
    return (completed / status.stages.length) * 100;
  };

  return (
    <div className="status-page">
      <h1>Processing Status</h1>
      
      <div className="job-info">
        <p><strong>File:</strong> {status.pdfFilename}</p>
        <p><strong>Job ID:</strong> {status.jobId}</p>
        <p><strong>Status:</strong> {status.status}</p>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${getProgressPercentage()}%` }}
        ></div>
      </div>

      <div className="stages">
        {status.stages.map((stage, index) => (
          <div key={index} className={`stage stage-${stage.status}`}>
            <span className="stage-icon">{getStatusIcon(stage.status)}</span>
            <div className="stage-info">
              <h3>{stage.stage.replace(/_/g, ' ')}</h3>
              <p className="stage-status">{stage.status}</p>
              {stage.startedAt && (
                <p className="stage-time">
                  Started: {new Date(stage.startedAt).toLocaleTimeString()}
                </p>
              )}
              {stage.completedAt && (
                <p className="stage-time">
                  Completed: {new Date(stage.completedAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {status.status === 'completed' && (
        <button
          className="view-lecture-button"
          onClick={() => navigate(`/player/${jobId}`)}
        >
          View Lecture
        </button>
      )}
    </div>
  );
}
```

### PlayerPage.jsx (Complete)

```jsx
// pages/PlayerPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPlaybackData } from '../api/playback';
import { ImmersiveReader } from '../components/ImmersiveReader';

export function PlayerPage() {
  const { jobId } = useParams();
  const [playbackData, setPlaybackData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPlaybackData() {
      try {
        const data = await getPlaybackData(jobId);
        setPlaybackData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPlaybackData();
  }, [jobId]);

  if (loading) {
    return <div className="player-page loading">Loading lecture...</div>;
  }

  if (error) {
    return (
      <div className="player-page error">
        <h1>Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="player-page">
      <ImmersiveReader playbackData={playbackData} />
    </div>
  );
}
```

---

## Testing Recommendations

### Unit Tests

```javascript
// __tests__/api/upload.test.js
import { uploadPDF } from '../api/upload';
import apiClient from '../api/client';

jest.mock('../api/client');

describe('uploadPDF', () => {
  it('should upload PDF successfully', async () => {
    const mockResponse = {
      data: {
        jobId: 'test-job-id',
        status: 'queued',
        message: 'Upload successful'
      }
    };

    apiClient.post.mockResolvedValue(mockResponse);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const result = await uploadPDF(file, 'test.pdf');

    expect(result.jobId).toBe('test-job-id');
    expect(apiClient.post).toHaveBeenCalledWith('/api/upload', expect.any(Object));
  });
});
```

### Integration Tests

```javascript
// __tests__/integration/upload-flow.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadPage } from '../pages/UploadPage';

describe('Upload Flow', () => {
  it('should complete full upload flow', async () => {
    render(<UploadPage />);

    // Select file
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/choose file/i);
    fireEvent.change(input, { target: { files: [file] } });

    // Submit
    const submitButton = screen.getByText(/upload and process/i);
    fireEvent.click(submitButton);

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });
  });
});
```

---

## Deployment

### Build Configuration

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "jest",
    "lint": "eslint src"
  }
}
```

### Environment Variables

```bash
# .env.development
REACT_APP_API_URL=http://localhost:3000

# .env.production
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_API_KEY=your-production-api-key
```

---

## Summary

This specification provides everything needed to build a complete frontend for the PDF Lecture Service:

1. **API Integration**: All endpoints with request/response examples
2. **Data Models**: TypeScript interfaces for type safety
3. **Components**: Complete implementations of key UI components
4. **State Management**: Recommended patterns and examples
5. **Error Handling**: Comprehensive error handling strategies
6. **Complete Examples**: Full page implementations
7. **Testing**: Unit and integration test examples

The frontend should provide a smooth user experience for uploading PDFs, managing agents, monitoring processing, and enjoying synchronized audio lectures.

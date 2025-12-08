# Frontend Developer Guide: PDF Lecture Service

## 🎯 Overview

This guide provides everything a frontend developer needs to build a complete user interface for the PDF Lecture Service. The service transforms scientific PDFs into audio lectures with synchronized playback.

**Your Mission:** Build a web application that allows users to:
1. Upload PDFs
2. Create and manage lecture agents (personalities)
3. Monitor processing status
4. Play lectures with synchronized PDF and script highlighting

---

## 🏗️ Architecture

### Backend (Already Deployed)
- **API Endpoint:** `https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev`
- **Authentication:** API key in `x-api-key` header
- **Processing Pipeline:** Upload → Vision Analysis → Script Generation → Audio Synthesis
- **Average Processing Time:** 30-60 seconds per PDF

### Frontend (Your Deliverable)
- **Framework:** Your choice (React, Vue, Svelte, vanilla JS, etc.)
- **Key Features:**
  - PDF upload with drag-and-drop
  - Agent management (CRUD)
  - Real-time status polling
  - Immersive reader with synchronized playback

---

## 📡 API Endpoints Reference

### Base Configuration

```typescript
const API_CONFIG = {
  baseUrl: 'https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev',
  apiKey: 'YOUR_API_KEY_HERE', // Get from deployment
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY_HERE'
  }
};
```


### 1. Upload PDF

**Endpoint:** `POST /api/upload`

**Request:**
```typescript
interface UploadRequest {
  file: string;      // Base64-encoded PDF
  filename: string;  // Original filename
  agentId?: string;  // Optional: pre-select agent
}

interface UploadResponse {
  jobId: string;
  status: 'queued';
  message: string;
}
```

**Example:**
```typescript
async function uploadPDF(file: File, agentId?: string): Promise<string> {
  const base64 = await fileToBase64(file);
  
  const response = await fetch(`${API_CONFIG.baseUrl}/api/upload`, {
    method: 'POST',
    headers: API_CONFIG.headers,
    body: JSON.stringify({
      file: base64,
      filename: file.name,
      agentId
    })
  });
  
  const data = await response.json();
  return data.jobId;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```


### 2. Check Job Status

**Endpoint:** `GET /api/status/:jobId`

**Response:**
```typescript
interface JobStatus {
  jobId: string;
  status: 'queued' | 'analyzing' | 'segmenting' | 'generating_script' | 'synthesizing_audio' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  pdfFilename: string;
  agentId?: string;
  error?: string;
  stages: StageStatus[];
}

interface StageStatus {
  stage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

**Example with Polling:**
```typescript
async function pollJobStatus(
  jobId: string, 
  onUpdate: (status: JobStatus) => void
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_CONFIG.baseUrl}/api/status/${jobId}`,
          { headers: API_CONFIG.headers }
        );
        
        const status: JobStatus = await response.json();
        onUpdate(status);
        
        if (status.status === 'completed') {
          clearInterval(interval);
          resolve(status);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          reject(new Error(status.error || 'Processing failed'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 3000); // Poll every 3 seconds
  });
}
```


### 3. Agent Management

**List Agents:** `GET /api/agents`

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  personality: {
    instructions: string;
    tone: 'humorous' | 'serious' | 'casual' | 'formal' | 'enthusiastic';
    examples?: string[];
  };
  voice: {
    voiceId: string;
    speed: number;    // 0.5 to 2.0
    pitch: number;    // -20 to 20
  };
  createdAt: string;
}

async function listAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_CONFIG.baseUrl}/api/agents`, {
    headers: API_CONFIG.headers
  });
  const data = await response.json();
  return data.agents;
}
```

**Create Agent:** `POST /api/agents`

```typescript
async function createAgent(agent: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent> {
  const response = await fetch(`${API_CONFIG.baseUrl}/api/agents`, {
    method: 'POST',
    headers: API_CONFIG.headers,
    body: JSON.stringify(agent)
  });
  return response.json();
}
```

**Delete Agent:** `DELETE /api/agents/:agentId`

```typescript
async function deleteAgent(agentId: string): Promise<void> {
  await fetch(`${API_CONFIG.baseUrl}/api/agents/${agentId}`, {
    method: 'DELETE',
    headers: API_CONFIG.headers
  });
}
```


### 4. Get Playback Data

**Endpoint:** `GET /api/playback/:jobId`

```typescript
interface PlaybackData {
  jobId: string;
  pdfUrl: string;      // S3 signed URL
  audioUrl: string;    // S3 signed URL
  script: LectureScript;
  wordTimings: WordTiming[];
}

interface LectureScript {
  segments: ScriptSegment[];
  totalEstimatedDuration: number;
}

interface ScriptSegment {
  segmentId: string;
  title: string;
  scriptBlocks: ScriptBlock[];
}

interface ScriptBlock {
  id: string;
  text: string;
  contentReference: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'citation';
    id: string;
    pageNumber: number;
  };
  estimatedDuration: number;
}

interface WordTiming {
  word: string;
  startTime: number;   // seconds
  endTime: number;     // seconds
  scriptBlockId: string;
}

async function getPlaybackData(jobId: string): Promise<PlaybackData> {
  const response = await fetch(
    `${API_CONFIG.baseUrl}/api/playback/${jobId}`,
    { headers: API_CONFIG.headers }
  );
  return response.json();
}
```

---


## 🎨 UI Components Guide

### Component 1: PDF Upload

**Features:**
- Drag-and-drop support
- File validation (PDF only, max 100MB)
- Progress indication
- Agent selection

**Example (React):**
```tsx
import React, { useState } from 'react';

interface UploadComponentProps {
  agents: Agent[];
  onUploadComplete: (jobId: string) => void;
}

export function PDFUpload({ agents, onUploadComplete }: UploadComponentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const validateAndSetFile = (file: File) => {
    setError('');
    
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) {
      setError('File must be under 100MB');
      return;
    }
    
    setFile(file);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError('');
    
    try {
      const jobId = await uploadPDF(file, selectedAgent || undefined);
      onUploadComplete(jobId);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container">
      <div 
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {file ? (
          <div className="file-info">
            <p>📄 {file.name}</p>
            <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <p>Drag and drop PDF here or click to browse</p>
        )}
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => e.target.files && validateAndSetFile(e.target.files[0])}
        />
      </div>

      <select 
        value={selectedAgent} 
        onChange={(e) => setSelectedAgent(e.target.value)}
      >
        <option value="">Select Agent (Optional)</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name} - {agent.description}
          </option>
        ))}
      </select>

      {error && <div className="error">{error}</div>}

      <button 
        onClick={handleUpload} 
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload PDF'}
      </button>
    </div>
  );
}
```


### Component 2: Status Monitor

**Features:**
- Real-time progress updates
- Stage-by-stage breakdown
- Error handling
- Estimated time remaining

**Example (React):**
```tsx
import React, { useEffect, useState } from 'react';

interface StatusMonitorProps {
  jobId: string;
  onComplete: () => void;
}

export function StatusMonitor({ jobId, onComplete }: StatusMonitorProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    pollJobStatus(jobId, (newStatus) => {
      setStatus(newStatus);
    })
      .then(() => onComplete())
      .catch((err) => setError(err.message));
  }, [jobId]);

  if (error) {
    return <div className="error">❌ {error}</div>;
  }

  if (!status) {
    return <div>Loading...</div>;
  }

  const getStageIcon = (stage: StageStatus) => {
    if (stage.status === 'completed') return '✅';
    if (stage.status === 'in_progress') return '⏳';
    if (stage.status === 'failed') return '❌';
    return '⏸️';
  };

  return (
    <div className="status-monitor">
      <h2>Processing: {status.pdfFilename}</h2>
      <div className="overall-status">
        Status: <strong>{status.status}</strong>
      </div>

      <div className="stages">
        {status.stages.map((stage) => (
          <div key={stage.stage} className={`stage stage-${stage.status}`}>
            <span className="icon">{getStageIcon(stage)}</span>
            <span className="name">{stage.stage}</span>
            {stage.completedAt && (
              <span className="time">
                {new Date(stage.completedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        ))}
      </div>

      {status.status === 'completed' && (
        <button onClick={onComplete}>
          View Lecture
        </button>
      )}
    </div>
  );
}
```


### Component 3: Agent Manager

**Features:**
- List all agents
- Create new agents
- Delete agents
- Preview agent personalities

**Example (React):**
```tsx
import React, { useState, useEffect } from 'react';

export function AgentManager() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const agentList = await listAgents();
    setAgents(agentList);
  };

  const handleDelete = async (agentId: string) => {
    if (confirm('Delete this agent?')) {
      await deleteAgent(agentId);
      loadAgents();
    }
  };

  return (
    <div className="agent-manager">
      <div className="header">
        <h2>Lecture Agents</h2>
        <button onClick={() => setShowCreateForm(true)}>
          + Create Agent
        </button>
      </div>

      <div className="agent-list">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <h3>{agent.name}</h3>
            <p className="description">{agent.description}</p>
            <div className="personality">
              <span className="tone-badge">{agent.personality.tone}</span>
              <span className="voice-info">
                Speed: {agent.voice.speed}x | Pitch: {agent.voice.pitch}
              </span>
            </div>
            <button 
              className="delete-btn"
              onClick={() => handleDelete(agent.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {showCreateForm && (
        <AgentCreateForm 
          onClose={() => setShowCreateForm(false)}
          onCreated={loadAgents}
        />
      )}
    </div>
  );
}

function AgentCreateForm({ onClose, onCreated }: any) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tone: 'casual' as Agent['personality']['tone'],
    instructions: '',
    voiceId: 'en-US-Neural2-A',
    speed: 1.0,
    pitch: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createAgent({
      name: formData.name,
      description: formData.description,
      personality: {
        instructions: formData.instructions,
        tone: formData.tone
      },
      voice: {
        voiceId: formData.voiceId,
        speed: formData.speed,
        pitch: formData.pitch
      }
    });
    
    onCreated();
    onClose();
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h3>Create New Agent</h3>
        
        <input
          placeholder="Agent Name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
        
        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          required
        />
        
        <select
          value={formData.tone}
          onChange={(e) => setFormData({...formData, tone: e.target.value as any})}
        >
          <option value="humorous">Humorous</option>
          <option value="serious">Serious</option>
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="enthusiastic">Enthusiastic</option>
        </select>
        
        <textarea
          placeholder="Personality Instructions"
          value={formData.instructions}
          onChange={(e) => setFormData({...formData, instructions: e.target.value})}
          required
        />
        
        <div className="voice-controls">
          <label>
            Speed: {formData.speed}x
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={formData.speed}
              onChange={(e) => setFormData({...formData, speed: parseFloat(e.target.value)})}
            />
          </label>
          
          <label>
            Pitch: {formData.pitch}
            <input
              type="range"
              min="-20"
              max="20"
              step="1"
              value={formData.pitch}
              onChange={(e) => setFormData({...formData, pitch: parseInt(e.target.value)})}
            />
          </label>
        </div>
        
        <div className="buttons">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Create Agent</button>
        </div>
      </form>
    </div>
  );
}
```

---


## 🎬 Immersive Reader Player

The immersive reader is the core playback experience. It synchronizes three elements:
1. **PDF Viewer** - Shows the original document
2. **Script Viewer** - Displays lecture script with word-level highlighting
3. **Audio Player** - Plays synthesized audio

### Architecture

The player uses **PDF.js** for PDF rendering and HTML5 Canvas for drawing. Word-level synchronization is achieved through:
- Binary search on word timing array
- Real-time highlighting updates (every 250ms)
- Auto-scrolling to keep highlighted words visible
- Page navigation based on current script block

### Reference Implementation

A complete vanilla JavaScript implementation exists in `public/player.html` and `public/player.js`. Key features:

**PDF Rendering:**
```javascript
// Uses PDF.js library
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const loadingTask = pdfjsLib.getDocument(pdfUrl);
const pdfDoc = await loadingTask.promise;

// Render page to canvas
const page = await pdfDoc.getPage(pageNumber);
const viewport = page.getViewport({ scale: 1.5 });
canvas.width = viewport.width;
canvas.height = viewport.height;

const context = canvas.getContext('2d');
await page.render({ canvasContext: context, viewport }).promise;
```

**Word Highlighting:**
```javascript
// Binary search for current word
function findCurrentWord(currentTime, wordTimings) {
  let left = 0;
  let right = wordTimings.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const timing = wordTimings[mid];

    if (currentTime >= timing.startTime && currentTime <= timing.endTime) {
      return timing;
    } else if (currentTime < timing.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return wordTimings[left - 1] || wordTimings[0];
}

// Update highlighting on audio timeupdate
audioPlayer.addEventListener('timeupdate', () => {
  const currentTime = audioPlayer.currentTime;
  const currentWord = findCurrentWord(currentTime, wordTimings);
  
  // Remove previous highlight
  if (previousWordElement) {
    previousWordElement.classList.remove('highlighted');
  }
  
  // Add new highlight
  const wordElement = findWordElement(currentWord);
  if (wordElement) {
    wordElement.classList.add('highlighted');
    wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
```


### Component 4: Immersive Reader (React Example)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface ImmersiveReaderProps {
  jobId: string;
}

export function ImmersiveReader({ jobId }: ImmersiveReaderProps) {
  const [playbackData, setPlaybackData] = useState<PlaybackData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Load playback data
  useEffect(() => {
    getPlaybackData(jobId).then(setPlaybackData);
  }, [jobId]);

  // Initialize PDF.js
  useEffect(() => {
    if (!playbackData) return;

    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    pdfjsLib.getDocument(playbackData.pdfUrl).promise.then(pdf => {
      pdfDocRef.current = pdf;
      renderPage(1);
    });
  }, [playbackData]);

  // Render PDF page
  const renderPage = async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    const page = await pdfDocRef.current.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    setCurrentPage(pageNum);
  };

  // Handle audio time updates
  const handleTimeUpdate = () => {
    if (!audioRef.current || !playbackData) return;
    
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // Find current word
    const currentWord = findCurrentWord(time, playbackData.wordTimings);
    if (currentWord) {
      highlightWord(currentWord);
      
      // Update page if needed
      const block = findScriptBlock(currentWord.scriptBlockId, playbackData.script);
      if (block && block.contentReference.pageNumber !== currentPage) {
        renderPage(block.contentReference.pageNumber);
      }
    }
  };

  const highlightWord = (wordTiming: WordTiming) => {
    // Remove all highlights
    document.querySelectorAll('.script-word.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // Add highlight to current word
    const wordElement = document.querySelector(
      `[data-block-id="${wordTiming.scriptBlockId}"][data-word="${wordTiming.word}"]`
    );
    
    if (wordElement) {
      wordElement.classList.add('highlighted');
      wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!playbackData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="immersive-reader">
      {/* PDF Viewer */}
      <div className="pdf-pane">
        <div className="pdf-controls">
          <button onClick={() => renderPage(currentPage - 1)} disabled={currentPage === 1}>
            ← Previous
          </button>
          <span>{currentPage} / {pdfDocRef.current?.numPages || 1}</span>
          <button 
            onClick={() => renderPage(currentPage + 1)} 
            disabled={currentPage === pdfDocRef.current?.numPages}
          >
            Next →
          </button>
        </div>
        <canvas ref={canvasRef} />
      </div>

      {/* Script Viewer */}
      <div className="script-pane" ref={scriptRef}>
        {playbackData.script.segments.map(segment => (
          <div key={segment.segmentId} className="segment">
            <h3>{segment.title}</h3>
            {segment.scriptBlocks.map(block => (
              <div key={block.id} className="script-block" data-block-id={block.id}>
                {block.text.split(/\s+/).map((word, idx) => (
                  <span 
                    key={idx}
                    className="script-word"
                    data-block-id={block.id}
                    data-word={word}
                  >
                    {word}{' '}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Audio Player */}
      <div className="audio-controls">
        <button onClick={togglePlayPause}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <input
          type="range"
          min="0"
          max={audioRef.current?.duration || 0}
          value={currentTime}
          onChange={(e) => {
            if (audioRef.current) {
              audioRef.current.currentTime = parseFloat(e.target.value);
            }
          }}
        />
        <span>{formatTime(currentTime)} / {formatTime(audioRef.current?.duration || 0)}</span>
        
        <audio
          ref={audioRef}
          src={playbackData.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
}

// Helper functions
function findCurrentWord(time: number, timings: WordTiming[]): WordTiming | null {
  let left = 0;
  let right = timings.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const timing = timings[mid];

    if (time >= timing.startTime && time <= timing.endTime) {
      return timing;
    } else if (time < timing.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return timings[left - 1] || timings[0];
}

function findScriptBlock(blockId: string, script: LectureScript): ScriptBlock | null {
  for (const segment of script.segments) {
    const block = segment.scriptBlocks.find(b => b.id === blockId);
    if (block) return block;
  }
  return null;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

---


## 🎨 Styling Guide

### Recommended Layout

```
┌─────────────────────────────────────────────────┐
│  Header: PDF Lecture Service                    │
├──────────────────┬──────────────────────────────┤
│                  │                              │
│   PDF Viewer     │    Script Viewer             │
│   (Canvas)       │    (Scrollable Text)         │
│                  │                              │
│   [← Page →]     │    [Highlighted Words]       │
│                  │                              │
├──────────────────┴──────────────────────────────┤
│  Audio Controls: [▶] ━━━━━━━━━━━ 2:45 / 7:30   │
└─────────────────────────────────────────────────┘
```

### CSS Example

```css
.immersive-reader {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}

.pdf-pane {
  border-right: 1px solid #ddd;
  overflow: auto;
  padding: 20px;
}

.script-pane {
  overflow-y: auto;
  padding: 20px;
  font-family: 'Georgia', serif;
  line-height: 1.8;
}

.script-word {
  transition: background-color 0.2s;
}

.script-word.highlighted {
  background-color: #ffeb3b;
  font-weight: bold;
  padding: 2px 4px;
  border-radius: 3px;
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
}

.audio-controls input[type="range"] {
  flex: 1;
}

/* Upload Component */
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-zone:hover {
  border-color: #2196F3;
  background: #f0f8ff;
}

.drop-zone.dragging {
  border-color: #4CAF50;
  background: #e8f5e9;
}

/* Status Monitor */
.stage {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
}

.stage-completed {
  background: #e8f5e9;
}

.stage-in_progress {
  background: #fff3e0;
  animation: pulse 2s infinite;
}

.stage-failed {
  background: #ffebee;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Agent Cards */
.agent-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin: 10px 0;
  transition: box-shadow 0.3s;
}

.agent-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.tone-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: #e3f2fd;
  color: #1976d2;
  font-size: 0.85em;
  font-weight: 500;
}
```

---


## 🚀 Complete Application Flow

### User Journey

```
1. Landing Page
   ↓
2. Upload PDF + Select Agent (optional)
   ↓
3. Status Monitor (polling every 3s)
   ↓ (30-60 seconds)
4. Immersive Reader (playback)
```

### State Management Example (React Context)

```tsx
import React, { createContext, useContext, useState } from 'react';

interface AppState {
  currentJobId: string | null;
  agents: Agent[];
  jobs: Map<string, JobStatus>;
}

interface AppContextType {
  state: AppState;
  uploadPDF: (file: File, agentId?: string) => Promise<string>;
  loadAgents: () => Promise<void>;
  getJobStatus: (jobId: string) => JobStatus | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    currentJobId: null,
    agents: [],
    jobs: new Map()
  });

  const uploadPDF = async (file: File, agentId?: string) => {
    const jobId = await uploadPDFAPI(file, agentId);
    setState(prev => ({ ...prev, currentJobId: jobId }));
    
    // Start polling
    pollJobStatus(jobId, (status) => {
      setState(prev => ({
        ...prev,
        jobs: new Map(prev.jobs).set(jobId, status)
      }));
    });
    
    return jobId;
  };

  const loadAgents = async () => {
    const agents = await listAgents();
    setState(prev => ({ ...prev, agents }));
  };

  const getJobStatus = (jobId: string) => {
    return state.jobs.get(jobId);
  };

  return (
    <AppContext.Provider value={{ state, uploadPDF, loadAgents, getJobStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
```

### Main App Component

```tsx
import React, { useEffect, useState } from 'react';

type View = 'upload' | 'status' | 'player';

export function App() {
  const { state, uploadPDF, loadAgents } = useApp();
  const [view, setView] = useState<View>('upload');

  useEffect(() => {
    loadAgents();
  }, []);

  const handleUploadComplete = (jobId: string) => {
    setView('status');
  };

  const handleProcessingComplete = () => {
    setView('player');
  };

  return (
    <div className="app">
      <header>
        <h1>📚 PDF Lecture Service</h1>
        <nav>
          <button onClick={() => setView('upload')}>Upload</button>
          <button onClick={() => setView('status')} disabled={!state.currentJobId}>
            Status
          </button>
        </nav>
      </header>

      <main>
        {view === 'upload' && (
          <PDFUpload 
            agents={state.agents}
            onUploadComplete={handleUploadComplete}
          />
        )}

        {view === 'status' && state.currentJobId && (
          <StatusMonitor
            jobId={state.currentJobId}
            onComplete={handleProcessingComplete}
          />
        )}

        {view === 'player' && state.currentJobId && (
          <ImmersiveReader jobId={state.currentJobId} />
        )}
      </main>
    </div>
  );
}
```

---


## 🔧 Development Setup

### Prerequisites

```bash
# Install dependencies
npm install pdfjs-dist
# or
yarn add pdfjs-dist

# For TypeScript
npm install --save-dev @types/pdfjs-dist
```

### Environment Configuration

Create `.env.local`:

```bash
VITE_API_BASE_URL=https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev
VITE_API_KEY=your-api-key-here
```

### API Client Setup

```typescript
// src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

export const apiClient = {
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
  },
  
  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options?.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }
};
```

### Testing Locally

```bash
# Start development server
npm run dev

# Test with sample PDF
curl -X POST http://localhost:5173/api/upload \
  -H "Content-Type: application/json" \
  -d @test-upload.json
```

---

## 📋 Checklist for Frontend Developer

### Phase 1: Basic Setup
- [ ] Set up project with your preferred framework
- [ ] Configure API client with base URL and API key
- [ ] Create TypeScript interfaces for all API responses
- [ ] Test API connectivity with health check endpoint

### Phase 2: Core Features
- [ ] Implement PDF upload component with drag-and-drop
- [ ] Implement file validation (PDF only, max 100MB)
- [ ] Implement status polling with real-time updates
- [ ] Create agent management UI (list, create, delete)
- [ ] Add error handling and user feedback

### Phase 3: Immersive Reader
- [ ] Integrate PDF.js for PDF rendering
- [ ] Implement canvas-based PDF viewer with page navigation
- [ ] Create script viewer with word-level highlighting
- [ ] Implement audio player with seek controls
- [ ] Add synchronization logic (binary search on word timings)
- [ ] Implement auto-scrolling for highlighted words
- [ ] Add page auto-navigation based on current script block

### Phase 4: Polish
- [ ] Add loading states and spinners
- [ ] Implement responsive design for mobile
- [ ] Add keyboard shortcuts (space = play/pause, arrows = seek)
- [ ] Optimize performance (lazy loading, memoization)
- [ ] Add analytics tracking
- [ ] Write user documentation

### Phase 5: Testing
- [ ] Test with various PDF sizes and types
- [ ] Test with different agent personalities
- [ ] Test synchronization accuracy
- [ ] Test error scenarios (network failures, invalid files)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

---


## 🐛 Common Issues & Solutions

### Issue 1: CORS Errors

**Problem:** Browser blocks API requests due to CORS policy.

**Solution:** The API Gateway is configured with CORS enabled. If you still see errors:
```typescript
// Ensure headers are correct
headers: {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  // Don't add 'Origin' header manually
}
```

### Issue 2: PDF.js Worker Not Loading

**Problem:** PDF.js worker script fails to load.

**Solution:**
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Or use local worker (copy from node_modules)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

### Issue 3: Word Highlighting Out of Sync

**Problem:** Highlighted words don't match audio.

**Solution:** Ensure you're using binary search and checking timing windows:
```typescript
// Check if time is within word's timing window
if (currentTime >= timing.startTime && currentTime <= timing.endTime) {
  return timing;
}
```

### Issue 4: Large PDF Files Timeout

**Problem:** Upload fails for large PDFs.

**Solution:** 
- Validate file size before upload (max 100MB)
- Show progress indicator during upload
- Consider chunked upload for very large files (future enhancement)

### Issue 5: Audio Doesn't Play on Mobile

**Problem:** Audio requires user interaction on mobile browsers.

**Solution:**
```typescript
// Add user interaction before playing
<button onClick={() => {
  audioRef.current?.play();
  setIsPlaying(true);
}}>
  Start Lecture
</button>
```

---

## 📚 Additional Resources

### PDF.js Documentation
- Official Docs: https://mozilla.github.io/pdf.js/
- Examples: https://mozilla.github.io/pdf.js/examples/

### Audio Synchronization
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- HTMLMediaElement: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement

### AWS S3 Signed URLs
- Understanding signed URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
- CORS configuration: https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html

### Reference Implementation
- See `public/player.html` and `public/player.js` for complete vanilla JS implementation
- See `docs/API.md` for detailed API documentation

---

## 🎯 Success Criteria

Your frontend is complete when:

1. ✅ Users can upload PDFs and see real-time processing status
2. ✅ Users can create and manage lecture agents with different personalities
3. ✅ The immersive reader displays PDF, script, and audio in sync
4. ✅ Word-level highlighting updates smoothly during playback
5. ✅ PDF pages auto-navigate based on current script position
6. ✅ All error states are handled gracefully with user feedback
7. ✅ The UI is responsive and works on desktop and tablet
8. ✅ Performance is smooth even with long lectures (10+ minutes)

---

## 🤝 Getting Help

If you encounter issues:

1. Check the API documentation in `docs/API.md`
2. Review the reference implementation in `public/`
3. Test API endpoints directly with curl or Postman
4. Check browser console for errors
5. Verify API key is correct and has proper permissions

**API Endpoint:** `https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev`

**Note:** You'll need to obtain an API key from the deployment team before you can make requests.

---

## 🚢 Deployment

When your frontend is ready:

1. Build for production: `npm run build`
2. Deploy static files to:
   - AWS S3 + CloudFront
   - Vercel
   - Netlify
   - Any static hosting service

3. Configure environment variables:
   - `VITE_API_BASE_URL` = production API endpoint
   - `VITE_API_KEY` = production API key

4. Test thoroughly in production environment

---

**Good luck building! 🚀**

The backend is ready and waiting for your beautiful frontend to bring it to life.

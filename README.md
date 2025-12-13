# PDF Lecture Service

Transform dense scientific PDFs into engaging audio lectures with synchronized playback.

## Overview

The PDF Lecture Service is a serverless application that analyzes scientific PDFs using computer vision and LLM technology, segments content into logical topics, generates personality-driven lecture scripts, and synthesizes audio with synchronized highlighting.

## Features

- **Multi-modal Content Analysis**: Extracts and interprets text, figures, tables, formulas, and citations using vision-first approach
- **Intelligent Segmentation**: Organizes content into logical topic flows with prerequisite ordering
- **Customizable Agents**: Multiple lecture personalities with different tones and voice characteristics
- **Audio Synthesis**: High-quality text-to-speech with word-level timing
- **Immersive Reader**: Synchronized PDF and script highlighting during playback
- **LLM Integration**: Fully integrated with OpenRouter, OpenAI, and Anthropic for vision and text analysis

## Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose (for local development)
- AWS account (for production deployment)

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pdf-lecture-service

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

### Local Development

```bash
# Start LocalStack (AWS services emulation)
docker-compose up -d

# Start the development server
npm run dev
```

The server will be available at `http://localhost:3000`.

### Your First Lecture

```bash
# 1. Upload a PDF
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "base64-encoded-pdf-content",
    "filename": "paper.pdf"
  }'

# 2. Check status (save the jobId from step 1)
curl http://localhost:3000/api/status/{jobId}

# 3. When status is "completed", access the player
open http://localhost:3000/api/player/{jobId}
```

For detailed instructions, see the [User Guide](docs/USER_GUIDE.md).

### Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Building

Build the TypeScript project:
```bash
npm run build
```

Bundle Lambda functions:
```bash
npm run bundle
```

## Project Structure

```
src/
├── functions/       # Serverless function handlers
├── models/          # Data models and interfaces
├── services/        # Business logic services
├── utils/           # Utility functions and helpers
├── tests/           # Test utilities and helpers
└── local-server/    # Express.js local development server
```

## Architecture

The system uses a multi-stage pipeline architecture:

1. **PDF Upload** - Validates and stores PDF files
2. **Content Analysis** - Extracts all PDF elements using computer vision and LLM
3. **Content Segmentation** - Organizes content into logical flows
4. **Script Generation** - Creates personality-driven lecture scripts
5. **Audio Synthesis** - Generates MP3 audio with word-level timing

Each stage is implemented as an independent serverless function for scalability.

## Documentation

- **[Implementation Status](docs/IMPLEMENTATION_STATUS.md)** - Complete status of all features (95% complete)
- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for using the service
- **[API Documentation](docs/API.md)** - Detailed API reference with examples
- **[Deployment Guide](DEPLOYMENT.md)** - Local setup and production deployment
- **[Legacy Documentation](docs/Legacy/)** - Historical implementation notes and migration guides

## System Status

✅ **Fully Implemented**: All core components are complete and functional:

### ✅ Vision-First Content Analysis

**Status**: Complete  
**Features**: Extracts pages as images and analyzes with vision LLM  
**File**: `src/services/analyzer-vision.ts`

### ✅ Real LLM Integration for Segmentation

**Status**: Complete  
**Features**: Dynamic content-based segmentation using real LLM API calls  
**File**: `src/services/script-generator.ts`

### ✅ Personality-Driven Script Generation

**Status**: Complete  
**Features**: Agent personality integration with tone-specific prompts  
**File**: `src/services/script-generator.ts`

---

**Implementation Details**: See [docs/Deployment/MISSING_IMPLEMENTATIONS.md](docs/Deployment/MISSING_IMPLEMENTATIONS.md) for complete implementation history and technical details.

**Current State**: Infrastructure 100% ✅ | Core Pipeline 100% ✅

## Quick Links

- [Upload a PDF](#uploading-pdfs) - Get started with your first lecture
- [Create Agents](docs/USER_GUIDE.md#managing-lecture-agents) - Customize presenter personalities
- [Immersive Reader](docs/USER_GUIDE.md#using-the-immersive-reader) - Synchronized playback experience
- [API Reference](docs/API.md) - Complete endpoint documentation

## Testing Strategy

The project uses a dual testing approach:

- **Unit Tests**: Verify specific examples and edge cases using Jest
- **Property-Based Tests**: Verify universal properties across all inputs using fast-check

All correctness properties from the design document are implemented as property-based tests.

## License

MIT

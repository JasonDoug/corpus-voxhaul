# PDF Lecture Service

Transform dense scientific PDFs into engaging audio lectures with synchronized playback.

## Overview

The PDF Lecture Service is a serverless application that analyzes scientific PDFs using computer vision and LLM technology, segments content into logical topics, generates personality-driven lecture scripts, and synthesizes audio with synchronized highlighting.

## Features

- **Multi-modal Content Analysis**: Extracts and interprets text, figures, tables, formulas, and citations
- **Intelligent Segmentation**: Organizes content into logical topic flows with prerequisite ordering
- **Customizable Agents**: Multiple lecture personalities with different tones and voice characteristics
- **Audio Synthesis**: High-quality text-to-speech with word-level timing
- **Immersive Reader**: Synchronized PDF and script highlighting during playback

## Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose (for local development)
- AWS account (for production deployment)

## Getting Started

### Installation

```bash
# Install dependencies
npm install
```

### Local Development Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Start LocalStack (S3 and DynamoDB emulation):
```bash
docker-compose up -d
```

3. Start the development server:
```bash
npm run dev
```

The server will be available at `http://localhost:3000`.

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

## API Endpoints

### Local Development

- `GET /health` - Health check
- `POST /api/upload` - Upload PDF
- `GET /api/status/:jobId` - Query job status
- `GET /api/agents` - List lecture agents
- `POST /api/agents` - Create lecture agent
- `GET /api/player/:jobId` - Playback interface

Additional endpoints will be added as features are implemented.

## Testing Strategy

The project uses a dual testing approach:

- **Unit Tests**: Verify specific examples and edge cases using Jest
- **Property-Based Tests**: Verify universal properties across all inputs using fast-check

All correctness properties from the design document are implemented as property-based tests.

## License

MIT

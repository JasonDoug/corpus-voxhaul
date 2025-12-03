jus# Requirements Document

## Introduction

**Context**: This spec is part of the larger **PDF Lecture Service** project (see `.kiro/specs/pdf-lecture-service/`). The main system is 95% complete with all infrastructure in place. This spec addresses the remaining 5% - completing three critical LLM integrations.

The PDF Lecture Service currently has three components using placeholder implementations instead of real API integrations. This spec addresses completing the LLM integration for content segmentation, script generation, and image extraction to enable the system to process actual PDF content and generate meaningful, personalized lectures.

**Parent Project**: `.kiro/specs/pdf-lecture-service/`  
**Scope**: Complete LLM integration for 3 specific components  
**Dependencies**: All infrastructure (LLM service, database, storage) already exists and is functional

## Glossary

- **Content Segmenter**: The LLM-powered component that analyzes extracted PDF content and organizes it into logical topic segments
- **Script Generator**: The LLM-powered component that creates lecture scripts based on segmented content and agent personality
- **Image Extractor**: The component that extracts actual images from PDF files for vision LLM analysis
- **LLM Service**: The existing unified interface for OpenRouter, OpenAI, and Anthropic APIs
- **Vision LLM**: Large language models with image understanding capabilities (GPT-4 Vision, Claude Vision)
- **Placeholder Implementation**: Mock/stub code that returns hardcoded data instead of processing real inputs

## Requirements

### Requirement 1

**User Story:** As a developer, I want the content segmenter to use real LLM API calls, so that different PDFs produce different, content-appropriate topic structures.

#### Acceptance Criteria

1. WHEN the Content Segmenter processes extracted content THEN the system SHALL call the LLM Service with a properly constructed prompt
2. WHEN the LLM returns segmentation data THEN the system SHALL parse the JSON response and validate its structure
3. WHEN processing different PDFs THEN the Content Segmenter SHALL produce different segment structures based on actual content
4. WHEN the LLM API call fails THEN the system SHALL retry with exponential backoff and log detailed error information
5. THE Content Segmenter SHALL use the recommended model for segmentation tasks from the LLM Service

### Requirement 2

**User Story:** As a developer, I want the script generator to use real LLM API calls with agent personality, so that scripts reflect actual PDF content and chosen presentation style.

#### Acceptance Criteria

1. WHEN the Script Generator processes a segment THEN the system SHALL call the LLM Service with the agent's personality instructions
2. WHEN generating scripts for different agents THEN the system SHALL produce different script styles reflecting each agent's tone and personality
3. WHEN generating scripts for different content THEN the system SHALL reference actual figures, tables, and formulas from the PDF
4. WHEN the agent personality is humorous THEN the generated script SHALL include jokes, analogies, or lighthearted commentary
5. WHEN the agent personality is serious THEN the generated script SHALL maintain formal academic language
6. WHEN the LLM API call fails THEN the system SHALL retry with exponential backoff and log detailed error information
7. THE Script Generator SHALL use the recommended model for script generation tasks from the LLM Service

### Requirement 3

**User Story:** As a developer, I want to extract actual images from PDFs, so that the vision LLM can analyze real figures and generate meaningful descriptions.

#### Acceptance Criteria

1. WHEN a figure is detected in a PDF THEN the system SHALL extract the actual image data from the PDF buffer
2. WHEN an image is extracted THEN the system SHALL convert it to a format suitable for vision LLM APIs (base64 or URL)
3. WHEN an image is larger than 2000x2000 pixels THEN the system SHALL resize it to optimize API costs while maintaining quality
4. WHEN sending images to the vision LLM THEN the system SHALL use actual image data instead of placeholder strings
5. WHEN image extraction fails for a specific figure THEN the system SHALL log the error and continue processing other figures
6. THE system SHALL support extracting multiple images from a single PDF page

### Requirement 4

**User Story:** As a developer, I want comprehensive error handling for all LLM integrations, so that the system degrades gracefully when APIs fail.

#### Acceptance Criteria

1. WHEN an LLM API call fails THEN the system SHALL retry up to 3 times with exponential backoff
2. WHEN all retry attempts fail THEN the system SHALL log detailed error information including request parameters
3. WHEN the LLM returns invalid JSON THEN the system SHALL catch the parsing error and provide a meaningful error message
4. WHEN the LLM response doesn't match expected structure THEN the system SHALL validate and reject invalid responses
5. THE system SHALL track LLM API call success rates and response times for monitoring

### Requirement 5

**User Story:** As a developer, I want to verify that LLM integrations work correctly, so that I can ensure the system produces quality output.

#### Acceptance Criteria

1. WHEN testing segmentation THEN the system SHALL produce different segments for PDFs with different content
2. WHEN testing script generation THEN the system SHALL produce different scripts for different agent personalities
3. WHEN testing image extraction THEN the system SHALL extract actual image data that can be analyzed by vision LLMs
4. THE system SHALL include integration tests that verify end-to-end processing with real LLM APIs
5. THE system SHALL include unit tests that verify prompt construction and response parsing logic

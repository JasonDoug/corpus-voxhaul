# LLM Integration Completion Spec

## Overview

This is a **subset spec** of the larger **PDF Lecture Service** project.

**Parent Project**: `.kiro/specs/pdf-lecture-service/`  
**Parent Status**: 95% complete - all infrastructure functional  
**This Spec**: Addresses the remaining 5% - three specific LLM integrations

## Context

The PDF Lecture Service is a fully-functional serverless application with:
- ✅ Complete infrastructure (AWS Lambda, DynamoDB, S3, API Gateway)
- ✅ LLM service supporting OpenRouter, OpenAI, and Anthropic
- ✅ Vision LLM integration (functional, just needs real images)
- ✅ Agent management system
- ✅ Audio synthesis with TTS
- ✅ Immersive reader playback interface
- ✅ Comprehensive test suite (17 tests passing)
- ✅ Full deployment configuration

However, **3 critical components use placeholder implementations**:

1. ❌ **Content Segmentation** - Returns mock segments instead of analyzing content
2. ❌ **Script Generation** - Returns mock scripts instead of generating personalized content
3. ❌ **Image Extraction** - Uses placeholder images instead of extracting from PDFs

## What This Spec Does

This spec provides requirements, design, and tasks to:

1. **Wire up segmentation** to use the existing LLM service
2. **Wire up script generation** to use the existing LLM service with agent personality
3. **Implement image extraction** using pdf-img-convert or pdf.js

**Estimated Effort**: 16-28 hours

## Relationship to Parent Project

### Shared Infrastructure

This spec **uses** (does not create):
- LLM service (`src/services/llm.ts`)
- Database utilities (`src/services/dynamodb.ts`)
- Storage utilities (`src/services/s3.ts`)
- Retry logic (`src/utils/retry.ts`)
- Logger (`src/utils/logger.ts`)
- Test framework (Jest + fast-check)
- Deployment configuration (AWS SAM)

### Modified Files

This spec **modifies** these existing files:
- `src/services/segmenter.ts` - Replace mock LLM call
- `src/services/script-generator.ts` - Replace mock LLM call
- `src/services/analyzer.ts` - Replace placeholder images

### Documentation Updates

This spec **updates** (does not create new):
- `docs/IMPLEMENTATION_STATUS.md` - Mark components complete
- `docs/MISSING_IMPLEMENTATIONS.md` - Mark gaps resolved
- `docs/API.md` - Document new behavior
- `README.md` - Update status

### Testing Approach

This spec **adds** tests for new integrations:
- ~6 new unit tests for segmentation
- ~6 new unit tests for script generation
- ~6 new unit tests for image extraction
- ~3 new integration tests

**Does not modify** existing 17 passing tests unless necessary.

### Deployment Approach

This spec **uses** existing deployment infrastructure:
- Existing AWS SAM configuration
- Existing LocalStack setup
- Existing CI/CD pipeline
- Existing CloudWatch monitoring

**Only adds**:
- Feature flags for gradual rollout
- LLM-specific metrics

## Files in This Spec

- `requirements.md` - 5 requirements for the 3 integrations
- `design.md` - Technical design with code examples
- `tasks.md` - 35 actionable implementation tasks
- `README.md` - This file

## How to Use This Spec

1. **Read parent spec first**: `.kiro/specs/pdf-lecture-service/`
2. **Understand existing system**: Review `docs/MISSING_IMPLEMENTATIONS.md`
3. **Review this spec**: Read requirements → design → tasks
4. **Implement tasks**: Follow tasks.md in order
5. **Update parent docs**: Mark components complete in parent project docs

## Success Criteria

After completing this spec:
- ✅ Different PDFs produce different segmentation structures
- ✅ Different agents produce different script styles
- ✅ Vision LLM receives real images and produces meaningful descriptions
- ✅ All tests pass (existing + new)
- ✅ Parent project is 100% complete
- ✅ System is production-ready

## Questions?

- For infrastructure questions: See parent spec `.kiro/specs/pdf-lecture-service/`
- For LLM integration questions: See this spec's `design.md`
- For implementation questions: See this spec's `tasks.md`

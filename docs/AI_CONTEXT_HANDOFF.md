# AI Developer Context Handoff

**Last Updated**: December 13, 2024  
**Project**: Corpus-Vox (PDF Lecture Service)  
**Current Branch**: `streamline-functions` (main development branch)  
**Status**: ✅ Fully functional, 100% implementation complete

---

## Quick Start for New AI Sessions

### What This Project Does
Transforms scientific PDFs into engaging audio lectures with synchronized playback. Uses vision LLMs to analyze PDF pages, generates personality-driven scripts, and synthesizes audio with word-level timing.

### Current Architecture (IMPORTANT - This Changed Recently!)
**Vision-First Pipeline** (current approach):
```
PDF → Python Lambda (convert to page images) → S3 storage → 
Vision LLM (analyze each page, extract segments) → 
Script Generator (with agent personality) → 
Audio Synthesis (Polly) → 
Playback with synchronized highlighting
```

**Key Point**: The system no longer uses text extraction + separate element detection. It's all vision-based now.

### Technology Stack
- **Language**: TypeScript (Node.js 20+)
- **Cloud**: AWS Lambda, S3, DynamoDB, EventBridge
- **LLM Provider**: OpenRouter (supports OpenAI, Anthropic, free models)
- **TTS**: AWS Polly (implemented), Mock TTS (for testing)
- **Testing**: Jest with property-based tests (fast-check)
- **Local Dev**: LocalStack for AWS emulation

---

## Recent Major Changes (Dec 2024)

### What Was Just Completed (Session: Dec 13, 2024)

1. **Fixed Failing Tests** ✅
   - File: `src/services/script-generator.unit.test.ts`
   - Issue: Test expectations didn't match new prompt structure
   - Fixed: Updated all assertions to match current implementation
   - Result: All 29 tests passing

2. **Cleaned Up Git State** ✅
   - Committed all working changes from `streamline-functions` branch
   - Created feature branch: `fix/update-tests-and-docs`
   - Pushed and opened PR #5 for review
   - Commits:
     - `feat: Update pipeline with vision-first analyzer and improved prompts`
     - `docs: Update documentation to reflect 100% implementation status`

3. **Updated Documentation** ✅
   - README.md: Removed outdated "Known Limitations", added accurate status
   - API_IMPLEMENTATION_STATUS.md: Changed from "NOT IMPLEMENTED" to "IMPLEMENTED"

### What Changed in the Pipeline (Earlier)

**Old Pipeline** (deprecated):
```
PDF → Text Extraction → Element Detection → Individual Vision Calls → Segmentation → Script → Audio
```

**New Pipeline** (current):
```
PDF → Page Images → Vision Analysis (per page, includes segmentation) → Script → Audio
```

**Key Files Changed**:
- `src/services/analyzer-vision.ts` - Vision-first analyzer (NEW approach)
- `src/services/script-generator.ts` - Improved prompts with personality-first design
- `src/functions/analyzer.ts` - Triggers vision-first analyzer
- `src/functions/pdf-to-images/app.py` - Python Lambda for PDF→image conversion

**Deprecated Files** (don't use these):
- `deprecated/analyzer.ts` - Old text-based analyzer
- Anything referencing "segmenter.ts" - Segmentation now happens in vision analysis

---

## Critical File Locations

### Core Pipeline Files
| File | Purpose | Status |
|------|---------|--------|
| `src/services/analyzer-vision.ts` | Vision-first page analysis | ✅ Production |
| `src/services/script-generator.ts` | LLM script generation with personality | ✅ Production |
| `src/services/audio-synthesizer.ts` | TTS with Polly/Mock | ✅ Production |
| `src/services/llm.ts` | LLM service abstraction (OpenRouter/OpenAI/Anthropic) | ✅ Production |
| `src/services/dynamodb.ts` | Database operations | ✅ Production (AWS SDK v2) |
| `src/services/s3.ts` | File storage operations | ✅ Production (AWS SDK v2) |

### Lambda Functions
| Function | Purpose | Runtime |
|----------|---------|---------|
| `src/functions/analyzer.ts` | Triggers vision analysis | Node.js 20 |
| `src/functions/script.ts` | Triggers script generation | Node.js 20 |
| `src/functions/audio.ts` | Triggers audio synthesis | Node.js 20 |
| `src/functions/pdf-to-images/app.py` | Converts PDF to page images | Python 3.12 |

### Test Files
| File | Purpose | Status |
|------|---------|--------|
| `src/services/script-generator.unit.test.ts` | Script generator tests | ✅ 29/29 passing |
| `src/services/analyzer-vision-robust.test.ts` | JSON parsing edge cases | ✅ Passing |
| `src/services/analyzer-vision-repro.test.ts` | Manual debug utility | ℹ️ For debugging |
| `src/services/polly-chunking.test.ts` | Polly chunking tests | ⚠️ Untracked (failing) |

---

## Known Issues & Technical Debt

### 1. AWS SDK v2 Deprecation (High Priority)
**Status**: Using deprecated AWS SDK v2  
**Impact**: Maintenance mode, no new features  
**Files Affected**: `dynamodb.ts`, `s3.ts`, `audio-synthesizer.ts`  
**Documentation**: `docs/Deployment/MIGRATION_GUIDE_SDK_V3_NODE_20.md`  
**Action Required**: Migrate to v3 on separate branch  
**Note**: Previous migration attempt was reverted - plan carefully!

### 2. Polly Chunking Test
**File**: `src/services/polly-chunking.test.ts`  
**Status**: Untracked, test expectations don't match implementation  
**Issue**: Test expects 1-2 Polly calls, implementation makes 4  
**Decision**: Fix after AWS SDK v3 migration (Polly code may change)

### 3. Untracked Files/Folders
- `.gemini/` - AI interaction history (don't commit)
- `src/services/polly-chunking.test.ts` - See issue #2 above

---

## Development Workflow

### Git Branch Strategy
- **main**: Production-ready code
- **streamline-functions**: Current development branch (base for PRs)
- **feature/fix branches**: Short-lived branches for specific work

### Git Workflow Pattern (User's Preference)
1. Create feature branch from `streamline-functions`
2. Make changes and commit with descriptive messages
3. Push branch and open PR to `streamline-functions`
4. CodeRabbit automatically reviews
5. User reviews and merges
6. Delete feature branch after merge

**Important**: User manages merges. Don't merge PRs automatically.

### Commit Message Convention
Follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test updates
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### Testing Strategy
- **Unit Tests**: Jest for specific examples and edge cases
- **Property Tests**: fast-check for universal properties
- **Integration Tests**: Real API calls (can be expensive)
- **Run tests**: `npm test`
- **Watch mode**: `npm run test:watch`

**Important**: Don't track test files that are exploratory/debugging only. Only commit tests that provide ongoing value.

---

## Configuration & Environment

### Feature Flags (`.env`)
```bash
# Pipeline Selection
ENABLE_VISION_FIRST_PIPELINE=true  # Use vision-first (recommended)
ENABLE_REAL_SCRIPT_GENERATION=true # Use real LLM for scripts

# LLM Configuration
LLM_PROVIDER=openrouter  # or 'openai', 'anthropic'
LLM_MODEL_VISION=google/gemini-2.0-flash-exp:free
LLM_MODEL_SCRIPT=meta-llama/llama-3.3-70b-instruct:free

# TTS Configuration
TTS_PROVIDER=mock  # or 'polly' for real audio

# AWS Configuration
AWS_REGION=us-west-2
USE_LOCALSTACK=true  # For local development
```

### Free Models (Zero Cost Testing)
- Vision: `google/gemini-2.0-flash-exp:free`
- Script: `meta-llama/llama-3.3-70b-instruct:free`
- Segmentation: `x-ai/grok-4.1-fast:free` (if using legacy pipeline)

### Local Development
```bash
# Start LocalStack
docker-compose up -d

# Start dev server
npm run dev

# Server runs on http://localhost:3000
```

---

## Common Tasks

### Running Tests
```bash
# All tests
npm test

# Specific test file
npm test -- --testPathPattern=script-generator

# Watch mode
npm run test:watch
```

### Deployment
```bash
# Dev environment
npm run deploy

# Staging
npm run deploy:staging

# Production (careful!)
npm run deploy:prod
```

### Checking Test Status
```bash
# Quick check of script generator tests (most likely to break)
npm test -- --testPathPattern=script-generator.unit.test.ts --no-coverage
```

---

## Documentation Structure

### Most Important Docs
| Document | Purpose | Accuracy |
|----------|---------|----------|
| `README.md` | Project overview | ✅ Current |
| `docs/Deployment/MISSING_IMPLEMENTATIONS.md` | Implementation history | ✅ Current |
| `docs/API/API_IMPLEMENTATION_STATUS.md` | API status | ✅ Current |
| `docs/Feature Flags/FEATURE_FLAGS.md` | Feature flag guide | ✅ Current |
| `docs/Testing/E2E/E2E_TEST_FINAL_RESULTS.md` | E2E test results | ✅ Current |

### Historical/Legacy Docs
| Document | Purpose | Note |
|----------|---------|------|
| `docs/Legacy/IMAGE_EXTRACTION_TODO.md` | Old image extraction plan | ℹ️ Completed, kept for history |
| `docs/Legacy/TASK_UPDATES_SUMMARY.md` | Old task tracking | ℹ️ Historical reference |

---

## User Preferences & Rules

### Critical Rules (from user's Warp rules)
1. **Never delete anything without explicit permission** - Especially if there's no backup or recovery

### User's Communication Style
- Direct and concise
- Appreciates efficiency
- Values getting up to speed quickly
- Works with multiple AI developers
- Manages own PR merges

### What User Expects
- Create feature branches for all work
- Commit frequently with good messages
- Open PRs but don't merge them
- Fix tests when they break
- Keep documentation accurate
- Plan carefully before major changes (like SDK migrations)

---

## Troubleshooting Common Issues

### Tests Failing After Changes
**Most Likely**: Prompt structure changed in `script-generator.ts`  
**Fix**: Update test expectations in `script-generator.unit.test.ts`  
**Check**: Look for assertions on prompt content (e.g., `.toContain()` calls)

### Vision Analysis Errors
**Most Likely**: JSON parsing issues from LLM response  
**Fix**: Check `cleanAndParseJson()` in `analyzer-vision.ts`  
**Test**: `analyzer-vision-robust.test.ts` has edge case tests

### Deployment Failures
**Most Likely**: AWS credentials or region mismatch  
**Check**: `.env` file has correct AWS_REGION (us-west-2)  
**LocalStack**: Make sure docker-compose is running

---

## Current State Summary (As of Dec 13, 2024)

### ✅ What's Working
- All core pipeline components implemented
- Vision-first analyzer with real LLM integration
- Script generation with agent personality support
- Audio synthesis with AWS Polly
- All infrastructure (S3, DynamoDB, EventBridge)
- Tests passing (except polly-chunking)
- Documentation accurate

### ⚠️ What Needs Attention
- AWS SDK v3 migration (planned for future)
- Polly chunking test (after SDK v3)

### 📋 Immediate Next Steps
1. Wait for PR #5 review and merge
2. After merge, delete `fix/update-tests-and-docs` branch
3. Continue development on `streamline-functions` branch

### 🎯 Future Major Work
- AWS SDK v3 migration (separate branch, careful planning)
- Possible production deployment
- Monitor and optimize LLM costs

---

## Quick Reference Commands

```bash
# Git ceremony (typical workflow)
git checkout streamline-functions
git pull
git checkout -b feature/your-feature-name
# ... make changes ...
git add .
git commit -m "feat: your descriptive message"
git push -u origin feature/your-feature-name
gh pr create --base streamline-functions --title "Your PR Title" --body "Description"

# Testing
npm test                                    # All tests
npm test -- --testPathPattern=filename      # Specific test
npm test -- --watch                         # Watch mode

# Development
docker-compose up -d                        # Start LocalStack
npm run dev                                 # Start dev server
npm run build                               # Build TypeScript

# Check status
git status                                  # Git state
git log --oneline -5                        # Recent commits
npm test -- --listTests                     # Available tests
```

---

## Gotchas & Tips

1. **Test Expectations**: Tests often need updating when prompts change
2. **SDK v2 Warnings**: Ignore AWS SDK v2 deprecation warnings for now (planned migration)
3. **LocalStack**: Always check it's running if AWS operations fail locally
4. **Free Models**: Use OpenRouter free models for zero-cost development
5. **Prompt Changes**: Changes to prompts in `script-generator.ts` will break tests
6. **Untracked Files**: `.gemini/` and exploratory tests shouldn't be committed
7. **PR Workflow**: User reviews and merges, you just create PRs
8. **Feature Flags**: Check `.env` if behavior seems unexpected

---

## If You're Starting a New Task

1. **Read this document first** - Get context quickly
2. **Check recent commits** - `git log --oneline -10`
3. **Check PR status** - `gh pr list`
4. **Check for uncommitted changes** - `git status`
5. **Run tests** - `npm test` to ensure baseline
6. **Check current branch** - Should be `streamline-functions` or feature branch
7. **Ask user for task** - Don't assume what to work on

---

## Contact & Questions

**Repository**: https://github.com/JasonDoug/corpus-voxhaul  
**Owner**: Jason  
**AI Assistant Context**: Use this document to get up to speed quickly

**When in doubt**:
- Check recent commits for context
- Look at test files to understand behavior
- Read the docs in priority order (listed above)
- Ask Jason before making major architectural changes

---

**End of Handoff Document**  
*Generated by AI Assistant on 2024-12-13*

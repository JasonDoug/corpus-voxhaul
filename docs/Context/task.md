# Production Hardening & Optimization Tasks

- [ ] **Infrastructure Upgrades**
    - [ ] Upgrade to AWS SDK v3
    - [ ] Update Runtime to Node.js 20.x

- [x] **Debugging & Connectivity**
    - [x] Fix "Failed to load agents" (CORS 403 on OPTIONS) <!-- id: 4 -->
        - [x] Identify Root Cause (Global Auth)
        - [x] Refactor `template.yaml` (Local)
        - [x] Deploy fix to AWS
        - [x] Verify `OPTIONS /agents` 200 OK
    - [x] Fix "Network Error" on PDF Upload (CORS/Buffer Issue) <!-- id: 5 -->
        - [x] Analyze `upload.ts` (Found missing CORS headers)
        - [x] Verify Frontend vs Backend Upload format (Match confirmed)
        - [x] Patch `src/functions/upload.ts` with correct headers & logic
        - [x] Deploy fix to AWS
        - [x] Verify fix (User confirmed successful upload: Job 2315a0de...)
        - [x] Verified Deep Pipeline: Job `a473ecbc` reached Audio Synthesis (Run `4ba5f21` confirmed stable)
        - [ ] Measure processing time per stage

- [ ] **Performance & Scalability**
    - [ ] **Concurrent Processing** <!-- id: 3 -->
        - [ ] Establish performance baselines
    - [ ] **Rate Limiting Review** <!-- id: 5 -->
        - [ ] Review OpenRouter limits
        - [ ] Document strategy

- [ ] **Comprehensive Testing**
    - [ ] **Error Handling** <!-- id: 6 -->
        - [ ] Test Corrupted PDF
        - [ ] Test Oversized PDF
        - [ ] Test Non-PDF file
        - [ ] Test Empty PDF
        - [ ] Test Image-only PDF
        - [ ] Test Non-English PDF
    - [ ] **Agent Testing** <!-- id: 7 -->
        - [ ] CRUD operations
        - [ ] Agent persistence (does it stay selected?)
        - [ ] Invalid configuration handling
        - [ ] Personality differences in script
    - [ ] **Content Complexity** <!-- id: 8 -->
        - [ ] Short vs Long papers
        - [ ] Figure/Formula heavy
        - [ ] Table/Citation heavy

- [ ] **Feature Enhancements**
    - [ ] **Player Optimization** <!-- id: 9 -->
        - [ ] Display Original PDF
        - [ ] Segment Navigation (Click segment -> Jump to audio)
        - [ ] Immersive Reader Sync (Highlighting)
        - [ ] Playback Accuracy (Timings)
    - [ ] **Pipeline Optimization** <!-- id: 13 -->
        - [ ] Investigate/Fix excessive segmentation (1 sentence segments)
    - [ ] **Admin Configuration** <!-- id: 10 -->
        - [ ] Identify all `.env` settings
        - [ ] Create Admin Page to manage them


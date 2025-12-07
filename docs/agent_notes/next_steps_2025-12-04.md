# To-Do / Next Steps for Corpus-Vox Project

This document outlines the remaining tasks and future improvements.

## Immediate Priority (Critical Fix)

1.  **Fix Audio Synthesis Text Limit:**
    *   **Problem:** `AudioFunction` fails with "Maximum text length has been exceeded" because it sends the full script to Polly in one go.
    *   **Action:** Refactor `src/services/audio-synthesizer.ts` to:
        *   Iterate over `script.segments` and synthesize each segment individually.
        *   Implement a safety chunking mechanism within `PollyTTSProvider` for any individual segment that exceeds the limit.
        *   Concatenate the resulting audio buffers and merge timing data.

## Short-Term Improvements

1.  **Optimize LLM Concurrency:**
    *   Investigate increasing concurrency for Vision Analysis while respecting rate limits (e.g., token bucket or smart batching).

2.  **Frontend Integration:**
    *   Update `StatusFunction` to return **Pre-Signed URLs** for the audio file (instead of raw S3 URLs), allowing the frontend to play audio from the private bucket.

3.  **Cleanup:**
    *   Remove excessive debug logging added during this session.
    *   Remove legacy/mock code paths.

## Technical Debt / Modernization

1.  **Upgrade Node.js Runtime:**
    *   Upgrade from `nodejs18.x` to a current LTS version (e.g., `nodejs20.x` or `nodejs22.x`).

2.  **Migrate AWS SDK to V3:**
    *   Migrate from AWS SDK v2 to AWS SDK v3 for modularity and smaller bundle sizes.

# To-Do / Next Steps for Corpus-Vox Project

This document outlines the remaining tasks and future improvements identified during the integration and debugging of the Vision First pipeline.

## Immediate Next Steps (Cleanup & Refinement)

1.  **Remove Excessive Logging:**
    *   The `ScriptFunction` and `AudioFunction` currently have verbose debug logging (printing full job objects). These should be removed or lowered to DEBUG level to reduce log noise and costs.

2.  **Address CloudWatch Metrics Permissions:**
    *   The `AnalyzerFunction` (and potentially other functions) logs `Failed to publish metric to CloudWatch` due to missing IAM permissions (`cloudwatch:PutMetricData`).
    *   **Action:** Update the IAM role policy for `AnalyzerFunction` (and other relevant Lambda functions) to include `cloudwatch:PutMetricData` action. This will enable proper observability of LLM call metrics.
    *   **Location:** Likely in `template.yaml`, within the `Policies` section for the relevant functions or the `LambdaExecutionRole`.

3.  **Frontend Integration:**
    *   Ensure the frontend correctly displays the `completed` status and renders the audio player using the `audioUrl`.

## Short-Term Improvements

1.  **Optimize LLM Concurrency (Multi-Page PDFs):**
    *   The current sequential processing with 2-second delays for vision analysis is safe but slow for multi-page PDFs.
    *   **Action:** Investigate options for increasing concurrency while respecting OpenRouter's limits. This might involve:
        *   Implementing a token bucket algorithm or more sophisticated rate limiting in `llm.ts`.
        *   If the user has a paid OpenRouter tier, adjusting `OPENROUTER_MIN_REQUEST_INTERVAL_MS` or using higher concurrency.
        *   Exploring an alternative free vision model with higher rate limits (if available and suitable).

2.  **Refine Vision Prompts:**
    *   Review the prompts used in `analyzer-vision.ts` (`analyzePageWithVision`) for optimal extraction and segmentation quality with the Nvidia Nemotron model.

## Long-Term Enhancements

1.  **Remove Legacy Remnants:**
    *   Since the Vision First pipeline is now the primary, systematically remove or deprecate the legacy analysis and segmentation code paths (`src/services/analyzer.ts`, `src/functions/segmenter.ts`, etc.) and associated configurations (e.g., `ENABLE_REAL_SEGMENTATION` flag).

2.  **Agent Customization:**
    *   Implement logic to fully utilize the `agent` parameter for script generation (e.g., dynamic persona, tone adjustments).
    *   Consider allowing the user to select agents via the upload API.

3.  **Error Handling & Retries:**
    *   Review and enhance error handling across the entire pipeline. Ensure all failures are gracefully handled, logged, and reflected in the job status.
    *   Implement dead-letter queues (DLQs) for Lambda functions to capture failed events for later analysis.

4.  **Cost Optimization:**
    *   Monitor LLM token usage and costs. Optimize prompts and model calls to reduce token consumption.
    *   Explore cost-effective LLM models or dedicated paid tiers for production usage.

## Technical Debt / Modernization

1.  **Upgrade Node.js Runtime:**
    *   The current project uses `nodejs18.x` (as defined in `template.yaml`). Node.js 18 is in maintenance mode and will reach end-of-life.
    *   **Action:** Upgrade the runtime to a current LTS version, such as `nodejs20.x` or `nodejs22.x`. This will involve updating `template.yaml`, `package.json` engines, and verifying compatibility of dependencies.

2.  **Migrate AWS SDK to V3:**
    *   The codebase currently uses AWS SDK v2 (`aws-sdk`). V2 is in maintenance mode and has a large bundle size.
    *   **Action:** Migrate to AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, etc.). V3 is modular, resulting in significantly smaller Lambda deployment packages and faster cold starts. This is a codebase-wide refactor involving import changes and some API syntax adjustments.
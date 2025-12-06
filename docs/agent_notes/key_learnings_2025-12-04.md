# Key Learnings from Corpus-Vox Pipeline Integration

1.  **Rate Limits are Paramount (Especially with Free Tiers):**
    *   Unbounded parallelism (`Promise.all`) with free-tier LLM models on platforms like OpenRouter will almost instantaneously trigger rate limits.
    *   Strict sequential processing or carefully managed concurrency with significant delays (e.g., 2-5 seconds per request) is essential to avoid `429 Too Many Requests` or `Rate limit exceeded` errors.
    *   "Upstream" provider rate limits (e.g., Google's limits on Gemini via OpenRouter) can be even stricter and require adapting model choice.

2.  **Event-Driven Architecture Debugging:**
    *   Debugging event-driven systems (EventBridge, Lambda triggers) is fundamentally about ensuring each component emits the expected event and the next component is correctly configured to listen and process it.
    *   **Crucial Lesson:** Verify event payload structure. EventBridge wraps custom events in a `detail` object. Accessing properties directly on the `event` object (e.g., `event.jobId`) instead of `event.detail.jobId` is a common pitfall that leads to silent failures.
    *   A missing `triggerEvent` call (e.g., `triggerScriptGeneration`) after a component's successful execution can silently halt the entire pipeline.
    *   Robust logging with `jobId` and `correlationId` is critical for tracing events across services.

3.  **CloudFormation/SAM Parameter Management:**
    *   Environment variables for AWS Lambda functions, especially API keys, must be explicitly passed during `sam deploy` via `--parameter-overrides` if defined as CloudFormation Parameters. They are NOT automatically read from local `.env` files for cloud deployments.
    *   Default values in `template.yaml` (e.g., `Default: ""`) can lead to silent failures if critical keys are not provided.
    *   **Model Defaults:** Ensure that fallback/default models in the code align with the intended deployment configuration (e.g., free vs. paid). Explicitly setting environment variables in `template.yaml` is safer than relying on code defaults.

4.  **Lambda IAM Permissions are Granular:**
    *   Even with `*CrudPolicy` shortcuts in SAM, specific permissions are often missed.
        *   `DynamoDBReadPolicy` is needed for any table read (e.g., `AgentsTable`), even if the function has CRUD on other tables.
        *   `EventBridgePutEventsPolicy` is explicitly required for any function that emits events.
        *   `cloudwatch:PutMetricData` is needed for custom metrics.
    *   Permission errors often manifest as silent failures or generic error messages if not caught and logged explicitly.

5.  **Error Object Serialization:**
    *   Standard `JSON.stringify()` (and many loggers) produces `{}` for native JavaScript `Error` objects because their properties (`message`, `stack`) are not enumerable.
    *   **Best Practice:** Always explicitly serialize error objects (e.g., `{ message: error.message, stack: error.stack, ... }`) before logging them to ensure diagnostic information is captured.

6.  **Importance of Direct DynamoDB Checks:**
    *   When an API status call is stale or suspicious, direct inspection of the underlying database (e.g., `aws dynamodb get-item`) is the definitive way to confirm the true state of a record and bypass caching layers.

7.  **Python for PDF Processing:**
    *   The decision to use a Python Lambda for PDF-to-image conversion (`pypdfium2`) was validated, as it's a well-suited tool for the task, successfully integrating into the Node.js pipeline.
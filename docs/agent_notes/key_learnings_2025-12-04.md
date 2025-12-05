# Key Learnings from Corpus-Vox Pipeline Integration

1.  **Rate Limits are Paramount (Especially with Free Tiers):**
    *   Unbounded parallelism (`Promise.all`) with free-tier LLM models on platforms like OpenRouter will almost instantaneously trigger rate limits.
    *   Strict sequential processing or carefully managed concurrency with significant delays (e.g., 2-5 seconds per request) is essential to avoid `429 Too Many Requests` or `Rate limit exceeded` errors.
    *   "Upstream" provider rate limits (e.g., Google's limits on Gemini via OpenRouter) can be even stricter and require adapting model choice.

2.  **Event-Driven Architecture Debugging:**
    *   Debugging event-driven systems (EventBridge, Lambda triggers) is fundamentally about ensuring each component emits the expected event and the next component is correctly configured to listen and process it.
    *   A missing `triggerEvent` call (e.g., `triggerScriptGeneration`) after a component's successful execution can silently halt the entire pipeline, even if the component itself finished its work.
    *   Robust logging with `jobId` and `correlationId` is critical for tracing events across services.

3.  **CloudFormation/SAM Parameter Management:**
    *   Environment variables for AWS Lambda functions, especially API keys, must be explicitly passed during `sam deploy` via `--parameter-overrides` if defined as CloudFormation Parameters. They are NOT automatically read from local `.env` files for cloud deployments.
    *   Default values in `template.yaml` (e.g., `Default: ""`) can lead to silent failures if critical keys are not provided.

4.  **Lambda IAM Permissions are Granular:**
    *   Even with `*CrudPolicy` shortcuts in SAM, granular permissions like `cloudwatch:PutMetricData` (for custom metrics) must be explicitly granted if the code tries to perform such actions. Errors due to missing permissions can sometimes be secondary to the main processing logic but still important for observability.

5.  **Importance of Direct DynamoDB Checks:**
    *   When an API status call is stale or suspicious, direct inspection of the underlying database (e.g., `aws dynamodb get-item`) is the definitive way to confirm the true state of a record and bypass caching layers.

6.  **Python for PDF Processing:**
    *   The decision to use a Python Lambda for PDF-to-image conversion (`pypdfium2`) was validated, as it's a well-suited tool for the task, successfully integrating into the Node.js pipeline.

# Key Learnings from Corpus-Vox Pipeline Integration

1.  **Rate Limits are Paramount (Especially with Free Tiers):**
    *   Unbounded parallelism (`Promise.all`) with free-tier LLM models on platforms like OpenRouter will almost instantaneously trigger rate limits.
    *   Strict sequential processing or carefully managed concurrency with significant delays (e.g., 2-5 seconds per request) is essential.
    *   "Upstream" provider rate limits (e.g., Google's limits on Gemini via OpenRouter) can be strict.

2.  **Event-Driven Architecture Debugging:**
    *   **Verify Event Payloads:** EventBridge wraps custom events in `detail`. Accessing `event.jobId` directly instead of `event.detail.jobId` causes silent failures.
    *   **Event Permissions:** Functions emitting events MUST have `events:PutEvents` permission.

3.  **CloudFormation/SAM Nuances:**
    *   **Environment Variables:** Local `.env` files are ignored by Lambda. Parameters must be passed via `sam deploy --parameter-overrides` or defined in `template.yaml`.
    *   **Policy Templates:** SAM has specific shorthands (e.g., `S3CrudPolicy`). Inventing new ones (e.g., `PollySynthesizeSpeechPolicy`) causes deployment failures. Use explicit IAM `Statement` blocks for unsupported services.

4.  **AWS SDK Credentials in Lambda:**
    *   **Do NOT manually set credentials** (`accessKeyId`, `secretAccessKey`) in production code running on Lambda. The SDK automatically handles temporary credentials (including `AWS_SESSION_TOKEN`). Manually setting only key/secret without the token causes "Invalid Security Token" errors.

5.  **AWS Polly Limits:**
    *   **Synchronous Limit:** `synthesizeSpeech` has a hard limit of ~3000 billing characters. Long scripts must be chunked or synthesized segment-by-segment.
    *   **Voice Compatibility:** Ensure the requested `VoiceId` is compatible with the selected `Engine` (e.g., 'generative' vs 'neural').

6.  **Error Logging:**
    *   Standard `JSON.stringify()` produces `{}` for `Error` objects. Explicit serialization (`{ message: err.message, stack: err.stack }`) is mandatory for meaningful logs.

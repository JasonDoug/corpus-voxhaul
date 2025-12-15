# Architectural Decision Record: AWS SDK v2 Limitations & Workarounds

**Date:** December 14, 2025
**Status:** Superseded (Migrated to AWS SDK v3 on December 14, 2025 via PR #7)
**Context:** Node.js 20.x / Python 3.12 Serverless Environment

## Migration Note
This document is preserved for historical reference. The project successfully migrated from AWS SDK v2 to v3 on December 14, 2025. All limitations described below have been resolved through the migration. See PR #7 for implementation details.

## 1. Executive Summary
This project previously relied on **AWS SDK v2 (`aws-sdk`)**. While functional, this SDK was in maintenance mode and introduced specific architectural friction points in a modern Node.js 20+ Serverless environment.

To maintain stability without a full migration to SDK v3, we implemented specific workarounds regarding **bundle sizes**, **Lambda Layers**, and **ESM/CommonJS compatibility**.

---

## 2. Core Limitation: The Monolithic SDK & Bundle Size

### The Problem
AWS SDK v2 is **monolithic**. When you import it (`import AWS from 'aws-sdk'`), you theoretically import support for *every* AWS service (S3, DynamoDB, EC2, SageMaker, etc.), regardless of which ones you actually use.

*   **Impact:** A simple Lambda function that only reads from DynamoDB can end up with a `node_modules` folder weighing **40MB+**.
*   **Lambda Constraint:** AWS Lambda has a **50MB** hard limit for direct zipped code uploads (and 250MB unzipped). Large bundles increase "Cold Start" times significantly.

### The Workaround: Lambda Layers & Externalizing Dependencies
To prevent our function deployment packages from exceeding limits and to ensure binary compatibility, we adopted a **Layer Strategy**.

#### A. The Python Vision Layer (`PdfLayer`)
The Vision First pipeline relies on `pypdfium2` and `Pillow`. These are **binary-heavy** libraries that must be compiled specifically for the Amazon Linux 2023 environment.
*   **Issue:** Building these locally (on Mac/Windows/Standard Linux) creates binaries incompatible with Lambda. Including them in the function code bloats the zip file.
*   **Solution:** We created a dedicated script (`scripts/build-pypdfium2-layer.sh`) that uses **Docker** (`public.ecr.aws/sam/build-python3.12`) to compile these dependencies into a standalone **Lambda Layer**.
*   **Benefit:** The Function code remains tiny (just the `app.py` logic), while the heavy binaries reside in the reusable Layer.

#### B. Node.js Layer Strategy (Implicit)
For Node.js, we rely on the Lambda Runtime's pre-existing environment where possible, or we rely on `sam build`'s tree-shaking (though v2 resists tree-shaking).
*   **Risk:** If we eventually include heavy libraries (like `canvas` or complex PDF parsers) in the Node functions, we will hit the 50MB limit immediately because SDK v2 is already taking up a huge chunk of that space.

---

## 3. The Compatibility Conflict: ESM vs. CommonJS

### The Problem
The modern JavaScript ecosystem (including libraries like `uuid` v10+, `node-fetch` v3+) has moved strictly to **ECMAScript Modules (ESM)**.
However, AWS SDK v2 is designed for **CommonJS (CJS)** (`require` syntax).

*   **The Crash:** When our TypeScript configuration targets CommonJS (to be compatible with SDK v2 patterns and standard Lambda handlers), it tries to `require()` these modern libraries.
*   **Error Seen:** `Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported.`

### The Workaround: Removing Modern Dependencies
We encountered this specifically with the `uuid` library, which broke the `AgentsFunction` with a 502 error.

*   **Attempted Fix:** Trying to force dynamic imports (`import()`) often fails in Lambda cold-start contexts without complex bundling configuration.
*   **Implemented Fix:** We removed the external `uuid` dependency entirely and replaced it with Node.js's native `crypto` module.
    ```typescript
    // OLD (Broken with CJS/SDK v2 setup)
    import { v4 as uuidv4 } from 'uuid'; 
    
    // NEW (Native, Fast, Compatible)
    import * as crypto from 'crypto';
    const id = crypto.randomUUID();
    ```

---

## 4. API Strictness & Typing Issues

### The Problem
AWS SDK v2 uses loose JSON objects for API calls. Unlike SDK v3, which has strict command objects (e.g., `new SynthesizeSpeechCommand(...)`), v2 relies on implied interfaces.

*   **The Incident:** We encountered a **"Speech marks not supported"** error with AWS Polly.
*   **Cause:** We sent `SpeechMarkTypes` parameters while requesting `mp3` audio.
*   **Why v2 made this harder:** In SDK v3, the type definition might have flagged that `SpeechMarkTypes` is incompatible with `OutputFormat: 'mp3'`. in v2, it accepted the object and failed at runtime.
*   **Workaround:** We had to manually separate the logic into two distinct API calls:
    1.  Call 1: Request MP3 (No speech marks).
    2.  Call 2: Request JSON (With speech marks).

---

## 5. Migration Results (Completed December 14, 2025)

All friction points documented in this ADR were resolved through migration to AWS SDK v3:

1.  **Migrated to AWS SDK v3 (Completed):**
    *   **Modular:** Now importing only needed packages (`@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, etc.). Bundle sizes reduced from ~40-70MB to ~3-10MB.
    *   **First-Class TypeScript:** Better type safety now prevents parameter errors at compile time (like the Polly issue).
    *   **ESM Support:** Native ESM support enables use of modern libraries (`uuid` v10+, etc.) without workarounds.
    *   **Migration validated:** Both single-page and multi-page PDFs processed successfully through entire pipeline.

2.  **Future Consideration - Containerize Complex Functions:**
    *   For the Vision/PDF pipeline, moving from Zip+Layer to a **Lambda Container Image** could eliminate the "Layer Build" scripts entirely, allowing us to just `COPY requirements.txt` in a Dockerfile.

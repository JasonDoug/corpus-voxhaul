# Integration Tests for LLM Services

## Overview

Integration tests verify that the LLM services work correctly with real API calls. These tests are automatically skipped when no real API keys are available.

## Running Integration Tests

### Prerequisites

You need at least one of the following API keys:
- OpenRouter API key (recommended - provides access to multiple models)
- OpenAI API key
- Anthropic API key

### Running Tests

#### Option 1: Set environment variable inline

```bash
OPENROUTER_API_KEY=your_actual_key npm test -- segmenter.integration.test.ts
```

#### Option 2: Use .env file

1. Copy `.env.example` to `.env`
2. Add your real API key to `.env`:
   ```
   OPENROUTER_API_KEY=your_actual_key
   ```
3. Run the tests:
   ```bash
   npm test -- segmenter.integration.test.ts
   ```

#### Option 3: Export environment variable

```bash
export OPENROUTER_API_KEY=your_actual_key
npm test -- segmenter.integration.test.ts
```

## What Gets Tested

### Segmentation Integration Tests (`segmenter.integration.test.ts`)

1. **Different PDFs produce different segments**
   - Tests with quantum physics and machine learning PDFs
   - Verifies that segment titles reflect different topics
   - Validates that different content elements are referenced

2. **Valid segment structure**
   - Verifies all required fields are present
   - Validates data types and ranges
   - Ensures all content is assigned to segments
   - Checks that prerequisites are valid

3. **Logical ordering and prerequisites**
   - Verifies prerequisites only reference earlier segments
   - Checks for no self-referential prerequisites
   - Validates no circular dependencies exist

## Test Behavior

- **With API key**: Tests run against real LLM APIs (may incur costs)
- **Without API key**: Tests are automatically skipped with a helpful message
- **Timeout**: Integration tests have a 60-second timeout to accommodate API latency

## Cost Considerations

Running integration tests will make real API calls and incur costs:
- Segmentation tests: ~$0.05-0.15 per test run (3 tests)
- Total estimated cost per run: ~$0.15-0.45

## Troubleshooting

### Tests are skipped

If you see "Integration tests skipped - no API key found", ensure:
1. Your API key is set in the environment
2. The key is not the mock value `test-key-mock`
3. The environment variable name matches exactly (case-sensitive)

### API errors

If tests fail with API errors:
1. Verify your API key is valid and has credits
2. Check your internet connection
3. Verify the API service is operational
4. Check rate limits on your API account

### Timeout errors

If tests timeout:
1. Increase the timeout in the test file (currently 60 seconds)
2. Check your internet connection speed
3. Try a different API provider

## Adding New Integration Tests

When adding new integration tests:

1. Follow the existing pattern:
   ```typescript
   const hasRealApiKey = (process.env.OPENROUTER_API_KEY && 
                          process.env.OPENROUTER_API_KEY !== 'test-key-mock') || ...;
   const describeOrSkip = hasRealApiKey ? describe : describe.skip;
   ```

2. Set appropriate timeout:
   ```typescript
   jest.setTimeout(60000);
   ```

3. Create realistic test data that exercises the full functionality

4. Validate both success cases and edge cases

5. Document what requirements the test validates

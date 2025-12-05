#!/bin/bash
# Watch logs for the entire stack
STACK_NAME="pdf-lecture-service"

echo "Starting log tail for stack: $STACK_NAME"
echo "Waiting for logs... (Ctrl+C to exit)"

# usage: sam logs -n <function_logical_id> --stack-name <stack_name> --tail
# But to watch ALL, we usually need to specify them or use a tool like cwtail.
# sam logs can only watch one function or resource at a time generally unless using specific flags or looping.
# Actually 'sam logs --stack-name X --tail' tries to fetch for all resources in the stack if not specified, but it can be noisy.

# Let's try watching the key functions specifically to keep it clean
sam logs --stack-name $STACK_NAME --tail \
  --name UploadFunction \
  --name PdfToImagesFunction \
  --name AnalyzerFunction \
  --name ScriptFunction \
  --name AudioFunction

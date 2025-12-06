# API Testing Guide

## 📄 OpenAPI Specification

**Location:** `docs/openapi.yaml`

### Using the OpenAPI Spec

**1. View in Swagger Editor:**
- Go to: https://editor.swagger.io/
- File → Import File → Select `docs/openapi.yaml`
- Explore all endpoints with examples

**2. Generate Client SDKs:**
```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript-axios \
  -o generated/typescript-client

# Generate Python client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o generated/python-client
```

**3. Validate API Responses:**
```bash
# Install validator
npm install -g openapi-validator

# Validate spec
openapi-validator docs/openapi.yaml
```

---

## 📮 Postman Collection

**Location:** `docs/postman_collection.json`

### Importing into Postman

**Method 1: Import File**
1. Open Postman
2. Click "Import" button
3. Select `docs/postman_collection.json`
4. Collection will appear in your workspace

**Method 2: Import URL (if hosted)**
1. Click "Import"
2. Select "Link" tab
3. Paste URL to raw JSON file
4. Click "Continue"

### Setup

**1. Configure Variables:**

After importing, set these collection variables:

- `baseUrl`: `https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev`
- `apiKey`: `rB5y5sScAKN3Ndoec3sq3iHQiaUpSt07A1XVuFYd`

**To edit variables:**
1. Click on the collection name
2. Go to "Variables" tab
3. Update `Current Value` for `baseUrl` and `apiKey`
4. Click "Save"

**2. Test Workflow:**

The collection is organized for a complete workflow:

```
1. Agent Management
   ├─ List All Agents
   ├─ Create Humorous Agent (saves agentId automatically)
   ├─ Create Serious Agent
   ├─ Get Agent by ID
   └─ Delete Agent

2. PDF Upload & Processing
   ├─ Upload PDF (saves jobId automatically)
   └─ Check Job Status (poll until completed)

3. Playback
   ├─ Get Playback Data
   └─ Open Immersive Reader

4. Manual Pipeline Triggers (Testing)
   ├─ Trigger Analysis
   ├─ Trigger Segmentation
   ├─ Trigger Script Generation
   └─ Trigger Audio Synthesis
```

### Running Requests

**Complete Workflow:**

1. **Create an Agent**
   - Run: `1. Agent Management → Create Humorous Agent`
   - The `agentId` is saved automatically
   - Verify: `1. Agent Management → List All Agents`

2. **Upload a PDF**
   - **Important:** Replace the `file` field with your base64-encoded PDF
   - Run: `2. PDF Upload & Processing → Upload PDF`
   - The `jobId` is saved automatically

3. **Monitor Processing**
   - Run: `2. PDF Upload & Processing → Check Job Status`
   - Keep running every 3-5 seconds until `status` is `completed`
   - Expected time: 30-60 seconds

4. **Access Playback**
   - Run: `3. Playback → Get Playback Data`
   - Or open in browser: `3. Playback → Open Immersive Reader`

### Converting PDF to Base64

**Using Command Line:**
```bash
# macOS/Linux
base64 -i your-paper.pdf | tr -d '\n' > pdf-base64.txt

# Then copy the content and paste into Postman request body
```

**Using Node.js:**
```javascript
const fs = require('fs');
const pdfBuffer = fs.readFileSync('your-paper.pdf');
const base64 = pdfBuffer.toString('base64');
console.log(base64);
```

**Using Python:**
```python
import base64

with open('your-paper.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')
    print(pdf_base64)
```

**Using Online Tool:**
- Go to: https://base64.guru/converter/encode/pdf
- Upload your PDF
- Copy the base64 string

---

## 🧪 Testing Scenarios

### Scenario 1: Basic Upload and Playback

```
1. Create Humorous Agent
2. Upload PDF with agent
3. Poll status until completed
4. Get playback data
5. Verify audio URL, script, and word timings
```

### Scenario 2: Compare Agent Personalities

```
1. Create Humorous Agent (save ID as agent1)
2. Create Serious Agent (save ID as agent2)
3. Upload same PDF with agent1
4. Wait for completion
5. Upload same PDF with agent2
6. Wait for completion
7. Compare scripts - should have different styles
```

### Scenario 3: Error Handling

```
1. Upload invalid file (not PDF) → Expect 400 error
2. Upload oversized file (>100MB) → Expect 400 error
3. Check status with invalid jobId → Expect 404 error
4. Get agent with invalid agentId → Expect 404 error
```

### Scenario 4: Manual Pipeline Testing

```
1. Upload PDF
2. Manually trigger each stage:
   - Trigger Analysis
   - Trigger Segmentation
   - Trigger Script Generation
   - Trigger Audio Synthesis
3. Check status after each stage
```

---

## 🔍 Response Examples

### Successful Upload
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "PDF uploaded successfully. Processing started."
}
```

### Job Status (In Progress)
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "analyzing",
  "createdAt": "2024-12-03T10:30:00.000Z",
  "updatedAt": "2024-12-03T10:31:00.000Z",
  "pdfFilename": "research-paper.pdf",
  "stages": [
    {
      "stage": "upload",
      "status": "completed",
      "completedAt": "2024-12-03T10:30:05.000Z"
    },
    {
      "stage": "analysis",
      "status": "in_progress",
      "startedAt": "2024-12-03T10:30:05.000Z"
    }
  ]
}
```

### Job Status (Completed)
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2024-12-03T10:30:00.000Z",
  "updatedAt": "2024-12-03T10:32:00.000Z",
  "pdfFilename": "research-paper.pdf",
  "agentId": "agent-123"
}
```

### Error Response
```json
{
  "error": "File size exceeds 100MB limit",
  "code": "FILE_TOO_LARGE",
  "retryable": false
}
```

---

## 🚀 Quick Start with cURL

If you prefer command line:

```bash
# Set variables
export API_KEY="rB5y5sScAKN3Ndoec3sq3iHQiaUpSt07A1XVuFYd"
export API_URL="https://vtqny8cp7e.execute-api.us-west-2.amazonaws.com/dev"

# Create agent
curl -X POST "$API_URL/api/agents" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Test",
    "description": "Test agent",
    "personality": {
      "instructions": "Be clear and concise",
      "tone": "casual"
    },
    "voice": {
      "voiceId": "en-US-Neural2-A",
      "speed": 1.0,
      "pitch": 0
    }
  }'

# Upload PDF (replace with your base64 PDF)
curl -X POST "$API_URL/api/upload" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "file": "YOUR_BASE64_PDF_HERE",
    "filename": "test.pdf"
  }'

# Check status
curl -X GET "$API_URL/api/status/YOUR_JOB_ID" \
  -H "x-api-key: $API_KEY"
```

---

## 📊 Monitoring API Usage

### View Logs
```bash
# Tail logs for upload function
aws logs tail /aws/lambda/pdf-lecture-service-UploadFunction-f1EN4kRje8U5 \
  --follow \
  --region us-west-2
```

### Track Costs
```bash
# Search for LLM cost metrics
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-ScriptFunction-Y2WH8O7G1aOD \
  --filter-pattern "LLM call metrics recorded" \
  --region us-west-2
```

---

## 🐛 Troubleshooting

### Issue: "Forbidden" Response

**Problem:** API returns `{"message":"Forbidden"}`

**Solution:** API Gateway needs to be redeployed:
```bash
aws apigateway create-deployment \
  --rest-api-id vtqny8cp7e \
  --stage-name dev \
  --region us-west-2
```

### Issue: Job Stuck in "analyzing"

**Check logs:**
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/pdf-lecture-service-AnalyzerFunction-WNQyG4ZdZZF5 \
  --filter-pattern "YOUR_JOB_ID" \
  --region us-west-2
```

### Issue: Invalid Base64 PDF

**Verify encoding:**
```bash
# Decode and check if valid PDF
echo "YOUR_BASE64" | base64 -d | file -
# Should output: "PDF document"
```

---

## 📚 Additional Resources

- **API Documentation:** `docs/API.md`
- **Frontend Guide:** `docs/FRONTEND_DEVELOPER_GUIDE.md`
- **Monitoring Guide:** `docs/MONITORING_GUIDE.md`
- **Deployment Status:** `DEPLOYMENT_STATUS.md`

---

**Happy Testing!** 🚀

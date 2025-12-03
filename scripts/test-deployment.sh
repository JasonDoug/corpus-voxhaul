#!/bin/bash

# Test Deployment Script
# Tests the deployed API endpoints to verify everything is working

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

STAGE=${1:-dev}
REGION=${2:-us-east-1}
API_KEY=${3:-}

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Testing Deployed API                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get API endpoint
echo -e "${YELLOW}Getting API endpoint...${NC}"
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name pdf-lecture-service-$STAGE \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text 2>/dev/null)

if [ -z "$API_ENDPOINT" ]; then
    echo -e "${RED}✗ Could not find API endpoint. Is the stack deployed?${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API Endpoint: $API_ENDPOINT${NC}"
echo ""

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}⚠ No API key provided${NC}"
    echo "Note: Some endpoints may require an API key"
    echo "Usage: bash scripts/test-deployment.sh dev us-east-1 YOUR_API_KEY"
    echo ""
    read -p "Enter API key (or press Enter to skip): " API_KEY
fi

# Test 1: Status endpoint (should work without API key for testing)
echo -e "${YELLOW}Test 1: Status endpoint${NC}"
echo "GET $API_ENDPOINT/status/test-job-id"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_ENDPOINT/status/test-job-id")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Status endpoint responding (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Unexpected status code: $HTTP_CODE${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 2: List agents (if API key provided)
if [ -n "$API_KEY" ]; then
    echo -e "${YELLOW}Test 2: List agents${NC}"
    echo "GET $API_ENDPOINT/agents"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_ENDPOINT/agents" \
        -H "x-api-key: $API_KEY")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Agents endpoint working (HTTP $HTTP_CODE)${NC}"
        echo "Response: $BODY"
    else
        echo -e "${RED}✗ Unexpected status code: $HTTP_CODE${NC}"
        echo "Response: $BODY"
    fi
    echo ""
    
    # Test 3: Create a test agent
    echo -e "${YELLOW}Test 3: Create test agent${NC}"
    echo "POST $API_ENDPOINT/agents"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT/agents" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{
            "name": "Test Agent",
            "description": "A test agent for deployment verification",
            "personality": {
                "instructions": "Be helpful and clear",
                "tone": "friendly"
            },
            "voice": {
                "voiceId": "en-US-Neural2-A",
                "speed": 1.0,
                "pitch": 0
            }
        }')
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo -e "${GREEN}✓ Agent creation working (HTTP $HTTP_CODE)${NC}"
        echo "Response: $BODY"
        
        # Extract agent ID for cleanup
        AGENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$AGENT_ID" ]; then
            echo -e "${BLUE}Created agent ID: $AGENT_ID${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Agent creation returned: $HTTP_CODE${NC}"
        echo "Response: $BODY"
    fi
else
    echo -e "${YELLOW}⚠ Skipping authenticated tests (no API key)${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Test Summary                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}API Endpoint:${NC} $API_ENDPOINT"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create an API key if you haven't already"
echo "2. Test with a real PDF upload"
echo "3. Monitor CloudWatch logs for any errors"
echo "4. Set up CloudWatch alarms"
echo ""
echo -e "${BLUE}For more details, see DEPLOYMENT_GUIDE.md${NC}"

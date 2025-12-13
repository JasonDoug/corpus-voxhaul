#!/bin/bash

# Quick Deployment Script for PDF Lecture Service
# This script performs all necessary steps to deploy to AWS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGE=${1:-dev}
# Configuration
STAGE=${1:-dev}
REGION=${2:-us-west-2}

# ... (lines 19-151 omitted)

# Determine stack name based on stage
if [ "$STAGE" = "dev" ]; then
    STACK_NAME="pdf-lecture-service"
else
    STACK_NAME="pdf-lecture-service-$STAGE"
fi

# Get stack outputs
echo -e "${BLUE}Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)

echo ""
echo -e "${GREEN}API Endpoint:${NC} $API_ENDPOINT"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create an API key in API Gateway console"
echo "2. Test the endpoint: curl -X GET \"$API_ENDPOINT/status/test\""
echo "3. Create a default agent using the API"
echo "4. Upload a test PDF"
echo ""
echo -e "${BLUE}For detailed instructions, see DEPLOYMENT_GUIDE.md${NC}"

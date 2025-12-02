#!/bin/bash

# PDF Lecture Service Deployment Script
# This script builds and deploys the serverless application using AWS SAM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE=${1:-dev}
REGION=${2:-us-east-1}

echo -e "${GREEN}PDF Lecture Service Deployment${NC}"
echo "Stage: $STAGE"
echo "Region: $REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}Error: AWS SAM CLI is not installed${NC}"
    echo "Install it from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Build TypeScript
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

# Bundle Lambda functions
echo -e "${YELLOW}Bundling Lambda functions...${NC}"
npm run bundle

# Validate SAM template
echo -e "${YELLOW}Validating SAM template...${NC}"
sam validate --lint

# Build SAM application
echo -e "${YELLOW}Building SAM application...${NC}"
sam build

# Deploy based on stage
echo -e "${YELLOW}Deploying to $STAGE...${NC}"
if [ "$STAGE" = "prod" ]; then
    sam deploy --config-env prod --region $REGION
elif [ "$STAGE" = "staging" ]; then
    sam deploy --config-env staging --region $REGION
else
    sam deploy --config-env default --region $REGION
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"

# Get stack outputs
echo -e "${YELLOW}Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name pdf-lecture-service-$STAGE \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

echo ""
echo -e "${GREEN}Deployment complete!${NC}"

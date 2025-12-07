#!/bin/bash

# Deploy All Script
# Builds and deploys both backend and frontend

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

STAGE=${1:-dev}
REGION=${2:-us-west-2}

echo -e "${BLUE}=== Starting Full Deployment ($STAGE) ===${NC}"

# 1. Backend Build
echo -e "\n${GREEN}[1/5] Building Backend...${NC}"
npm install
npm run build
npm run bundle

# 2. SAM Build
echo -e "\n${GREEN}[2/5] Building SAM Application...${NC}"
sam build

# 3. Deploy Infrastructure (to get API URL)
echo -e "\n${GREEN}[3/5] Deploying Infrastructure...${NC}"
# Use existing env vars if set, otherwise default to stored config
sam deploy --config-env default --no-confirm-changeset

# Get Outputs
API_URL=$(aws cloudformation describe-stacks --stack-name pdf-lecture-service --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name pdf-lecture-service --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name pdf-lecture-service --query 'Stacks[0].Outputs[?OutputKey==`FrontendDistribution`].OutputValue' --output text)

echo -e "API URL: $API_URL"
echo -e "Frontend Bucket: $FRONTEND_BUCKET"

# 4. Build Frontend
echo -e "\n${GREEN}[4/5] Building Frontend...${NC}"
cd frontend
npm install
VITE_API_URL=$API_URL npm run build
cd ..

# 5. Sync Frontend
echo -e "\n${GREEN}[5/5] Deploying Frontend Assets...${NC}"
aws s3 sync frontend/dist s3://$FRONTEND_BUCKET --delete

# Invalidate Cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo -e "\n${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Frontend URL: https://$(aws cloudformation describe-stacks --stack-name pdf-lecture-service --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' --output text)"

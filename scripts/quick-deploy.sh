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
REGION=${2:-us-east-1}

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PDF Lecture Service - Quick Deployment      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Stage:${NC} $STAGE"
echo -e "${GREEN}Region:${NC} $REGION"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/8] Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI installed${NC}"

if ! command -v sam &> /dev/null; then
    echo -e "${RED}✗ SAM CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SAM CLI installed${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js installed${NC}"

# Check AWS credentials
echo ""
echo -e "${YELLOW}[2/8] Verifying AWS credentials...${NC}"
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT" ]; then
    echo -e "${RED}✗ AWS credentials not configured${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS Account: $AWS_ACCOUNT${NC}"

# Check for API keys
echo ""
echo -e "${YELLOW}[3/8] Checking API keys...${NC}"

# Check for OpenRouter first (recommended)
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${YELLOW}⚠ OPENROUTER_API_KEY not set${NC}"
    read -p "Enter OpenRouter API Key (recommended, or press Enter to skip): " OPENROUTER_API_KEY
fi

# Fallback to direct API keys
if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠ OPENAI_API_KEY not set${NC}"
    read -p "Enter OpenAI API Key (or press Enter to skip): " OPENAI_API_KEY
fi

if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY not set${NC}"
    read -p "Enter Anthropic API Key (or press Enter to skip): " ANTHROPIC_API_KEY
fi

if [ -z "$TTS_API_KEY" ]; then
    echo -e "${YELLOW}⚠ TTS_API_KEY not set${NC}"
    read -p "Enter TTS API Key (or press Enter to skip): " TTS_API_KEY
fi

# Set LLM provider
if [ -n "$OPENROUTER_API_KEY" ]; then
    LLM_PROVIDER="openrouter"
    echo -e "${GREEN}✓ Using OpenRouter${NC}"
elif [ -n "$OPENAI_API_KEY" ]; then
    LLM_PROVIDER="openai"
    echo -e "${GREEN}✓ Using OpenAI${NC}"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
    LLM_PROVIDER="anthropic"
    echo -e "${GREEN}✓ Using Anthropic${NC}"
else
    echo -e "${RED}✗ No LLM API key set${NC}"
    exit 1
fi

# Install dependencies
echo ""
echo -e "${YELLOW}[4/8] Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build TypeScript
echo ""
echo -e "${YELLOW}[5/8] Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✓ TypeScript compiled${NC}"

# Bundle Lambda functions
echo ""
echo -e "${YELLOW}[6/8] Bundling Lambda functions...${NC}"
npm run bundle
echo -e "${GREEN}✓ Lambda functions bundled${NC}"

# Validate and build SAM
echo ""
echo -e "${YELLOW}[7/8] Building SAM application...${NC}"
sam validate --lint
sam build
echo -e "${GREEN}✓ SAM application built${NC}"

# Deploy
echo ""
echo -e "${YELLOW}[8/8] Deploying to AWS...${NC}"
echo -e "${BLUE}This may take 5-10 minutes...${NC}"
echo ""

if [ "$STAGE" = "prod" ]; then
    CONFIG_ENV="prod"
elif [ "$STAGE" = "staging" ]; then
    CONFIG_ENV="staging"
else
    CONFIG_ENV="default"
fi

sam deploy \
  --config-env $CONFIG_ENV \
  --region $REGION \
  --parameter-overrides \
    "Stage=$STAGE \
     OpenRouterApiKey=$OPENROUTER_API_KEY \
     OpenAIApiKey=$OPENAI_API_KEY \
     AnthropicApiKey=$ANTHROPIC_API_KEY \
     TTSApiKey=$TTS_API_KEY \
     LLMProvider=$LLM_PROVIDER" \
  --no-fail-on-empty-changeset

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Successful! 🎉             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get stack outputs
echo -e "${BLUE}Stack Outputs:${NC}"
aws cloudformation describe-stacks \
    --stack-name pdf-lecture-service-$STAGE \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output table

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name pdf-lecture-service-$STAGE \
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

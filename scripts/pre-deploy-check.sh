#!/bin/bash

# Pre-Deployment Checklist Script
# Verifies that everything is ready for production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Pre-Deployment Checklist                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check and report
check() {
    local name=$1
    local command=$2
    
    echo -n "Checking $name... "
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# Check AWS CLI
check "AWS CLI" "command -v aws"

# Check SAM CLI
check "SAM CLI" "command -v sam"

# Check Node.js
check "Node.js 20.x" "node --version | grep -q 'v20'"

# Check npm
check "npm" "command -v npm"

# Check AWS credentials
echo -n "Checking AWS credentials... "
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}✓${NC} (Account: $ACCOUNT)"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((CHECKS_FAILED++))
fi

# Check if dependencies are installed
check "Node modules" "test -d node_modules"

# Check if TypeScript compiles
echo -n "Checking TypeScript compilation... "
if npm run build &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((CHECKS_FAILED++))
fi

# Check if SAM template is valid
echo -n "Checking SAM template... "
if sam validate --lint &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC}"
    ((CHECKS_FAILED++))
fi

# Check for API keys
echo ""
echo -e "${YELLOW}API Keys Status:${NC}"
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "  OPENAI_API_KEY: ${GREEN}✓ Set${NC}"
else
    echo -e "  OPENAI_API_KEY: ${YELLOW}⚠ Not set${NC}"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "  ANTHROPIC_API_KEY: ${GREEN}✓ Set${NC}"
else
    echo -e "  ANTHROPIC_API_KEY: ${YELLOW}⚠ Not set${NC}"
fi

if [ -n "$TTS_API_KEY" ]; then
    echo -e "  TTS_API_KEY: ${GREEN}✓ Set${NC}"
else
    echo -e "  TTS_API_KEY: ${YELLOW}⚠ Not set${NC}"
fi

# Check LocalStack status
echo ""
echo -n "Checking LocalStack... "
if docker ps | grep -q localstack; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running (OK for production)${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Summary                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo -e "${YELLOW}To deploy, run:${NC}"
    echo "  bash scripts/quick-deploy.sh dev      # Deploy to development"
    echo "  bash scripts/quick-deploy.sh staging  # Deploy to staging"
    echo "  bash scripts/quick-deploy.sh prod     # Deploy to production"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues before deploying.${NC}"
    exit 1
fi

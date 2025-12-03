#!/bin/bash

echo "Initializing LocalStack resources using --profile localstack..."

# Set the endpoint
ENDPOINT="--endpoint-url http://localhost.localstack.cloud:4566"

# Create S3 bucket
echo "Creating S3 bucket..."
aws s3 mb s3://pdf-lecture-service $ENDPOINT --profile localstack 2>/dev/null || echo "Bucket already exists"
echo "✓ S3 bucket: pdf-lecture-service"

# Create DynamoDB tables
echo "Creating DynamoDB tables..."

aws dynamodb create-table \
  --table-name pdf-lecture-jobs \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  $ENDPOINT --profile localstack 2>/dev/null || echo "Table pdf-lecture-jobs already exists"

echo "✓ DynamoDB table: pdf-lecture-jobs"

aws dynamodb create-table \
  --table-name pdf-lecture-agents \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  $ENDPOINT --profile localstack 2>/dev/null || echo "Table pdf-lecture-agents already exists"

echo "✓ DynamoDB table: pdf-lecture-agents"

aws dynamodb create-table \
  --table-name pdf-lecture-content \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  $ENDPOINT --profile localstack 2>/dev/null || echo "Table pdf-lecture-content already exists"

echo "✓ DynamoDB table: pdf-lecture-content"

echo ""
echo "LocalStack initialization complete!"
echo ""
echo "Verifying resources..."
echo ""
echo "S3 Buckets:"
aws s3 ls $ENDPOINT --profile localstack
echo ""
echo "DynamoDB Tables:"
aws dynamodb list-tables $ENDPOINT --profile localstack --query 'TableNames' --output table


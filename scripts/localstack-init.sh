#!/bin/bash

echo "Initializing LocalStack resources..."

# Create S3 bucket
awslocal s3 mb s3://pdf-lecture-service
echo "Created S3 bucket: pdf-lecture-service"

# Create DynamoDB tables
awslocal dynamodb create-table \
  --table-name pdf-lecture-jobs \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "Created DynamoDB table: pdf-lecture-jobs"

awslocal dynamodb create-table \
  --table-name pdf-lecture-agents \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "Created DynamoDB table: pdf-lecture-agents"

awslocal dynamodb create-table \
  --table-name pdf-lecture-content \
  --attribute-definitions \
    AttributeName=jobId,AttributeType=S \
  --key-schema \
    AttributeName=jobId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo "Created DynamoDB table: pdf-lecture-content"

echo "LocalStack initialization complete!"

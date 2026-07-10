#!/bin/bash

set -e

echo "Cleaning up CloudSnap AWS resources..."
echo "======================================="

# Delete DynamoDB tables
echo "Deleting DynamoDB tables..."
aws dynamodb delete-table --table-name terraform-locks --region us-east-1 2>/dev/null || echo "  terraform-locks not found"
aws dynamodb delete-table --table-name cloudsnap-image-metadata --region us-east-1 2>/dev/null || echo "  cloudsnap-image-metadata not found"

# Wait for DynamoDB tables to be deleted
echo "Waiting for DynamoDB tables to be deleted..."
sleep 5

# Empty and delete S3 buckets
echo "Emptying and deleting S3 buckets..."
aws s3 rm s3://cloudsnap-terraform-state-bucket --recursive 2>/dev/null || echo "  cloudsnap-terraform-state-bucket not found or already empty"
aws s3 rb s3://cloudsnap-terraform-state-bucket --force 2>/dev/null || echo "  cloudsnap-terraform-state-bucket deletion failed"

aws s3 rm s3://cloudsnap-upload --recursive 2>/dev/null || echo "  cloudsnap-upload not found or already empty"
aws s3 rb s3://cloudsnap-upload --force 2>/dev/null || echo "  cloudsnap-upload deletion failed"

aws s3 rm s3://cloudsnap-processed --recursive 2>/dev/null || echo "  cloudsnap-processed not found or already empty"
aws s3 rb s3://cloudsnap-processed --force 2>/dev/null || echo "  cloudsnap-processed deletion failed"

aws s3 rm s3://cloudsnap-staticsite --recursive 2>/dev/null || echo "  cloudsnap-staticsite not found or already empty"
aws s3 rb s3://cloudsnap-staticsite --force 2>/dev/null || echo "  cloudsnap-staticsite deletion failed"

# Delete Lambda functions
echo "Deleting Lambda functions..."
aws lambda delete-function --function-name serverless-photo-app-lambda --region us-east-1 2>/dev/null || echo "  serverless-photo-app-lambda not found"
aws lambda delete-function --function-name cloudsnap-image-processor-lambda --region us-east-1 2>/dev/null || echo "  cloudsnap-image-processor-lambda not found"
aws lambda delete-function --function-name sharing_photos_group6 --region us-east-1 2>/dev/null || echo "  sharing_photos_group6 not found"

# Delete IAM roles
echo "Deleting IAM roles..."
aws iam delete-role --role-name cloudsnap-lambda-execution-role 2>/dev/null || echo "  cloudsnap-lambda-execution-role not found"
aws iam delete-role --role-name cloudsnap-cognito-authenticated-role 2>/dev/null || echo "  cloudsnap-cognito-authenticated-role not found"
aws iam delete-role --role-name cloudsnap-cognito-unauthenticated-role 2>/dev/null || echo "  cloudsnap-cognito-unauthenticated-role not found"

echo "======================================="
echo "Cleanup complete!"

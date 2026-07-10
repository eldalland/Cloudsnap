#!/bin/bash

# Clean up existing CloudSnap resources (but NOT the backend resources)
# This is safe to run multiple times

set -e

echo "Cleaning up existing CloudSnap resources..."
echo "============================================"

# Delete Lambda functions
echo "Deleting Lambda functions..."
aws lambda delete-function --function-name serverless-photo-app-lambda --region us-east-1 2>/dev/null || echo "  serverless-photo-app-lambda not found"
aws lambda delete-function --function-name cloudsnap-image-processor-lambda --region us-east-1 2>/dev/null || echo "  cloudsnap-image-processor-lambda not found"
aws lambda delete-function --function-name sharing_photos_group6 --region us-east-1 2>/dev/null || echo "  sharing_photos_group6 not found"

# Delete S3 buckets (empty them first)
echo "Emptying and deleting S3 buckets..."
for bucket in cloudsnap-uploaded cloudsnap-resized cloudsnap-staticsite; do
  aws s3 rm s3://$bucket --recursive 2>/dev/null || true
  aws s3 rb s3://$bucket --force 2>/dev/null || echo "  $bucket not found or could not delete"
done

# Delete DynamoDB tables
echo "Deleting DynamoDB tables..."
aws dynamodb delete-table --table-name cloudsnap-image-metadata --region us-east-1 2>/dev/null || echo "  cloudsnap-image-metadata not found"

# Delete IAM roles (need to delete inline policies first)
echo "Deleting IAM roles..."
aws iam delete-role-policy --role-name cloudsnap-lambda-execution-role --policy-name cloudsnap-lambda-policy 2>/dev/null || true
aws iam delete-role --role-name cloudsnap-lambda-execution-role 2>/dev/null || echo "  cloudsnap-lambda-execution-role not found"

aws iam delete-role-policy --role-name cloudsnap-cognito-authenticated-role --policy-name cognito-policy 2>/dev/null || true
aws iam delete-role --role-name cloudsnap-cognito-authenticated-role 2>/dev/null || echo "  cloudsnap-cognito-authenticated-role not found"

aws iam delete-role-policy --role-name cloudsnap-cognito-unauthenticated-role --policy-name cognito-policy 2>/dev/null || true
aws iam delete-role --role-name cloudsnap-cognito-unauthenticated-role 2>/dev/null || echo "  cloudsnap-cognito-unauthenticated-role not found"

# Delete CloudFront resources
echo "Deleting CloudFront resources..."
DIST_IDS=$(aws cloudfront list-distributions --query 'DistributionList.Items[*].Id' --output text 2>/dev/null || echo "")
for dist_id in $DIST_IDS; do
  etag=$(aws cloudfront get-distribution --id $dist_id --query 'ETag' --output text 2>/dev/null || echo "")
  if [ -n "$etag" ]; then
    aws cloudfront update-distribution --id $dist_id --distribution-config file:///dev/null 2>/dev/null || true
    sleep 1
    aws cloudfront delete-distribution --id $dist_id --if-match $etag 2>/dev/null || echo "  Could not delete distribution $dist_id"
  fi
done

# Delete OAC
echo "Deleting CloudFront OAC..."
OAC_IDS=$(aws cloudfront list-origin-access-controls --query 'OriginAccessControlList.Items[?Name==\`cloudsnap-s3-oac\`].Id' --output text 2>/dev/null || echo "")
for oac_id in $OAC_IDS; do
  etag=$(aws cloudfront get-origin-access-control --id $oac_id --query 'ETag' --output text 2>/dev/null || echo "")
  if [ -n "$etag" ]; then
    aws cloudfront delete-origin-access-control --id $oac_id --if-match $etag 2>/dev/null || echo "  Could not delete OAC $oac_id"
  fi
done

echo "============================================"
echo "Cleanup complete!"

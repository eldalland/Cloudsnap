#!/bin/bash

# Import existing AWS resources into Terraform state
# This script imports resources that already exist in AWS but are not in the Terraform state

set -e

echo "Importing existing AWS resources into Terraform state..."
echo "=========================================================="

# Import DynamoDB tables
echo "Importing DynamoDB tables..."
terraform import aws_dynamodb_table.terraform_locks terraform-locks || true
terraform import aws_dynamodb_table.image_metadata cloudsnap-image-metadata || true

# Import S3 buckets
echo "Importing S3 buckets..."
terraform import aws_s3_bucket.terraform_state cloudsnap-terraform-state-bucket || true
terraform import aws_s3_bucket.upload_bucket cloudsnap-upload || true
terraform import aws_s3_bucket.processed_bucket cloudsnap-processed || true

# Import IAM roles
echo "Importing IAM roles..."
terraform import aws_iam_role.lambda_execution_role cloudsnap-lambda-execution-role || true
terraform import aws_iam_role.cognito_authenticated_role cloudsnap-cognito-authenticated-role || true
terraform import aws_iam_role.cognito_unauthenticated_role cloudsnap-cognito-unauthenticated-role || true

# Import Cognito resources
echo "Importing Cognito resources..."
terraform import 'aws_cognito_user_pool.user_pool' $(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`cloudsnap-user-pool`].Id' --output text) 2>/dev/null || true
terraform import 'aws_cognito_identity_pool.identity_pool' $(aws cognito-identity list-identity-pools --max-results 10 --query 'IdentityPools[?IdentityPoolName==`cloudsnap-identity-pool`].IdentityPoolId' --output text) 2>/dev/null || true

# Import Lambda functions
echo "Importing Lambda functions..."
terraform import aws_lambda_function.upload_handler serverless-photo-app-lambda || true
terraform import aws_lambda_function.image_processor cloudsnap-image-processor-lambda || true

# Import CloudFront distributions
echo "Importing CloudFront distributions..."
CLOUDFRONT_ID=$(aws cloudfront list-distributions --query 'DistributionList.Items[?Aliases.Items[0]==`cloudsnap.erikdalland.com`].Id' --output text 2>/dev/null || echo "")
if [ -n "$CLOUDFRONT_ID" ]; then
  terraform import aws_cloudfront_distribution.app_distribution "$CLOUDFRONT_ID" || true
fi

echo "=========================================================="
echo "Import complete! Please review the state file:"
echo "  terraform state list"
echo "  terraform state show <resource>"

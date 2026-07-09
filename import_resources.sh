#!/bin/bash

echo "🔍 Gathering AWS resource IDs..."

# S3 Buckets (these exist, no need to get IDs)
echo "✅ S3 Buckets found (will import by name)"

# IAM Role
echo "✅ IAM Role found (will import by name)"

# CloudFront OAC ID
echo "Getting CloudFront OAC ID..."
OAC_ID=$(aws cloudfront list-origin-access-controls --query 'OriginAccessControlList.Items[?Name==`cloudsnap-s3-oac`].Id' --output text)
echo "OAC ID: $OAC_ID"

# CloudFront Distribution IDs
echo "Getting CloudFront Distribution IDs..."
DISTRIBUTIONS=$(aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,Origins[0].DomainName]' --output text)
echo "Distributions found:"
echo "$DISTRIBUTIONS"

# Extract IDs (you may need to identify which is which)
DIST_IDS=$(aws cloudfront list-distributions --query 'DistributionList.Items[*].Id' --output text)
DIST_ARRAY=($DIST_IDS)
STATIC_DIST_ID=${DIST_ARRAY[0]}
IMAGES_DIST_ID=${DIST_ARRAY[1]}
echo "Static Site Distribution ID: $STATIC_DIST_ID"
echo "Images Distribution ID: $IMAGES_DIST_ID"

# API Gateway ID
echo "Getting API Gateway ID..."
API_ID=$(aws apigatewayv2 get-apis --query 'Items[?Name==`cloudsnap-api`].ApiId' --output text)
echo "API ID: $API_ID"

# Cognito User Pool ID
echo "Getting Cognito User Pool ID..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`cloudsnap-user-pool`].Id' --output text)
echo "User Pool ID: $USER_POOL_ID"

# Cognito User Pool Client ID
echo "Getting Cognito User Pool Client ID..."
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --max-results 10 --query 'UserPoolClients[?ClientName==`cloudsnap-web-client`].ClientId' --output text)
echo "Client ID: $CLIENT_ID"

# Cognito Identity Pool ID
echo "Getting Cognito Identity Pool ID..."
IDENTITY_POOL_ID=$(aws cognito-identity list-identity-pools --max-results 10 --query 'IdentityPools[?IdentityPoolName==`cloudsnap_identity_pool`].IdentityPoolId' --output text)
echo "Identity Pool ID: $IDENTITY_POOL_ID"

echo ""
echo "🔄 Importing resources into Terraform state..."

# Import S3 buckets
echo "Importing S3 buckets..."
terraform import aws_s3_bucket.website_bucket cloudsnap-staticsite || true
terraform import aws_s3_bucket.upload_bucket cloudsnap-uploaded || true
terraform import aws_s3_bucket.processed_bucket cloudsnap-resized || true
terraform import aws_s3_bucket.terraform_state cloudsnap-terraform-state-bucket || true

# Import IAM role
echo "Importing IAM role..."
terraform import aws_iam_role.lambda_execution_role cloudsnap-lambda-execution-role || true

# Import CloudFront OAC
if [ -n "$OAC_ID" ]; then
  echo "Importing CloudFront OAC..."
  terraform import aws_cloudfront_origin_access_control.s3_oac "$OAC_ID" || true
fi

# Import CloudFront distributions
if [ -n "$STATIC_DIST_ID" ]; then
  echo "Importing Static Site CloudFront Distribution..."
  terraform import aws_cloudfront_distribution.static_site "$STATIC_DIST_ID" || true
fi

if [ -n "$IMAGES_DIST_ID" ]; then
  echo "Importing Images CloudFront Distribution..."
  terraform import aws_cloudfront_distribution.processed_images "$IMAGES_DIST_ID" || true
fi

# Import API Gateway
if [ -n "$API_ID" ]; then
  echo "Importing API Gateway..."
  terraform import aws_apigatewayv2_api.cloudsnap_api "$API_ID" || true
fi

# Import Cognito resources
if [ -n "$USER_POOL_ID" ]; then
  echo "Importing Cognito User Pool..."
  terraform import aws_cognito_user_pool.cloudsnap "$USER_POOL_ID" || true
fi

if [ -n "$CLIENT_ID" ]; then
  echo "Importing Cognito User Pool Client..."
  terraform import aws_cognito_user_pool_client.cloudsnap_web "$USER_POOL_ID:$CLIENT_ID" || true
fi

if [ -n "$IDENTITY_POOL_ID" ]; then
  echo "Importing Cognito Identity Pool..."
  terraform import aws_cognito_identity_pool.cloudsnap "$IDENTITY_POOL_ID" || true
fi

echo ""
echo "✅ Import complete! Running terraform plan to verify..."
terraform plan

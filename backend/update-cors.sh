#!/bin/bash

# Update CORS configuration for API Gateway HTTP API
# Replace YOUR_API_ID with your actual API Gateway ID

API_ID="cco10loarj"  # From your API URL: cco10loarj.execute-api.us-east-1.amazonaws.com
REGION="us-east-1"

echo "Updating CORS configuration for API: $API_ID"

aws apigatewayv2 update-api \
  --api-id $API_ID \
  --region $REGION \
  --cors-configuration "AllowOrigins=https://d27xgyz8l8wwy4.cloudfront.net,AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type,authorization,x-amz-date,x-api-key,x-amz-security-token,MaxAge=300"

echo "✅ CORS configuration updated!"
echo "Your Lambda functions already handle OPTIONS requests."
echo "Deploy your Lambda changes and test again."

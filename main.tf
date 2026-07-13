terraform {
  backend "s3" {
    bucket = "cloudsnap-terraform-state-bucket"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
    # KMS encryption is configured via backend-config.hcl during init
  }
}

provider "aws" {
  region = "us-east-1"
}

# Lambda execution role
resource "aws_iam_role" "lambda_execution_role" {
  name = "cloudsnap-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda policy for S3, DynamoDB, and CloudFront access
resource "aws_iam_role_policy" "lambda_policy" {
  name = "cloudsnap-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
            "arn:aws:s3:::cloudsnap-uploaded",
            "arn:aws:s3:::cloudsnap-uploaded/*",
            "arn:aws:s3:::cloudsnap-resized",
            "arn:aws:s3:::cloudsnap-resized/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.image_metadata.arn,
          "${aws_dynamodb_table.image_metadata.arn}/index/*"
        ]
      }
    ]
  })
}

# Upload handler Lambda function
resource "aws_lambda_function" "upload_handler" {
  filename         = "backend/placeholder.zip"
  function_name    = "serverless-photo-app-lambda"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "python3.11"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      USER_UPLOAD_BUCKET = aws_s3_bucket.upload_bucket.id
    }
  }

  tags = {
    Name = "upload-handler"
  }
}

# Image processor Lambda function
resource "aws_lambda_function" "image_processor" {
  filename         = "backend/placeholder.zip"
  function_name    = "cloudsnap-image-processor-lambda"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "python3.11"
  timeout          = 120
  memory_size      = 512

  environment {
    variables = {
      PROCESSED_BUCKET = aws_s3_bucket.processed_bucket.id
      DYNAMODB_TABLE   = aws_dynamodb_table.image_metadata.name
    }
  }

  tags = {
    Name = "image-processor"
  }
}

# DynamoDB query Lambda function
resource "aws_lambda_function" "db_query" {
  filename         = "backend/placeholder.zip"
  function_name    = "sharing_photos_group6"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "index.handler"
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.image_metadata.name
    }
  }

  tags = {
    Name = "db-query"
  }
}

# Static site bucket (for frontend)
resource "aws_s3_bucket" "website_bucket" {
  bucket = "cloudsnap-staticsite"

  tags = {
    Name = "static-site"
  }
}

resource "aws_s3_bucket_versioning" "website_bucket" {
  bucket = aws_s3_bucket.website_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "website_bucket" {
  bucket = aws_s3_bucket.website_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website_bucket" {
  bucket = aws_s3_bucket.website_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = data.aws_kms_key.app.arn
    }
    bucket_key_enabled = true
  }
}

# Upload bucket (for user uploads)
resource "aws_s3_bucket" "upload_bucket" {
  bucket = "cloudsnap-uploaded"

  tags = {
    Name = "uploaded-images"
  }
}

resource "aws_s3_bucket_versioning" "upload_bucket" {
  bucket = aws_s3_bucket.upload_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "upload_bucket" {
  bucket = aws_s3_bucket.upload_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "upload_bucket" {
  bucket = aws_s3_bucket.upload_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = data.aws_kms_key.app.arn
    }
    bucket_key_enabled = true
  }
}

# Processed/resized bucket (for processed images)
resource "aws_s3_bucket" "processed_bucket" {
  bucket = "cloudsnap-resized"

  tags = {
    Name = "resized-images"
  }
}

resource "aws_s3_bucket_versioning" "processed_bucket" {
  bucket = aws_s3_bucket.processed_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "processed_bucket" {
  bucket = aws_s3_bucket.processed_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "processed_bucket" {
  bucket = aws_s3_bucket.processed_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = data.aws_kms_key.app.arn
    }
    bucket_key_enabled = true
  }
}

# DynamoDB table for image metadata
resource "aws_dynamodb_table" "image_metadata" {
  name           = "cloudsnap-image-metadata"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "photo_id"

  attribute {
    name = "photo_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = data.aws_kms_key.app.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  # Global Secondary Index for user_id searches
  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  tags = {
    Name = "image-metadata"
  }
}

# CloudFront origin access control for S3
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "cloudsnap-s3-oac"
  description                       = "OAC for CloudSnap S3 buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution for static website
resource "aws_cloudfront_distribution" "static_site" {
  origin {
    domain_name              = aws_s3_bucket.website_bucket.bucket_regional_domain_name
    origin_id                = "static-site-bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  enabled             = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "static-site-bucket"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 300
    max_ttl                = 3600
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "cloudsnap-static-site"
  }
}

# CloudFront distribution for processed images
resource "aws_cloudfront_distribution" "processed_images" {
  origin {
    domain_name              = aws_s3_bucket.processed_bucket.bucket_regional_domain_name
    origin_id                = "processed-images-bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  enabled = true

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "processed-images-bucket"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "cloudsnap-processed-images"
  }
}

# S3 bucket policy for CloudFront access to static site
resource "aws_s3_bucket_policy" "website_bucket" {
  bucket = aws_s3_bucket.website_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::026344354643:distribution/${aws_cloudfront_distribution.static_site.id}"
          }
        }
      }
    ]
  })
}

# S3 bucket policy for CloudFront access to processed images
resource "aws_s3_bucket_policy" "processed_bucket" {
  bucket = aws_s3_bucket.processed_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.processed_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::026344354643:distribution/${aws_cloudfront_distribution.processed_images.id}"
          }
        }
      }
    ]
  })
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "cloudsnap_api" {
  name          = "cloudsnap-api"
  protocol_type = "HTTP"
  
  tags = {
    Name = "cloudsnap-api"
  }
}

# Integration for upload Lambda
resource "aws_apigatewayv2_integration" "upload_integration" {
  api_id             = aws_apigatewayv2_api.cloudsnap_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.upload_handler.invoke_arn
  payload_format_version = "2.0"
}

# Integration for query Lambda
resource "aws_apigatewayv2_integration" "query_integration" {
  api_id             = aws_apigatewayv2_api.cloudsnap_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.db_query.invoke_arn
  payload_format_version = "2.0"
}

# API Stage (default)
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.cloudsnap_api.id
  name        = "$default"
  auto_deploy = true
  
  tags = {
    Name = "default"
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "upload_api_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.cloudsnap_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "query_api_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.db_query.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.cloudsnap_api.execution_arn}/*/*"
}

# Cognito User Pool
resource "aws_cognito_user_pool" "cloudsnap" {
  name = "cloudsnap-user-pool"

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # MFA configuration - set to OFF since no MFA device is configured
  mfa_configuration = "OFF"

  # User attribute configuration
  schema {
    name              = "email"
    attribute_data_type = "String"
    required          = true
    mutable           = true
  }

  schema {
    name              = "name"
    attribute_data_type = "String"
    mutable           = true
  }

  # Auto-verified attributes
  auto_verified_attributes = ["email"]

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = {
    Name = "cloudsnap-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "cloudsnap_web" {
  name                = "cloudsnap-web-client"
  user_pool_id        = aws_cognito_user_pool.cloudsnap.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  callback_urls = ["http://localhost:3000", "https://yourdomain.com"]
  logout_urls   = ["http://localhost:3000", "https://yourdomain.com"]

  supported_identity_providers = ["COGNITO"]

  # Added these mandatory units to resolve the 400 error
  # while keeping your original resource identifier names.
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Cognito Identity Pool
resource "aws_cognito_identity_pool" "cloudsnap" {
  identity_pool_name               = "cloudsnap_identity_pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id              = aws_cognito_user_pool_client.cloudsnap_web.id
    provider_name          = aws_cognito_user_pool.cloudsnap.endpoint
  }

  tags = {
    Name = "cloudsnap-identity-pool"
  }
}

# IAM Role for authenticated users
resource "aws_iam_role" "cognito_authenticated_role" {
  name = "cloudsnap-cognito-authenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.cloudsnap.id
          }
          "ForAllValues:StringLike" = {
            "cognito-identity.amazonaws.com:sub" = "*"
          }
        }
      }
    ]
  })
}

# IAM Policy for authenticated users to access API Gateway
resource "aws_iam_role_policy" "cognito_authenticated_policy" {
  name = "cloudsnap-cognito-authenticated-policy"
  role = aws_iam_role.cognito_authenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = "${aws_apigatewayv2_api.cloudsnap_api.execution_arn}/*"
      }
    ]
  })
}

# Attach the authenticated role to the identity pool
resource "aws_cognito_identity_pool_roles_attachment" "cloudsnap" {
  identity_pool_id = aws_cognito_identity_pool.cloudsnap.id

  roles = {
    "authenticated" = aws_iam_role.cognito_authenticated_role.arn
  }
}

# JWT Authorizer for API Gateway
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.cloudsnap_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience       = [aws_cognito_user_pool_client.cloudsnap_web.id]
    issuer         = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.cloudsnap.id}"
  }
}

# Update the upload route to use the authorizer
resource "aws_apigatewayv2_route" "upload_route" {
  api_id       = aws_apigatewayv2_api.cloudsnap_api.id
  route_key    = "POST /upload"
  target       = "integrations/${aws_apigatewayv2_integration.upload_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Update the query route to use the authorizer
resource "aws_apigatewayv2_route" "query_route" {
  api_id       = aws_apigatewayv2_api.cloudsnap_api.id
  route_key    = "GET /images"
  target       = "integrations/${aws_apigatewayv2_integration.query_integration.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Outputs
output "user_pool_id" {
  value       = aws_cognito_user_pool.cloudsnap.id
  description = "Cognito User Pool ID"
}

output "user_pool_client_id" {
  value       = aws_cognito_user_pool_client.cloudsnap_web.id
  description = "Cognito User Pool Client ID"
}

output "identity_pool_id" {
  value       = aws_cognito_identity_pool.cloudsnap.id
  description = "Cognito Identity Pool ID"
}

output "cognito_domain" {
  value       = aws_cognito_user_pool.cloudsnap.endpoint
  description = "Cognito User Pool endpoint"
}

# Output API endpoint
output "api_endpoint" {
  value       = aws_apigatewayv2_api.cloudsnap_api.api_endpoint
  description = "CloudSnap API endpoint URL"
}

# Outputs for reference
output "upload_handler_arn" {
  value = aws_lambda_function.upload_handler.arn
}

output "image_processor_arn" {
  value = aws_lambda_function.image_processor.arn
}

output "db_query_arn" {
  value = aws_lambda_function.db_query.arn
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.processed_images.domain_name
  description = "CloudFront distribution domain name for processed images"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.processed_images.id
  description = "CloudFront distribution ID"
}
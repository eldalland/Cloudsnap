terraform {
  backend "s3" {
    bucket = "cloudsnap-terraform-state-bucket"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

# KMS key for Terraform state encryption
resource "aws_kms_key" "terraform" {
  description             = "KMS key for CloudSnap Terraform state encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "cloudsnap-terraform"
  }
}

resource "aws_kms_alias" "terraform" {
  name          = "alias/cloudsnap-terraform"
  target_key_id = aws_kms_key.terraform.key_id
}

# Reference existing Lambda functions (data sources, not creating new ones)
data "aws_lambda_function" "upload_handler" {
  function_name = "serverless-photo-app-lambda"
}

data "aws_lambda_function" "image_processor" {
  function_name = "cloudsnap-image-processor-lambda"
}

data "aws_lambda_function" "db_query" {
  function_name = "sharing_photos_group6"
}

# Reference existing S3 buckets
data "aws_s3_bucket" "website_bucket" {
  bucket = "serverless-photo-website-group6"
}

data "aws_s3_bucket" "upload_bucket" {
  bucket = "serverless-photo-upload-group6"
}

data "aws_s3_bucket" "processed_bucket" {
  bucket = "serverless-photo-processed-group6"
}

# Manage the Terraform state bucket
resource "aws_s3_bucket" "terraform_state" {
  bucket = "cloudsnap-terraform-state-bucket"

  tags = {
    Name = "terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.terraform.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:PutObject"
        Resource = "${aws_s3_bucket.terraform_state.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      },
      {
        Sid    = "DenyIncorrectKmsKey"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:PutObject"
        Resource = "${aws_s3_bucket.terraform_state.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption-aws-kms-key-id" = aws_kms_key.terraform.arn
          }
        }
      },
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
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
      kms_master_key_id = aws_kms_key.terraform.arn
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
      kms_master_key_id = aws_kms_key.terraform.arn
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
      kms_master_key_id = aws_kms_key.terraform.arn
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
    kms_key_arn = aws_kms_key.terraform.arn
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

# Reference existing API Gateway
data "aws_apigatewayv2_api" "api" {
  api_id = "serverless-photo-api"
}

# Reference existing CloudFront distribution
data "aws_cloudfront_distribution" "cdn" {
  id = "E1RVO4SZDJE6JU"
}

# Outputs for reference
output "upload_handler_arn" {
  value = data.aws_lambda_function.upload_handler.arn
}

output "image_processor_arn" {
  value = data.aws_lambda_function.image_processor.arn
}

output "db_query_arn" {
  value = data.aws_lambda_function.db_query.arn
}

output "cloudfront_domain" {
  value = data.aws_cloudfront_distribution.cdn.domain_name
}
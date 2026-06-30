# 1. Configure the Provider
provider "aws" {
  region = "us-east-1"
}

# 2. Create the S3 Bucket to hold your ZIP files
resource "aws_s3_bucket" "terraform_lambda_bucket" {
  bucket = "cloudsnap-lambda-deployments-12345" # Must be globally unique
}

resource "aws_s3_bucket_ownership_controls" "bucket_ownership" {
  bucket = aws_s3_bucket.terraform_lambda_bucket.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# 3. Define the Shared IAM Role
resource "aws_iam_role" "lambda_role" {
  name = "cloudsnap_shared_lambda_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 4. Define the three Lambda functions
resource "aws_lambda_function" "function_one" {
  function_name = "cloudsnap-function-one"
  role          = aws_iam_role.lambda_role.arn
  s3_bucket     = aws_s3_bucket.terraform_lambda_bucket.id
  s3_key        = var.lambda_one_key
  handler       = "image_upload.handler"
  runtime       = "python3.12"
}

resource "aws_lambda_function" "function_two" {
  function_name = "cloudsnap-function-two"
  role          = aws_iam_role.lambda_role.arn
  s3_bucket     = aws_s3_bucket.terraform_lambda_bucket.id
  s3_key        = var.lambda_two_key
  handler       = "image_processor.handler"
  runtime       = "python3.12"
}

resource "aws_lambda_function" "function_three" {
  function_name = "cloudsnap-function-three"
  role          = aws_iam_role.lambda_role.arn
  s3_bucket     = aws_s3_bucket.terraform_lambda_bucket.id
  s3_key        = var.lambda_three_key
  handler       = "db_metadata_query.handler"
  runtime       = "python3.12"
}
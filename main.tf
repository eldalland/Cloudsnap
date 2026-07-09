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

# Reference existing DynamoDB table
data "aws_dynamodb_table" "photos_table" {
  name = "cloudsnap"
}

# Reference existing API Gateway
data "aws_apigatewayv2_api" "api" {
  name = "serverless-photo-api"  # Update this with your actual API name
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
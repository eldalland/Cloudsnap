Serverless Photo Sharing and Multi-Platform Image Optimization System

A serveless photo sharing app hosted on AWS where users can login to upload their images, which will be resized for
facebook, instagram, linkedin, and general website format, and then returned to the browser for download in real-time.
Implemented with Terraform, AWS Actions + Githubs Actions to develop AWS hosted resources as code (IaC) in an external ci/cd environment.

Created as a Capstone Project for NPower's Solutions Architect Course

Group Members: Erik Dalland, Ametelwokil Omer, Jean Cespedes, Howard Bryels

CSS styling + UI js Scripting written by Ametelwokil Omer
Lambda Functions + js AWS Services Configs (Cognito, API, Lambda integration) Scripting + Workflows written by Erik Dalland

================================================================================
TERRAFORM SETUP - MANUAL COMMANDS (Run First Time Only)
================================================================================

Before running "terraform apply", execute these commands manually:

  aws s3 mb s3://cloudsnap-terraform-state-bucket --region us-east-1
  
  aws s3api put-bucket-versioning \
    --bucket cloudsnap-terraform-state-bucket \
    --versioning-configuration Status=Enabled
  
  aws s3api put-public-access-block \
    --bucket cloudsnap-terraform-state-bucket \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  
  aws s3api put-bucket-policy \
    --bucket cloudsnap-terraform-state-bucket \
    --policy file://terraform-state-bucket-policy.json

Then initialize and deploy:

  terraform init -backend-config=backend-config.hcl
  terraform plan
  terraform apply

================================================================================
AWS RESOURCES MANAGED BY TERRAFORM
================================================================================

Compute:
  - API Gateway HTTP API with JWT Cognito authorizer
  - 3 Lambda Functions (upload handler, image processor, database query)
  - Lambda execution IAM role

Storage:
  - 4 S3 Buckets (static site, uploads, processed images, terraform state)
  - S3 versioning and encryption configuration
  - S3 bucket policies and public access blocks

Database:
  - DynamoDB table for image metadata with encryption
  - DynamoDB table for terraform state locking
  - Global secondary index on user_id

Networking & CDN:
  - 2 CloudFront distributions (static site and processed images)
  - CloudFront origin access control

Authentication:
  - Cognito User Pool with email verification
  - Cognito Identity Pool for AWS service access
  - Cognito User Pool Client with OAuth configuration

Security:
  - KMS key for terraform state file encryption
  - IAM roles with least privilege (Lambda, Cognito)
  - IAM policies for S3, DynamoDB, and CloudWatch Logs access
  - Cloudwatch alarm + SNS Topic for email alerts based on API usage

================================================================================
AWS Services Used:
================================================================================

Cognito 
Lambda
API Gateway
S3
CloudFront
DynamoDB
KMS
IAM
SNS
Cloudwatch
Terraform
AWS GitHub Actions
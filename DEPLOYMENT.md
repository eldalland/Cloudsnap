# CloudSnap Terraform Deployment Guide

## Workflow Overview

The CloudSnap infrastructure uses two GitHub Actions workflows:

1. **bootstrap.yaml** - Creates the Terraform backend infrastructure (S3 bucket, DynamoDB table)
2. **deploy.yaml** - Deploys the CloudSnap application infrastructure using Terraform

## Initial Deployment Steps

### Step 1: Bootstrap the Terraform Backend

The first time you deploy, you need to create the Terraform backend resources:

1. Go to GitHub Actions in your repository
2. Select the **"Bootstrap Terraform Backend"** workflow
3. Click **"Run workflow"** and confirm

This will:
- Create the S3 bucket: `cloudsnap-terraform-state-bucket`
- Create the DynamoDB table: `terraform-locks`
- Enable KMS encryption for both
- Configure appropriate bucket policies and access controls

**Wait for the bootstrap workflow to complete successfully before proceeding.**

### Step 2: Deploy CloudSnap Infrastructure

After bootstrap completes, deploy the infrastructure:

1. Push your code to the `main` branch, OR
2. Manually trigger the **"Deploy Cloudsnap"** workflow from GitHub Actions

This will:
- Initialize Terraform with the remote backend
- Validate the Terraform configuration
- Plan the infrastructure deployment
- Create all CloudSnap AWS resources (Lambda, DynamoDB tables, S3 buckets, Cognito, etc.)
- Deploy the frontend to S3
- Update Lambda functions with the latest code

## Backend Configuration

The Terraform backend is configured in `backend-config.hcl`:

```hcl
bucket         = "cloudsnap-terraform-state-bucket"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "terraform-locks"
encrypt        = true
kms_key_id     = "alias/cloudsnap-terraform"
```

During `terraform init`, this configuration is applied:

```bash
terraform init -backend-config=backend-config.hcl
```

## KMS Encryption

All Terraform state is encrypted using the KMS key: `alias/cloudsnap-terraform`

Required KMS permissions for GitHub Actions role:
- `kms:Decrypt`
- `kms:GenerateDataKey`
- `kms:DescribeKey`

## State Management

- **State file location**: `s3://cloudsnap-terraform-state-bucket/prod/terraform.tfstate`
- **Lock table**: `terraform-locks` (DynamoDB)
- **Encryption**: KMS with key `alias/cloudsnap-terraform`

### Important: State is NOT tracked in Git

The `terraform.tfstate` file should **never** be committed to Git. Instead, state is stored in:
1. S3 bucket (encrypted with KMS)
2. DynamoDB table for locking (encrypted with KMS)

This allows multiple users to safely run Terraform commands without conflicts.

## Troubleshooting

### Backend Bucket Already Exists

If you see an error about the bucket already existing, the bootstrap workflow was likely already run. You can skip bootstrap and proceed directly to deployment.

### State Lock Timeout

If a Terraform operation times out or is interrupted, a lock may be left in DynamoDB. To remove it:

```bash
aws dynamodb delete-item \
  --table-name terraform-locks \
  --key '{"LockID": {"S": "cloudsnap-terraform-state-bucket/prod/terraform.tfstate"}}' \
  --region us-east-1
```

### Checksum Mismatch

If you see a checksum mismatch error between S3 and DynamoDB:

1. Delete the lock (see above)
2. Re-run terraform init

This error occurs when a write to DynamoDB fails or is delayed.

## Manual Terraform Operations

If you need to run Terraform commands locally:

```bash
# Initialize with remote backend
terraform init -backend-config=backend-config.hcl

# Plan infrastructure changes
terraform plan -out=tfplan

# Apply planned changes
terraform apply tfplan

# Destroy infrastructure (use with caution!)
terraform destroy
```

## AWS Credentials

The workflows use OIDC (OpenID Connect) to authenticate with AWS without storing long-lived credentials:

- **Role**: `arn:aws:iam::026344354643:role/github-actions`
- **Trust relationship**: Trusts the GitHub repository
- **Permissions**: See `github-actions-policy.json`

## Important Resources

- **S3 Buckets**: 
  - `cloudsnap-terraform-state-bucket` - Terraform state
  - `cloudsnap-upload` - User photo uploads
  - `cloudsnap-processed` - Processed images
  - `cloudsnap-staticsite` - Frontend assets

- **Lambda Functions**:
  - `serverless-photo-app-lambda` - Upload handler
  - `cloudsnap-image-processor-lambda` - Image processing
  - `sharing_photos_group6` - Database query handler

- **DynamoDB Tables**:
  - `terraform-locks` - State locking
  - `cloudsnap-image-metadata` - Photo metadata

- **Cognito**:
  - User pool for authentication
  - Identity pool for AWS credentials

## Next Steps

After successful deployment:

1. Verify all resources are created in AWS Console
2. Test the upload functionality
3. Monitor CloudWatch logs for any errors
4. Update Lambda functions with production code (currently using placeholders)

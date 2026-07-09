# KMS Key Configuration
# 
# Two KMS keys are supported:
# 1. terraform_state_kms_key_id - For Terraform state file encryption (S3 + DynamoDB lock table)
# 2. app_kms_key_id - For application data encryption (S3 buckets + DynamoDB tables)
#
# Both default to the same existing key: alias/cloudsnap-terraform
# Override these variables to use different keys if needed.

variable "terraform_state_kms_key_id" {
  description = "KMS key ID for Terraform state encryption (S3 state file + DynamoDB locks)"
  type        = string
  default     = "alias/cloudsnap-terraform"
}

variable "app_kms_key_id" {
  description = "KMS key ID for application data encryption (S3 buckets + DynamoDB tables)"
  type        = string
  default     = "alias/cloudsnap-terraform"
}

# Data sources to reference the existing KMS keys
data "aws_kms_key" "terraform_state" {
  key_id = var.terraform_state_kms_key_id
}

data "aws_kms_key" "app" {
  key_id = var.app_kms_key_id
}

bucket         = "cloudsnap-terraform-state-bucket"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
kms_key_id     = "alias/cloudsnap-terraform"
# Note: dynamodb_table is deprecated but still required for AWS provider < 1.0
# Once fully deprecated, state locking will use local lockfile (use_lockfile)
dynamodb_table = "terraform-locks"

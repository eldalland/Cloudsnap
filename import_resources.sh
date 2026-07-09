#!/bin/bash

set -e

ROLE_NAME="cloudsnap-lambda-execution-role"

terraform import -lock=false aws_s3_bucket.website_bucket cloudsnap-staticsite 2>&1 || true
terraform import -lock=false aws_s3_bucket.upload_bucket cloudsnap-uploaded 2>&1 || true
terraform import -lock=false aws_s3_bucket.processed_bucket cloudsnap-resized 2>&1 || true
terraform import -lock=false aws_s3_bucket.terraform_state cloudsnap-terraform-state-bucket 2>&1 || true
terraform import -lock=false aws_iam_role.lambda_execution_role $ROLE_NAME 2>&1 || true

OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='cloudsnap-s3-oac'].Id" --output text 2>/dev/null || echo "")
if [ ! -z "$OAC_ID" ]; then
  terraform import -lock=false aws_cloudfront_origin_access_control.s3_oac $OAC_ID 2>&1 || true
fi

terraform plan -lock=false

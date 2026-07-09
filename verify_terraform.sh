#!/bin/bash

set -e

echo "Verifying Terraform Infrastructure..."
echo ""

aws s3api head-object --bucket cloudsnap-terraform-state-bucket --key prod/terraform.tfstate >/dev/null 2>&1 && echo "State file: OK" || echo "State file: MISSING"

aws dynamodb describe-table --table-name terraform-locks >/dev/null 2>&1 && echo "Lock table: OK" || echo "Lock table: MISSING"

terraform state list >/dev/null 2>&1 && echo "Terraform state: OK" || echo "Terraform state: ERROR"

echo ""
echo "Resources:"
terraform state list 2>/dev/null

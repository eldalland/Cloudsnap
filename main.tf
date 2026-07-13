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

# --- REMAINING RESOURCES (LAMBDA, S3, DYNAMODB, CLOUDFRONT, API GATEWAY BASE) ---
# [Note: Keep all your existing Lambda, S3, DynamoDB, and CloudFront resources here, 
# along with the API Gateway resource declarations, up until the Cognito section.]

# --- COMMENTED OUT COGNITO AND DEPENDENT RESOURCES ---

# # Cognito User Pool
# resource "aws_cognito_user_pool" "cloudsnap" {
#   name = "cloudsnap-user-pool"
#   password_policy {
#     minimum_length    = 8
#     require_lowercase = true
#     require_numbers   = true
#     require_symbols   = true
#     require_uppercase = true
#   }
#   mfa_configuration = "OFF"
#   schema {
#     name                = "email"
#     attribute_data_type = "String"
#     required            = true
#     mutable             = true
#   }
#   schema {
#     name                = "name"
#     attribute_data_type = "String"
#     mutable             = true
#   }
#   auto_verified_attributes = ["email"]
#   email_configuration {
#     email_sending_account = "COGNITO_DEFAULT"
#   }
#   tags = { Name = "cloudsnap-user-pool" }
# }
#
# # Cognito User Pool Client
# resource "aws_cognito_user_pool_client" "cloudsnap_web" {
#   name                = "cloudsnap-web-client"
#   user_pool_id        = aws_cognito_user_pool.cloudsnap.id
#   generate_secret     = false
#   explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
#   allowed_oauth_flows                  = ["code", "implicit"]
#   allowed_oauth_scopes                 = ["email", "openid", "profile"]
#   allowed_oauth_flows_user_pool_client = true
#   callback_urls = ["http://localhost:3000", "https://yourdomain.com"]
#   logout_urls   = ["http://localhost:3000", "https://yourdomain.com"]
#   supported_identity_providers = ["COGNITO"]
# }
#
# # Cognito Identity Pool
# resource "aws_cognito_identity_pool" "cloudsnap" {
#   identity_pool_name               = "cloudsnap_identity_pool"
#   allow_unauthenticated_identities = false
#   cognito_identity_providers {
#     client_id                = aws_cognito_user_pool_client.cloudsnap_web.id
#     provider_name            = aws_cognito_user_pool.cloudsnap.endpoint
#   }
#   tags = { Name = "cloudsnap-identity-pool" }
# }
#
# # IAM Role for authenticated users
# resource "aws_iam_role" "cognito_authenticated_role" {
#   name = "cloudsnap-cognito-authenticated-role"
#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect = "Allow"
#       Principal = { Federated = "cognito-identity.amazonaws.com" }
#       Action = "sts:AssumeRoleWithWebIdentity"
#       Condition = {
#         StringEquals = { "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.cloudsnap.id }
#       }
#     }]
#   })
# }
#
# # IAM Policy for authenticated users
# resource "aws_iam_role_policy" "cognito_authenticated_policy" {
#   name = "cloudsnap-cognito-authenticated-policy"
#   role = aws_iam_role.cognito_authenticated_role.id
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect = "Allow"
#       Action = ["execute-api:Invoke"]
#       Resource = "${aws_apigatewayv2_api.cloudsnap_api.execution_arn}/*"
#     }]
#   })
# }
#
# # Attach role
# resource "aws_cognito_identity_pool_roles_attachment" "cloudsnap" {
#   identity_pool_id = aws_cognito_identity_pool.cloudsnap.id
#   roles = { "authenticated" = aws_iam_role.cognito_authenticated_role.arn }
# }
#
# # JWT Authorizer
# resource "aws_apigatewayv2_authorizer" "cognito" {
#   api_id           = aws_apigatewayv2_api.cloudsnap_api.id
#   authorizer_type  = "JWT"
#   identity_sources = ["$request.header.Authorization"]
#   name             = "cognito-authorizer"
#   jwt_configuration {
#     audience = [aws_cognito_user_pool_client.cloudsnap_web.id]
#     issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.cloudsnap.id}"
#   }
# }
#
# # Routes
# resource "aws_apigatewayv2_route" "upload_route" {
#   api_id      = aws_apigatewayv2_api.cloudsnap_api.id
#   route_key   = "POST /upload"
#   target      = "integrations/${aws_apigatewayv2_integration.upload_integration.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
# }
#
# resource "aws_apigatewayv2_route" "query_route" {
#   api_id      = aws_apigatewayv2_api.cloudsnap_api.id
#   route_key   = "GET /images"
#   target      = "integrations/${aws_apigatewayv2_integration.query_integration.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
# }
#
# # Outputs
# output "user_pool_id" { value = aws_cognito_user_pool.cloudsnap.id }
# output "user_pool_client_id" { value = aws_cognito_user_pool_client.cloudsnap_web.id }
# output "identity_pool_id" { value = aws_cognito_identity_pool.cloudsnap.id }
# output "cognito_domain" { value = aws_cognito_user_pool.cloudsnap.endpoint }
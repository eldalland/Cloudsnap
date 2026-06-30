variable "lambda_one_key" {
  description = "S3 key for the image upload function"
  type        = string
  # Default value used if no key is provided during initial deployment
  default     = "initial-deployment.zip" 
}

variable "lambda_two_key" {
  description = "S3 key for the image processor function"
  type        = string
  default     = "initial-deployment.zip"
}

variable "lambda_three_key" {
  description = "S3 key for the DB metadata query function"
  type        = string
  default     = "initial-deployment.zip"
}
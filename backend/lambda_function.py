import json
import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

def lambda_handler(event, context):
    # 1. Grab the bucket name from environment variables
    bucket_name = os.environ.get('USER_UPLOAD_BUCKET')
    
    if not bucket_name:
        return create_response(500, {"error": "Server configuration error: S3 bucket environment variable missing"})
    
    # 2. Parse the filename and content type sent by the frontend
    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName')
        file_type = body.get('fileType') # e.g., 'image/jpeg' or 'image/png'
    except Exception as e:
        return create_response(400, {"error": "Invalid request body"})

    if not file_name or not file_type:
        return create_response(400, {"error": "Missing fileName or fileType"})

    # 3. Initialize the S3 Client
    s3_client = boto3.client('s3', region_name='us-east-1',config=Config(signature_version='s3v4')) # Ensure region matches your architecture
    
    # Organize uploads into a specific folder prefix
    object_key = f"uploads/{file_name}"

    try:
        # 4. Generate the pre-signed PUT URL (Valid for 5 minutes / 300 seconds)
        # We specify ClientMethod='put_object' so S3 expects a clean PUT stream
        upload_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': file_type,
                'ServerSideEncryption': 'aws:kms',
                'SSEKMSKeyId': 'arn:aws:kms:us-east-1:337763382699:key/photo-sharing-app-key'
            },
            ExpiresIn=300
        )
    except ClientError as e:
        return create_response(500, {"error": str(e)})

    # 5. Return just the clean string upload URL back to the website script
    return create_response(200, {
        "uploadUrl": upload_url,
        "finalKey": object_key
    })

def create_response(status_code, body):
    """Helper to handle CORS and format the API Gateway response"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", # Left as * since you don't have a custom domain yet
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,PUT,OPTIONS"
        },
        "body": json.dumps(body)
    }
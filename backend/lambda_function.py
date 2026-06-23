import json
import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

def lambda_handler(event, context):
    # Handle OPTIONS preflight requests for CORS
    if event.get('httpMethod') == 'OPTIONS':
        return create_response(200, {"message": "CORS preflight successful"})
    
    # 1. Grab the bucket name from environment variables
    bucket_name = os.environ.get('USER_UPLOAD_BUCKET')
    
    if not bucket_name:
        return create_response(500, {"error": "Server configuration error: S3 bucket environment variable missing"})
    
    # 2. Extract Username securely from Cognito Context instead of request body
    try:
        # API Gateway extracts this directly from the validated Bearer token
        authorizer_claims = event['requestContext']['authorizer']['claims']
        username = authorizer_claims.get('cognito:username') or authorizer_claims.get('username')
        
        if not username:
            return create_response(401, {"error": "Unauthorized: Unable to extract valid user context"})
    except (KeyError, TypeError) as e:
        print(f"Authorizer block exception payload: {str(event)}")
        return create_response(401, {"error": f"Unauthorized: Request missing validated Cognito token context. {str(e)}"})

    # 3. Parse the filename and content type sent by the frontend
    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName')
        file_type = body.get('fileType') # e.g., 'image/jpeg' or 'image/png'
    except Exception as e:
        return create_response(400, {"error": "Invalid request body"})

    if not file_name or not file_type:
        return create_response(400, {"error": "Missing fileName or fileType"})

    # 4. Initialize the S3 Client
    s3_client = boto3.client('s3', region_name='us-east-1', config=Config(signature_version='s3v4'))
    
    # Organize uploads securely by using their unique Cognito username as a folder prefix
    object_key = f"uploads/{username}/{file_name}"

    try:
        # 5. Generate the pre-signed PUT URL
        upload_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': file_type,
                'Metadata': {'user_id': username},
                'ServerSideEncryption': 'aws:kms',
                'SSEKMSKeyId': 'arn:aws:kms:us-east-1:337763382699:key/2a0566eb-80cb-4a5b-be8c-bdd6abfe5b03'
            },
            ExpiresIn=300
        )
    except ClientError as e:
        return create_response(500, {"error": str(e)})

    # 6. Return just the clean string upload URL back to the website script
    return create_response(200, {
        "uploadUrl": upload_url,
        'metadata': {'user_id': username},
        "finalKey": object_key
    })

def create_response(status_code, body):
    """Helper to handle CORS and format the API Gateway response"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", 
            # CRITICAL: Added Authorization to allowed headers so preflights don't bounce!
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "POST,GET,PUT,OPTIONS"
        },
        "body": json.dumps(body)
    }
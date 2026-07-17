import json
import os
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # Handle OPTIONS preflight requests for CORS (NO AUTH REQUIRED)/*
    """
    if event.get('httpMethod') == 'OPTIONS' or event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Max-Age": "86400"
            },
            "body": json.dumps({"message": "CORS preflight"})
        }
    """
    # 1. Grab the bucket name from environment variables
    bucket_name = os.environ.get('USER_UPLOAD_BUCKET')
    
    if not bucket_name:
        return create_response(500, {"error": "Server configuration error: S3 bucket environment variable missing"})
    
    # 2. Extract Username securely from Cognito Context instead of request body
    username = None
    try:
        # HTTP API v2 uses 'jwt' instead of 'claims'
        request_context = event['requestContext']
        
        # Try HTTP API v2 format first
        if 'authorizer' in request_context and 'jwt' in request_context['authorizer']:
            jwt_claims = request_context['authorizer']['jwt']['claims']
            username = jwt_claims.get('cognito:username') or jwt_claims.get('username')
        # Fall back to REST API format
        elif 'authorizer' in request_context and 'claims' in request_context['authorizer']:
            authorizer_claims = request_context['authorizer']['claims']
            username = authorizer_claims.get('cognito:username') or authorizer_claims.get('username')
        else:
            print(f"Authorizer structure not recognized: {json.dumps(request_context.get('authorizer', {}))}")
            return create_response(401, {"error": "Unauthorized: Unable to parse authorizer context"})
        
        if not username:
            return create_response(401, {"error": "Unauthorized: Unable to extract valid user context"})
        
        print(f"✅ Authenticated user: {username}")
    except (KeyError, TypeError) as e:
        print(f"Authorizer block exception payload: {json.dumps(event)}")
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
        # NOTE: Removed Metadata because it causes signature issues when uploading from browser
        upload_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': file_type,
                'ServerSideEncryption': 'aws:kms',
                'SSEKMSKeyId': 'arn:aws:kms:us-east-1:026344354643:key/2f2e51c1-2235-45e3-82f2-ee0e4d0c6985'
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
import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from urllib.parse import urlparse

dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'cloudsnap')
table = dynamodb.Table(TABLE_NAME)

# Define your asset CloudFront distribution domain here
CLOUDFRONT_ASSET_DOMAIN = "https://d15kfhgeq0idge.cloudfront.net"

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # Handle OPTIONS preflight requests for CORS (NO AUTH REQUIRED)
    if event.get('httpMethod') == 'OPTIONS' or event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Max-Age": "86400"
            },
            "body": json.dumps({"message": "CORS preflight"})
        }
    
    try:
        # 1. EXTRACT USERNAME SECURELY FROM COGNITO CONTEXT
        try:
            authorizer_claims = event['requestContext']['authorizer']['claims']
            user_id = authorizer_claims.get('cognito:username') or authorizer_claims.get('username')
            
            if not user_id:
                return create_response(401, {"error": "Unauthorized: Unable to extract valid user context"})
        except (KeyError, TypeError) as e:
            print(f"Authorizer block exception payload: {str(event)}")
            return create_response(401, {"error": "Unauthorized: Request missing validated Cognito token context."})
        
        print(f"Fetching metadata from DynamoDB for verified user: {user_id}")
        
        # 2. Query DynamoDB for the user's records using your Global Secondary Index
        db_response = table.query(
            IndexName='user_id_index',  
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        records = db_response.get('Items', [])
        print(f"Found records in DB: {records}")
        
        processed_images = []
        
        # 3. Loop through records and dynamically build high-performance CloudFront URLs
        for record in records:
            photo_id = record.get('photo_id')
            raw_variants = record.get('Variants', {})
            
            cloudfront_variants = {}
            for platform, s3_value in raw_variants.items():
                # Handle if DynamoDB stores variants as objects or raw strings
                s3_path_str = s3_value.get('S') if isinstance(s3_value, dict) else str(s3_value)
                
                # Robust extraction: Strip out full URLs or bucket names to isolate just the true key prefix
                if s3_path_str.startswith('http://') or s3_path_str.startswith('https://'):
                    parsed_url = urlparse(s3_path_str)
                    clean_key = parsed_url.path.lstrip('/') 
                else:
                    clean_key = s3_path_str.lstrip('/')
                
                # REPLACEMENT: Instead of signing an S3 URL, append the clean asset key to your CloudFront distribution domain
                cloudfront_variants[platform] = f"{CLOUDFRONT_ASSET_DOMAIN}/{clean_key}"
            
            processed_images.append({
                "user_id": user_id,
                "photo_id": photo_id,
                "variants": cloudfront_variants
            })
            
        return create_response(200, {
            "images": processed_images,
            "count": len(processed_images)
        })
        
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        return create_response(500, {"error": str(e)})

def create_response(status_code, body):
    """Helper to handle CORS and format the API Gateway response"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body)
    }
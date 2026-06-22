import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from urllib.parse import urlparse

# Setup S3 client and DynamoDB resource
s3_config = Config(signature_version='s3v4', region_name='us-east-1')
s3_client = boto3.client('s3', config=s3_config)
dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'cloudsnap')
PROCESSED_BUCKET = os.environ['PROCESSED_BUCKET']
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    try:
        user_id = event.get('queryStringParameters', {}).get('user_id')
        if not user_id:
            return create_response(400, {"error": "user_id query parameter required"})
        
        print(f"Fetching metadata from DynamoDB for user: {user_id}")
        
        # 1. Query DynamoDB for the user's records
        db_response = table.query(
            IndexName='user_id_index',  # <--- Change this if your index name is different!
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        records = db_response.get('Items', [])
        print(f"Found records in DB: {records}")
        
        processed_images = []
        
        # 2. Loop through records and generate fresh presigned URLs
        for record in records:
            photo_id = record.get('photo_id')
            raw_variants = record.get('Variants', {})
            
            signed_variants = {}
            for platform, s3_value in raw_variants.items():
                try:
                    # Handle if DynamoDB stores variants as objects or raw strings
                    s3_path_str = s3_value.get('S') if isinstance(s3_value, dict) else str(s3_value)
                    
                    # Robust extraction: If it's a full URL, strip out everything except the true S3 key
                    if s3_path_str.startswith('http://') or s3_path_str.startswith('https://'):
                        parsed_url = urlparse(s3_path_str)
                        clean_key = parsed_url.path.lstrip('/') # Removes leading slash
                    else:
                        clean_key = s3_path_str.lstrip('/')
                    
                    print(f"Signing bucket: {PROCESSED_BUCKET} with clean key: {clean_key}")
                    
                    # Generate a fresh 1-hour download token
                    fresh_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': PROCESSED_BUCKET, 'Key': clean_key},
                        ExpiresIn=3600
                    )
                    signed_variants[platform] = fresh_url
                except Exception as s3_err:
                    print(f"Failed signing for variant {platform}: {str(s3_err)}")
                    # Skip broken variants instead of crashing the entire response loop
                    continue
            
            processed_images.append({
                "user_id": user_id,
                "photo_id": photo_id,
                "variants": signed_variants
            })
            
        return create_response(200, {
            "images": processed_images,
            "count": len(processed_images)
        })
        
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        return create_response(500, {"error": str(e)})

def create_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body)
    }
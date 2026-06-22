import json
import os
import boto3
from boto3.dynamodb.conditions import Key

# Setup S3 client and DynamoDB resource
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'cloudsnap_metadata')
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
            KeyConditionExpression=Key('user_id').eq(user_id)
        )
        records = db_response.get('Items', [])
        
        processed_images = []
        
        # 2. Loop through records and generate FRESH presigned URLs on the fly
        for record in records:
            photo_id = record.get('photo_id')
            raw_variants = record.get('Variants', {}) # e.g., {"instagram": "raw/path/key.jpg"}
            
            signed_variants = {}
            for platform, s3_key in raw_variants.items():
                try:
                    # Clean the key if it accidentally saved as a full URL string
                    clean_key = s3_key.split('.com/')[-1] if '.com/' in s3_key else s3_key
                    
                    # Generate a fresh 1-hour download token right now
                    fresh_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': PROCESSED_BUCKET, 'Key': clean_key},
                        ExpiresIn=3600
                    )
                    signed_variants[platform] = fresh_url
                except Exception as s3_err:
                    print(f"Failed signing for {platform}: {str(s3_err)}")
            
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
        print(f"Error: {str(e)}")
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
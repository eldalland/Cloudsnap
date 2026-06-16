import json
import os
import uuid
from datetime import datetime
import boto3
from PIL import Image
import io

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

RESIZE_CONFIGS = {
    "facebook": (1200, 630),
    "instagram": (1080, 1080),
    "linkedin": (1200, 628),
    "website": (800, 600)
}

def lambda_handler(event, context):
    print("=== TRACE 1: LAMBDA ACTIVATED SUCCESSFULLY ===")
    print("RECEIVED EVENT PAYLOAD:", json.dumps(event))
    
    processed_bucket = os.environ['PROCESSED_BUCKET']
    table_name = os.environ['DYNAMODB_TABLE']
    table = dynamodb.Table(table_name)
    
    s3_record = event['Records'][0]['s3']
    source_bucket = s3_record['bucket']['name']
    source_key = s3_record['object']['key']
    file_name = source_key.split('/')[-1]
    
    print(f"=== TRACE 2: PARSED PATHS === Source Bucket: {source_bucket} | Key: {source_key}")
    
    try:
        print("=== TRACE 3: DOWNLOADING FROM S3 ===")
        response = s3_client.get_object(Bucket=source_bucket, Key=source_key)
        image_data = response['Body'].read()
        metadata = response.get('Metadata', {})
        username = metadata.get('user_id')
        print(f"=== TRACE 4: DOWNLOAD COMPLETE === Size: {len(image_data)} bytes")
        
        original_image = Image.open(io.BytesIO(image_data))
        original_image.load()
        file_format = original_image.format if original_image.format else 'JPEG'
        
        resized_urls = {}
        photo_id = str(uuid.uuid4())
        
        print(f"=== TRACE 5: STARTING RESIZE LOOP FOR FORMAT: {file_format} ===")
        for platform, dimensions in RESIZE_CONFIGS.items():
            img_copy = original_image.copy()
            img_copy.thumbnail(dimensions)
            
            buffer = io.BytesIO()
            img_copy.save(buffer, format=file_format)
            buffer.seek(0)
            
            destination_key = f"{platform}/{file_name}"
            print(f"-> Uploading {platform} variant to: {processed_bucket}/{destination_key}")
            
            s3_client.put_object(
                Bucket=processed_bucket,
                Key=destination_key,
                Body=buffer,
                ContentType=response['ContentType']
            )
            resized_urls[platform] = f"https://{processed_bucket}.s3.amazonaws.com/{destination_key}"
            
        print("=== TRACE 6: WRITING TO DYNAMODB ===")
        
        # Enforce clean formatting of the map layout
        db_payload = {
            'photo_id': str(photo_id),
            'user_id' : username,
            'OriginalFileName': str(file_name),
            'SourceS3Path': f"s3://{source_bucket}/{source_key}",
            'ProcessedTimestamp': datetime.utcnow().isoformat() + 'Z',
            'Variants': {str(k): str(v) for k, v in resized_urls.items()} # Strict string map evaluation
        }
        
        print("PAYLOAD BEING SENT TO DYNAMODB:", json.dumps(db_payload))
        
        table.put_item(Item=db_payload)
        print("=== TRACE 6b: DYNAMODB WRITE CONFIRMED ===")
        
        print("=== TRACE 7: PIPELINE COMPLETE ===")
        return {
            'statusCode': 200,
            'body': json.dumps('Image processing complete!')
        }

    except Exception as e:
        print(f"!!! CRITICAL ERROR AT KEY {source_key} !!!")
        # Check if it's a native boto3 service error with full metadata
        if hasattr(e, 'response'):
            print("AWS SERVICE ERROR DETAILS:", json.dumps(e.response, indent=2))
        else:
            print("GENERIC EXCEPTION DETAILS:", str(e))
        raise e
import json
import os
import boto3

s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')
QUEUE_URL = os.environ['SQS_QUEUE_URL']
PROCESSED_BUCKET = os.environ['PROCESSED_BUCKET']

def lambda_handler(event, context):
    print("=== DYNAMODB STREAM TRIGGERED ===")
    
    for record in event['Records']:
        if record['eventName'] == 'INSERT':
            new_image = record['dynamodb']['NewImage']
            
            user_id = new_image['user_id']['S']
            photo_id = new_image['photo_id']['S']
            
            # Reconstruct clean variant map
            variants_map = new_image['Variants']['M']
            
            # Generate signed URLs instead of plain S3 URLs
            signed_urls = {}
            for platform, s3_url_obj in variants_map.items():
                s3_url = s3_url_obj['S']
                print(f"Original S3 URL for {platform}: {s3_url}")
                
                # Extract key from URL - handle different URL formats
                # https://bucket.s3.amazonaws.com/key or https://bucket.s3.region.amazonaws.com/key
                try:
                    # Split by domain and get everything after it
                    parts = s3_url.split('.s3')
                    if len(parts) > 1:
                        # Get the path after the domain
                        path_part = parts[1].split('/', 1)[1]  # Skip the first /, get the rest
                        print(f"Extracted path for {platform}: {path_part}")
                    else:
                        path_part = s3_url.split('/')[-1]
                    
                    # Generate signed URL (valid for 1 hour)
                    signed_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': PROCESSED_BUCKET, 'Key': path_part},
                        ExpiresIn=3600  # 1 hour
                    )
                    signed_urls[platform] = signed_url
                    print(f"Generated signed URL for {platform}")
                except Exception as e:
                    print(f"Error generating signed URL for {platform}: {str(e)}")
                    raise
            
            # Construct the data payload with signed URLs
            message_body = {
                "user_id": user_id,
                "photo_id": photo_id,
                "variants": signed_urls
            }
            print(f"Enqueuing processing results to SQS for user: {user_id}")
            
            # Send message to SQS. 
            # MessageAttributes allow API Gateway/Frontend to filter by user later.
            sqs_client.send_message(
                QueueUrl=QUEUE_URL,
                MessageBody=json.dumps(message_body),
                MessageAttributes={
                    'user_id': {
                        'DataType': 'String',
                        'StringValue': user_id
                    }
                }
            )
            
    return {'statusCode': 200, 'body': 'Enqueued successfully'}
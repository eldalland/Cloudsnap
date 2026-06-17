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
                # Extract key from URL: https://bucket.s3.amazonaws.com/key → key
                key = s3_url.split('/')[-1]
                path = '/'.join(s3_url.split('/')[3:])  # Get full path after domain
                
                # Generate signed URL (valid for 1 hour)
                signed_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': PROCESSED_BUCKET, 'Key': path},
                    ExpiresIn=3600  # 1 hour
                )
                signed_urls[platform] = signed_url
                print(f"Generated signed URL for {platform}")
            
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
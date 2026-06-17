import json
import os
import boto3

sqs_client = boto3.client('sqs')
QUEUE_URL = os.environ['SQS_QUEUE_URL']

def lambda_handler(event, context):
    print("=== DYNAMODB STREAM TRIGGERED ===")
    
    for record in event['Records']:
        if record['eventName'] == 'INSERT':
            new_image = record['dynamodb']['NewImage']
            
            user_id = new_image['user_id']['S']
            photo_id = new_image['photo_id']['S']
            
            # Reconstruct clean variant map
            variants_map = new_image['Variants']['M']
            resized_urls = {k: v['S'] for k, v in variants_map.items()}
            
            # Construct the exact data payload for the frontend
            message_body = {
                "user_id": user_id,
                "photo_id": photo_id,
                "variants": resized_urls
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
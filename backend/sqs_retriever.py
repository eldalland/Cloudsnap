import json
import os
import boto3

sqs_client = boto3.client('sqs')
QUEUE_URL = os.environ['SQS_QUEUE_URL']

def lambda_handler(event, context):
    print("=== SQS RETRIEVER LAMBDA TRIGGERED ===")
    print(f"Event: {json.dumps(event)}")
    print(f"QUEUE_URL from env: {QUEUE_URL}")
    
    try:
        # Get user_id from query parameters
        user_id = event.get('queryStringParameters', {}).get('user_id')
        print(f"user_id from query: {user_id}")
        
        if not user_id:
            return create_response(400, {"error": "user_id query parameter required"})
        
        print(f"Retrieving messages for user: {user_id}")
        
        # Receive messages from SQS filtered by user_id
        messages = sqs_client.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=10,
            MessageAttributeNames=['All']
        )
        
        processed_images = []
        
        # Filter messages by user_id and extract image data
        if 'Messages' in messages:
            for message in messages['Messages']:
                message_attributes = message.get('MessageAttributes', {})
                msg_user_id = message_attributes.get('user_id', {}).get('StringValue')
                
                # Only return messages for this user
                if msg_user_id == user_id:
                    body = json.loads(message['Body'])
                    processed_images.append(body)
                    
                    # Delete message after retrieving
                    sqs_client.delete_message(
                        QueueUrl=QUEUE_URL,
                        ReceiptHandle=message['ReceiptHandle']
                    )
                    print(f"Deleted message for photo_id: {body['photo_id']}")
        
        print(f"Retrieved {len(processed_images)} images for user {user_id}")
        
        return create_response(200, {
            "images": processed_images,
            "count": len(processed_images)
        })
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
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

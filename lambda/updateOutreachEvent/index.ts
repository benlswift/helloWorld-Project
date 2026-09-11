import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,PUT'
  };

  // Browsers preflight JSON requests with an OPTIONS request; short-circuit before body validation.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  let input: { id?: string; Name?: string; Location?: string; Date?: string };
  try {
    input = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  if (!input.id || !input.Name || !input.Location || !input.Date) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Id, Name, Location and Date are required' }) };
  }

  const item = {
    id: input.id,
    Name: input.Name,
    Location: input.Location,
    Date: input.Date,
  };

  try {
    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: item.id },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'SET #name = :name, #location = :location, #date = :date',
      ExpressionAttributeNames: {
        '#name': 'Name',
        '#location': 'Location',
        '#date': 'Date',
      },
      ExpressionAttributeValues: {
        ':name': item.Name,
        ':location': item.Location,
        ':date': item.Date,
      },
    }));
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Outreach event not found' }) };
    }
    console.error('Failed to update item in DynamoDB', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Failed to update outreach event' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(item),
    headers
  };
};

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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'PUT') {
     return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
   }

  let input: { id?: string; Name?: string; Location?: string; Role?: string; Email?: string };
  try {
    input = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  if (!input.id || !input.Name || !input.Location || !input.Role || !input.Email) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Id, Name, Location, Role and Email are required' }) };
  }

  const item = {
    id: input.id,
    Name: input.Name,
    Location: input.Location,
    Role: input.Role,
    Email: input.Email,
  };

  try {
    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: item.id },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'SET #name = :name, #location = :location, #role = :role, #email = :email',
      ExpressionAttributeNames: {
        '#name': 'Name',
        '#location': 'Location',
        '#role': 'Role',
        '#email': 'Email',
      },
      ExpressionAttributeValues: {
        ':name': item.Name,
        ':location': item.Location,
        ':role': item.Role,
        ':email': item.Email,
      },
    }));
  } catch (error: any) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Outreach champion not found' }) };
    }
    console.error('Failed to update item in DynamoDB', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Failed to update outreach champion' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(item),
    headers
  };
};

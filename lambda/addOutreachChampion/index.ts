import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  // Browsers preflight JSON POSTs with an OPTIONS request; short-circuit before body validation.
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  let input: { Name?: string; Location?: string; Role?: string; Email?: string };
  try {
    input = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  if (!input.Name || !input.Location || !input.Role || !input.Email) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Name, Location, Role and Email are required' }) };
  }

  const item = {
    id: randomUUID(),
    Name: input.Name,
    Location: input.Location,
    Role: input.Role,
    Email: input.Email,
  };
  
  try {
    await client.send(new PutCommand({ TableName: tableName, Item: item }));
  } catch (error) {
    console.error('Failed to add item to DynamoDB', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Failed to add outreach champion' }) };
  }

  return {
    statusCode: 201,
    body: JSON.stringify(item),
    headers
  };
};

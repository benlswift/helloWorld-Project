import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,DELETE'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const id = (event as typeof event & { queryStringParameters?: { id?: string } | null })
    .queryStringParameters?.id;
  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Id is required' }) };
  }

  await client.send(new DeleteCommand({ TableName: tableName, Key: { id } }));

  return {
    statusCode: 200,
    body: JSON.stringify({ Id: id }),
    headers
  };
};

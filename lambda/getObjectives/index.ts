import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

export const handler = async (event: { queryStringParameters?: { id?: string } | null }) => {
  const id = event.queryStringParameters?.id;

  const result = id
    ? await client.send(new GetCommand({ TableName: tableName, Key: { id } }))
    : await client.send(new ScanCommand({ TableName: tableName }));

    const sortEvents = (events: { Date: string }[]) => {
      return events.sort((a, b) => (a.Date < b.Date ? 1 : a.Date > b.Date ? -1 : 0));
    };

  (result as any).Items = sortEvents((result as any).Items ?? []);

  const body = id ? (result as any).Item ?? null : (result as any).Items ?? [];

  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
};

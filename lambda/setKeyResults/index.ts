import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Use POST to update a key result' }) };
  }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = event.body ? JSON.parse(event.body) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Expected a JSON object' }) };
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  if (typeof input.id !== 'string' || !input.id.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Id is required' }) };
  }

  if (typeof input.ObjectiveID !== 'string' || !input.ObjectiveID.trim() ||
      typeof input.Progress !== 'number' || !Number.isFinite(input.Progress) ||
      input.Progress < 0 || input.Progress > 100 ||
      typeof input.Result !== 'string' || !input.Result.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'ObjectiveID, Progress (0-100), and Result are required' }),
    };
  }

  const item = {
    id: input.id,
    ObjectiveID: input.ObjectiveID,
    Progress: input.Progress,
    Result: input.Result,
  };

  try {
    const result = await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: item.id },
      ConditionExpression: 'attribute_exists(id)',
      UpdateExpression: 'SET #objectiveID = :objectiveID, #progress = :progress, #result = :result',
      ExpressionAttributeNames: {
        '#objectiveID': 'ObjectiveID',
        '#progress': 'Progress',
        '#result': 'Result',
      },
      ExpressionAttributeValues: {
        ':objectiveID': item.ObjectiveID,
        ':progress': item.Progress,
        ':result': item.Result,
      },
      ReturnValues: 'ALL_NEW',
    }));
    return { statusCode: 200, headers, body: JSON.stringify(result.Attributes ?? item) };
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: 'Key result not found' }) };
    }
    console.error('Failed to update key result', error);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Failed to update key result' }) };
  }
};

import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME as string;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

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

  if (input.action === 'assignChampion') {
    if (typeof input.championId !== 'string' || !input.championId.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: 'Champion ID is required' }) };
    }

    try {
      const result = await client.send(new UpdateCommand({
        TableName: tableName,
        Key: { id: input.id },
        UpdateExpression: 'SET #people = list_append(if_not_exists(#people, :empty), :champion)',
        ConditionExpression: 'attribute_exists(id) AND (attribute_not_exists(#people) OR NOT contains(#people, :championId))',
        ExpressionAttributeNames: { '#people': 'People' },
        ExpressionAttributeValues: {
          ':empty': [],
          ':champion': [input.championId],
          ':championId': input.championId,
        },
        ReturnValues: 'ALL_NEW',
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }));
      return { statusCode: 200, headers, body: JSON.stringify(result.Attributes) };
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return {
          statusCode: error.Item ? 409 : 404,
          headers,
          body: JSON.stringify({
            message: error.Item
              ? 'This champion is already assigned to the selected event.'
              : 'Outreach event not found',
          }),
        };
      }
      console.error('Failed to assign champion to outreach event', error);
      return { statusCode: 500, headers, body: JSON.stringify({ message: 'Failed to assign champion to outreach event' }) };
    }
  }

  if (input.action !== undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Unknown event action' }) };
  }

  if (typeof input.Name !== 'string' || !input.Name ||
      typeof input.Location !== 'string' || !input.Location ||
      typeof input.Date !== 'string' || !input.Date ||
      !isStringArray(input.People) || !isStringArray(input.ExpectedPeople)) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Name, Location, Date, People and ExpectedPeople are required' }) };
  }

  const item = {
    id: input.id,
    Name: input.Name,
    Location: input.Location,
    Date: input.Date,
    People: input.People ?? [],
  };

  try {
    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { id: item.id },
      ConditionExpression: `attribute_exists(id) AND (#people = :expectedPeople${input.ExpectedPeople.length ? '' : ' OR attribute_not_exists(#people)'})`,
      UpdateExpression: 'SET #name = :name, #location = :location, #date = :date, #people = :people',
      ExpressionAttributeNames: {
        '#name': 'Name',
        '#location': 'Location',
        '#date': 'Date',
        '#people': 'People',
      },
      ExpressionAttributeValues: {
        ':name': item.Name,
        ':location': item.Location,
        ':date': item.Date,
        ':people': item.People,
        ':expectedPeople': input.ExpectedPeople,
      },
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return {
        statusCode: error.Item ? 409 : 404,
        headers,
        body: JSON.stringify({
          message: error.Item
            ? 'Event assignments changed. Reload the page before saving again.'
            : 'Outreach event not found',
        }),
      };
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

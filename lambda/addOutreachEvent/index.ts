import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const snsClient = new SNSClient({});
const tableName = process.env.TABLE_NAME as string;
const emailTopicArn = process.env.EMAIL_TOPIC_ARN as string;

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

  let input: { Name?: string; Location?: string; Date?: string };
  try {
    input = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  if (!input.Name || !input.Location || !input.Date) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Name, Location and Date are required' }) };
  }

  const item = {
    id: randomUUID(),
    Name: input.Name,
    Location: input.Location,
    Date: input.Date,
  };

  await client.send(new PutCommand({ TableName: tableName, Item: item }));
  try {
    await snsClient.send(new PublishCommand({
    TopicArn: emailTopicArn,
    Subject: `Outreach event added: ${item.Name}`,
    Message: [
      'A new outreach event was added.',
      `Name: ${item.Name}`,
      `Location: ${item.Location}`,
      `Date: ${item.Date}`,
    ].join('\n'),
  }));
  } catch (error) {
    console.error('Failed to send SNS notification', error);
  }

  return {
    statusCode: 201,
    body: JSON.stringify(item),
    headers
  };
};

import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../lambda/getEventResources';

const mockGet = jest.fn();
const mockList = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/lib-dynamodb'),
  DynamoDBDocumentClient: {
    from: () => ({ send: (command: GetCommand) => mockGet(command) }),
  },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  paginateListObjectsV2: (...args: unknown[]) => mockList(...args),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

beforeEach(() => {
  process.env.BUCKET_NAME = 'events';
  process.env.TABLE_NAME = 'outreach-events';
  mockGet.mockReset();
  mockList.mockReset();
});

test('rejects an unscoped resource listing before accessing DynamoDB or S3', async () => {
  const response = await handler({ queryStringParameters: null });
  expect(response.statusCode).toBe(400);
  expect(mockGet).not.toHaveBeenCalled();
  expect(mockList).not.toHaveBeenCalled();
});

test('only lists resources for an existing event prefix', async () => {
  mockGet.mockResolvedValue({ Item: { id: 'event-1' } });
  mockList.mockReturnValue((async function* () {})());

  const response = await handler({ queryStringParameters: { prefix: 'event-1/' } });

  expect(response.statusCode).toBe(200);
  expect(mockGet.mock.calls[0][0].input).toMatchObject({
    Key: { id: 'event-1' },
  });
  expect(mockList.mock.calls[0][1]).toMatchObject({
    Prefix: 'event-1/',
  });
});

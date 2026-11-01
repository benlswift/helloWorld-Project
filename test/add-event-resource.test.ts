import { PutObjectCommand } from '@aws-sdk/client-s3';
import { handler } from '../lambda/addEventResource';

const mockSend = jest.fn<Promise<unknown>, [PutObjectCommand]>();

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn(() => ({ send: (command: PutObjectCommand) => mockSend(command) })),
}));

const request = {
  httpMethod: 'POST',
  queryStringParameters: { prefix: 'event-123', fileName: 'agenda.txt' },
  headers: { 'Content-Type': 'text/plain' },
  body: 'Meeting agenda',
};

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
});

test('uploads a new file inside the prefix without listing existing objects', async () => {
  const result = await handler(request);
  expect(result.statusCode).toBe(201);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
  expect(mockSend.mock.calls[0][0].input).toMatchObject({
    Key: 'event-123/agenda.txt', Body: Buffer.from(request.body), ContentType: 'text/plain',
  });
  expect(JSON.parse(result.body)).toMatchObject({
    prefix: 'event-123', key: 'event-123/agenda.txt', size: Buffer.byteLength(request.body),
  });
});

test('decodes binary contents and normalizes a trailing folder slash', async () => {
  const bytes = Buffer.from([0, 128, 255, 10]);
  const result = await handler({
    ...request,
    queryStringParameters: { prefix: 'events/event-123/', fileName: 'image.bin' },
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes.toString('base64'),
    isBase64Encoded: true,
  });
  expect(result.statusCode).toBe(201);
  expect(mockSend.mock.calls[0][0].input).toMatchObject({
    Key: 'events/event-123/image.bin', Body: bytes, ContentType: 'application/octet-stream',
  });
});

test('supports an empty file and a default content type', async () => {
  expect((await handler({ ...request, body: '', headers: null })).statusCode).toBe(201);
  expect(mockSend.mock.calls[0][0].input).toMatchObject({
    Body: Buffer.alloc(0), ContentType: 'application/octet-stream',
  });
});

test.each([
  { prefix: '', fileName: 'file.txt' },
  { prefix: 'event-123', fileName: '' },
  { prefix: 'event-123', fileName: '../file.txt' },
  { prefix: '/event-123', fileName: 'file.txt' },
  { prefix: 'events/../other', fileName: 'file.txt' },
  { prefix: 'event-123', fileName: 'folder\\file.txt' },
  { prefix: 'event-123', fileName: 'a'.repeat(1024) },
])('rejects invalid destination %j without writing', async queryStringParameters => {
  expect((await handler({ ...request, queryStringParameters })).statusCode).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});

test('rejects a missing body or invalid base64 without writing', async () => {
  expect((await handler({ ...request, body: null })).statusCode).toBe(400);
  expect((await handler({ ...request, body: 'not base64!', isBase64Encoded: true })).statusCode).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});

test('handles preflight and rejects non-upload methods', async () => {
  expect((await handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(204);
  expect((await handler({ ...request, httpMethod: 'GET' })).statusCode).toBe(405);
  expect(mockSend).not.toHaveBeenCalled();
});

test('reports and logs S3 write failures', async () => {
  const error = new Error('Access denied');
  mockSend.mockRejectedValue(error);
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const result = await handler(request);
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ message: 'Error uploading S3 resource' });
    expect(log).toHaveBeenCalledWith('Error uploading S3 resource:', error);
  } finally {
    log.mockRestore();
  }
});

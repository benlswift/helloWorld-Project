import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../lambda/updateOutreachEvent';

const mockSend = jest.fn<Promise<{ Attributes?: Record<string, unknown> }>, [UpdateCommand]>();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/lib-dynamodb'),
  DynamoDBDocumentClient: {
    from: () => ({ send: (command: UpdateCommand) => mockSend(command) }),
  },
}));

const existingEvent = {
  id: 'event-1', Name: 'School visit', Location: 'London', Date: '2026-10-13',
  People: ['existing-champion'],
};

function request(body: unknown) {
  return handler({ httpMethod: 'PUT', body: JSON.stringify(body) });
}

function assign(championId: string) {
  return request({ action: 'assignChampion', id: existingEvent.id, championId });
}

function conditionFailure(exists = true) {
  return new ConditionalCheckFailedException({
    $metadata: {},
    message: 'Condition failed',
    ...(exists ? { Item: { id: { S: existingEvent.id } } } : {}),
  });
}

beforeEach(() => mockSend.mockReset());

test('appends and checks duplicates in a single conditional update without touching event metadata', async () => {
  mockSend.mockResolvedValue({ Attributes: existingEvent });
  expect((await assign('champion-1')).statusCode).toBe(200);
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(mockSend.mock.calls[0][0].input).toMatchObject({
    Key: { id: existingEvent.id },
    UpdateExpression: 'SET #people = list_append(if_not_exists(#people, :empty), :champion)',
    ConditionExpression: 'attribute_exists(id) AND (attribute_not_exists(#people) OR NOT contains(#people, :championId))',
    ExpressionAttributeNames: { '#people': 'People' },
    ExpressionAttributeValues: {
      ':empty': [], ':champion': ['champion-1'], ':championId': 'champion-1',
    },
    ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
  });
});

// Model DynamoDB's serialized evaluation of each conditional update.
function modelAssignments(initialPeople?: string[]) {
  let people = initialPeople?.slice();
  mockSend.mockImplementation(async ({ input }) => {
    const values = input.ExpressionAttributeValues!;
    const championId = values[':championId'];
    if (people?.includes(championId)) throw conditionFailure();
    people = [...(people ?? []), championId];
    return { Attributes: { ...existingEvent, People: people } };
  });
  return () => people;
}

test('parallel assignments retain both IDs along with existing people', async () => {
  const people = modelAssignments(existingEvent.People);
  const results = await Promise.all([assign('champion-1'), assign('champion-2')]);
  expect(results.map(result => result.statusCode)).toEqual([200, 200]);
  expect(people()).toEqual(['existing-champion', 'champion-1', 'champion-2']);
});

test('parallel duplicate assignments append only once', async () => {
  const people = modelAssignments([]);
  const results = await Promise.all([assign('champion-1'), assign('champion-1')]);
  expect(results.map(result => result.statusCode).sort()).toEqual([200, 409]);
  expect(people()).toEqual(['champion-1']);
});

test('initializes an absent People list', async () => {
  const people = modelAssignments();
  expect((await assign('champion-1')).statusCode).toBe(200);
  expect(people()).toEqual(['champion-1']);
});

test('returns 404 rather than creating a missing event', async () => {
  mockSend.mockRejectedValue(conditionFailure(false));
  expect((await assign('champion-1')).statusCode).toBe(404);
});

test.each([undefined, [], ['existing-champion']])('requires a snapshot for full edits (%j)', async expected => {
  mockSend.mockResolvedValue({});
  const result = await request({ ...existingEvent, ExpectedPeople: expected });
  expect(result.statusCode).toBe(expected ? 200 : 400);
  if (expected) {
    expect(mockSend.mock.calls[0][0].input).toMatchObject({
      ConditionExpression: `attribute_exists(id) AND (#people = :expectedPeople${expected.length ? '' : ' OR attribute_not_exists(#people)'})`,
      ExpressionAttributeValues: { ':expectedPeople': expected },
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    });
  } else {
    expect(mockSend).not.toHaveBeenCalled();
  }
});

test('rejects a stale editor after an atomic assignment without erasing it', async () => {
  let people = [...existingEvent.People];
  mockSend.mockImplementation(async ({ input }) => {
    const values = input.ExpressionAttributeValues!;
    if (values[':championId']) {
      people = [...people, values[':championId']];
    } else {
      if (JSON.stringify(people) !== JSON.stringify(values[':expectedPeople'])) {
        throw conditionFailure();
      }
      people = values[':people'];
    }
    return { Attributes: { ...existingEvent, People: people } };
  });
  await assign('champion-1');
  const result = await request({ ...existingEvent, ExpectedPeople: existingEvent.People });
  expect(result.statusCode).toBe(409);
  expect(JSON.parse(result.body).message).toMatch(/Reload/);
  expect(people).toEqual(['existing-champion', 'champion-1']);
});

test.each([null, [], { id: 'event-1', action: 'unknown' },
  { id: 'event-1', action: 'assignChampion', championId: '' },
  { id: 'event-1', action: 'assignChampion', championId: 123 },
])('rejects invalid input %j without writing', async input => {
  expect((await request(input)).statusCode).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});

test('handles preflight and malformed JSON without writing', async () => {
  expect((await handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(204);
  expect((await handler({ body: '{' })).statusCode).toBe(400);
  expect(mockSend).not.toHaveBeenCalled();
});

test('surfaces unexpected database errors', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockSend.mockRejectedValue(new Error('Database unavailable'));
    expect((await assign('champion-1')).statusCode).toBe(500);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

class Element {
  children: Element[] = [];
  textContent = '';
  value = '';
  disabled = false;
  appendChild(child: Element) { this.children.push(child); }
  append() {}
  replaceChildren(...children: Element[]) { this.children = children; }
  addEventListener() {}
}

const source = readFileSync(join(__dirname, '../outreach-hub/js/champion.js'), 'utf8');
const selectedEvent = {
  id: 'event-1', Name: 'School visit', Location: 'London', Date: '2026-10-13',
  People: ['other-champion']
};

async function setup(events = [selectedEvent], eventsOk = true, updateStatus = 200) {
  const elements: Record<string, Element> = {};
  const getElementById = (id: string) => elements[id] ??= new Element();
  const fetch = jest.fn(async (url: string, options?: { method: string; body?: string }) => {
    if (options?.method === 'PUT') return {
      ok: updateStatus === 200, status: updateStatus,
      json: async () => ({ message: updateStatus === 409
        ? 'This champion is already assigned to the selected event.'
        : 'Outreach event not found' })
    };
    if (url === '/champions') return {
      ok: true, json: async () => [{ id: 'champion-1', Name: 'Alex' }]
    };
    return { ok: eventsOk, status: eventsOk ? 200 : 500, json: async () => events };
  });
  const context = {
    URLSearchParams,
    window: {
      location: { search: '?id=champion-1' },
      OUTREACH_CHAMPIONS_API_URL: '/champions',
      OUTREACH_API_URL: '/events',
      UPDATE_OUTREACH_EVENT_API_URL: '/update-event'
    },
    document: { getElementById, createElement: () => new Element() },
    fetch,
    alert: jest.fn(),
    console: { error: jest.fn() }
  };
  await runInNewContext(`${source}\nloadChampion();`, context);
  return {
    elements, fetch, alert: context.alert,
    add: () => runInNewContext('addEventToChampion();', context)
  };
}

test('populates a labelled event selection with IDs and dates', async () => {
  const { elements } = await setup();
  const select = elements['new-champion-event'];
  expect(select.disabled).toBe(false);
  expect(select.children.map(option => [option.value, option.textContent])).toEqual([
    ['', 'Select an event'], ['event-1', 'School visit (2026-10-13)']
  ]);
});

test('requests atomic assignment by ID without sending a stale event or People array', async () => {
  const { elements, fetch, add } = await setup();
  elements['new-champion-event'].value = 'event-1';
  await add();
  const request = fetch.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(request?.[0]).toBe('/update-event');
  expect(JSON.parse(request?.[1]?.body ?? '{}')).toEqual({
    action: 'assignChampion', id: 'event-1', championId: 'champion-1'
  });
  expect(elements['new-champion-event'].value).toBe('');
  expect(elements['add-champion-event-button'].disabled).toBe(false);
});

test('requires a selection', async () => {
  const { add, fetch, alert } = await setup();
  await add();
  expect(alert).toHaveBeenCalledWith('Select an event.');
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});

test.each([409, 404])('reports backend assignment rejection (%s) and refreshes the events', async status => {
  const { elements, add, fetch, alert } = await setup([selectedEvent], true, status);
  elements['new-champion-event'].value = 'event-1';
  await add();
  expect(alert).toHaveBeenCalledWith(status === 409
    ? 'This champion is already assigned to the selected event.'
    : 'Outreach event not found');
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true);
  expect(elements['new-champion-event'].value).toBe('');
  expect(elements['add-champion-event-button'].disabled).toBe(false);
});

test.each([true, false])('disables selection when events are empty or fail (ok=%s)', async ok => {
  const { elements } = await setup([], ok);
  expect(elements['new-champion-event'].disabled).toBe(true);
  expect(elements['add-champion-event-button'].disabled).toBe(true);
  expect(elements['new-champion-event'].children[0].textContent).toBe(
    ok ? 'No events available.' : 'Unable to load events.'
  );
});

test('reports save failures and restores the controls', async () => {
  const { elements, add, alert } = await setup([selectedEvent], true, 500);
  elements['new-champion-event'].value = 'event-1';
  await add();
  expect(alert).toHaveBeenCalledWith('Failed to add event to champion.');
  expect(elements['add-champion-event-button'].disabled).toBe(false);
  expect(elements['new-champion-event'].value).toBe('event-1');
});

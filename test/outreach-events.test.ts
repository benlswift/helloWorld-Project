import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

class Element {
  children: Element[] = [];
  textContent = '';
  href = '';
  colSpan = 0;
  listeners: Record<string, (...args: unknown[]) => unknown> = {};

  append(...children: Element[]) { this.children.push(...children); }
  appendChild(child: Element) { this.append(child); }
  replaceChildren(...children: Element[]) { this.children = children; }
  setAttribute() {}
  addEventListener(name: string, listener: (...args: unknown[]) => unknown) {
    this.listeners[name] = listener;
  }
}

const source = readFileSync(join(__dirname, '../outreach-hub/js/index.js'), 'utf8');

function event(id: string, date: string) {
  return { id, Name: `Event ${id}`, Location: 'London', Date: date };
}

async function load(events: ReturnType<typeof event>[], ok = true) {
  const upcoming = new Element();
  const past = new Element();
  const button = new Element();
  const errors = jest.fn();
  await runInNewContext(`${source}\nloadOutreachEvents();`, {
    Date,
    console: { log: jest.fn(), error: errors },
    window: { OUTREACH_API_URL: '/events' },
    fetch: jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => events }),
    document: {
      getElementById: (id: string) => ({
        'upcoming-events': upcoming,
        'past-events': past,
        'add-event-button': button
      })[id],
      createElement: () => new Element()
    }
  });
  return { upcoming, past, errors };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 16, 23, 59));
});

afterEach(() => jest.useRealTimers());

test('groups by local calendar date and sorts each table while retaining links and remove buttons', async () => {
  const { upcoming, past } = await load([
    event('later', '2026-12-01'),
    event('oldest', '2025-01-01'),
    event('today', '2026-10-16'),
    event('recent', '2026-10-15'),
    event('tomorrow', '2026-10-17')
  ]);
  const names = (body: Element) => body.children.map(row => row.children[0].children[0].textContent);
  expect(names(upcoming)).toEqual(['Event today', 'Event tomorrow', 'Event later']);
  expect(names(past)).toEqual(['Event recent', 'Event oldest']);
  for (const body of [upcoming, past]) {
    for (const row of body.children) {
      expect(row.children[0].children[0].href).toMatch(/^event\.html\?id=/);
      expect(row.children[1].textContent).toBe('London');
      expect(row.children[3].children[0].listeners.click).toBeDefined();
    }
  }
});

test('puts all eight existing event dates in Past on 16 October 2026', async () => {
  const dates = [
    '2026-10-13', '2026-10-06', '2026-06-26', '2026-06-23',
    '2026-04-29', '2026-03-16', '2026-03-02', '2025-12-05'
  ];
  const { upcoming, past, errors } = await load(
    dates.map((date, index) => event(String(index), date))
  );

  expect(upcoming.children).toHaveLength(1);
  expect(upcoming.children[0].children[0].textContent).toBe('No upcoming outreach events.');
  expect(past.children).toHaveLength(8);
     expect(past.children.map(row => row.children[2].textContent)).toEqual([
     '13/10/2026', '06/10/2026', '26/06/2026', '23/06/2026',
     '29/04/2026', '16/03/2026', '02/03/2026', '05/12/2025'
   ]);
  expect(errors).not.toHaveBeenCalled();
});

test.each([
  [[], 'No upcoming outreach events.', 'No past outreach events.'],
  [[event('past', '2026-10-15')], 'No upcoming outreach events.', ''],
  [[event('future', '2026-10-17')], '', 'No past outreach events.']
])('shows independent empty states for %j', async (events, upcomingMessage, pastMessage) => {
  const { upcoming, past } = await load(events);
  if (upcomingMessage) expect(upcoming.children[0].children[0].textContent).toBe(upcomingMessage);
  if (pastMessage) expect(past.children[0].children[0].textContent).toBe(pastMessage);
});

test.each(['', 'invalid', '2026-02-30'])('surfaces invalid dates (%s) in both tables', async date => {
  const { upcoming, past, errors } = await load([event('invalid', date)]);
  for (const body of [upcoming, past]) {
    expect(body.children[0].children[0].textContent).toBe('Unable to load outreach events.');
  }
  expect(errors).toHaveBeenCalled();
});

test('shows fetch failures in both tables', async () => {
  const { upcoming, past, errors } = await load([], false);
  for (const body of [upcoming, past]) {
    expect(body.children[0].children[0].textContent).toBe('Unable to load outreach events.');
  }
  expect(errors).toHaveBeenCalled();
});

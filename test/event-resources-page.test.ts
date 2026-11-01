import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(join(__dirname, '../outreach-hub/js/event.js'), 'utf8')
  .replace(/\nloadEvent\(\);\s*showResources\(\);\s*$/, '');

class Element {
  textContent = '';
  type = '';
  className = '';
  children: Element[] = [];
  setAttribute = jest.fn();
  addEventListener = jest.fn();
  appendChild(child: Element) { this.children.push(child); }
}

function setup({
  search = '?id=event%20%26%201',
  apiUrl = 'https://example.com/prod/?existing=value',
  response = { objects: [{ key: 'event & 1/<agenda>.txt', size: 42, url: 'https://bucket.example.com/agenda.txt?signature=test' }] },
  ok = true,
}: { search?: string; apiUrl?: string; response?: unknown; ok?: boolean } = {}) {
  const container = { replaceChildren: jest.fn() };
  const fetch = jest.fn().mockResolvedValue({
    ok, status: ok ? 200 : 500, json: async () => response,
  });
  const alert = jest.fn();
  const error = jest.fn();
  const open = jest.fn();
  const context = {
    URL, URLSearchParams, fetch, alert,
    console: { error },
    window: { location: { search }, EVENT_RESOURCES_API_URL: apiUrl, open },
    document: {
      getElementById: (id: string) => id === 'resources-container'
        ? container : { addEventListener: jest.fn() },
      createElement: () => new Element(),
    },
  };
  runInNewContext(source, context);
  return { fetch, alert, error, open, container, load: () => runInNewContext('showResources()', context) };
}

test('uses the configured API with an encoded folder prefix and renders the objects envelope as text', async () => {
  const page = setup();
  await page.load();
  expect(page.fetch).toHaveBeenCalledTimes(1);
  const url = new URL(page.fetch.mock.calls[0][0]);
  expect(url.pathname).toBe('/prod/');
  expect(url.searchParams.get('prefix')).toBe('event & 1/');
  expect(url.searchParams.get('existing')).toBe('value');
  expect(page.container.replaceChildren).toHaveBeenCalledWith(expect.objectContaining({
    textContent: '<agenda>.txt',
  }));
  expect(page.alert).not.toHaveBeenCalled();
});

test('opens the signed file URL in a new tab using the resource button', async () => {
  const page = setup();
  await page.load();
  const item = page.container.replaceChildren.mock.calls[0][0] as Element;
  const button = item.children[0];
  expect(button.textContent).toBe('Open file');
  expect(button.type).toBe('button');
  expect(button.setAttribute).toHaveBeenCalledWith('aria-label', 'Open <agenda>.txt in a new tab');
  expect(button.addEventListener.mock.calls[0][0]).toBe('click');
  expect(page.open).not.toHaveBeenCalled();
  button.addEventListener.mock.calls[0][1]();
  expect(page.open).toHaveBeenCalledWith(
    'https://bucket.example.com/agenda.txt?signature=test', '_blank', 'noopener,noreferrer',
  );
});

test.each(['agenda.txt', 'event-1/agenda.txt', 'events/event-1/agenda.txt'])(
  'shows only the file name for %s', async key => {
    const page = setup({
      response: { objects: [{ key, url: 'https://bucket.example.com/agenda.txt' }] },
    });
    await page.load();
    const item = page.container.replaceChildren.mock.calls[0][0] as Element;
    expect(item.textContent).toBe('agenda.txt');
    expect(item.children[0].setAttribute).toHaveBeenCalledWith('aria-label', 'Open agenda.txt in a new tab');
  },
);

test.each([undefined, 'javascript:alert(1)'])('reports missing or unsafe file URLs (%s)', async url => {
  const page = setup({ response: { objects: [{ key: 'agenda.txt', size: 42, url }] } });
  await page.load();
  expect(page.alert).toHaveBeenCalledWith('Invalid resource file URL.');
  expect(page.error).toHaveBeenCalled();
  expect(page.container.replaceChildren).not.toHaveBeenCalled();
  expect(page.open).not.toHaveBeenCalled();
});

test('clears the list when no resources exist', async () => {
  const page = setup({ response: { objects: [] } });
  await page.load();
  expect(page.container.replaceChildren).toHaveBeenCalledWith();
});

test.each([
  [{ apiUrl: '' }, 'The event resources API is not configured.'],
  [{ response: [] }, 'Invalid event resources response.'],
  [{ ok: false }, 'Failed to load resources: 500'],
])('reports resource loading errors %j', async (options, message) => {
  const page = setup(options);
  await page.load();
  expect(page.alert).toHaveBeenCalledWith(message);
  expect(page.error).toHaveBeenCalled();
  expect(page.container.replaceChildren).not.toHaveBeenCalled();
});

test('does not request resources without an event ID', async () => {
  const page = setup({ search: '' });
  await page.load();
  expect(page.fetch).not.toHaveBeenCalled();
  expect(page.alert).toHaveBeenCalledWith('No event was selected.');
});

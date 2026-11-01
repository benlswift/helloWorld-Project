import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(join(__dirname, '../outreach-hub/js/event.js'), 'utf8')
  .replace(/\nloadEvent\(\);\s*showResources\(\);\s*$/, '');

function setup({
  search = '?id=event%20%26%201',
  file = { name: 'agenda & notes.pdf', type: 'application/pdf' },
  apiUrl = 'https://example.com/prod/?existing=value',
  ok = true,
}: {
  search?: string;
  file?: { name: string; type: string } | null;
  apiUrl?: string;
  ok?: boolean;
} = {}) {
  const fetch = jest.fn().mockResolvedValue({ ok, status: ok ? 201 : 500 });
  const alert = jest.fn();
  const error = jest.fn();
  const preventDefault = jest.fn();
  const form = { addEventListener: jest.fn() };
  const context = {
    URL, URLSearchParams, fetch, alert,
    console: { error },
    window: { location: { search }, UPLOAD_RESOURCE_API_URL: apiUrl },
    document: {
      getElementById: (id: string) => id === 'resource-file' ? { files: file ? [file] : [] } : form,
    },
  };
  runInNewContext(source, context);
  const submit = form.addEventListener.mock.calls[0][1];
  return { fetch, alert, error, preventDefault, file, submit: () => submit({ preventDefault }) };
}

test('passes the event ID and file name as encoded query parameters with raw file contents', async () => {
  const page = setup();
  await page.submit();
  expect(page.preventDefault).toHaveBeenCalled();
  expect(page.fetch).toHaveBeenCalledTimes(1);
  const [url, options] = page.fetch.mock.calls[0];
  const params = new URL(url).searchParams;
  expect(params.get('prefix')).toBe('event & 1');
  expect(params.get('fileName')).toBe('agenda & notes.pdf');
  expect(params.get('existing')).toBe('value');
  expect(options.method).toBe('POST');
  expect(options.headers).toEqual({ 'Content-Type': 'application/pdf' });
  expect(options.body).toBe(page.file);
  expect(page.alert).toHaveBeenCalledWith('Resource uploaded successfully.');
});

test('defaults an unknown file type to application/octet-stream', async () => {
  const page = setup({ file: { name: 'data.bin', type: '' } });
  await page.submit();
  expect(page.fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/octet-stream');
});

test.each([
  [{ search: '' }, 'No event was selected.'],
  [{ file: null }, 'Please select a file to upload.'],
  [{ apiUrl: '' }, 'The resource upload API is not configured.'],
])('rejects missing upload requirements %j', async (options, message) => {
  const page = setup(options);
  await page.submit();
  expect(page.fetch).not.toHaveBeenCalled();
  expect(page.alert).toHaveBeenCalledWith(message);
});

test('logs and displays upload failures without showing success', async () => {
  const page = setup({ ok: false });
  await page.submit();
  expect(page.error).toHaveBeenCalled();
  expect(page.alert).toHaveBeenCalledTimes(1);
  expect(page.alert).toHaveBeenCalledWith('Upload failed: 500');
});

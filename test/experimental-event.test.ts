/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions":["node","node-addons"]}
 */
import { h } from 'preact';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { EventPage } from '../frontend-event/EventPage';
import { MAX_FILE_SIZE, uploadResource } from '../frontend-event/api';

const original = {
  id: 'event-1', Name: 'School visit', Location: 'London', Date: '2026-10-13',
  People: ['champion-1'],
};
const mockFetch = jest.fn();
let updateStatus = 200;
let uploadStatus = 201;
let resourcesStatus = 200;

beforeEach(() => {
  window.history.replaceState(null, '', '/experimental-event/index.html?id=event-1');
  window.OUTREACH_API_URL = 'https://api.example.com/events';
  window.OUTREACH_CHAMPIONS_API_URL = 'https://api.example.com/champions';
  window.UPDATE_OUTREACH_EVENT_API_URL = 'https://api.example.com/update';
  window.EVENT_RESOURCES_API_URL = 'https://api.example.com/resources';
  window.UPLOAD_RESOURCE_API_URL = 'https://api.example.com/upload';
  updateStatus = 200;
  uploadStatus = 201;
  resourcesStatus = 200;
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (input: string) => {
    const url = new URL(input);
    let status = 200;
    let data: unknown;
    switch (url.pathname) {
      case '/events': data = [original]; break;
      case '/champions':
        data = [{ id: 'champion-1', Name: 'Alice' }, { id: 'champion-2', Name: 'Bob' }];
        break;
      case '/resources':
        status = resourcesStatus;
        data = { objects: [{ key: 'event-1/agenda.txt', size: 42, url: 'https://bucket.example.com/agenda.txt?signature=test' }] };
        break;
      case '/update': status = updateStatus; break;
      case '/upload': status = uploadStatus; break;
      default: throw new Error(`Unexpected request: ${input}`);
    }
    return { ok: status < 400, status, json: async () => data };
  });
  global.fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test('loads event details, champion names and filename-only resources with secure open buttons', async () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  render(h(EventPage, {}));
  expect(await screen.findByRole('heading', { name: 'School visit' })).toBeTruthy();
  await screen.findByText('Alice');
  expect(await screen.findByText('agenda.txt')).toBeTruthy();
  expect(screen.queryByText('event-1/agenda.txt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open agenda.txt in a new tab' }));
  expect(open).toHaveBeenCalledWith('https://bucket.example.com/agenda.txt?signature=test', '_blank', 'noopener,noreferrer');
  const listRequest = mockFetch.mock.calls.find(([url]) => new URL(url).pathname === '/resources');
  expect(new URL(listRequest![0]).searchParams.get('prefix')).toBe('event-1/');
});

test('edits using typed state and preserves assignment concurrency protection', async () => {
  render(h(EventPage, {}));
  fireEvent.click(await screen.findByRole('button', { name: 'Update Event' }));
  const name = await screen.findByLabelText('Name');
  fireEvent.input(name, { target: { value: 'Updated visit' } });
  fireEvent.input(screen.getByLabelText('People'), { target: { value: 'Alice, Bob' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));
  await screen.findByText('Event updated successfully.');
  expect(screen.getByRole('heading', { name: 'Updated visit' })).toBeTruthy();
  const update = mockFetch.mock.calls.find(([url]) => new URL(url).pathname === '/update');
  expect(JSON.parse(update![1].body)).toEqual({
    ...original, Name: 'Updated visit', People: ['champion-1', 'champion-2'], ExpectedPeople: ['champion-1'],
  });
  expect(window.location.pathname).toBe('/experimental-event/index.html');
});

test('keeps edits visible and reports concurrency conflicts', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  updateStatus = 409;
  render(h(EventPage, {}));
  fireEvent.click(await screen.findByRole('button', { name: 'Update Event' }));
  await screen.findByLabelText('Name');
  fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));
  await screen.findByText('Event assignments changed. Reload the page before saving again.');
  expect(screen.getByLabelText('Name')).toBeTruthy();
  expect(screen.queryByText('Event updated successfully.')).toBeNull();
});

test('cancel restores view mode without updating the event', async () => {
  render(h(EventPage, {}));
  fireEvent.click(await screen.findByRole('button', { name: 'Update Event' }));
  fireEvent.input(await screen.findByLabelText('Name'), { target: { value: 'Unsaved change' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('heading', { name: 'School visit' })).toBeTruthy();
  expect(mockFetch.mock.calls.some(([url]) => new URL(url).pathname === '/update')).toBe(false);
});

test('uploads raw file bytes with event prefix and file name, then refreshes resources', async () => {
  render(h(EventPage, {}));
  await screen.findByRole('heading', { name: 'School visit' });
  const file = new File(['agenda'], 'agenda & notes.txt', { type: 'text/plain' });
  fireEvent.change(screen.getByLabelText('File (maximum 4 MiB)'), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole('button', { name: 'Upload' }).closest('form')!);
  await screen.findByText('Resource uploaded successfully.');
  const upload = mockFetch.mock.calls.find(([url]) => new URL(url).pathname === '/upload');
  expect(new URL(upload![0]).searchParams.get('prefix')).toBe('event-1');
  expect(new URL(upload![0]).searchParams.get('fileName')).toBe(file.name);
  expect(upload![1]).toEqual({ method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: file });
  await waitFor(() => expect(mockFetch.mock.calls.filter(([url]) => new URL(url).pathname === '/resources')).toHaveLength(2));
});

test('accepts exactly 4 MiB and rejects one byte over without an upload request', async () => {
  const accepted = new File([new Uint8Array(MAX_FILE_SIZE)], 'maximum.bin');
  await uploadResource('event-1', accepted);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  mockFetch.mockClear();
  await expect(uploadResource('event-1', new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'oversize.bin')))
    .rejects.toThrow('The file must be 4 MiB or smaller.');
  expect(mockFetch).not.toHaveBeenCalled();
});

test('shows upload errors and does not claim success', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  uploadStatus = 500;
  render(h(EventPage, {}));
  await screen.findByRole('heading', { name: 'School visit' });
  fireEvent.change(screen.getByLabelText('File (maximum 4 MiB)'), {
    target: { files: [new File(['agenda'], 'agenda.txt')] },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Upload' }).closest('form')!);
  await screen.findByText('Request failed: 500');
  expect(screen.queryByText('Resource uploaded successfully.')).toBeNull();
});

test('missing event ID makes no API requests', async () => {
  window.history.replaceState(null, '', '/experimental-event/index.html');
  render(h(EventPage, {}));
  expect(await screen.findByText('No event was selected.')).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Upload' }).hasAttribute('disabled')).toBe(true);
});

test('resource errors leave event details usable', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  resourcesStatus = 500;
  render(h(EventPage, {}));
  await screen.findByText('Request failed: 500');
  expect(await screen.findByRole('heading', { name: 'School visit' })).toBeTruthy();
});

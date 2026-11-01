export interface OutreachEvent {
  id: string;
  Name: string;
  Location: string;
  Date: string;
  People?: string[];
}

export interface Champion {
  id: string;
  Name: string;
}

export interface Resource {
  key: string;
  size: number;
  url: string;
}

declare global {
  interface Window {
    OUTREACH_API_URL?: string;
    OUTREACH_CHAMPIONS_API_URL?: string;
    UPDATE_OUTREACH_EVENT_API_URL?: string;
    EVENT_RESOURCES_API_URL?: string;
    UPLOAD_RESOURCE_API_URL?: string;
  }
}

export const MAX_FILE_SIZE = 4 * 1024 * 1024;

function endpoint(value: string | undefined, label: string) {
  if (!value) throw new Error(`The ${label} API is not configured.`);
  return new URL(value);
}

async function request(url: URL, options?: RequestInit) {
  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Event assignments changed. Reload the page before saving again.');
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export async function getEvent(id: string): Promise<OutreachEvent> {
  const data: unknown = await (await request(endpoint(window.OUTREACH_API_URL, 'outreach events'))).json();
  if (!Array.isArray(data)) throw new Error('Invalid events response.');
  const event: unknown = data.find(item => isRecord(item) && String(item.id) === id);
  if (!event) throw new Error('Event not found.');
  if (!isRecord(event) || typeof event.id !== 'string' || typeof event.Name !== 'string' ||
      typeof event.Location !== 'string' || typeof event.Date !== 'string' ||
      (event.People !== undefined && !isStrings(event.People))) {
    throw new Error('Invalid event response.');
  }
  return {
    id: event.id, Name: event.Name, Location: event.Location, Date: event.Date,
    People: event.People,
  };
}

export async function getChampions(): Promise<Champion[]> {
  const data: unknown = await (await request(endpoint(window.OUTREACH_CHAMPIONS_API_URL, 'outreach champions'))).json();
  if (!Array.isArray(data)) throw new Error('Invalid champions response.');
  return data.map((item: unknown) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.Name !== 'string') {
      throw new Error('Invalid champion response.');
    }
    return { id: item.id, Name: item.Name };
  });
}

export async function getResources(id: string): Promise<Resource[]> {
  const url = endpoint(window.EVENT_RESOURCES_API_URL, 'event resources');
  url.searchParams.set('prefix', `${id}/`);
  const data: unknown = await (await request(url)).json();
  if (!isRecord(data) || !Array.isArray(data.objects)) throw new Error('Invalid event resources response.');
  return data.objects.map((item: unknown) => {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.size !== 'number' ||
        typeof item.url !== 'string' || !['https:', 'http:'].includes(new URL(item.url).protocol)) {
      throw new Error('Invalid resource response.');
    }
    return { key: item.key, size: item.size, url: item.url };
  });
}

export async function saveEvent(event: OutreachEvent, names: string, expectedPeople: string[]) {
  const champions = await getChampions();
  const people = names.split(',').map(name => name.trim()).filter(Boolean).map(name => {
    const champion = champions.find(item => item.Name.toLowerCase() === name.toLowerCase());
    if (!champion) throw new Error(`No outreach champion matches "${name}".`);
    return champion.id;
  });
  await request(endpoint(window.UPDATE_OUTREACH_EVENT_API_URL, 'update outreach event'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, People: people, ExpectedPeople: expectedPeople }),
  });
  return { ...event, People: people };
}

export async function uploadResource(id: string, file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error('The file must be 4 MiB or smaller.');
  const url = endpoint(window.UPLOAD_RESOURCE_API_URL, 'resource upload');
  url.searchParams.set('prefix', id);
  url.searchParams.set('fileName', file.name);
  await request(url, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}

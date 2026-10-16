import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

class Element {
  textContent = '';
  children: Element[] = [];
  replaceChildren() { this.children = []; this.textContent = ''; }
  appendChild(child: Element) { this.children.push(child); }
}

const source = readFileSync(join(__dirname, '../outreach-hub/js/objectives.js'), 'utf8');
const html = readFileSync(join(__dirname, '../outreach-hub/objectives.html'), 'utf8');

async function load(data: unknown, ok = true, keyResults: unknown = [], keyResultsOk = true) {
  const elements = new Map<string, Element>();
  const pageIds = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  const fixtureIds = ['students', 'other'].flatMap(id => [`okr-name-${id}`, `okr-description-${id}`]);
  for (const id of [...pageIds, ...fixtureIds]) {
    const element = new Element();
    element.textContent = 'Loading...';
    elements.set(id, element);
  }
  const getElementById = (id: string) => elements.get(id) ?? null;
  const errors = jest.fn();
  const fetch = jest.fn(async (url: string) => {
    const success = url === '/objectives' ? ok : keyResultsOk;
    return { ok: success, status: success ? 200 : 500,
      json: async () => url === '/objectives' ? data : keyResults };
  });
  await runInNewContext(`${source}\nfetchObjectives();`, {
    window: { GET_OBJECTIVES_API_URL: '/objectives', GET_KEY_RESULTS_API_URL: '/key-results' },
    document: {
      getElementById,
      createElement: () => new Element(),
    },
    console: { error: errors },
    fetch,
  });
  return { elements, getElementById, errors, fetch };
}

test('renders every objective with only its matching key results', async () => {
  const { elements, errors, fetch } = await load([
    { id: 'students', Objective: 'Support students', description: 'Not used' },
    { id: 'other', Objective: 'Another objective' },
  ], true, [
    { id: 'kr1', ObjectiveID: 'students', Result: 'Five sessions' },
    { id: 'kr2', ObjectiveID: 'other', Result: 'Unrelated result' },
    { id: 'kr3', ObjectiveID: 'students', Result: 'A tour' },
  ]);
  expect(fetch).toHaveBeenCalledWith('/objectives');
  expect(fetch).toHaveBeenCalledWith('/key-results');
  expect(elements.get('okr-name-students')?.textContent).toBe('Support students');
  expect(elements.get('okr-description-students')?.children[0].children.map(item => item.textContent))
    .toEqual(['Five sessions', 'A tour']);
  expect(elements.get('okr-name-other')?.textContent).toBe('Another objective');
  expect(elements.get('okr-description-other')?.children[0].children.map(item => item.textContent))
    .toEqual(['Unrelated result']);
  expect(elements.get('okr-name-students')).not.toBe(elements.get('okr-description-students'));
  expect(errors).not.toHaveBeenCalled();
});

test('renders description points as text list items', async () => {
  const { elements } = await load([{ id: 'students', Objective: 'Support students' }], true, [
    { ObjectiveID: 'students', Result: 'Five sessions' },
    { ObjectiveID: 'students', Result: '<b>A tour</b>' },
  ]);
  expect(elements.get('okr-description-students')?.children[0].children.map(item => item.textContent))
    .toEqual(['Five sessions', '<b>A tour</b>']);
});

test('shows when no key results match the objective ID', async () => {
  const { elements } = await load([{ id: 'students', Objective: 'Support students' }],
    true, [{ ObjectiveID: 'other', Result: 'Unrelated result' }]);
  expect(elements.get('okr-name-students')?.textContent).toBe('Support students');
  expect(elements.get('okr-description-students')?.textContent).toBe('No key results found for this objective.');
});

test('does not render or request key results when no objectives are returned', async () => {
  const { elements, errors, fetch } = await load([]);
  expect(fetch).not.toHaveBeenCalledWith('/key-results');
  expect([...elements.values()].every(element => element.textContent === 'Loading...')).toBe(true);
  expect(errors).not.toHaveBeenCalled();
});

test.each([
  [[], false], [null, true], [[{}], true],
  [[{ Objective: 'Support students' }], true],
])('logs failed or invalid objective responses for %j (ok=%s)', async (data, ok) => {
  const { elements, errors } = await load(data, ok);
  expect([...elements.values()].every(element => element.textContent === 'Loading...')).toBe(true);
  expect(errors).toHaveBeenCalledWith('Failed to fetch objectives:', expect.objectContaining({ message: expect.any(String) }));
});

test.each([
  [[], false],
  [null, true],
  [[{ ObjectiveID: 'students', description: 'Wrong field' }], true],
])('surfaces failed or invalid key results (%j, ok=%s)', async (results, ok) => {
  const { elements, errors } = await load(
    [{ id: 'students', Objective: 'Support students' }], true, results, ok
  );
  expect(elements.get('okr-name-students')?.textContent).toBe('Loading...');
  expect(elements.get('okr-description-students')?.textContent).toBe('Loading...');
  expect(errors).toHaveBeenCalledWith('Failed to fetch objectives:', expect.objectContaining({ message: expect.any(String) }));
});

test('returns null for missing IDs rather than aliasing an existing element', async () => {
  const { getElementById, errors } = await load([
    { id: 'missing', Objective: 'No corresponding page section' },
  ]);
  expect(getElementById('okr-name')).toBeNull();
  expect(getElementById('okr-name-missing')).toBeNull();
  expect(getElementById('okr-description-missing')).toBeNull();
  expect(errors).toHaveBeenCalledWith('Failed to fetch objectives:', expect.objectContaining({ message: expect.any(String) }));
});

test('loads configuration before the objectives script in the page', () => {
  expect(html).toContain('src="config.js"');
  expect(html).toContain('src="js/objectives.js?v=3"');
  expect(html.indexOf('src="config.js"')).toBeLessThan(html.indexOf('src="js/objectives.js?v=3"'));
});

test('renders the deployed DynamoDB field casing and numeric-string relationship IDs', async () => {
  const { elements, errors } = await load([
    { id: '2', Objective: 'Support the partnership.' },
    { id: '1', Objective: 'Deliver meaningful support to students.' },
    { id: '3', Objective: 'Develop staff.' },
  ], true, [
    { id: '2', Result: 'Deliver tours / on site visits', ObjectiveID: '1' },
    { id: '1', Result: 'Participate in at least 5 insight sessions', ObjectiveID: '1' },
  ]);
  expect(elements.get('okr-name-1')?.textContent).toBe('Deliver meaningful support to students.');
  expect(elements.get('okr-description-1')?.children[0].children.map(item => item.textContent)).toEqual([
    'Deliver tours / on site visits', 'Participate in at least 5 insight sessions',
  ]);
  for (const [id, title] of [['2', 'Support the partnership.'], ['3', 'Develop staff.']]) {
    expect(elements.get(`okr-name-${id}`)?.textContent).toBe(title);
    expect(elements.get(`okr-description-${id}`)?.textContent).toBe('No key results found for this objective.');
  }
  expect(errors).not.toHaveBeenCalled();
});

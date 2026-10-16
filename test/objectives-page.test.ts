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

async function load(data: unknown, ok = true, keyResults: unknown = [], keyResultsOk = true) {
  const name = new Element();
  const description = new Element();
  const errors = jest.fn();
  const fetch = jest.fn(async (url: string) => {
    const success = url === '/objectives' ? ok : keyResultsOk;
    return { ok: success, status: success ? 200 : 500,
      json: async () => url === '/objectives' ? data : keyResults };
  });
  await runInNewContext(`${source}\nfetchObjectives();`, {
    window: { GET_OBJECTIVES_API_URL: '/objectives', GET_KEY_RESULTS_API_URL: '/key-results' },
    document: {
      getElementById: (id: string) => id === 'okr-name' ? name : description,
      createElement: () => new Element(),
    },
    console: { error: errors },
    fetch,
  });
  return { name, description, errors, fetch };
}

test('renders the first objective with only its matching key results', async () => {
  const { name, description, fetch } = await load([
    { id: 'students', Objective: 'Support students', description: 'Not used' },
    { id: 'other', Objective: 'Another objective' },
  ], true, [
    { id: 'kr1', ObjectiveID: 'students', Result: 'Five sessions' },
    { id: 'kr2', ObjectiveID: 'other', Result: 'Unrelated result' },
    { id: 'kr3', ObjectiveID: 'students', Result: 'A tour' },
  ]);
  expect(fetch).toHaveBeenCalledWith('/objectives');
  expect(fetch).toHaveBeenCalledWith('/key-results');
  expect(name.textContent).toBe('Support students');
  expect(description.children[0].children.map(item => item.textContent)).toEqual(['Five sessions', 'A tour']);
});

test('renders description points as text list items', async () => {
  const { description } = await load([{ id: 'students', Objective: 'Support students' }], true, [
    { ObjectiveID: 'students', Result: 'Five sessions' },
    { ObjectiveID: 'students', Result: '<b>A tour</b>' },
  ]);
  expect(description.children[0].children.map(item => item.textContent)).toEqual(['Five sessions', '<b>A tour</b>']);
});

test('shows when no key results match the objective ID', async () => {
  const { name, description } = await load([{ id: 'students', Objective: 'Support students' }],
    true, [{ ObjectiveID: 'other', Result: 'Unrelated result' }]);
  expect(name.textContent).toBe('Support students');
  expect(description.textContent).toBe('No key results found for this objective.');
});

test('shows an empty state', async () => {
  const { name, description } = await load([]);
  expect(name.textContent).toBe('No objectives found');
  expect(description.textContent).toBe('');
});

test.each([
  [[], false], [null, true], [[{}], true],
  [[{ Objective: 'Support students' }], true],
])('shows errors instead of leaving loading placeholders for %j (ok=%s)', async (data, ok) => {
  const { name, description, errors } = await load(data, ok);
  expect(name.textContent).toBe('Unable to load objectives.');
  expect(description.textContent).not.toBe('');
  expect(errors).toHaveBeenCalled();
});

test.each([
  [[], false],
  [null, true],
  [[{ ObjectiveID: 'students', description: 'Wrong field' }], true],
])('surfaces failed or invalid key results (%j, ok=%s)', async (results, ok) => {
  const { name, description, errors } = await load(
    [{ id: 'students', Objective: 'Support students' }], true, results, ok
  );
  expect(name.textContent).toBe('Unable to load objectives.');
  expect(description.textContent).not.toBe('');
  expect(errors).toHaveBeenCalled();
});

test('loads configuration before the objectives script in the page', () => {
  const html = readFileSync(join(__dirname, '../outreach-hub/objectives.html'), 'utf8');
  expect(html).toContain('src="config.js"');
  expect(html).toContain('src="js/objectives.js?v=3"');
  expect(html.indexOf('src="config.js"')).toBeLessThan(html.indexOf('src="js/objectives.js?v=3"'));
});

test('renders the deployed DynamoDB field casing and numeric-string relationship IDs', async () => {
  const { name, description, errors } = await load([
    { id: '1', Objective: 'Deliver meaningful support to students.' },
  ], true, [
    { id: '2', Result: 'Deliver tours / on site visits', ObjectiveID: '1' },
    { id: '1', Result: 'Participate in at least 5 insight sessions', ObjectiveID: '1' },
  ]);
  expect(name.textContent).toBe('Deliver meaningful support to students.');
  expect(description.children[0].children.map(item => item.textContent)).toEqual([
    'Deliver tours / on site visits', 'Participate in at least 5 insight sessions',
  ]);
  expect(errors).not.toHaveBeenCalled();
});

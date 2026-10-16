const championNameElement = document.getElementById('champion-name');
const championLocationElement = document.getElementById('champion-location');
const championRoleElement = document.getElementById('champion-role');
const championEmailElement = document.getElementById('champion-email');
const updateButton = document.getElementById('update-champion-button');
const championEventsList = document.getElementById('champion-events-list');
const eventSelect = document.getElementById('new-champion-event');
const addEventButton = document.getElementById('add-champion-event-button');
let loadedChampionName = '';

function showChampionError(message) {
  championNameElement.textContent = message;
  championLocationElement.textContent = '';
  championRoleElement.textContent = '';
  championEmailElement.textContent = '';
  updateButton.disabled = true;
  eventSelect.disabled = true;
  addEventButton.disabled = true;
  championEventsList.replaceChildren(buildEventListItem(message));
  showEventOptions([], 'Events unavailable.');
}

async function loadChampion() {
  const championId = new URLSearchParams(window.location.search).get('id');

  if (!championId) {
    showChampionError('No outreach champion was selected.');
    return;
  }

  try {
    const response = await fetch(window.OUTREACH_CHAMPIONS_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const champions = await response.json();
    const champion = champions.find((item) => String(item.id) === championId);

    if (!champion) {
      showChampionError('Outreach champion not found.');
      return;
    }

    championNameElement.textContent = champion.Name ?? '';
    championLocationElement.textContent = champion.Location ?? '';
    championRoleElement.textContent = champion.Role ?? '';
    championEmailElement.textContent = champion.Email ?? '';
    championEmailElement.href = `mailto:${champion.Email ?? ''}`;
    document.title = `${champion.Name ?? 'Outreach Champion'} | BBC Outreach Hub`;
    loadedChampionName = champion.Name ?? '';
    await loadChampionEvents(champion.id, champion.Name);
  } catch (error) {
    console.error(error);
    showChampionError('Unable to load outreach champion.');
  }
}

async function loadChampionEvents(championId, championName) {
  eventSelect.disabled = true;
  addEventButton.disabled = true;
  try {
    const response = await fetch(window.OUTREACH_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const events = await response.json();
    showEventOptions(events, events.length ? 'Select an event' : 'No events available.');
    eventSelect.disabled = !events.length;
    addEventButton.disabled = !events.length;
    const matchingEvents = events.filter((event) =>
      (event.People ?? []).some((personName) =>
        personName === championId || personName.trim().toLowerCase() === championName.trim().toLowerCase()
      )
    );

    if (!matchingEvents.length) {
      championEventsList.replaceChildren(buildEventListItem('No events found for this champion.'));
      return;
    }

    championEventsList.replaceChildren(...matchingEvents.map(buildEventListItem));
  } catch (error) {
    console.error(error);
    championEventsList.replaceChildren(buildEventListItem('Unable to load events.'));
    showEventOptions([], 'Unable to load events.');
  }
}

function showEventOptions(events, message) {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = message;
  eventSelect.replaceChildren(placeholder, ...events.map((event) => {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = `${event.Name ?? 'Untitled event'}${event.Date ? ` (${event.Date})` : ''}`;
    return option;
  }));
  eventSelect.value = '';
}

function buildEventListItem(event) {
  const item = document.createElement('li');

  if (typeof event === 'string') {
    item.textContent = event;
    return item;
  }

  const link = document.createElement('a');
  link.href = `event.html?id=${encodeURIComponent(event.id)}`;
  link.textContent = event.Name ?? 'Untitled event';
  item.appendChild(link);

  if (event.Date) {
    item.append(` (${event.Date})`);
  }

  return item;
}

function createInput(id, type, value) {
  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  input.value = value;
  return input;
}

function showChampionForm() {
  championNameElement.replaceWith(createInput('champion-name', 'text', championNameElement.textContent));
  championLocationElement.replaceWith(createInput('champion-location', 'text', championLocationElement.textContent));
  championRoleElement.replaceWith(createInput('champion-role', 'text', championRoleElement.textContent));
  championEmailElement.replaceWith(createInput('champion-email', 'email', championEmailElement.textContent));

  updateButton.textContent = 'Save Champion';
  updateButton.onclick = updateChampion;
}

async function addEventToChampion() {
  const championId = new URLSearchParams(window.location.search).get('id');
  const eventId = eventSelect.value;

  if (!eventId) {
    alert('Select an event.');
    return;
  }

  addEventButton.disabled = true;
  eventSelect.disabled = true;
  addEventButton.textContent = 'Adding...';
  try {
    const eventsResponse = await fetch(window.OUTREACH_API_URL);
    if (!eventsResponse.ok) {
      throw new Error(`Request failed: ${eventsResponse.status}`);
    }
    const events = await eventsResponse.json();
    const event = events.find((item) => String(item.id) === eventId);
    if (!event) {
      throw new Error('Selected event no longer exists.');
    }
    const people = event.People ?? [];
    if (people.some((person) => person === championId ||
        person.trim().toLowerCase() === loadedChampionName.trim().toLowerCase())) {
      alert('This champion is already assigned to the selected event.');
      return;
    }

    const response = await fetch(window.UPDATE_OUTREACH_EVENT_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        Name: event.Name,
        Location: event.Location,
        Date: event.Date,
        People: [...people, championId]
      })
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    await loadChampionEvents(championId, loadedChampionName);
  } catch (error) {
    console.error(error);
    alert('Failed to add event to champion.');
  } finally {
    addEventButton.textContent = 'Add Event';
    eventSelect.disabled = eventSelect.children.length <= 1;
    addEventButton.disabled = eventSelect.disabled;
  }
}

async function updateChampion() {
  const championId = new URLSearchParams(window.location.search).get('id');
  const name = document.getElementById('champion-name').value.trim();
  const location = document.getElementById('champion-location').value.trim();
  const role = document.getElementById('champion-role').value.trim();
  const email = document.getElementById('champion-email').value.trim();

  if (!name || !location || !role || !email) {
    alert('All fields are required.');
    return;
  }

  try {
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    const response = await fetch(window.UPDATE_OUTREACH_CHAMPION_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: championId, Name: name, Location: location, Role: role, Email: email })
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    window.location.href = `champion.html?id=${encodeURIComponent(championId)}`;
  } catch (error) {
    console.error(error);
    alert('Failed to update outreach champion.');
    updateButton.disabled = false;
    updateButton.textContent = 'Save Champion';
  }
}

updateButton.addEventListener('click', showChampionForm, { once: true });
document.getElementById('add-champion-event-button').addEventListener('click', addEventToChampion);
loadChampion();
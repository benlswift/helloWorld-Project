const championNameElement = document.getElementById('champion-name');
const championLocationElement = document.getElementById('champion-location');
const championRoleElement = document.getElementById('champion-role');
const championEmailElement = document.getElementById('champion-email');
const updateButton = document.getElementById('update-champion-button');
const championEventsList = document.getElementById('champion-events-list');

function showChampionError(message) {
  championNameElement.textContent = message;
  championLocationElement.textContent = '';
  championRoleElement.textContent = '';
  championEmailElement.textContent = '';
  updateButton.disabled = true;
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
    await loadChampionEvents(champion.id, champion.Name);
  } catch (error) {
    console.error(error);
    showChampionError('Unable to load outreach champion.');
  }
}

async function loadChampionEvents(championId, championName) {
  try {
    const response = await fetch(window.OUTREACH_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const events = await response.json();
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
  }
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
loadChampion();
async function loadOutreachChampions() {
  const tbody = document.querySelector('tbody');

  try {
    const response = await fetch(window.OUTREACH_CHAMPIONS_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const champions = await response.json();
    renderPeople(tbody, champions);
  } catch (err) {
    tbody.replaceChildren(buildMessageRow('Unable to load outreach champions.'));
    console.error(err);
  }
}

function renderPeople(tbody, champions) {
  if (!champions.length) {
    tbody.replaceChildren(buildMessageRow('No outreach champions found.'));
    return;
  }

  const rows = champions.map((champion) => {
    const row = document.createElement('tr');
    row.append(
      buildPersonCell(champion),
      buildCell(champion.Location),
      buildCell(champion.Role),
      buildEmailCell(champion.Email),
    );
    return row;
  });

  tbody.replaceChildren(...rows);
}

function buildPersonCell(champion) {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = `champion.html?id=${encodeURIComponent(champion.id)}`;
  link.textContent = champion.Name ?? '';
  cell.appendChild(link);
  return cell;
}

function buildCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
}

function buildEmailCell(email) {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = `mailto:${email ?? ''}`;
  link.textContent = email ?? '';
  cell.appendChild(link);
  return cell;
}

function buildMessageRow(message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.textContent = message;
  row.appendChild(cell);
  return row;
}

async function addOutreachChampion() {
  const nameInput = document.getElementById('champion-name');
  const locationInput = document.getElementById('champion-location');
  const roleInput = document.getElementById('champion-role');
  const emailInput = document.getElementById('champion-email');
  const button = document.getElementById('add-champion-button');

  const name = nameInput.value;
  const location = locationInput.value;
  const role = roleInput.value;
  const email = emailInput.value;

  if (!name || !location || !role || !email) {
    alert('All fields are required.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Adding...';

  try {
    const response = await fetch(window.ADD_OUTREACH_CHAMPION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Name: name, Location: location, Role: role, Email: email })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Request failed: ${response.status}${details ? ` - ${details}` : ''}`);
    }
  } catch (err) {
    console.error(err);
    alert(`Failed to add outreach champion: ${err.message}`);
    return;
  } finally {
    button.disabled = false;
    button.textContent = 'Add Outreach Champion';
  }

  nameInput.value = '';
  locationInput.value = '';
  roleInput.value = '';
  emailInput.value = '';
  await loadOutreachChampions();
}

async function updateChampion(championID, eventID) {
    const nameElement = document.getElementById('champion-name');
    const locationElement = document.getElementById('champion-location');
    const roleElement = document.getElementById('champion-role');
    const emailElement = document.getElementById('champion-email');

    const name = nameElement.value;
    const location = locationElement.value;
    const role = roleElement.value;
    const email = emailElement.value;
  const button = document.getElementById('update-champion-button');
  try {
    button.disabled = true;
    button.textContent = 'Updating...';
    const response = await fetch(window.UPDATE_OUTREACH_CHAMPION_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: championID, Name: name, Location: location, Role: role, Email: email })
      
    });
    window.location.href = `champion.html?id=${encodeURIComponent(championID)}`;

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update outreach champion.');
  } finally {
    button.disabled = false;
    button.textContent = 'Update Champion';
  }
}

async function filterChampions() {
  filterText = document.getElementById('filter-input').value.toLowerCase();
  const tableRows = document.querySelectorAll('table tbody tr');
  tableRows.forEach(row => {
    const cells = Array.from(row.cells);
    const matches = cells.some(cell => cell.textContent.toLowerCase().includes(filterText));
    row.style.display = matches ? '' : 'none';
  });
}

loadOutreachChampions();

document.getElementById('add-champion-button').addEventListener('click', addOutreachChampion);
document.getElementById('filter-input').addEventListener('input', filterChampions);
async function loadOutreachEvents() {
  const tbody = document.querySelector('tbody');

  try {
    const response = await fetch(window.OUTREACH_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const events = await response.json();
    renderEvents(tbody, events);
  } catch (err) {
    tbody.replaceChildren(buildMessageRow('Unable to load outreach events.'));
    console.error(err);
  }
}

function renderEvents(tbody, events) {
  if (!events.length) {
    tbody.replaceChildren(buildMessageRow('No outreach events found.'));
    return;
  }

  const rows = events.map((event) => {
    const row = document.createElement('tr');
    row.append(
      buildCell(event.Name),
      buildCell(event.Location),
      buildCell(event.Date),
      (() => {
        const cell = buildCell('X');
          cell.onmouseover = (event) => {
            cell.style.color = 'red';
        };
        cell.onmouseout = (event) => {
            cell.style.color = '';
        };
        cell.addEventListener('click', () => removeOutreachEvent(event.id));
        return cell;
      })()
    );
    return row;
  });

  tbody.replaceChildren(...rows);
}

function buildCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
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

async function addOutreachEvent() {
  const nameInput = document.getElementById('event-name');
  const locationInput = document.getElementById('event-location');
  const dateInput = document.getElementById('event-date');
  const button = document.getElementById('add-event-button');

  const name = nameInput.value;
  const location = locationInput.value;
  const date = dateInput.value;

  if (!name || !location || !date) {
    alert('All fields are required.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Adding...';

  try {
    const response = await fetch(window.ADD_OUTREACH_EVENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Name: name, Location: location, Date: date })
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    nameInput.value = '';
    locationInput.value = '';
    dateInput.value = '';
    await loadOutreachEvents();
  } catch (err) {
    console.error(err);
    alert('Failed to add outreach event.');
  } finally {
    button.disabled = false;
    button.textContent = 'Add Outreach Event';
  }
}

async function removeOutreachEvent(id) {
  try {
    alert('Removing Event');
    const response = await fetch(`${window.REMOVE_OUTREACH_EVENT_API_URL}?id=${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    await loadOutreachEvents();
  } catch (err) {
    console.error(err);
    alert('Failed to remove outreach event.');
  }
}

loadOutreachEvents();

document.getElementById('add-event-button').addEventListener('click', addOutreachEvent);

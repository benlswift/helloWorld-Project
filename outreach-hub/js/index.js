function formatDate(date) {
  const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
  const parsedDate = new Date(date);
  return parsedDate.toLocaleDateString('en-GB', options);
}

async function loadOutreachEvents() {
  const upcomingBody = document.getElementById('upcoming-events');
  const pastBody = document.getElementById('past-events');

  try {
    const response = await fetch(window.OUTREACH_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const events = await response.json();
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcoming = [];
    const past = [];

    for (const event of events) {
      if (typeof event.Date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.Date) ||
          !Number.isFinite(Date.parse(event.Date)) ||
          new Date(event.Date).toISOString().slice(0, 10) !== event.Date) {
        throw new Error(`Invalid date for outreach event: ${event.id}`);
      }
      (event.Date >= todayDate ? upcoming : past).push(event);
    }

    upcoming.sort((a, b) => a.Date.localeCompare(b.Date));
    past.sort((a, b) => b.Date.localeCompare(a.Date));
    renderEvents(upcomingBody, upcoming, 'No upcoming outreach events.');
    renderEvents(pastBody, past, 'No past outreach events.');
  } catch (err) {
    upcomingBody.replaceChildren(buildMessageRow('Unable to load outreach events.'));
    pastBody.replaceChildren(buildMessageRow('Unable to load outreach events.'));
    console.error(err);
  }
}

function renderEvents(tbody, events, emptyMessage) {
  if (!events.length) {
    tbody.replaceChildren(buildMessageRow(emptyMessage));
    return;
  }

  const rows = events.map((event) => {
    const row = document.createElement('tr');
    row.append(
      buildEventCell(event),
      buildCell(event.Location),
      buildCell(formatDate(event.Date)),
      (() => {
        const cell = document.createElement('td');
        const button = document.createElement('button');
        button.setAttribute('aria-label', `Remove outreach event: ${event.Name ?? ''}`);
        button.textContent = 'Remove';
        button.addEventListener('click', () => removeOutreachEvent(event.id, button));
        cell.appendChild(button);
        return cell;
      })()
    );
    return row;
  });

  tbody.replaceChildren(...rows);
}

function buildEventCell(event) {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = `event.html?id=${encodeURIComponent(event.id)}`;
  link.textContent = event.Name ?? '';
  cell.appendChild(link);
  return cell;
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

async function removeOutreachEvent(id, cell) {
  try {
    alert('Removing Event');
    cell.textContent = 'Removing...';
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

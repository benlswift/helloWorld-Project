const nameElement = document.getElementById('event-name');
const dateElement = document.getElementById('event-date');
const locationElement = document.getElementById('event-location');

function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZoneName: 'short' };
  const parsedDate = new Date(date);
  return parsedDate.toLocaleDateString('en-GB', options);
}

async function loadEvent() {
  const eventId = new URLSearchParams(window.location.search).get('id');

  if (!eventId) {
    showEventError(nameElement, dateElement, locationElement, 'No event was selected.');
    return;
  }

  try {
    const response = await fetch(window.OUTREACH_API_URL);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const events = await response.json();
    const event = events.find((item) => String(item.id) === eventId);

    if (!event) {
      showEventError(nameElement, dateElement, locationElement, 'Event not found.');
      return;
    }

    nameElement.textContent = event.Name ?? '';
    dateElement.textContent = event.Date ?? '';
    dateElement.dateTime = event.Date ?? '';
    locationElement.textContent = event.Location ?? '';
    document.title = `${event.Name ?? 'Event Details'}`;
  } catch (error) {
    console.error(error);
    showEventError(nameElement, dateElement, locationElement, 'Unable to load event.');
    document.getElementById('update-event-button').disabled = true;
  }
}

function showEventError(nameElement, dateElement, locationElement, message) {
  nameElement.textContent = message;
  dateElement.textContent = '';
  locationElement.textContent = '';
}

function updateForm(eventID) {
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'event-name';
  nameInput.value = nameElement.textContent;
  nameElement.replaceWith(nameInput);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.id = 'event-date';
  dateInput.value = dateElement.dateTime || dateElement.textContent;
  dateElement.replaceWith(dateInput);

  const locationInput = document.createElement('input');
  locationInput.type = 'text';
  locationInput.id = 'event-location';
  locationInput.value = locationElement.textContent;
  locationElement.replaceWith(locationInput);

  const button = document.getElementById('update-event-button');
  button.textContent = 'Save Event';
  button.onclick = () => updateEvent(eventID);
}

async function updateEvent(eventID) {
    const name = nameElement.value;
    const location = locationElement.value;
    const date = dateElement.value;

  const button = document.getElementById('update-event-button');
  try {
    button.disabled = true;
    button.textContent = 'Updating...';
    const response = await fetch(window.UPDATE_OUTREACH_EVENT_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: eventID, Name: name, Location: location, Date: date })
      
    });
    window.location.href = `event.html?id=${encodeURIComponent(eventID)}`;

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to update outreach event.');
  } finally {
    button.disabled = false;
    button.textContent = 'Update Event';
  }
}

loadEvent();

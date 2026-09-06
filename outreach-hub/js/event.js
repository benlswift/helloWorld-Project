async function loadEvent() {
  const eventId = new URLSearchParams(window.location.search).get('id');
  const nameElement = document.getElementById('event-name');
  const dateElement = document.getElementById('event-date');
  const locationElement = document.getElementById('event-location');

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
  }
}

function showEventError(nameElement, dateElement, locationElement, message) {
  nameElement.textContent = message;
  dateElement.textContent = '';
  locationElement.textContent = '';
}

loadEvent();

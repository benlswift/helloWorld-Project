const nameElement = document.getElementById('event-name');
const dateElement = document.getElementById('event-date');
const locationElement = document.getElementById('event-location');
const peopleElement = document.getElementById('event-people');
let eventPeople = [];

function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const parsedDate = new Date(date);
  return parsedDate.toLocaleDateString('en-GB', options);
}

async function loadEvent() {
  const eventId = new URLSearchParams(window.location.search).get('id');

  if (!eventId) {
    showEventError(nameElement, dateElement, locationElement, peopleElement, 'No event was selected.');
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
      showEventError(nameElement, dateElement, locationElement, peopleElement, 'Event not found.');
      return;
    }

    nameElement.textContent = event.Name ?? '';
    dateElement.textContent = formatDate(event.Date) ?? '';
    dateElement.dateTime = event.Date ?? '';
    locationElement.textContent = event.Location ?? '';
    eventPeople = event.People ?? [];
    displayEventPeople(eventPeople);
    document.title = `${event.Name ?? 'Event Details'}`;
  } catch (error) {
    console.error(error);
    showEventError(nameElement, dateElement, locationElement, peopleElement, 'Unable to load event.');
    document.getElementById('update-event-button').disabled = true;
  }
}

async function loadChampions() {
  const response = await fetch(window.OUTREACH_CHAMPIONS_API_URL);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function displayEventPeople(people) {
  peopleElement.textContent = 'Loading...';
  try {
    const champions = await loadChampions();
    const championNames = people.map((championId) => {
      const champion = champions.find((item) => item.id === championId);
      return champion?.Name ?? championId;
    });
    peopleElement.textContent = championNames.join(', ') || 'No outreach champions assigned.';
  } catch (error) {
    console.error(error);
    peopleElement.textContent = 'Failed to load people.';
  }
}

function showEventError(nameElement, dateElement, locationElement, peopleElement, message) {
  nameElement.textContent = message;
  dateElement.textContent = '';
  locationElement.textContent = '';
  peopleElement.textContent = '';
}

async function updateForm(eventID) {
  let champions;
  try {
    champions = await loadChampions();
  } catch (error) {
    console.error(error);
    alert('Unable to load outreach champions.');
    return;
  }

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

  const peopleInput = document.createElement('input');
  peopleInput.type = 'text';
  peopleInput.id = 'event-people';
  peopleInput.value = eventPeople.map((championId) => {
    const champion = champions.find((item) => item.id === championId || item.Name === championId);
    return champion?.Name ?? championId;
  }).join(', ');
  peopleElement.replaceWith(peopleInput);

  const button = document.getElementById('update-event-button');
  button.textContent = 'Save Event';
  button.onclick = () => updateEvent(eventID);
}

async function updateEvent(eventID) {
  const name = document.getElementById('event-name').value;
  const location = document.getElementById('event-location').value;
  const date = document.getElementById('event-date').value;
  const personNames = document.getElementById('event-people').value.split(',').map((personName) => personName.trim()).filter(Boolean);

  const button = document.getElementById('update-event-button');
  try {
    button.disabled = true;
    button.textContent = 'Updating...';
    const champions = await loadChampions();
    const people = personNames.map((personName) => {
      const champion = champions.find((item) => item.Name?.toLowerCase() === personName.toLowerCase());
      if (!champion) {
        throw new Error(`No outreach champion matches "${personName}".`);
      }
      return champion.id;
    });

    const response = await fetch(window.UPDATE_OUTREACH_EVENT_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: eventID, Name: name, Location: location, Date: date, People: people, ExpectedPeople: eventPeople })
      
    });
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error('Event assignments changed. Reload the page before saving again.');
      }
      throw new Error(`Request failed: ${response.status}`);
    }
    window.location.href = `event.html?id=${encodeURIComponent(eventID)}`;
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to update outreach event.');
  } finally {
    button.disabled = false;
    button.textContent = 'Update Event';
  }
}

function checkFileSize(file) {
  const maxFileSize = 4 * 1024 * 1024;

  if (file.size > maxFileSize) {
    alert('The file must be 4 MiB or smaller.');
    return false;
  }
  return true;
}

async function uploadResource(event) {
  event.preventDefault();
  const eventID = new URLSearchParams(window.location.search).get('id');
  if (!eventID) {
    alert('No event was selected.');
    return;
  }
  const fileInput = document.getElementById('resource-file');
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a file to upload.');
    return;
  }
  if (!checkFileSize(file)) {
    return;
  }

  try {
    if (!window.UPLOAD_RESOURCE_API_URL) {
      throw new Error('The resource upload API is not configured.');
    }
    const uploadUrl = new URL(window.UPLOAD_RESOURCE_API_URL);
    uploadUrl.searchParams.set('prefix', eventID);
    uploadUrl.searchParams.set('fileName', file.name);
    const response = await fetch(uploadUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    alert('Resource uploaded successfully.');
    await showResources();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to upload resource.');
  }
}

async function showResources(){
  const eventID = new URLSearchParams(window.location.search).get('id');
  if (!eventID) {
    alert('No event was selected.');
    return;
  }
  try {
    if (!window.EVENT_RESOURCES_API_URL) {
      throw new Error('The event resources API is not configured.');
    }
    const resourcesUrl = new URL(window.EVENT_RESOURCES_API_URL);
    resourcesUrl.searchParams.set('prefix', `${eventID}/`);
    const response = await fetch(resourcesUrl.toString());
    if (!response.ok) {
      throw new Error(`Failed to load resources: ${response.status}`);
    }
    const resources = await response.json();
    if (!Array.isArray(resources.objects)) {
      throw new Error('Invalid event resources response.');
    }
    const resourcesContainer = document.getElementById('resources-container');
    if (resourcesContainer) {
      const items = resources.objects.map(resource => {
        if (!resource.url || !['https:', 'http:'].includes(new URL(resource.url).protocol)) {
          throw new Error('Invalid resource file URL.');
        }
        const fileName = resource.key.slice(resource.key.lastIndexOf('/') + 1);
        const item = document.createElement('p');
        item.textContent = fileName;
        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.textContent = 'Open file';
        openButton.className = 'open-resource-button';
        openButton.setAttribute('aria-label', `Open ${fileName} in a new tab`);
        openButton.addEventListener('click', () => {
          window.open(resource.url, '_blank', 'noopener,noreferrer');
        });
        item.appendChild(openButton);
        return item;
      });
      resourcesContainer.replaceChildren(...items);
    }
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to load resources.');
  }
}

document.getElementById('upload-resource-form').addEventListener('submit', uploadResource);

loadEvent();
showResources();

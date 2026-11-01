import { useEffect, useState } from 'preact/hooks';
import {
  Champion, OutreachEvent, Resource, getChampions, getEvent, getResources, saveEvent, uploadResource,
} from './api';

function report(error: unknown, fallback: string) {
  console.error(error);
  return error instanceof Error ? error.message : fallback;
}

export function EventPage() {
  const id = new URLSearchParams(window.location.search).get('id');
  const [event, setEvent] = useState<OutreachEvent | null>(null);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [peopleError, setPeopleError] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourceError, setResourceError] = useState('');
  const [eventError, setEventError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<OutreachEvent | null>(null);
  const [names, setNames] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setEventError('No event was selected.');
      setResourcesLoading(false);
      return;
    }
    void getEvent(id).then(value => {
      if (active) {
        setEvent(value);
        document.title = value.Name || 'Event Details';
      }
    }).catch(error => {
      if (active) setEventError(report(error, 'Unable to load event.'));
    });
    void getChampions().then(value => {
      if (active) setChampions(value);
    }).catch(error => {
      if (active) setPeopleError(report(error, 'Unable to load outreach champions.'));
    });
    void getResources(id).then(value => {
      if (active) setResources(value);
    }).catch(error => {
      if (active) setResourceError(report(error, 'Failed to load resources.'));
    }).finally(() => {
      if (active) setResourcesLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  async function edit() {
    if (!event) return;
    setSaving(true);
    setActionError('');
    try {
      const available = await getChampions();
      setChampions(available);
      setPeopleError('');
      setNames((event.People || []).map(person =>
        available.find(champion => champion.id === person || champion.Name === person)?.Name || person,
      ).join(', '));
      setDraft({ ...event });
    } catch (error) {
      setActionError(report(error, 'Unable to load outreach champions.'));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!draft || !event) return;
    setSaving(true);
    setActionError('');
    setNotice('');
    try {
      setEvent(await saveEvent(draft, names, event.People || []));
      document.title = draft.Name || 'Event Details';
      setDraft(null);
      setNotice('Event updated successfully.');
    } catch (error) {
      setActionError(report(error, 'Failed to update outreach event.'));
    } finally {
      setSaving(false);
    }
  }

  async function upload() {
    if (!id || !event) return;
    setActionError('');
    setNotice('');
    if (!file) {
      setActionError('Please select a file to upload.');
      return;
    }
    setUploading(true);
    try {
      await uploadResource(id, file);
      setNotice('Resource uploaded successfully.');
      setResourcesLoading(true);
      try {
        setResources(await getResources(id));
        setResourceError('');
      } catch (error) {
        setResourceError(report(error, 'Failed to refresh resources.'));
      } finally {
        setResourcesLoading(false);
      }
    } catch (error) {
      setActionError(report(error, 'Failed to upload resource.'));
    } finally {
      setUploading(false);
    }
  }

  return <>
    <header class="site-header">
      <a href="../index.html"><img class="bbc-logo" src="../bbc-logo-white-rgb.png" alt="BBC Outreach Hub Logo" /></a>
      <h1>BBC Outreach Hub</h1>
      <h2>Browse and edit outreach event</h2>
      <a class="back-link" href="../index.html">Back</a>
    </header>
    <main class="event-page">
      <p>Experimental Preact/TypeScript page. <a href={`../event.html?id=${encodeURIComponent(id || '')}`}>Use the original page</a></p>
      {notice && <p role="status">{notice}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {eventError ? <p role="alert">{eventError}</p> : !event ? <p role="status">Loading event...</p> :
        <form onSubmit={e => { e.preventDefault(); void save(); }}>
          <section class="event-hero" aria-label="Event details">
            {draft ? <>
              <label for="event-name">Name</label>
              <input id="event-name" required disabled={saving} value={draft.Name}
                onInput={e => setDraft({ ...draft, Name: e.currentTarget.value })} />
            </> : <h1 id="event-name">{event.Name}</h1>}
            <div class="event-meta">
              <p><label class="meta-label" for={draft ? 'event-date' : undefined}>Date</label>
                {draft ? <input id="event-date" type="date" required disabled={saving} value={draft.Date}
                  onInput={e => setDraft({ ...draft, Date: e.currentTarget.value })} /> :
                  <time dateTime={event.Date}>{new Date(event.Date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</time>}
              </p>
              <p><label class="meta-label" for={draft ? 'event-location' : undefined}>Location</label>
                {draft ? <input id="event-location" required disabled={saving} value={draft.Location}
                  onInput={e => setDraft({ ...draft, Location: e.currentTarget.value })} /> : <span>{event.Location}</span>}
              </p>
              <p><label class="meta-label" for={draft ? 'event-people' : undefined}>People</label>
                {draft ? <input id="event-people" disabled={saving} value={names} onInput={e => setNames(e.currentTarget.value)} /> :
                  <span>{(event.People || []).map(person => champions.find(champion => champion.id === person)?.Name || person).join(', ') || 'No outreach champions assigned.'}</span>}
              </p>
              {peopleError && <p role="alert">{peopleError}</p>}
            </div>
          </section>
          {draft ? <>
            <button class="update-event-button" disabled={saving} type="submit">{saving ? 'Updating...' : 'Save Event'}</button>
            <button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button>
          </> : <button class="update-event-button" type="button" disabled={saving} onClick={() => void edit()}>
            {saving ? 'Loading...' : 'Update Event'}
          </button>}
        </form>}
      <section class="resources" aria-labelledby="resource-heading">
        <h2 id="resource-heading">Resource Manager</h2>
        {resourcesLoading && <p role="status">Loading resources...</p>}
        {resourceError && <p role="alert">{resourceError}</p>}
        <ul>{resources.map(resource => {
          const fileName = resource.key.slice(resource.key.lastIndexOf('/') + 1);
          return <li key={resource.key}>{fileName}
            <button type="button" class="open-resource-button" aria-label={`Open ${fileName} in a new tab`}
              onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}>Open file</button>
          </li>;
        })}</ul>
        <h3>Upload Resource</h3>
        <form onSubmit={e => { e.preventDefault(); void upload(); }}>
          <label for="resource-file">File (maximum 4 MiB)</label>
          <input id="resource-file" type="file" required disabled={!event || uploading}
            onChange={e => setFile(e.currentTarget.files?.[0] || null)} />
          <button type="submit" disabled={!event || uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>
      </section>
    </main>
  </>;
}

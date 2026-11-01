import { render } from 'preact';
import { EventPage } from './EventPage';

const root = document.getElementById('app');
if (!root) throw new Error('The event page root is missing.');
render(<EventPage />, root);

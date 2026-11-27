// A Drive share link's page (/apps/drive/share.html#…): opens what was shared, for anyone, without
// signing in to Sanga (see SharePage).
import { createRoot } from 'react-dom/client';
import SharePage from './SharePage';
import './drive.css';

createRoot(document.getElementById('root')!).render(<SharePage />);

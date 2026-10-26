import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initSettings } from './state/settings';
import { initPrivacy } from './lib/privacy';
import { App } from './App';

initSettings();
initPrivacy();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

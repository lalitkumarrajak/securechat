import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initSettings } from './state/settings';
import { App } from './App';

initSettings();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

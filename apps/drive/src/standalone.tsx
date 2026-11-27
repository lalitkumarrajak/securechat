// Drive on its own page (/apps/drive/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import DriveApp from './App';
import './drive.css';

void bootStandalone(DriveApp);

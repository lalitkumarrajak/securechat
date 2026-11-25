// Passwords on its own page (/apps/passwords/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import PasswordsApp from './App';
import './passwords.css';

void bootStandalone(PasswordsApp);

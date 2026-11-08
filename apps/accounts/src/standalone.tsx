// Accounts on its own page (/apps/accounts/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import AccountsApp from './App';
import './accounts.css';

void bootStandalone(AccountsApp);

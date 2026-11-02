// Split on its own page (/apps/split/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import SplitApp from './App';
// Its own styles only here: inside Sanga, the shell's stylesheet covers Split's classes too.
import './split.css';

void bootStandalone(SplitApp);

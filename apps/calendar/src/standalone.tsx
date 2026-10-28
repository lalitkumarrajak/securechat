// The calendar on its own page (/apps/calendar/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import CalendarApp from './App';
// Its own styles only here: inside Sanga, the shell's stylesheet covers the calendar's classes too
// (two copies of the utilities would fight).
import './calendar.css';

void bootStandalone(CalendarApp);

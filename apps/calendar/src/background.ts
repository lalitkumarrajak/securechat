// Run by Sanga when it starts (once you've used the calendar): keeps the calendar synced and the
// server's list of reminders current, so repeating events and fasts keep reminding you even if the
// Calendar tab isn't opened for weeks.
import { load, onChange, startCalendar, syncCalendar } from './model';
import { scheduleReminders } from './reminders';

let running = false;
export default async function background() {
  if (running) return;
  running = true;
  startCalendar();
  onChange(scheduleReminders);
  await load();
  await syncCalendar();
  scheduleReminders();
  setInterval(scheduleReminders, 6 * 3600e3); // the weeks move on
}

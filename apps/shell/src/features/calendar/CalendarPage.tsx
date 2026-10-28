// The Calendar tab. The calendar is a separate app (apps/calendar): the shell gives it the page
// above the tabs, and loads its code the first time it's opened.
import { go } from '../../lib/nav';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';

export function CalendarPage() {
  return (
    <section aria-label="Calendar" className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        <AppFrame id="calendar" name="the calendar" onClose={() => go('chat')} tab />
      </div>
      <AppTabs />
    </section>
  );
}

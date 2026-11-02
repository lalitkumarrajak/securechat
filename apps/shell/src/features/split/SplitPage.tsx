// The Split tab. Split is a separate app (apps/split): the shell gives it the page above the tabs,
// and loads its code the first time it's opened.
import { go } from '../../lib/nav';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';

export function SplitPage() {
  return (
    <section aria-label="Split" className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        <AppFrame id="split" name="Split" onClose={() => go('chat')} tab />
      </div>
      <AppTabs />
    </section>
  );
}

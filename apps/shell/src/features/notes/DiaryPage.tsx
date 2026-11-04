// The Diary, opened from the More page. The diary is a separate app (apps/notes): the shell gives it the page above the
// tabs, and loads its code the first time it's opened.
import { back, go } from '../../lib/nav';
import { useApp } from '../../state/app';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';
import { t } from '@sanga/i18n';

export function DiaryPage() {
  const chat = useApp((s) => s.notesChat);
  return (
    <section aria-label={t('Diary and notes')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Opened from More: Back returns to More. Opened for one chat ("Notes about this chat"): to that chat. */}
        <AppFrame key={chat ?? ''} id="notes" name={t('the diary')} onClose={chat === null ? back : () => go('chat')} params={chat === null ? {} : { chat }} />
      </div>
      <AppTabs />
    </section>
  );
}

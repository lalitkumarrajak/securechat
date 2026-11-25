// Passwords, opened from the More page. It's a separate app (apps/passwords): the shell gives it the
// page above the tabs, and loads its code the first time it's opened.
import { back } from '../../lib/nav';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';
import { t } from '@sanga/i18n';

export function PasswordsPage() {
  return (
    <section aria-label={t('Passwords')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col overflow-hidden bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        <AppFrame id="passwords" name={t('Passwords')} onClose={back} />
      </div>
      <AppTabs />
    </section>
  );
}

// Accounts, opened from the More page. It's a separate app (apps/accounts): the shell gives it the page
// above the tabs, and loads its code the first time it's opened. Another app (the Calendar's card bills)
// or Share → Sanga can open it with starting values; they're handed over once, here.
import { useEffect, useState } from 'react';
import { back } from '../../lib/nav';
import { getApp, setApp } from '../../state/app';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';
import { t } from '@sanga/i18n';

export function AccountsPage() {
  const [params] = useState(() => getApp().appParams.accounts ?? {});
  useEffect(() => { if (getApp().appParams.accounts) setApp({ appParams: { ...getApp().appParams, accounts: undefined } }); }, []);
  return (
    <section aria-label={t('Accounts')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col overflow-hidden bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        <AppFrame id="accounts" name={t('Accounts')} onClose={back} params={params} />
      </div>
      <AppTabs />
    </section>
  );
}

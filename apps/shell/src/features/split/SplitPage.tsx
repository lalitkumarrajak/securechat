// The Split tab. Split is a separate app (apps/split): the shell gives it the page above the tabs,
// and loads its code the first time it's opened. Another app can open it with starting values
// (sdk.open('split', …): the Calendar sends a card bill): they're handed over once, here.
import { useEffect, useState } from 'react';
import { go } from '../../lib/nav';
import { getApp, setApp } from '../../state/app';
import { AppFrame } from '../apps/AppFrame';
import { AppTabs } from '../nav/AppTabs';
import { t } from '@sanga/i18n';

export function SplitPage() {
  const [params] = useState(() => getApp().appParams.split ?? {});
  useEffect(() => { if (getApp().appParams.split) setApp({ appParams: { ...getApp().appParams, split: undefined } }); }, []);
  return (
    <section aria-label={t('Split')} className="mx-auto flex h-[var(--app-h,100dvh)] max-w-[1600px] flex-col overflow-hidden bg-bg md:border-x md:border-line">
      <div className="flex min-h-0 flex-1 flex-col">
        <AppFrame id="split" name={t('Split')} onClose={() => go('chat')} params={params} tab />
      </div>
      <AppTabs />
    </section>
  );
}

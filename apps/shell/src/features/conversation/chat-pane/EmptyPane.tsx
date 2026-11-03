import { Lock } from 'lucide-react';
import { useSettings } from '../../../state/settings';
import { t } from '@sanga/i18n';

export function EmptyPane() {
  const wallpaper = useSettings((s) => s.wallpaper);
  return (
    <div className={`wallpaper wp-${wallpaper} grid h-full place-items-center p-8`}>
      <div className="max-w-sm text-center">
        <img src="/logo.svg" alt="" className="mx-auto size-20 rounded-3xl opacity-90" />
        <h2 className="mt-5 text-2xl font-semibold">Sanga</h2>{/* i18n-ok */}
        <p className="mt-2 text-sm text-muted">{t('Pick a chat on the left, or add a friend to start a new one.')}</p>
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> {t('Your messages are end-to-end encrypted')}</p>
      </div>
    </div>
  );
}

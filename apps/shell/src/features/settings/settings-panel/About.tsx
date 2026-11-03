import { Section } from './Section';
import { t } from '@sanga/i18n';

export function About() {
  return (
    <Section className="px-5 py-6 text-center">
      <img src="/logo.svg" alt="" className="mx-auto size-16 rounded-2xl" />
      <h3 className="mt-3 text-xl font-semibold">Sanga</h3>{/* i18n-ok */}
      <p className="text-sm text-muted">{t('Version {v}', { v: '2.0' })}</p>
      <p className="mx-auto mt-4 max-w-xs text-sm text-muted">
        {t('Private messaging with friends. Messages are encrypted on your device with keys only you and your friend have.')}
      </p>
    </Section>
  );
}

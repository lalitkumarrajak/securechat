import { Check } from 'lucide-react';
import { LANGS, setLang, t, useLang } from '@sanga/i18n';
import { setApp } from '../../../state/app';
import { Section } from './Section';

/** Pick the language of everything in Sanga. What people write is never translated. */
export function Language() {
  const now = useLang();
  return (
    <>
      <Section>
        <div role="radiogroup" aria-label={t('Language')}>
          {LANGS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={now === l.id} lang={l.id}
              onClick={() => { setApp({ settingsPage: 'language' }); void setLang(l.id); }}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-hover">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.name}</span>
                {l.name !== l.english && <span className="block text-sm text-muted">{l.english}</span>}
              </span>
              {now === l.id && <Check className="size-5 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      </Section>
      <Section className="px-5 py-4"><p className="text-sm text-muted">{t('Messages, names and notes stay as they were written.')}</p></Section>
    </>
  );
}

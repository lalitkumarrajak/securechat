import { MessageSquare } from 'lucide-react';
import { setApp, useApp } from '../../../state/app';
import { setSettings, useSettings } from '../../../state/settings';
import { NavRow } from './NavRow';
import { Section } from './Section';
import { ToggleRow } from './ToggleRow';
import { t } from '@sanga/i18n';

export function Chats() {
  const enter = useSettings((s) => s.enterToSend);
  const archived = useApp((s) => s.chats.filter((c) => c.archived && c.ts).length);
  return (
    <Section>
      <ToggleRow label={t('Enter to send')} sub={t('Enter sends the message; Shift+Enter adds a new line.')} checked={enter} onChange={(v) => setSettings({ enterToSend: v })} />
      <NavRow icon={<MessageSquare />} label={t('Archived chats')} sub={t('{n} archived', { n: archived })} onClick={() => setApp({ panel: 'archived' })} />
    </Section>
  );
}

// The buttons on every login: copy the username, copy the password, open the site.
import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, UserRound } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { href } from './store';

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    // Older browsers, or no permission: the hidden-textarea way.
    const a = document.createElement('textarea');
    a.value = text; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select();
    const ok = document.execCommand('copy');
    a.remove();
    return ok;
  }
}

export function CopyButton({ kind, value, className }: { kind: 'username' | 'password'; value: string; className?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const id = setTimeout(() => setDone(false), 1500); return () => clearTimeout(id); }, [done]);
  const label = done ? t('Copied') : kind === 'username' ? t('Copy username') : t('Copy password');
  return (
    <IconButton label={label} className={cn(done && 'text-accent hover:text-accent', className)} onClick={async (e) => { e.stopPropagation(); if (await copy(value)) setDone(true); }}>
      {done ? <Check /> : kind === 'username' ? <UserRound /> : <KeyRound />}
    </IconButton>
  );
}

export function OpenButton({ url, className }: { url?: string; className?: string }) {
  const link = href(url);
  if (!link) return null;
  return (
    <IconButton label={t('Open site')} className={className} onClick={(e) => { e.stopPropagation(); window.open(link, '_blank', 'noopener,noreferrer'); }}>
      <ExternalLink />
    </IconButton>
  );
}

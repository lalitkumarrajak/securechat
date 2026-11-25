// The buttons on every login: copy the link, the username or the password, and open the site.
import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, Link2, UserRound } from 'lucide-react';
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

const COPY = { link: Link2, username: UserRound, password: KeyRound };

export function CopyButton({ kind, value, className, small }: { kind: 'link' | 'username' | 'password'; value: string; className?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const id = setTimeout(() => setDone(false), 1500); return () => clearTimeout(id); }, [done]);
  const label = done ? t('Copied') : kind === 'link' ? t('Copy link') : kind === 'username' ? t('Copy username') : t('Copy password');
  const Icon = done ? Check : COPY[kind];
  return (
    <IconButton label={label} size={small ? 'icon-sm' : 'icon'} className={cn(done && 'text-accent hover:text-accent', small && '[&_svg]:size-[1.1rem]', className)}
      onClick={async (e) => { e.stopPropagation(); if (await copy(value)) setDone(true); }}>
      <Icon />
    </IconButton>
  );
}

export function OpenButton({ url, className, small }: { url?: string; className?: string; small?: boolean }) {
  const link = href(url);
  if (!link) return null;
  return (
    <IconButton label={t('Open site')} size={small ? 'icon-sm' : 'icon'} className={cn(small && '[&_svg]:size-[1.1rem]', className)} onClick={(e) => { e.stopPropagation(); window.open(link, '_blank', 'noopener,noreferrer'); }}>
      <ExternalLink />
    </IconButton>
  );
}

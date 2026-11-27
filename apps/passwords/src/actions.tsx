// The buttons on every login: copy the link, the username or the password, and open the site.
// Sanga can't type into another site, so Open copies the password first: paste it there.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Check, ExternalLink, KeyRound, Link2, UserRound } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { href } from './store';

/** A short note at the bottom of Passwords ("Password copied — paste it on the site"). */
export const useNotice = create<{ text: string }>(() => ({ text: '' }));
let noticeTimer = 0;
const notice = (text: string) => {
  useNotice.setState({ text });
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => useNotice.setState({ text: '' }), 4000) as unknown as number;
};

/** Installed Sanga on Android opens links in a tab over Sanga; this opens Chrome itself instead. */
function outside(link: string) {
  const installed = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches;
  if (!installed || !/Android/i.test(navigator.userAgent)) return link;
  const u = new URL(link);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(link)};end`;
}

/** Copy the password (if there is one), then open the site in the browser. */
export async function openSite(url: string | undefined, password?: string) {
  const link = href(url);
  if (!link) return;
  const copied = !!password && await copy(password);
  const target = outside(link);
  if (target === link) window.open(link, '_blank', 'noopener,noreferrer');
  else location.href = target;
  if (copied) notice(t('Password copied. Paste it on the site.'));
}

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

export function OpenButton({ url, password, className, small }: { url?: string; password?: string; className?: string; small?: boolean }) {
  const link = href(url);
  if (!link) return null;
  return (
    <IconButton label={password ? t('Copy password and open site') : t('Open site')} size={small ? 'icon-sm' : 'icon'} className={cn(small && '[&_svg]:size-[1.1rem]', className)}
      onClick={(e) => { e.stopPropagation(); void openSite(url, password); }}>
      <ExternalLink />
    </IconButton>
  );
}

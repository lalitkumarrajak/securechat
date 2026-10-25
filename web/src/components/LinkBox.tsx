// A link to pass on: shown in full, with Copy and (where the device has one) the share sheet.
import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export function LinkBox({ url, title, text, onUse, dark, className }: {
  url: string; title: string; text: string;
  onUse?: () => void;  // called the first time the link is copied or shared
  dark?: boolean; className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    onUse?.();
    try { await navigator.clipboard.writeText(url); }
    catch { // older browsers: select the text so it can be copied by hand
      (document.getElementById('linkbox-' + url) as HTMLInputElement | null)?.select();
      return toast('Select the link and copy it');
    }
    setCopied(true);
    toast.success('Link copied', { description: 'Paste it anywhere: WhatsApp, SMS, email…' });
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    onUse?.();
    try { await navigator.share({ title, text, url }); }
    catch (e) { if ((e as Error).name !== 'AbortError') copy(); }
  }

  const btn = cn('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold',
    dark ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-accent text-accent-ink hover:opacity-90');
  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className={cn('flex items-center gap-2 rounded-full p-1 pl-4', dark ? 'bg-white/10' : 'bg-hover')}>
        <input id={'linkbox-' + url} readOnly value={url} aria-label="Invite link" onFocus={(e) => e.target.select()}
          className={cn('min-w-0 flex-1 truncate bg-transparent text-sm outline-none', dark ? 'text-white/85' : 'text-ink')} />
        <button type="button" onClick={copy} className={btn} aria-label="Copy link">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {canShare && (
        <button type="button" onClick={share} className={cn('flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold',
          dark ? 'border border-white/25 text-white hover:bg-white/10' : 'border border-line hover:bg-hover')}>
          <Share2 className="size-4" /> Share…
        </button>
      )}
    </div>
  );
}

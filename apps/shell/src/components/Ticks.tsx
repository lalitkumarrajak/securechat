import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

/** Message status: 🕓 sending, ✓ sent, ✓✓ delivered, blue ✓✓ read, ! failed. */
export function Ticks({ s, className }: { s: number; className?: string }) {
  const c = cn('size-4 shrink-0', className);
  if (s === -2) return <AlertCircle className={cn(c, 'text-danger')} aria-label="Not sent" />;
  if (s === -1) return <Clock className={cn(c, 'size-3.5 opacity-70')} aria-label="Sending" />;
  if (s === 0) return <Check className={cn(c, 'opacity-70')} aria-label="Sent" />;
  if (s === 1) return <CheckCheck className={cn(c, 'opacity-70')} aria-label="Delivered" />;
  return <CheckCheck className={cn(c, 'text-read')} aria-label="Read" />;
}

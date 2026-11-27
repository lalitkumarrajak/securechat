import { useEffect, useRef } from 'react';
import { cn } from '@sanga/ui/utils';

export function Media({ stream, mirror, fit, className }: { stream: MediaStream | null; mirror?: boolean; fit?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);
  // Back in Sanga: a phone may have paused it while away, which looked like a frozen call.
  useEffect(() => {
    const again = () => { const el = ref.current; if (document.visibilityState === 'visible' && el?.srcObject && el.paused) el.play().catch(() => {}); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('pageshow', again);
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('pageshow', again); };
  }, []);
  return <video ref={ref} autoPlay playsInline muted className={cn(fit ? 'bg-black object-contain' : 'object-cover', mirror && '-scale-x-100', className)} />;
}

import { useEffect, useRef } from 'react';
import { cn } from '@sanga/ui/utils';

export function Media({ stream, mirror, fit, className }: { stream: MediaStream | null; mirror?: boolean; fit?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    if (stream) ref.current.play().catch(() => {});
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cn(fit ? 'bg-black object-contain' : 'object-cover', mirror && '-scale-x-100', className)} />;
}

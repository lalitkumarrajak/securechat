import { useEffect, useRef } from 'react';

export function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
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
  return <audio ref={ref} autoPlay playsInline />;
}

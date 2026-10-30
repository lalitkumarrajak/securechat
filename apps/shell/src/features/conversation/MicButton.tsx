import { toast } from 'sonner';
import { Mic } from 'lucide-react';
import { sendTyping } from '../../lib/engine';
import { VoiceRecorder } from '../../lib/voice';
import { hold, voice } from './voiceHold';

export function MicButton({ peer, onStart }: { peer: string; onStart: () => void }) {
  async function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    voice.pressStart = performance.now();
    voice.pressX = e.clientX;
    hold.active = true;
    hold.cancelled = false;
    hold.released = false;
    // Released while the browser was still asking for the microphone: switch to "locked" mode.
    window.addEventListener('pointerup', () => { hold.released = true; }, { once: true });
    voice.recorder = new VoiceRecorder();
    try {
      await voice.recorder.start();
    } catch {
      voice.recorder = null;
      hold.active = false;
      toast.error('Microphone not available', { description: 'Allow microphone access for this site in your browser settings.' });
      return;
    }
    sendTyping(peer, true);
    onStart();
  }
  return (
    <button type="button" aria-label="Hold to record a voice message" onPointerDown={down}
      onContextMenu={(e) => e.preventDefault()}
      className="grid size-11 shrink-0 touch-none place-items-center rounded-full bg-accent text-white shadow-sm transition select-none active:scale-110">
      <Mic className="size-5" />
    </button>
  );
}

// Game sounds, synthesised so there's nothing to download. Off with the speaker button in a game.
import { useSettings } from '../../state/settings';

export type Sound = 'roll' | 'step' | 'capture' | 'home' | 'turn' | 'chat' | 'invite' | 'win' | 'out';

let ctx: AudioContext | null = null;

function tone(at: number, freq: number, dur: number, vol = 0.12, type: OscillatorType = 'sine', slideTo?: number) {
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx!.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

// A short burst of filtered noise: one dice knock.
function knock(at: number) {
  const len = Math.floor(ctx!.sampleRate * 0.04);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx!.createBufferSource();
  const f = ctx!.createBiquadFilter();
  const g = ctx!.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = 1800 + Math.random() * 1200;
  g.gain.value = 0.5;
  src.connect(f).connect(g).connect(ctx!.destination);
  src.start(at);
}

export function playSound(s: Sound) {
  if (!useSettings.getState().gameSound || document.visibilityState !== 'visible') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    switch (s) {
      case 'roll': for (let i = 0; i < 6; i++) knock(t + i * 0.07 + Math.random() * 0.03); break;
      case 'step': tone(t, 660, 0.06, 0.07, 'triangle'); break;
      case 'capture': tone(t, 520, 0.35, 0.14, 'sawtooth', 110); break;
      case 'home': [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.08, f, 0.18, 0.1)); break;
      case 'turn': tone(t, 880, 0.12, 0.1); tone(t + 0.1, 1175, 0.16, 0.1); break;
      case 'chat': tone(t, 1320, 0.08, 0.06); break;
      case 'invite': [784, 988, 1175].forEach((f, i) => tone(t + i * 0.1, f, 0.2, 0.1)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, 0.25, 0.1, 'triangle')); break;
      case 'out': tone(t, 300, 0.4, 0.1, 'triangle', 150); break;
    }
  } catch { /* audio not available */ }
}

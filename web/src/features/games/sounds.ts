// Game sounds, synthesised so there's nothing to download. Off with the speaker button in a game.
import { useSettings } from '../../state/settings';

export type Sound = 'roll' | 'step' | 'capture' | 'zip' | 'home' | 'turn' | 'chat' | 'invite' | 'win' | 'out'
  | 'card' | 'draw' | 'uno' | 'skip' | 'plus' | 'shuffle';

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

// A short burst of filtered noise: one dice knock, a wooden tap, a whoosh.
function noise(at: number, dur: number, freq: number, vol: number, q = 1, sweepTo?: number) {
  const len = Math.floor(ctx!.sampleRate * dur);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
  const src = ctx!.createBufferSource();
  const f = ctx!.createBiquadFilter();
  const g = ctx!.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx!.destination);
  src.start(at);
}
const knock = (at: number, freq = 1800 + Math.random() * 1600, vol = 0.45) => noise(at, 0.035, freq, vol, 2);

export function playSound(s: Sound) {
  if (!useSettings.getState().gameSound || document.visibilityState !== 'visible') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    switch (s) {
      // Dice shaken in the hand, then two clacks as they land.
      case 'roll': {
        let at = t;
        for (let i = 0; i < 11; i++) { knock(at); at += 0.045 + Math.random() * 0.035; }
        knock(at + 0.08, 1100, 0.9); tone(at + 0.08, 160, 0.09, 0.12, 'sine', 90);
        knock(at + 0.17, 1400, 0.6);
        break;
      }
      // A token hopping one square: a soft wooden "tock".
      case 'step': noise(t, 0.03, 2400, 0.35, 3); tone(t, 820, 0.07, 0.09, 'sine', 560); break;
      // Captured: a hit and a whoosh…
      case 'capture':
        tone(t, 140, 0.18, 0.22, 'sine', 60); noise(t, 0.05, 900, 0.8, 1);
        noise(t + 0.06, 0.45, 3500, 0.5, 0.8, 400); tone(t + 0.08, 700, 0.4, 0.08, 'sawtooth', 120);
        break;
      // …and the token zips back home.
      case 'zip': tone(t, 300, 0.9, 0.06, 'triangle', 1400); noise(t, 0.9, 800, 0.15, 1, 5000); break;
      case 'home': [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.08, f, 0.18, 0.1)); break;
      case 'turn': tone(t, 880, 0.12, 0.1); tone(t + 0.1, 1175, 0.16, 0.1); break;
      case 'chat': tone(t, 1320, 0.08, 0.06); break;
      case 'invite': [784, 988, 1175].forEach((f, i) => tone(t + i * 0.1, f, 0.2, 0.1)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, 0.25, 0.1, 'triangle')); break;
      case 'out': tone(t, 300, 0.4, 0.1, 'triangle', 150); break;
      // UNO
      case 'card': noise(t, 0.12, 4000, 0.45, 0.7, 1500); noise(t + 0.1, 0.03, 1500, 0.5, 2); break;   // swish and slap
      case 'draw': noise(t, 0.09, 6000, 0.25, 0.8, 2500); break;                                      // flick off the deck
      case 'uno': tone(t, 660, 0.16, 0.14, 'square'); tone(t + 0.16, 990, 0.3, 0.14, 'square'); break; // "U-NO!"
      case 'skip': tone(t, 900, 0.25, 0.1, 'triangle', 300); break;                                    // whoop
      case 'plus': tone(t, 220, 0.3, 0.16, 'sawtooth', 90); noise(t, 0.08, 600, 0.6, 1); break;        // heavy thud
      case 'shuffle': for (let i = 0; i < 14; i++) noise(t + i * 0.035, 0.03, 3500 + Math.random() * 2000, 0.25, 2); break;
    }
  } catch { /* audio not available */ }
}

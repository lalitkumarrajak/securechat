// Some quick emoji come with a sound, and a few with a voice too: heard by everyone in the game when one
// is sent on its own. Synthesised like the other game sounds; the voice is the device's own speech.
import { audioNow, noise, tone } from './sounds';

type Voice = { say: string; pitch?: number; rate?: number };

function speak({ say, pitch = 1, rate = 1 }: Voice) {
  try {
    const sp = window.speechSynthesis;
    if (!sp) return;
    sp.cancel(); // one at a time: a burst of emoji doesn't queue up a speech
    const u = new SpeechSynthesisUtterance(say);
    u.lang = 'en-US';
    u.pitch = pitch;
    u.rate = rate;
    u.volume = 0.9;
    sp.speak(u);
  } catch { /* no speech on this device */ }
}

const SOUNDS: Record<string, { fx?: (t: number) => void; voice?: Voice }> = {
  // Laughing: bouncing "ha"s, and a voice laughing along.
  '😂': { fx: (t) => [0, 0.16, 0.32, 0.48].forEach((d, i) => tone(t + d, 520 - i * 30, 0.12, 0.1, 'triangle', 380 - i * 30)), voice: { say: 'Ha ha ha ha!', pitch: 1.4, rate: 1.2 } }, // i18n-ok: a sound, not text
  '🤣': { fx: (t) => [0, 0.12, 0.24, 0.36, 0.48, 0.6].forEach((d, i) => tone(t + d, 600 - i * 25, 0.1, 0.1, 'triangle', 420)), voice: { say: 'Ha ha ha ha ha!', pitch: 1.7, rate: 1.4 } }, // i18n-ok: a sound, not text
  // A kiss: a quick smack and a rising chirp.
  '😘': { fx: (t) => { noise(t, 0.04, 2500, 0.6, 4); tone(t + 0.03, 900, 0.18, 0.08, 'sine', 1800); }, voice: { say: 'Mwah!', pitch: 1.5 } }, // i18n-ok: a sound, not text
  '😍': { fx: (t) => [659, 880, 1047].forEach((f, i) => tone(t + i * 0.1, f, 0.22, 0.08)) },
  '😎': { fx: (t) => { tone(t, 330, 0.12, 0.1, 'square'); tone(t + 0.14, 494, 0.25, 0.1, 'square'); }, voice: { say: 'Too cool!', pitch: 0.7, rate: 0.9 } }, // i18n-ok: a sound, not text
  // Angry: a low growl.
  '😡': { fx: (t) => { tone(t, 110, 0.6, 0.18, 'sawtooth', 80); noise(t, 0.6, 300, 0.4, 1); }, voice: { say: 'Grrr!', pitch: 0.3, rate: 0.8 } }, // i18n-ok: a sound, not text
  // Crying: a falling wail.
  '😭': { fx: (t) => { tone(t, 700, 0.5, 0.08, 'triangle', 420); tone(t + 0.5, 650, 0.6, 0.08, 'triangle', 350); }, voice: { say: 'Waaah!', pitch: 1.6, rate: 0.7 } }, // i18n-ok: a sound, not text
  // Scream: a shriek.
  '😱': { fx: (t) => tone(t, 900, 0.5, 0.08, 'sawtooth', 1600), voice: { say: 'Oh no!', pitch: 1.6, rate: 1.1 } }, // i18n-ok: a sound, not text
  '🤩': { fx: (t) => [784, 988, 1175, 1568].forEach((f, i) => tone(t + i * 0.07, f, 0.16, 0.07, 'triangle')), voice: { say: 'Wow!', pitch: 1.3 } }, // i18n-ok: a sound, not text
  '🔥': { fx: (t) => noise(t, 0.7, 500, 0.5, 0.7, 3000) },
  // Applause: lots of little claps.
  '👏': { fx: (t) => { for (let i = 0; i < 24; i++) noise(t + i * 0.045 + Math.random() * 0.03, 0.03, 1200 + Math.random() * 1800, 0.35, 1.5); } },
  '🎉': { fx: (t) => { noise(t, 0.06, 1500, 0.9, 1); tone(t + 0.05, 440, 0.5, 0.09, 'sawtooth', 660); }, voice: { say: 'Yay!', pitch: 1.5 } }, // i18n-ok: a sound, not text
  '👋': { voice: { say: 'Bye bye!', pitch: 1.3 } }, // i18n-ok: a sound, not text
  '😴': { fx: (t) => { noise(t, 0.9, 200, 0.5, 2, 120); noise(t + 1.1, 0.5, 2000, 0.15, 1); } },
  '🥱': { voice: { say: 'Boring!', pitch: 0.8, rate: 0.6 } }, // i18n-ok: a sound, not text
  // A drum roll and a cymbal: ba-dum-tss.
  '🥁': { fx: (t) => { tone(t, 180, 0.1, 0.25, 'sine', 90); tone(t + 0.15, 150, 0.12, 0.25, 'sine', 70); noise(t + 0.32, 0.5, 7000, 0.4, 0.5); } },
  '🐔': { fx: (t) => [0, 0.12, 0.24].forEach((d) => tone(t + d, 1100, 0.08, 0.08, 'square', 700)), voice: { say: 'Chicken!', pitch: 1.8, rate: 1.2 } }, // i18n-ok: a sound, not text
  '💩': { fx: (t) => { tone(t, 90, 0.45, 0.2, 'sawtooth', 60); noise(t, 0.45, 150, 0.6, 3); } },
  '🙏': { voice: { say: 'Please!', pitch: 1.1, rate: 0.9 } }, // i18n-ok: a sound, not text
  '😈': { fx: (t) => tone(t, 220, 0.6, 0.1, 'sawtooth', 110), voice: { say: 'Mwa ha ha!', pitch: 0.4, rate: 0.8 } }, // i18n-ok: a sound, not text
};

/** Plays the sound (and voice) for a chat line that is just one emoji that has one. Returns whether it did. */
export function playEmoji(text: string): boolean {
  const s = SOUNDS[text.trim()];
  if (!s) return false;
  const t = audioNow();
  if (t === null) return false;
  try { s.fx?.(t); } catch { /* audio not available */ }
  if (s.voice) speak(s.voice);
  return true;
}

export const hasSound = (e: string) => e in SOUNDS;

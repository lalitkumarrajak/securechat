// Things you can throw at another player, like Ludo King: the picture, what lands, and how it feels.
import { tk } from '@sanga/i18n';

export interface Tease { k: string; emoji: string; label: string /* English: show it with t(label) */; hit: string; shake: boolean }

export const TEASES: Tease[] = [
  { k: 'tomato', emoji: '🍅', label: tk('Tomato'), hit: '💥', shake: true },
  { k: 'egg', emoji: '🥚', label: tk('Egg'), hit: '🍳', shake: true },
  { k: 'banana', emoji: '🍌', label: tk('Slip!'), hit: '💫', shake: true },
  { k: 'bomb', emoji: '💣', label: tk('Boom'), hit: '💥', shake: true },
  { k: 'snow', emoji: '❄️', label: tk('Freeze'), hit: '🥶', shake: true },
  { k: 'fire', emoji: '🔥', label: tk('Burn'), hit: '🔥', shake: true },
  { k: 'clown', emoji: '🤡', label: tk('Clown'), hit: '🤡', shake: false },
  { k: 'turtle', emoji: '🐢', label: tk('So slow'), hit: '💤', shake: false },
  { k: 'rose', emoji: '🌹', label: tk('Rose'), hit: '💖', shake: false },
  { k: 'kiss', emoji: '💋', label: tk('Kiss'), hit: '😘', shake: false },
  { k: 'cake', emoji: '🎂', label: tk('Cake'), hit: '🎉', shake: false },
  { k: 'clap', emoji: '👏', label: tk('Well played'), hit: '✨', shake: false },
];

export const teaseOf = (k: string) => TEASES.find((t) => t.k === k);

// Things you can throw at another player, like Ludo King: the picture, what lands, and how it feels.
import { tk } from '@sanga/i18n';

export interface Tease { k: string; emoji: string; label: string /* English: show it with t(label) */; hit: string; shake: boolean }

export const TEASES: Tease[] = [
  { k: 'tomato', emoji: '🍅', label: tk('Tomato'), hit: '💥', shake: true },
  { k: 'egg', emoji: '🥚', label: tk('Egg'), hit: '🍳', shake: true },
  { k: 'pie', emoji: '🥧', label: tk('Pie face'), hit: '😵', shake: true },
  { k: 'slipper', emoji: '🩴', label: tk('Chappal!'), hit: '😵‍💫', shake: true },
  { k: 'bonk', emoji: '🔨', label: tk('Bonk'), hit: '🤕', shake: true },
  { k: 'splash', emoji: '💦', label: tk('Splash'), hit: '🌊', shake: true },
  { k: 'bomb', emoji: '💣', label: tk('Boom'), hit: '💥', shake: true },
  { k: 'snow', emoji: '❄️', label: tk('Freeze'), hit: '🥶', shake: true },
  { k: 'fire', emoji: '🔥', label: tk('Burn'), hit: '🔥', shake: true },
  { k: 'mosquito', emoji: '🦟', label: tk('Buzz buzz'), hit: '😖', shake: true },
  { k: 'alarm', emoji: '⏰', label: tk('Wake up!'), hit: '😴', shake: true },
  { k: 'chicken', emoji: '🐔', label: tk('Chicken!'), hit: '🐣', shake: false },
  { k: 'clown', emoji: '🤡', label: tk('Clown'), hit: '🤡', shake: false },
  { k: 'turtle', emoji: '🐢', label: tk('So slow'), hit: '💤', shake: false },
  { k: 'baby', emoji: '🍼', label: tk('Cry baby'), hit: '😭', shake: false },
  { k: 'lol', emoji: '🤣', label: tk('LOL'), hit: '😂', shake: false },
  { k: 'rose', emoji: '🌹', label: tk('Rose'), hit: '💖', shake: false },
  { k: 'cake', emoji: '🎂', label: tk('Cake'), hit: '🎉', shake: false },
  { k: 'clap', emoji: '👏', label: tk('Well played'), hit: '✨', shake: false },
  { k: 'crown', emoji: '👑', label: tk('Champion'), hit: '🏆', shake: false },
];

export const teaseOf = (k: string) => TEASES.find((t) => t.k === k);

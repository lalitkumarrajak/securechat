// Things you can throw at another player, like Ludo King: the picture, what lands, and how it feels.
export interface Tease { k: string; emoji: string; label: string; hit: string; shake: boolean }

export const TEASES: Tease[] = [
  { k: 'tomato', emoji: '🍅', label: 'Tomato', hit: '💥', shake: true },
  { k: 'egg', emoji: '🥚', label: 'Egg', hit: '🍳', shake: true },
  { k: 'banana', emoji: '🍌', label: 'Slip!', hit: '💫', shake: true },
  { k: 'bomb', emoji: '💣', label: 'Boom', hit: '💥', shake: true },
  { k: 'snow', emoji: '❄️', label: 'Freeze', hit: '🥶', shake: true },
  { k: 'fire', emoji: '🔥', label: 'Burn', hit: '🔥', shake: true },
  { k: 'clown', emoji: '🤡', label: 'Clown', hit: '🤡', shake: false },
  { k: 'turtle', emoji: '🐢', label: 'So slow', hit: '💤', shake: false },
  { k: 'rose', emoji: '🌹', label: 'Rose', hit: '💖', shake: false },
  { k: 'kiss', emoji: '💋', label: 'Kiss', hit: '😘', shake: false },
  { k: 'cake', emoji: '🎂', label: 'Cake', hit: '🎉', shake: false },
  { k: 'clap', emoji: '👏', label: 'Well played', hit: '✨', shake: false },
];

export const teaseOf = (k: string) => TEASES.find((t) => t.k === k);

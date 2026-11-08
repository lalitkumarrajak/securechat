import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'escape', order: 15, emoji: '🗝️', category: 'adventure',
  name: tk('Escape Room'),
  blurb: tk('Find clues, crack codes, get out'),
  steps: [
    tk('Tap things in the room to look at them. Some hide items for your bag.'),
    tk('Tap an item in your bag, then tap where to use it.'),
    tk('Tap one item, then another, to put them together.'),
    tk('Clues around the room give the codes for locks.'),
    tk('Stuck? Tap Hint for the next step. Your progress is kept.'),
  ],
  background: 'radial-gradient(120% 90% at 50% 30%, #3b2a4a 0%, #231a30 55%, #120c1a 100%)',
} satisfies SoloMeta as SoloMeta;

import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'merge', order: 13, emoji: '🥚', category: 'casual',
  name: tk('Monster Merge'),
  blurb: tk('Hatch, merge and collect cute monsters'),
  steps: [
    tk('Tap Summon to hatch an egg. It costs coins.'),
    tk('Drag a monster onto one just like it, or tap one then the other, to merge them into the next level.'),
    tk('Every monster from level 2 earns coins each second, even while you’re away.'),
    tk('Spend coins on more eggs, and fill your collection book up to level 12.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0 2px, transparent 2.5px) 0 0 / 34px 34px, radial-gradient(120% 90% at 50% 30%, #a855f7 0%, #7e22ce 45%, #4c1d95 85%, #2e1065 100%)',
} satisfies SoloMeta as SoloMeta;

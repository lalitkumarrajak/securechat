import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'nonogram', order: 8, emoji: '🖼️', category: 'brain',
  name: tk('Picture Cross'),
  blurb: tk('Number clues hide a picture'),
  steps: [
    tk('The numbers by each row and column are the runs of filled squares in it, in order.'),
    tk('A gap of at least one square sits between two runs.'),
    tk('Tap a square to fill it. Drag to fill several in a line.'),
    tk('Mark squares you know are empty with ✕: press and hold, or switch to Mark.'),
    tk('A clue fades when its line is right. Get them all to see the picture.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0 1.5px, transparent 2px) 0 0 / 26px 26px, radial-gradient(120% 90% at 50% 40%, #9a3412 0%, #7c2d12 45%, #431407 85%, #2a0c04 100%)',
} satisfies SoloMeta as SoloMeta;

import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'stack', order: 5, emoji: '🧱', category: 'arcade',
  name: tk('Stack Up'),
  blurb: tk('Build the tallest tower you can'),
  steps: [
    tk('A block slides back and forth above the tower.'),
    tk('Tap anywhere to drop it.'),
    tk('Whatever hangs over the edge is cut off, so the next block is smaller.'),
    tk('Drop it exactly on top to keep it whole. Do that a few times in a row and it grows back.'),
    tk('Miss the tower completely and the game is over. It gets faster as you climb.'),
  ],
  background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)',
} satisfies SoloMeta as SoloMeta;

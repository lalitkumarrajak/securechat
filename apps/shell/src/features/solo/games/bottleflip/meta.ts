import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'bottleflip', order: 6, emoji: '🍾', category: 'arcade',
  name: tk('Flip It'),
  blurb: tk('Flip the bottle onto the next table'),
  steps: [
    tk('Press and hold to charge the throw. Watch the meter beside the bottle.'),
    tk('Let go to flip the bottle towards the next table.'),
    tk('It has to land on the table, standing up.'),
    tk('Land in the middle for a perfect. Perfects in a row score more.'),
    tk('Too little or too much power and the bottle falls. Then the game is over.'),
  ],
  background: 'linear-gradient(180deg, #0f172a 0%, #1e3a5f 60%, #334e68 100%)',
} satisfies SoloMeta as SoloMeta;

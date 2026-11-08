import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'dotlink', order: 3, emoji: '🔗', category: 'puzzle',
  name: tk('Dot Link'),
  blurb: tk('Join the dots, fill the board'),
  steps: [
    tk('Drag from a dot to the other dot of the same colour, or tap square by square.'),
    tk('Paths can’t cross or share a square.'),
    tk('Drawing into another path cuts it back; press on a path to change it.'),
    tk('Finish when every pair is joined and every square is filled.'),
    tk('Stuck? A hint draws one path for you.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0 1.5px, transparent 2px) 0 0 / 26px 26px, radial-gradient(120% 90% at 50% 40%, #3730a3 0%, #312e81 45%, #1e1b4b 85%, #0f0a2e 100%)',
} satisfies SoloMeta as SoloMeta;

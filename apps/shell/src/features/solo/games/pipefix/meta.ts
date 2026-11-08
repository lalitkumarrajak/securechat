import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'pipefix', order: 9, emoji: '🚰', category: 'puzzle',
  name: tk('Pipe Fix'),
  blurb: tk('Turn the pipes, water every flower'),
  steps: [
    tk('Tap a pipe to turn it a quarter turn.'),
    tk('Water runs from the tap through pipes whose ends meet.'),
    tk('Get the water to every pipe, and every flower blooms.'),
    tk('Fewer taps is better. Stuck? A hint turns one pipe for you.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0 1.5px, transparent 2px) 0 0 / 28px 28px, radial-gradient(120% 90% at 50% 40%, #166534 0%, #14532d 45%, #052e16 85%, #021a0c 100%)',
} satisfies SoloMeta as SoloMeta;

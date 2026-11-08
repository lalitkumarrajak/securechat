import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'carout', order: 2, emoji: '🚗', category: 'puzzle',
  name: tk('Car Out'),
  blurb: tk('Slide the cars, free the red one'),
  steps: [
    tk('Cars only move along their length: forwards and backwards, never sideways.'),
    tk('Drag a car to slide it, or tap it and then tap a dot.'),
    tk('Clear a way so the red car can drive out of the gap on the right.'),
    tk('Fewer moves is better: each slide counts as one, however far.'),
    tk('Stuck? Undo, start again, or ask for a hint.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0 1.5px, transparent 2px) 0 0 / 28px 28px, radial-gradient(120% 90% at 50% 40%, #475569 0%, #334155 45%, #1e293b 85%, #0f172a 100%)',
} satisfies SoloMeta as SoloMeta;

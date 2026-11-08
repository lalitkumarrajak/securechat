import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'watersort', order: 1, emoji: '🧪', category: 'puzzle',
  name: tk('Colour Pour'),
  blurb: tk('Sort the colours into tubes'),
  steps: [
    tk('Tap a tube to pick it up, then tap another tube to pour into it.'),
    tk('You can only pour onto the same colour, or into an empty tube.'),
    tk('All the layers of the top colour pour together, as many as fit.'),
    tk('Finish when every tube holds just one colour.'),
    tk('Stuck? Undo, start the level again, or ask for a hint.'),
  ],
  background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 40%, #0e7490 0%, #155e75 45%, #083344 85%, #042f2e 100%)',
} satisfies SoloMeta as SoloMeta;

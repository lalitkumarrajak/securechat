import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'mixlab', order: 4, emoji: '⚗️', category: 'casual',
  name: tk('Mix Lab'),
  blurb: tk('Mix two things, discover a new one'),
  steps: [
    tk('You start with water, fire, earth and air.'),
    tk('Tap two things to mix them in the bowl. On a computer you can drag them there too.'),
    tk('A good mix makes something new, and it joins your list.'),
    tk('Stuck? Ask for a hint, or search your list.'),
    tk('Find all of them!'),
  ],
  background: 'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.10), transparent 40%), radial-gradient(120% 100% at 50% 20%, #0ea5e9 0%, #2563eb 40%, #1e3a8a 80%, #172554 100%)',
} satisfies SoloMeta as SoloMeta;

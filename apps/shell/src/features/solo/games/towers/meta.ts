import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'towers', order: 14, emoji: '🏰', category: 'strategy',
  name: tk('Tower Guard'),
  blurb: tk('Build towers, hold off the waves'),
  steps: [
    tk('Enemies march along the path in waves. Stop them before they reach the end.'),
    tk('Tap a spot beside the path and pick a tower: Dart, Cannon, Frost or Longshot.'),
    tk('Each kill earns coins. Spend them on more towers, or tap a tower to upgrade or sell it.'),
    tk('Tap Start wave when you’re ready. Every enemy that gets through costs lives.'),
    tk('Hold off all the waves to clear the map and unlock the next one.'),
  ],
  background: 'radial-gradient(120% 90% at 50% 30%, #1f3b2c 0%, #14281e 55%, #0a1510 100%)',
} satisfies SoloMeta as SoloMeta;

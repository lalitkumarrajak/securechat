import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'dartspin', order: 12, emoji: '🎯', category: 'arcade',
  name: tk('Dart Spin'),
  blurb: tk('Throw darts into a spinning wheel'),
  steps: [
    tk('The wheel spins. Tap anywhere to throw a dart into it.'),
    tk('Darts stay in the wheel and turn with it.'),
    tk('If your dart hits another dart, the game is over.'),
    tk('Throw all your darts to break the wheel and go on to the next one.'),
    tk('Hit the fruit on the rim for extra points. Every fifth wheel is a boss.'),
  ],
  background: 'radial-gradient(120% 90% at 50% 30%, #3b2f2a 0%, #1c1917 55%, #0c0a09 100%)',
} satisfies SoloMeta as SoloMeta;

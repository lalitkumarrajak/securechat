import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'metro', order: 10, emoji: '🚇', category: 'strategy',
  name: tk('Metro Lines'),
  blurb: tk('Link stations, keep the city moving'),
  steps: [
    tk('Drag from one station to another to build a line. A train starts running on it.'),
    tk('People wait at stations, each showing the shape of the station they want.'),
    tk('Trains pick them up and drop them off. Every trip home scores a point.'),
    tk('Drag a line’s round end to stretch it. Tap a line below to add a train or remove it.'),
    tk('Crossing the river takes a tunnel. Each week, pick a new line, train or tunnels.'),
    tk('If a station stays too crowded until its ring fills up, the game is over.'),
  ],
  background: 'radial-gradient(120% 90% at 50% 30%, #1e293b 0%, #0f172a 55%, #020617 100%)',
} satisfies SoloMeta as SoloMeta;

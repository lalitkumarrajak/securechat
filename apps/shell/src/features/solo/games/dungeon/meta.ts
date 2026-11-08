import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'dungeon', order: 7, emoji: '🗡️', category: 'cards',
  name: tk('Dungeon Deck'),
  blurb: tk('Fight your way down, card by card'),
  steps: [
    tk('Tap a card next to you (not corner to corner) to step onto it.'),
    tk('Monsters hurt you by their number. Your weapon blocks that much and wears down.'),
    tk('Potions heal, gold adds to your score, traps hurt even with a weapon.'),
    tk('Chests hide gold, a potion or a monster. Stairs take you deeper, where all is stronger.'),
    tk('The game ends at 0 health. Beat your best gold.'),
  ],
  background: 'radial-gradient(circle at 50% 20%, rgba(251,191,36,0.10), transparent 55%), radial-gradient(120% 100% at 50% 30%, #3b2f4a 0%, #261c33 50%, #140e1c 100%)',
} satisfies SoloMeta as SoloMeta;

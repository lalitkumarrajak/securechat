import { tk } from '@sanga/i18n';
import type { SoloMeta } from '../../kit';

export default {
  id: 'spider', order: 11, emoji: '🕷️', category: 'cards',
  name: tk('Spider Solitaire'),
  blurb: tk('Two decks, ten columns, eight runs'),
  steps: [
    tk('Put a card on any card one higher, like a 7 on an 8.'),
    tk('A run of the same suit going down moves together.'),
    tk('Tap a card to send it where it fits best, or drag it.'),
    tk('Stuck? Tap the stock to deal a card onto every column. No column can be empty.'),
    tk('Build King down to Ace in one suit and it leaves the table. Clear all eight to win.'),
  ],
  background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(120% 100% at 50% 30%, #15803d 0%, #166534 45%, #14532d 80%, #052e16 100%)',
} satisfies SoloMeta as SoloMeta;

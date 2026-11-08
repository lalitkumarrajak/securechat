// Escape Room: three rooms (study, kitchen, lab), each a chain of puzzles. Tap things to look and pick
// up, use an item on a thing, put two items together, enter codes from clues. Pure functions: each
// returns the next state and what to say (English, shown through t()). See logic.test.ts.
import { tk } from '@sanga/i18n';

export type Item = 'smallKey' | 'torchEmpty' | 'batteries' | 'torch' | 'ice' | 'brassKey' | 'spoon' | 'note' | 'cardA' | 'cardB' | 'keycard' | 'fuse';
export interface Escape { room: number; inv: Item[]; flags: string[]; out: boolean }
export type View = { kind: 'code'; lock: string; digits: number } | { kind: 'knobs' };
export interface Result { s: Escape; msg: string; view?: View; ok?: boolean }

export const ROOMS = [tk('Study'), tk('Kitchen'), tk('Lab')];
export const SPOTS: string[][] = [
  ['bookshelf', 'painting', 'clock', 'desk', 'lamp', 'rug', 'door'],
  ['fridge', 'recipe', 'stove', 'shelf', 'pantry', 'sink', 'table', 'door'],
  ['whiteboard', 'bottles', 'locker', 'fuses', 'coat', 'computer', 'bin', 'door'],
];
export const SPOT_NAMES: Record<string, string> = {
  bookshelf: tk('Bookshelf'), painting: tk('Painting'), clock: tk('Clock'), desk: tk('Desk drawer'), lamp: tk('Lamp'), rug: tk('Rug'), door: tk('Door'),
  fridge: tk('Fridge'), recipe: tk('Recipe card'), stove: tk('Stove'), shelf: tk('Shelf'), pantry: tk('Pantry'), sink: tk('Sink'), table: tk('Table'),
  whiteboard: tk('Whiteboard'), bottles: tk('Bottles'), locker: tk('Locker'), fuses: tk('Fuse box'), coat: tk('Lab coat'), computer: tk('Computer'), bin: tk('Bin'),
};
export const ITEMS: Record<Item, { name: string; about: string; icon: string }> = {
  smallKey: { name: tk('Small key'), about: tk('A tiny brass key.'), icon: '🔑' },
  torchEmpty: { name: tk('Torch with no batteries'), about: tk('A torch. It needs batteries.'), icon: '🔦' },
  batteries: { name: tk('Batteries'), about: tk('Two batteries.'), icon: '🔋' },
  torch: { name: tk('Torch'), about: tk('A working torch.'), icon: '🔦' },
  ice: { name: tk('Block of ice'), about: tk('A key, frozen inside a block of ice.'), icon: '🧊' },
  brassKey: { name: tk('Brass key'), about: tk('A big brass key, still cold.'), icon: '🗝️' },
  spoon: { name: tk('Spoon'), about: tk('A strong metal spoon.'), icon: '🥄' },
  note: { name: tk('Note'), about: tk('The note says: “Plates, then cups, then jars.”'), icon: '📝' },
  cardA: { name: tk('Half a keycard'), about: tk('The top half of a keycard.'), icon: '💳' },
  cardB: { name: tk('Other half of a keycard'), about: tk('The bottom half of a keycard.'), icon: '💳' },
  keycard: { name: tk('Keycard'), about: tk('A keycard, taped together.'), icon: '💳' },
  fuse: { name: tk('Fuse'), about: tk('A glass fuse.'), icon: '🔌' },
};
/** The codes (from clues in each room), and the stove's knobs. */
export const CODES: Record<string, string> = { study: '4781', kitchen: '352', computer: '6929' };
export const KNOBS = [true, false, true, true];

export const fresh = (room = 0): Escape => ({ room, inv: [], flags: [], out: false });
export const has = (s: Escape, f: string) => s.flags.includes(f);
const with_ = (s: Escape, { flag, add, drop }: { flag?: string; add?: Item; drop?: Item[] }): Escape => ({
  ...s,
  flags: flag && !has(s, flag) ? [...s.flags, flag] : s.flags,
  inv: [...s.inv.filter((i) => !drop?.includes(i)), ...(add ? [add] : [])],
});
const say = (s: Escape, msg: string, view?: View): Result => ({ s, msg, view });

/** Tap something in the room (nothing in hand). */
export function tap(s: Escape, spot: string): Result {
  if (s.out) return say(s, tk('The way out is open.'));
  const k = `${s.room}:${spot}`;
  switch (k) {
    // the study
    case '0:rug': return has(s, 'rug') ? say(s, tk('Just floorboards under the rug.')) : say(with_(s, { flag: 'rug', add: 'smallKey' }), tk('You lift the rug. A small key!'));
    case '0:desk': return say(s, has(s, 'drawer') ? tk('The drawer is empty now.') : tk('The drawer is locked. It has a tiny keyhole.'));
    case '0:clock': return has(s, 'clock') ? say(s, tk('The clock has stopped at ten past four.'))
      : say(with_(s, { flag: 'clock', add: 'batteries' }), tk('The clock has stopped. In its back: two batteries!'));
    case '0:bookshelf': return say(s, has(s, 'lit') ? tk('Behind the books, it says: “The painter’s year, backwards.”') : tk('Something is written behind the books, but it’s too dark to read.'));
    case '0:painting': return say(with_(s, { flag: 'painting' }), tk('A ship at sea, signed “Rao, 1874”.'));
    case '0:lamp': return say(s, tk('A desk lamp. It doesn’t reach the shelf.'));
    case '0:door': return say(s, tk('The door has a keypad. It wants 4 numbers.'), { kind: 'code', lock: 'study', digits: 4 });
    // the kitchen
    case '1:fridge': return has(s, 'fridge') ? say(s, tk('Just milk and leftovers.'))
      : say(with_(s, { flag: 'fridge', add: 'ice' }), tk('In the freezer: a block of ice with a key frozen inside!'));
    case '1:recipe': return say(with_(s, { flag: 'recipe' }), tk('A recipe card. “To light the stove: knobs on, off, on, on.”'));
    case '1:stove': return has(s, 'lit') ? say(s, tk('The stove is burning nicely.')) : say(s, tk('The stove has four knobs.'), { kind: 'knobs' });
    case '1:shelf': return say(with_(s, { flag: 'shelf' }), tk('On the shelf: 3 plates, 5 cups and 2 jars.'));
    case '1:pantry': return say(s, has(s, 'pantry') ? tk('Tins of beans and jars of pickle.') : tk('The pantry is locked with a big keyhole.'));
    case '1:sink': return say(s, tk('A dripping tap. Nothing else.'));
    case '1:table': return say(s, has(s, 'drawer') ? tk('The hidden drawer is empty now.') : tk('There’s a thin gap under the table top: a hidden drawer, stuck shut.'));
    case '1:door': return say(s, tk('A padlock with 3 numbers.'), { kind: 'code', lock: 'kitchen', digits: 3 });
    // the lab
    case '2:bin': return has(s, 'bin') ? say(s, tk('Only scrap paper.')) : say(with_(s, { flag: 'bin', add: 'cardA' }), tk('In the bin: half a keycard.'));
    case '2:coat': return has(s, 'coat') ? say(s, tk('The pockets are empty.')) : say(with_(s, { flag: 'coat', add: 'cardB' }), tk('In the coat’s pocket: the other half of a keycard.'));
    case '2:locker': return say(s, has(s, 'locker') ? tk('The locker is empty now.') : tk('A locker with a card reader.'));
    case '2:fuses': return say(s, has(s, 'power') ? tk('The power is on.') : tk('The fuse box has an empty slot.'));
    case '2:whiteboard': return say(with_(s, { flag: 'board' }), tk('On the whiteboard: GREEN, BLUE, RED, BLUE.'));
    case '2:bottles': return say(with_(s, { flag: 'bottles' }), tk('Three bottles: red marked 2, green marked 6, blue marked 9.'));
    case '2:computer': return has(s, 'power') ? say(s, tk('The computer asks for a 4-number code.'), { kind: 'code', lock: 'computer', digits: 4 }) : say(s, tk('The computer has no power.'));
    case '2:door': return has(s, 'unlocked') ? { s: { ...s, out: true }, msg: tk('You step out into the fresh air!'), ok: true } : say(s, tk('The door is sealed. The computer controls it.'));
  }
  return say(s, tk('Nothing there.'));
}

/** Use an item from the bag on something in the room. */
export function use(s: Escape, item: Item, spot: string): Result {
  if (!s.inv.includes(item)) return say(s, tk('That doesn’t work here.'));
  switch (`${s.room}:${item}:${spot}`) {
    case '0:smallKey:desk': return { s: with_(s, { flag: 'drawer', drop: ['smallKey'], add: 'torchEmpty' }), msg: tk('The drawer opens. Inside: a torch with no batteries.'), ok: true };
    case '0:torch:bookshelf': return { s: with_(s, { flag: 'lit' }), msg: tk('Behind the books, it says: “The painter’s year, backwards.”'), ok: true };
    case '1:ice:stove':
      return has(s, 'lit') ? { s: with_(s, { flag: 'melted', drop: ['ice'], add: 'brassKey' }), msg: tk('The ice melts away. A brass key!'), ok: true } : say(s, tk('The stove is cold. Light it first.'));
    case '1:brassKey:pantry': return { s: with_(s, { flag: 'pantry', drop: ['brassKey'], add: 'spoon' }), msg: tk('The pantry opens. Among the tins: a strong spoon.'), ok: true };
    case '1:spoon:table': return { s: with_(s, { flag: 'drawer', drop: ['spoon'], add: 'note' }), msg: tk('You prise the hidden drawer open. There’s a note inside!'), ok: true };
    case '2:keycard:locker': return { s: with_(s, { flag: 'locker', drop: ['keycard'], add: 'fuse' }), msg: tk('Beep! The locker opens. Inside: a fuse.'), ok: true };
    case '2:fuse:fuses': return { s: with_(s, { flag: 'power', drop: ['fuse'] }), msg: tk('The lights flicker on. The computer starts up!'), ok: true };
  }
  return say(s, tk('That doesn’t work here.'));
}

/** Put two items from the bag together. */
export function combine(s: Escape, a: Item, b: Item): Result {
  const pair = [a, b].sort().join('+');
  if (!s.inv.includes(a) || !s.inv.includes(b)) return say(s, tk('Those don’t go together.'));
  if (pair === 'batteries+torchEmpty') return { s: with_(s, { drop: [a, b], add: 'torch' }), msg: tk('You put the batteries in. The torch works!'), ok: true };
  if (pair === 'cardA+cardB') return { s: with_(s, { drop: [a, b], add: 'keycard' }), msg: tk('You tape the two halves together: a keycard!'), ok: true };
  return say(s, tk('Those don’t go together.'));
}

/** Try a code on a lock. */
export function enter(s: Escape, lock: string, code: string): Result {
  if (CODES[lock] !== code) return say(s, tk('Wrong code. Nothing happens.'));
  if (lock === 'computer') return { s: with_(s, { flag: 'unlocked' }), msg: tk('ACCESS GRANTED. You hear the door unlock.'), ok: true };
  return { s: { ...with_(s, { flag: 'opened' }), out: true }, msg: tk('Click! The door swings open.'), ok: true };
}

/** Set the stove's knobs. */
export function knobs(s: Escape, set: boolean[]): Result {
  if (s.room !== 1 || has(s, 'lit')) return say(s, tk('Nothing happens.'));
  if (set.every((v, i) => v === KNOBS[i])) return { s: with_(s, { flag: 'lit' }), msg: tk('Whoosh! The stove lights up.'), ok: true };
  return say(s, tk('Click. The stove stays cold.'));
}

/** On to the next room (after getting out of this one). */
export const nextRoom = (s: Escape): Escape => (s.out && s.room < ROOMS.length - 1 ? fresh(s.room + 1) : s);

/** What to do next, from where you are. */
export function hint(s: Escape): string {
  const h = (f: string) => has(s, f), got = (i: Item) => s.inv.includes(i);
  if (s.out) return tk('You’re out! On to the next room.');
  if (s.room === 0) {
    if (!h('rug')) return tk('Something might be hidden under the rug.');
    if (!h('drawer')) return tk('Tap the small key, then tap the desk drawer.');
    if (!h('clock')) return tk('The clock has stopped. Take a closer look at it.');
    if (got('torchEmpty')) return tk('Tap the torch, then the batteries, to put them together.');
    if (!h('lit')) return tk('Shine the torch on the bookshelf.');
    if (!h('painting')) return tk('Look at the painting for a year.');
    return tk('The painting’s year backwards: 1874 becomes 4781. Enter it at the door.');
  }
  if (s.room === 1) {
    if (!h('fridge')) return tk('Check the fridge.');
    if (!h('lit') && !h('recipe')) return tk('The ice needs heat. Read the recipe card by the stove.');
    if (!h('lit')) return tk('Turn the stove’s knobs on, off, on, on.');
    if (!h('melted')) return tk('Use the block of ice on the lit stove.');
    if (!h('pantry')) return tk('Use the brass key on the pantry.');
    if (!h('drawer')) return tk('Look under the table. The spoon could prise something open.');
    if (!h('shelf')) return tk('The note talks about plates, cups and jars. Count them on the shelf.');
    return tk('3 plates, 5 cups, 2 jars: try 352 on the door’s padlock.');
  }
  if (!h('bin') || !h('coat')) return tk('Look in the bin and in the lab coat.');
  if (!h('locker') && !got('keycard')) return tk('Put the two halves of the keycard together.');
  if (!h('locker')) return tk('Use the keycard on the locker.');
  if (!h('power')) return tk('Put the fuse in the fuse box.');
  if (!h('unlocked') && (!h('board') || !h('bottles'))) return tk('The whiteboard lists colours; the bottles turn colours into numbers.');
  if (!h('unlocked')) return tk('Green 6, blue 9, red 2, blue 9: enter 6929 on the computer.');
  return tk('The door is open. Walk out!');
}

// Mix Lab: start with water, fire, earth and air; mix two things to discover new ones. The table below
// is the whole game: each thing, its picture, and the two things that make it (in any order). Every
// thing can be reached from the four basics: see logic.test.ts.
import { tk } from '@sanga/i18n';

export interface Item { id: string; emoji: string; name: string; from?: [string, string] }

const T: [string, string, string, string?, string?][] = [
  ['water', '💧', tk('Water')], ['fire', '🔥', tk('Fire')], ['earth', '🌍', tk('Earth')], ['air', '💨', tk('Air')],
  ['steam', '♨️', tk('Steam'), 'water', 'fire'], ['mud', '🟫', tk('Mud'), 'water', 'earth'], ['lava', '🌋', tk('Lava'), 'fire', 'earth'],
  ['energy', '⚡', tk('Energy'), 'fire', 'air'], ['mist', '🌫️', tk('Mist'), 'water', 'air'],
  ['sea', '🌊', tk('Sea'), 'water', 'water'], ['wind', '🌬️', tk('Wind'), 'air', 'air'], ['stone', '🪨', tk('Stone'), 'lava', 'water'],
  ['cloud', '☁️', tk('Cloud'), 'steam', 'air'], ['rain', '🌧️', tk('Rain'), 'cloud', 'water'], ['storm', '⛈️', tk('Storm'), 'cloud', 'energy'],
  ['sky', '🌤️', tk('Sky'), 'cloud', 'air'], ['sun', '☀️', tk('Sun'), 'fire', 'sky'], ['rainbow', '🌈', tk('Rainbow'), 'rain', 'sun'],
  ['plant', '🌱', tk('Plant'), 'earth', 'rain'], ['sand', '🏖️', tk('Sand'), 'stone', 'wind'], ['glass', '🪟', tk('Glass'), 'sand', 'fire'],
  ['metal', '🔩', tk('Metal'), 'stone', 'fire'], ['tool', '🔨', tk('Hammer'), 'metal', 'stone'], ['time', '⏳', tk('Time'), 'glass', 'sand'],
  ['ice', '🧊', tk('Ice'), 'water', 'wind'], ['snow', '❄️', tk('Snow'), 'ice', 'cloud'], ['mountain', '⛰️', tk('Mountain'), 'stone', 'earth'],
  ['tornado', '🌪️', tk('Tornado'), 'wind', 'storm'], ['grass', '🌿', tk('Grass'), 'plant', 'earth'], ['tree', '🌳', tk('Tree'), 'plant', 'time'],
  ['forest', '🌲', tk('Forest'), 'tree', 'tree'], ['life', '🧬', tk('Life'), 'sea', 'energy'], ['bacteria', '🦠', tk('Germ'), 'life', 'mud'],
  ['fish', '🐟', tk('Fish'), 'life', 'sea'], ['bird', '🐦', tk('Bird'), 'life', 'air'], ['egg', '🥚', tk('Egg'), 'bird', 'bird'],
  ['animal', '🐾', tk('Animal'), 'life', 'earth'], ['bug', '🐛', tk('Bug'), 'life', 'grass'], ['flower', '🌸', tk('Flower'), 'plant', 'rainbow'],
  ['fruit', '🍎', tk('Fruit'), 'tree', 'flower'], ['butterfly', '🦋', tk('Butterfly'), 'bug', 'rainbow'], ['bee', '🐝', tk('Bee'), 'bug', 'flower'],
  ['honey', '🍯', tk('Honey'), 'bee', 'flower'],  ['clay', '🏺', tk('Clay'), 'mud', 'sand'], ['brick', '🧱', tk('Brick'), 'clay', 'fire'], ['human', '🧑', tk('Human'), 'clay', 'life'],
  ['wood', '🪵', tk('Wood'), 'tree', 'tool'], ['house', '🏠', tk('House'), 'brick', 'wood'], ['village', '🏘️', tk('Village'), 'house', 'house'],
  ['city', '🏙️', tk('City'), 'village', 'village'], ['farmer', '🧑‍🌾', tk('Farmer'), 'human', 'plant'], ['wheat', '🌾', tk('Wheat'), 'farmer', 'grass'],
  ['bread', '🍞', tk('Bread'), 'wheat', 'fire'], ['cow', '🐄', tk('Cow'), 'animal', 'grass'], ['milk', '🥛', tk('Milk'), 'cow', 'human'],
  ['cheese', '🧀', tk('Cheese'), 'milk', 'time'], ['cake', '🎂', tk('Cake'), 'bread', 'egg'], ['pizza', '🍕', tk('Pizza'), 'bread', 'cheese'],
  ['icecream', '🍦', tk('Ice cream'), 'milk', 'ice'], ['tea', '🍵', tk('Tea'), 'steam', 'plant'],
  ['coffee', '☕', tk('Coffee'), 'tea', 'energy'], ['love', '❤️', tk('Love'), 'human', 'human'], ['family', '👪', tk('Family'), 'love', 'house'],
  ['dog', '🐕', tk('Dog'), 'animal', 'human'], ['cat', '🐈', tk('Cat'), 'animal', 'milk'], ['snowman', '⛄', tk('Snowman'), 'snow', 'human'],
  ['penguin', '🐧', tk('Penguin'), 'bird', 'ice'], ['lizard', '🦎', tk('Lizard'), 'animal', 'sand'], ['dinosaur', '🦖', tk('Dinosaur'), 'lizard', 'time'],
  ['dragon', '🐉', tk('Dragon'), 'lizard', 'fire'], ['whale', '🐋', tk('Whale'), 'fish', 'fish'], ['shell', '🐚', tk('Shell'), 'sea', 'sand'],
  ['island', '🏝️', tk('Island'), 'sea', 'earth'], ['desert', '🏜️', tk('Desert'), 'sand', 'sun'], ['cactus', '🌵', tk('Cactus'), 'desert', 'plant'],
  ['camel', '🐪', tk('Camel'), 'desert', 'animal'], ['palm', '🌴', tk('Palm tree'), 'tree', 'sand'], ['monkey', '🐒', tk('Monkey'), 'animal', 'tree'],
  ['banana', '🍌', tk('Banana'), 'monkey', 'fruit'], ['bear', '🐻', tk('Bear'), 'animal', 'forest'], ['horse', '🐎', tk('Horse'), 'animal', 'wind'],
  ['unicorn', '🦄', tk('Unicorn'), 'horse', 'rainbow'], ['moon', '🌙', tk('Moon'), 'stone', 'sky'], ['star', '⭐', tk('Star'), 'moon', 'sun'],
  ['galaxy', '🌌', tk('Galaxy'), 'star', 'star'], ['planet', '🪐', tk('Planet'), 'galaxy', 'earth'], ['alien', '👽', tk('Alien'), 'galaxy', 'life'],
  ['engine', '⚙️', tk('Engine'), 'metal', 'energy'], ['rocket', '🚀', tk('Rocket'), 'engine', 'sky'], ['saucer', '🛸', tk('Flying saucer'), 'alien', 'rocket'],
  ['astronaut', '🧑‍🚀', tk('Astronaut'), 'human', 'rocket'], ['wheel', '🛞', tk('Wheel'), 'wood', 'tool'], ['car', '🚗', tk('Car'), 'engine', 'wheel'],
  ['bicycle', '🚲', tk('Bicycle'), 'wheel', 'wheel'], ['train', '🚂', tk('Train'), 'car', 'car'], ['boat', '⛵', tk('Boat'), 'wood', 'sea'],
  ['ship', '🚢', tk('Ship'), 'boat', 'metal'], ['plane', '✈️', tk('Plane'), 'bird', 'metal'], ['electricity', '🔌', tk('Electricity'), 'storm', 'metal'],
  ['bulb', '💡', tk('Light bulb'), 'electricity', 'glass'], ['clock', '🕰️', tk('Clock'), 'time', 'tool'], ['computer', '💻', tk('Computer'), 'electricity', 'clock'],
  ['phone', '📱', tk('Phone'), 'computer', 'human'], ['internet', '🌐', tk('Internet'), 'computer', 'computer'], ['robot', '🤖', tk('Robot'), 'human', 'metal'],
  ['music', '🎵', tk('Music'), 'human', 'wind'], ['guitar', '🎸', tk('Guitar'), 'music', 'wood'], ['dance', '💃', tk('Dance'), 'music', 'human'],
  ['party', '🎉', tk('Party'), 'music', 'cake'], ['paper', '📄', tk('Paper'), 'wood', 'water'], ['book', '📖', tk('Book'), 'paper', 'paper'],
  ['school', '🏫', tk('School'), 'book', 'house'], ['letter', '💌', tk('Love letter'), 'paper', 'love'], ['art', '🎨', tk('Painting'), 'paper', 'rainbow'],
  ['umbrella', '☂️', tk('Umbrella'), 'rain', 'tool'], ['gold', '🪙', tk('Gold'), 'metal', 'sun'], ['crown', '👑', tk('Crown'), 'gold', 'tool'],
  ['king', '🤴', tk('King'), 'crown', 'human'], ['castle', '🏰', tk('Castle'), 'king', 'house'], ['diamond', '💎', tk('Diamond'), 'stone', 'time'],
  ['ring', '💍', tk('Ring'), 'gold', 'diamond'], ['sword', '🗡️', tk('Sword'), 'metal', 'tool'], ['knight', '🛡️', tk('Knight'), 'human', 'sword'],
  ['magic', '✨', tk('Magic'), 'rainbow', 'energy'], ['wizard', '🧙', tk('Wizard'), 'human', 'magic'], ['wand', '🪄', tk('Wand'), 'wood', 'magic'],
  ['fairy', '🧚', tk('Fairy'), 'butterfly', 'magic'], ['ghost', '👻', tk('Ghost'), 'mist', 'human'], ['telescope', '🔭', tk('Telescope'), 'glass', 'star'],
];

export const ITEMS: Item[] = T.map(([id, emoji, name, a, b]) => ({ id, emoji, name, from: a && b ? [a, b] : undefined }));
export const BASICS = ITEMS.filter((i) => !i.from).map((i) => i.id);
export const byId = new Map(ITEMS.map((i) => [i.id, i]));

const key = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);
const RECIPES = new Map(ITEMS.filter((i) => i.from).map((i) => [key(i.from![0], i.from![1]), i.id]));

/** What two things make (in either order), or null if they don't mix. */
export const mix = (a: string, b: string) => RECIPES.get(key(a, b)) ?? null;

/** A recipe you can make now with what you have, for something you haven't found: [a, b, result]. */
export function hint(found: string[]): [string, string, string] | null {
  const have = new Set(found);
  const i = ITEMS.find((x) => x.from && !have.has(x.id) && have.has(x.from[0]) && have.has(x.from[1]));
  return i ? [i.from![0], i.from![1], i.id] : null;
}

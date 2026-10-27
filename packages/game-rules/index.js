// Every game the app offers. To add one, write its rules (see core.js for the shape), add it
// here, and add its board to apps/shell/src/features/games/registry.ts.
import ludo from './ludo.js';
import uno from './uno.js';

export const GAMES = { [ludo.type]: ludo, [uno.type]: uno };

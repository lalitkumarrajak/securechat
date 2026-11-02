// Every game the app offers. To add one, write its rules (see core.js for the shape), add it
// here, and add its board to apps/shell/src/features/games/registry.ts.
import ludo from './ludo.js';
import uno from './uno.js';
import tictactoe from './tictactoe.js';
import connect4 from './connect4.js';
import snakes from './snakes.js';

export const GAMES = { [ludo.type]: ludo, [uno.type]: uno, [snakes.type]: snakes, [connect4.type]: connect4, [tictactoe.type]: tictactoe };

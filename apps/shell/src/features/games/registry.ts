// The games the app offers, and how each is drawn. To add a game: write its rules in
// packages/game-rules/ (see core.js), list it in packages/game-rules/index.js, and add its board here.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import ludo from '@sanga/game-rules/ludo.js';
import uno from '@sanga/game-rules/uno.js';
import snakes from '@sanga/game-rules/snakes.js';
import connect4 from '@sanga/game-rules/connect4.js';
import tictactoe from '@sanga/game-rules/tictactoe.js';
import { tk } from '@sanga/i18n';
import { registerGameNames, type Game } from './store';

export interface GameBoardProps {
  g: Game;
  me: string;                              // my username
  act: (a: object) => boolean | void;                // send an action (the game's own shape, e.g. { a: 'roll' })
  bubble: (u: string) => string | null;    // what this player just said in chat, to show over them
}

export interface GameUi {
  type: string;
  name: string;
  emoji: string;
  blurb: string; // English: show it with t(blurb)
  min: number;
  max: number;
  /** Dark, immersive background behind the board. */
  background: string;
  Board: LazyExoticComponent<ComponentType<GameBoardProps>>;
}

// Names come from game-rules and are shown with t(name); Ludo and UNO stay as they are, these have a translation.
export const TRANSLATED_NAMES = [tk('Snakes & Ladders'), tk('Connect Four'), tk('Tic-Tac-Toe')];

export const GAME_UI: Record<string, GameUi> = {
  ludo: {
    type: ludo.type, name: ludo.name, emoji: '🎲', blurb: tk('Classic rules · 2 to 6 players'),
    min: ludo.min, max: ludo.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0 1.5px, transparent 2px) 0 0 / 34px 34px, radial-gradient(120% 90% at 50% 38%, #2a66df 0%, #0f3394 45%, #071a55 80%, #040d33 100%)',
    Board: lazy(() => import('./ludo/LudoBoard')),
  },
  uno: {
    type: uno.type, name: uno.name, emoji: '🃏', blurb: tk('Match colours and numbers · 2 to 8 players'),
    min: uno.min, max: uno.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 45%, #c62828 0%, #8e0f14 45%, #4a0509 85%, #2a0205 100%)',
    Board: lazy(() => import('./uno/UnoBoard')),
  },
  snakes: {
    type: snakes.type, name: snakes.name, emoji: '🐍', blurb: tk('Climb ladders, dodge snakes · 2 to 4 players'),
    min: snakes.min, max: snakes.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 40%, #1f9d55 0%, #0f6b3a 45%, #07402a 85%, #04251a 100%)',
    Board: lazy(() => import('./snakes/SnakesBoard')),
  },
  connect4: {
    type: connect4.type, name: connect4.name, emoji: '🔴', blurb: tk('Line up four discs · 2 players'),
    min: connect4.min, max: connect4.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 40%, #2b5fd9 0%, #173a99 45%, #0b1f5c 85%, #06133a 100%)',
    Board: lazy(() => import('./connect4/ConnectFourBoard')),
  },
  tictactoe: {
    type: tictactoe.type, name: tictactoe.name, emoji: '❌', blurb: tk('Three in a row · 2 players'),
    min: tictactoe.min, max: tictactoe.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 40%, #7c3aed 0%, #4c1d95 45%, #2e1065 85%, #1a0838 100%)',
    Board: lazy(() => import('./tictactoe/TicTacToeBoard')),
  },
};

registerGameNames(Object.fromEntries(Object.values(GAME_UI).map((x) => [x.type, x.name])));

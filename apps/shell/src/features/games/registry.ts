// The games the app offers, and how each is drawn. To add a game: write its rules in
// packages/game-rules/ (see core.js), list it in packages/game-rules/index.js, and add its board here.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import ludo from '@sanga/game-rules/ludo.js';
import uno from '@sanga/game-rules/uno.js';
import { registerGameNames, type Game } from './store';

export interface GameBoardProps {
  g: Game;
  me: string;                              // my username
  act: (a: object) => void;                // send an action (the game's own shape, e.g. { a: 'roll' })
  bubble: (u: string) => string | null;    // what this player just said in chat, to show over them
}

export interface GameUi {
  type: string;
  name: string;
  emoji: string;
  blurb: string;
  min: number;
  max: number;
  /** Dark, immersive background behind the board. */
  background: string;
  Board: LazyExoticComponent<ComponentType<GameBoardProps>>;
}

export const GAME_UI: Record<string, GameUi> = {
  ludo: {
    type: ludo.type, name: ludo.name, emoji: '🎲', blurb: 'Classic rules · 2 to 6 players',
    min: ludo.min, max: ludo.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0 1.5px, transparent 2px) 0 0 / 34px 34px, radial-gradient(120% 90% at 50% 38%, #2a66df 0%, #0f3394 45%, #071a55 80%, #040d33 100%)',
    Board: lazy(() => import('./ludo/LudoBoard')),
  },
  uno: {
    type: uno.type, name: uno.name, emoji: '🃏', blurb: 'Match colours and numbers · 2 to 8 players',
    min: uno.min, max: uno.max,
    background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0 1.5px, transparent 2px) 0 0 / 30px 30px, radial-gradient(120% 90% at 50% 45%, #c62828 0%, #8e0f14 45%, #4a0509 85%, #2a0205 100%)',
    Board: lazy(() => import('./uno/UnoBoard')),
  },
};

registerGameNames(Object.fromEntries(Object.values(GAME_UI).map((x) => [x.type, x.name])));

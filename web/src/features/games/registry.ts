// The games the app offers, and how each is drawn. To add a game: write its rules in
// shared/games/ (see core.js), list it in shared/games/index.js, and add its board here.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import ludo from '../../../../shared/games/ludo.js';
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
    background: 'radial-gradient(120% 90% at 50% 40%, #1b4fb8 0%, #0c2c79 55%, #061a4a 100%)',
    Board: lazy(() => import('./ludo/LudoBoard')),
  },
};

registerGameNames(Object.fromEntries(Object.values(GAME_UI).map((x) => [x.type, x.name])));

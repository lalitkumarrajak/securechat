// The full-screen game view every game shares: header, lobby, the game's own board, in-game
// chat with emoji and quick phrases, and the results.
import { useGames } from './store';
import { GameView } from './game-screen/GameView';

export function GameScreen() {
  const id = useGames((s) => s.open);
  const g = useGames((s) => (id ? s.games[id] : undefined));
  if (!id || !g) return null;
  return <GameView key={id} g={g} />;
}

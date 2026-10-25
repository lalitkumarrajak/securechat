// What every turn-based game shares: players, turns, finishing places and leaving.
// Shared by the server (which runs games) and the app (which draws them).
//
// A game record:
//   { id, type, host, status: 'lobby' | 'play' | 'over',
//     players: [{ u, state, missed, rank }],   // state: invited | joined | declined | playing | done | left | out
//     turn,                                    // index into players of whoever moves next
//     ranked,                                  // places handed out so far (1st, 2nd, …)
//     s,                                       // the game's own state (board, dice, …)
//     ev }                                     // events of the last update, so apps can animate them
//
// Each game is a definition object (see ludo.js):
//   type, name, min, max   players allowed
//   turnMs                 time per turn before the server plays for you
//   begin(g)               set up g.s for the players
//   act(g, i, action, rand) apply player i's action, or throw if it isn't allowed
//   auto(g, rand)          play for whoever's turn it is (they ran out of time)
//   pass(g)                end the current turn
//   removed(g, i)          clean up after player i leaves (e.g. take their pieces off the board)
// rand(n) returns a random whole number from 0 to n-1; only the server supplies it.

export const playing = (pl) => pl.state === 'playing';

/** Start the game with the players who joined. */
export function begin(g, def) {
  g.players = g.players.filter((pl) => pl.state === 'joined');
  for (const pl of g.players) Object.assign(pl, { state: 'playing', missed: 0, rank: 0 });
  g.status = 'play';
  g.turn = 0;
  g.ranked = 0;
  g.ev = [{ k: 'start' }];
  def.begin(g);
  return g;
}

/** Hand the turn to the next player still playing. */
export function nextTurn(g) {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const j = (g.turn + k) % n;
    if (playing(g.players[j])) { g.turn = j; break; }
  }
  g.ev.push({ k: 'turn', s: g.turn });
}

/** Player i has finished: give them the next place. */
export function finish(g, i) {
  g.players[i].state = 'done';
  g.players[i].rank = ++g.ranked;
  g.ev.push({ k: 'done', s: i, rank: g.ranked });
  endIfDecided(g);
}

// The game ends when at most one player is still playing; they take the last place.
export function endIfDecided(g) {
  const left = g.players.filter(playing);
  if (left.length > 1) return;
  for (const pl of left) { pl.state = 'done'; pl.rank = ++g.ranked; }
  g.status = 'over';
  g.ev.push({ k: 'over' });
}

/** A player leaves, or is removed for missing turns ('left' | 'out'). */
export function remove(g, def, i, why) {
  if (!playing(g.players[i])) return g;
  g.players[i].state = why;
  g.ev.push({ k: why, s: i });
  def.removed(g, i);
  endIfDecided(g);
  if (g.status !== 'over' && g.turn === i) def.pass(g);
  return g;
}

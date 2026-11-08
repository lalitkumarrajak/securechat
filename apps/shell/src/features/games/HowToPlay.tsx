// "How to play": each game's rules in a few short steps, with a picture for Connect Four. Opens from the
// game's ? button and the lobby, and by itself the first time you play a game on this device.
import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Dialog } from '@sanga/ui/dialog';
import { Button } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { GAME_UI } from './registry';

const STEPS: Record<string, string[]> = {
  connect4: [
    tk('Two players take turns: one is red, the other yellow. Your colour is next to your name at the top.'),
    tk('On your turn, tap a column. Your disc drops to the lowest empty spot in it.'),
    tk('Get four of your discs in a line to win: across, up and down, or slanted.'),
    tk('Watch the other player too: if they have three in a line, drop yours where their fourth would go.'),
    tk('Don’t fill the spot just under where they’d win: they can then drop on top of yours.'),
    tk('The middle column is part of the most lines, so it’s a good place to start.'),
    tk('If the board fills up with no four in a line, it’s a draw.'),
  ],
  tictactoe: [
    tk('Two players take turns: one is X (goes first), the other O.'),
    tk('On your turn, tap an empty square to put your mark there.'),
    tk('Get three of your marks in a line to win: across, up and down, or slanted.'),
    tk('If the other player has two in a line, put yours in the third square to stop them.'),
    tk('If all nine squares fill up with no three in a line, it’s a draw.'),
  ],
  ludo: [
    tk('Each player has four tokens waiting in their corner.'),
    tk('On your turn, tap the dice. A 6 brings a token out onto your start square.'),
    tk('Then tap a token to move it that many squares, round the board and up your own coloured path to the centre.'),
    tk('A 6, sending someone home or reaching the centre gives you another roll. Three 6s in a row lose the turn.'),
    tk('Land on another player’s token to send it back to their corner. Start squares and star squares are safe.'),
    tk('The first to bring all four tokens to the centre wins.'),
  ],
  snakes: [
    tk('Everyone starts off the board. On your turn, tap the dice and your piece moves that many squares.'),
    tk('Land at the bottom of a ladder and you climb up it. Land on a snake’s head and you slide down to its tail.'),
    tk('A 6 rolls again; a third 6 in a row loses the turn.'),
    tk('You need the exact number to land on 100. A bigger roll stays put.'),
    tk('The first to reach 100 wins.'),
  ],
  uno: [
    tk('Everyone gets 7 cards. On your turn, play a card with the same colour or the same number or symbol as the top card.'),
    tk('Wild cards go on anything, and you choose the colour that comes next.'),
    tk('Can’t play? Draw a card. If it fits, you can play it straight away.'),
    tk('Skip: the next player misses a turn. Reverse: play goes the other way. Draw Two and Wild Draw Four: the next player picks up and misses their turn.'),
    tk('When you’re about to have one card left, tap UNO. If someone catches you without calling it, you pick up two.'),
    tk('The first to play all their cards wins.'),
  ],
};
const COMMON = [tk('Each turn has a time limit; if it runs out, the game moves for you. Miss too many and you’re out.')];

const SEEN = 'sanga-games-howto';
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) ?? '[]'); } catch { return []; } };
const markSeen = (type: string) => { try { localStorage.setItem(SEEN, JSON.stringify([...new Set([...seen(), type])])); } catch { /* shown again next time */ } };

/** Four in a row, three ways: across, up and down, slanted. */
function FourInARow() {
  const ways: [string, number[]][] = [[tk('Across'), [21, 22, 23, 24]], [tk('Up and down'), [3, 10, 17, 24]], [tk('Slanted'), [3, 9, 15, 21]]];
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden>
      {ways.map(([name, on]) => (
        <figure key={name} className="text-center">
          <div className="grid grid-cols-7 gap-0.5 rounded-lg bg-blue-600 p-1">
            {Array.from({ length: 28 }, (_, k) => <span key={k} className={cn('aspect-square rounded-full', on.includes(k) ? 'bg-red-500' : 'bg-blue-900/80')} />)}
          </div>
          <figcaption className="mt-1 text-xs text-muted">{t(name)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function HowToPlay({ type, open, onOpenChange }: { type: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ui = GAME_UI[type];
  const steps = [...(STEPS[type] ?? []), ...COMMON];
  const close = (o: boolean) => { if (!o) markSeen(type); onOpenChange(o); };
  return (
    <Dialog open={open} onOpenChange={close} title={t('How to play {game}', { game: ui ? t(ui.name) : '' })}>
      <div className="grid gap-4">
        {type === 'connect4' && <FourInARow />}
        <ol className="grid gap-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent-ink">{i + 1}</span>
              <span className="pt-0.5">{t(s)}</span>
            </li>
          ))}
        </ol>
        <Button onClick={() => close(false)}>{t('Got it')}</Button>
      </div>
    </Dialog>
  );
}

/** The ? button for the game screen's header; opens the guide by itself the first time a game starts. */
export function HowToPlayButton({ type, playing }: { type: string; playing: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (playing && STEPS[type] && !seen().includes(type)) setOpen(true); }, [playing, type]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('How to play')} title={t('How to play')}
        className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10"><CircleHelp className="size-6" /></button>
      <HowToPlay type={type} open={open} onOpenChange={setOpen} />
    </>
  );
}

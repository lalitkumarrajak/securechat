import { cn } from '@sanga/ui/utils';
import { splitMentions } from '../../lib/mentions';

/** Chat text with each @tag as a blue highlight that stays readable on any bubble colour, showing the
 *  player's name when we know it. `me` is you: a tag of you is solid blue; `onDark` is for text on the
 *  accent-coloured bubble; `onLight` for the always-white speech bubbles on the board (dark theme too). */
export function MentionText({ text, users, names, me, onDark, onLight }: {
  text: string; users: string[]; names?: Record<string, string>; me?: string; onDark?: boolean; onLight?: boolean;
}) {
  return splitMentions(text, users).map((part, i) => part.u ? (
    <span key={i} className={cn('rounded-md px-1 py-px font-semibold whitespace-nowrap',
      part.u === me ? 'bg-blue-600 text-white'
        : onDark ? 'bg-white text-blue-700'
          : onLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200')}
      title={part.t}>@{names?.[part.u] || part.u}</span>
  ) : <span key={i}>{part.t}</span>);
}

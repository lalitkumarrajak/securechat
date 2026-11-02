import { cn } from '@sanga/ui/utils';
import { splitMentions } from '../../lib/mentions';

/** Chat text with each @tag as a blue highlight that stays readable on any bubble colour.
 *  `me` is you: a tag of you is solid blue; `onDark` is for text on the accent-coloured bubble. */
export function MentionText({ text, users, me, onDark }: { text: string; users: string[]; me?: string; onDark?: boolean }) {
  return splitMentions(text, users).map((part, i) => part.u ? (
    <span key={i} className={cn('rounded-md px-1 py-px font-semibold',
      part.u === me ? 'bg-blue-600 text-white'
        : onDark ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200')}>{part.t}</span>
  ) : <span key={i}>{part.t}</span>);
}

import { Emoji } from '../../conversation/Emoji';
import { emojiOnly } from '../../../lib/emoji';

/** A comment; one that's only emoji is shown big and animated, as in a chat. */
export function CommentText({ text }: { text: string }) {
  const emoji = emojiOnly(text);
  if (emoji) return <span className="mt-0.5 flex gap-0.5">{emoji.map((e, i) => <Emoji key={i + e} e={e} size={36} />)}</span>;
  return <span className="block text-sm break-words whitespace-pre-wrap">{text}</span>;
}

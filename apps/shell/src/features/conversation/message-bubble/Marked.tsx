import { useApp } from '../../../state/app';

/** While searching in the chat, the words you searched for are highlighted. */
export function Marked({ text }: { text: string }) {
  const q = useApp((s) => (s.searchOpen ? s.searchQuery.trim().toLowerCase() : ''));
  if (!q || !text.toLowerCase().includes(q)) return <>{text}</>;
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    out.push(text.slice(at, i), <mark key={i} className="rounded-sm bg-amber-300 px-px text-amber-950">{text.slice(i, i + q.length)}</mark>);
    at = i + q.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

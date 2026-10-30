import { Marked } from './Marked';

// Links become clickable; everything is still rendered as text (never as HTML).
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-ink underline underline-offset-2" onClick={(e) => e.stopPropagation()}><Marked text={p} /></a> : <Marked key={i} text={p} />))}</>;
}

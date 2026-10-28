
/** The ring around a story's photo: colourful when new, grey when seen. */
export function StoryRing({ state, children }: { state: 'new' | 'seen' | 'none'; children: React.ReactNode }) {
  return (
    <span className="grid rounded-full p-[2px]"
      style={{ background: state === 'new' ? 'conic-gradient(from 210deg,#14b8a6,#6366f1,#ec4899,#f59e0b,#14b8a6)' : state === 'seen' ? 'var(--border)' : 'transparent' }}>
      <span className="grid rounded-full bg-panel p-[2px]">{children}</span>
    </span>
  );
}

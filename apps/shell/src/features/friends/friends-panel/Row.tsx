import { Avatar } from '../../../components/Avatar';
import { showProfile } from '../ProfileCard';
import { displayName, type Person } from '../../../lib/types';
import { useApp } from '../../../state/app';

export function Row({ p, sub, children, onClick }: { p: Person; sub?: string; children?: React.ReactNode; onClick?: () => void }) {
  const online = useApp((s) => s.presence[p.u]?.on);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{displayName(p, p.u)}</span>
        <span className="block truncate text-sm text-muted">{sub ?? (p.name ? '@' + p.u : p.about || '@' + p.u)}</span>
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button onClick={() => showProfile(p.u)} aria-label={`${displayName(p, p.u)}’s profile`} className="shrink-0 rounded-full">
        <Avatar u={p.u} name={p.name} size={46} online={online} />
      </button>
      {onClick ? <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">{body}</button> : body}
      {children}
    </li>
  );
}

import { useEffect, useMemo, type ReactNode } from 'react';
import { ArrowRight, FilePlus2, FolderPlus, HandCoins, Pencil, Tag, Trash2, Undo2, UserMinus, UserPlus, LogOut, Type, Link2 } from 'lucide-react';
import { money, parseDay, type Activity, type Person } from './model';
import { useLedger, useNames } from './hooks';
import { markSeen, type GroupData } from './store';
import { Empty } from './Empty';
import { PersonDot } from './PersonDot';

const ICON: Record<Activity['kind'], { Icon: typeof Pencil; tone: string }> = {
  group_create: { Icon: FolderPlus, tone: 'text-accent bg-accent/15' }, group_rename: { Icon: Type, tone: 'text-accent bg-accent/15' },
  person_add: { Icon: UserPlus, tone: 'text-sky-600 bg-sky-500/15' }, person_remove: { Icon: UserMinus, tone: 'text-danger bg-danger/10' },
  person_left: { Icon: LogOut, tone: 'text-muted bg-panel-2' }, category_add: { Icon: Tag, tone: 'text-violet-600 bg-violet-500/15' },
  expense_add: { Icon: FilePlus2, tone: 'text-emerald-600 bg-emerald-500/15' }, expense_edit: { Icon: Pencil, tone: 'text-amber-600 bg-amber-500/15' },
  expense_delete: { Icon: Trash2, tone: 'text-danger bg-danger/10' }, settle_add: { Icon: HandCoins, tone: 'text-emerald-600 bg-emerald-500/15' },
  settle_undo: { Icon: Undo2, tone: 'text-muted bg-panel-2' },
  person_link: { Icon: Link2, tone: 'text-sky-600 bg-sky-500/15' }, person_rename: { Icon: Type, tone: 'text-muted bg-panel-2' },
};

/** Everything that happened in the group, newest first: who added, changed or deleted what, who joined or left, who paid whom. */
export function ActivityTab({ g, onOpenExpense }: { g: GroupData; onOpenExpense: (id: string) => void }) {
  const name = useNames();
  const { meta, activity, person } = useLedger(g);
  const currency = meta?.currency ?? 'INR';
  useEffect(() => { markSeen(g.gid); }, [g.gid, activity.length]); // looking at it: nothing here is new any more

  const days = useMemo(() => {
    const out: { day: string; items: Activity[] }[] = [];
    for (const a of activity) {
      const d = new Date(a.ts), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      (out.at(-1)?.day === day ? out.at(-1)! : out[out.push({ day, items: [] }) - 1]).items.push(a);
    }
    return out;
  }, [activity]);

  if (!activity.length) return <Empty emoji="🕘" title="No activity yet">Who adds, changes or deletes expenses, and who joins or pays, is listed here.</Empty>;

  const who = (id: string): Person => person(id);
  const b = (t: string) => <b className="font-semibold">{t}</b>;
  const amt = (n: number | undefined) => b(money(n ?? 0, currency));
  const sentence = (a: Activity): ReactNode => {
    const by = b(name(who(a.by)));
    const sub = (id?: string) => b(id ? name(who(id)) : 'someone');
    switch (a.kind) {
      case 'group_create': return <>{by} created the group {b(a.name ?? '')}</>;
      case 'group_rename': return <>{by} renamed the group{a.wasDesc ? <> from {b(a.wasDesc)}</> : null} to {b(a.name ?? '')}</>;
      case 'person_add': return <>{by} added {sub(a.who)}</>;
      case 'person_remove': return <>{by} removed {sub(a.who)}</>;
      case 'person_link': return <>{by} linked {b(a.name ?? 'a name')} to {sub(a.who)}’s Sanga account</>;
      case 'person_rename': return <>{by} renamed {b(a.wasDesc ?? 'someone')} to {b(a.name ?? '')}</>;
      case 'person_left': return <>{by} left the group</>;
      case 'category_add': return <>{by} added the category {b(a.name ?? '')}</>;
      case 'expense_add': return <>{by} added {b(a.desc ?? 'an expense')} · {amt(a.amount)}</>;
      case 'expense_edit': return <>{by} changed {b(a.wasDesc ?? a.desc ?? 'an expense')}{a.wasDesc && a.desc ? <> to {b(a.desc)}</> : null}
        {a.wasAmount !== undefined ? <> · {amt(a.wasAmount)} <ArrowRight className="mx-0.5 inline size-3.5" aria-label="to" /> {amt(a.amount)}</> : null}</>;
      case 'expense_delete': return <>{by} deleted {b(a.desc ?? 'an expense')} · {amt(a.amount)}</>;
      case 'settle_add': return <>{by} recorded that {sub(a.from)} paid {sub(a.to)} {amt(a.amount)}</>;
      case 'settle_undo': return <>{by} undid a payment from {sub(a.from)} to {sub(a.to)} · {amt(a.amount)}</>;
    }
  };

  return (
    <div className="pb-6">
      {days.map(({ day, items }) => (
        <section key={day} aria-label={day}>
          <h3 className="sticky top-0 z-[1] bg-bg/95 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">
            {parseDay(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: parseDay(day).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
          </h3>
          <ul className="divide-y divide-line bg-panel">
            {items.map((a) => {
              const { Icon, tone } = ICON[a.kind];
              const open = a.ref && g.expenses[a.ref] && !g.expenses[a.ref].deleted && a.kind !== 'expense_delete' ? a.ref : null;
              const body = (
                <>
                  <span className="relative shrink-0"><PersonDot p={who(a.by)} name={name(who(a.by))} size={36} />
                    <span className={`absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-panel ${tone}`}><Icon className="size-3" aria-hidden /></span></span>
                  <span className="min-w-0 flex-1 text-sm leading-snug">{sentence(a)}
                    <span className="block text-xs text-muted">{new Date(a.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></span>
                </>
              );
              return (
                <li key={a.id}>
                  {open
                    ? <button type="button" onClick={() => onOpenExpense(open)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover">{body}</button>
                    : <div className="flex items-center gap-3 px-4 py-3">{body}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

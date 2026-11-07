import { locale, t, tx } from '@sanga/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { ArrowRight, Shapes, FilePlus2, FolderPlus, HandCoins, Pencil, Tag, Trash2, Undo2, UserMinus, UserPlus, LogOut, Type, Link2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { GROUP_KINDS, money, parseDay, type Activity, type Person } from './model';
import { useLedger, useNames } from './hooks';
import { markSeen, type GroupData } from './store';
import { Empty } from './Empty';
import { PersonDot } from './PersonDot';

const ICON: Record<Activity['kind'], { Icon: typeof Pencil; tone: string }> = {
  group_create: { Icon: FolderPlus, tone: 'text-accent bg-accent/15' }, group_rename: { Icon: Type, tone: 'text-accent bg-accent/15' }, group_kind: { Icon: Shapes, tone: 'text-accent bg-accent/15' },
  person_add: { Icon: UserPlus, tone: 'text-sky-600 bg-sky-500/15' }, person_remove: { Icon: UserMinus, tone: 'text-danger bg-danger/10' },
  person_left: { Icon: LogOut, tone: 'text-muted bg-panel-2' }, category_add: { Icon: Tag, tone: 'text-violet-600 bg-violet-500/15' },
  expense_add: { Icon: FilePlus2, tone: 'text-emerald-600 bg-emerald-500/15' }, expense_edit: { Icon: Pencil, tone: 'text-amber-600 bg-amber-500/15' },
  expense_delete: { Icon: Trash2, tone: 'text-danger bg-danger/10' }, settle_add: { Icon: HandCoins, tone: 'text-emerald-600 bg-emerald-500/15' },
  settle_undo: { Icon: Undo2, tone: 'text-muted bg-panel-2' },
  settle_request: { Icon: Clock, tone: 'text-amber-600 bg-amber-500/15' }, settle_confirm: { Icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-500/15' },
  settle_decline: { Icon: XCircle, tone: 'text-muted bg-panel-2' },
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

  if (!activity.length) return <Empty emoji="🕘" title={t('No activity yet')}>{t('Who adds, changes or deletes expenses, and who joins or pays, is listed here.')}</Empty>;

  const who = (id: string): Person => person(id);
  const b = (s: string) => <b className="font-semibold">{s}</b>;
  const amt = (n: number | undefined) => b(money(n ?? 0, currency));
  const sentence = (a: Activity): ReactNode => {
    const by = b(name(who(a.by)));
    const sub = (id?: string) => b(id ? name(who(id)) : t('someone'));
    switch (a.kind) {
      case 'group_create': return tx('{by} created the group {name}', { by, name: b(a.name ?? '') });
      case 'group_rename': return a.wasDesc
        ? tx('{by} renamed the group from {old} to {name}', { by, old: b(a.wasDesc), name: b(a.name ?? '') })
        : tx('{by} renamed the group to {name}', { by, name: b(a.name ?? '') });
      case 'group_kind': {
        const k = GROUP_KINDS.find((x) => x.id === a.name) ?? GROUP_KINDS[0];
        return tx('{by} marked this group as {kind}', { by, kind: b(`${k.emoji} ${t(k.name)}`) });
      }
      case 'person_add': return tx('{by} added {who}', { by, who: sub(a.who) });
      case 'person_remove': return tx('{by} removed {who}', { by, who: sub(a.who) });
      case 'settle_request': return tx('{by} says {from} paid {to} {amount} · waiting for {to} to confirm', { by, from: sub(a.from), to: sub(a.to), amount: amt(a.amount) });
      case 'settle_confirm': return tx('{by} confirmed getting {amount} from {from}', { by, amount: amt(a.amount), from: sub(a.from) });
      case 'settle_decline': return tx('{by} cancelled the unconfirmed payment from {from} to {to} · {amount}', { by, from: sub(a.from), to: sub(a.to), amount: amt(a.amount) });
      case 'person_link': return tx('{by} linked {name} to {who}’s Sanga account', { by, name: b(a.name ?? t('a name')), who: sub(a.who) });
      case 'person_rename': return tx('{by} renamed {old} to {name}', { by, old: b(a.wasDesc ?? t('someone')), name: b(a.name ?? '') });
      case 'person_left': return tx('{by} left the group', { by });
      case 'category_add': return tx('{by} added the category {name}', { by, name: b(a.name ?? '') });
      case 'expense_add': return tx('{by} added {desc} · {amount}', { by, desc: b(a.desc ?? t('an expense')), amount: amt(a.amount) });
      case 'expense_edit': return <>
        {a.wasDesc && a.desc
          ? tx('{by} changed {old} to {desc}', { by, old: b(a.wasDesc), desc: b(a.desc) })
          : tx('{by} changed {desc}', { by, desc: b(a.wasDesc ?? a.desc ?? t('an expense')) })}
        {a.wasAmount !== undefined ? <> · {amt(a.wasAmount)} <ArrowRight className="mx-0.5 inline size-3.5" aria-label={t('to')} /> {amt(a.amount)}</> : null}</>;
      case 'expense_delete': return tx('{by} deleted {desc} · {amount}', { by, desc: b(a.desc ?? t('an expense')), amount: amt(a.amount) });
      case 'settle_add': return tx('{by} recorded that {from} paid {to} {amount}', { by, from: sub(a.from), to: sub(a.to), amount: amt(a.amount) });
      case 'settle_undo': return tx('{by} undid a payment from {from} to {to} · {amount}', { by, from: sub(a.from), to: sub(a.to), amount: amt(a.amount) });
    }
  };

  return (
    <div className="pb-6">
      {days.map(({ day, items }) => (
        <section key={day} aria-label={day}>
          <h3 className="sticky top-0 z-[1] bg-bg/95 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">
            {parseDay(day).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: parseDay(day).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
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
                    <span className="block text-xs text-muted">{new Date(a.ts).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })}</span></span>
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

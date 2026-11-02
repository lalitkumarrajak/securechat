import { useMemo } from 'react';
import { sdk } from '@sanga/sdk';
import { useSplit, type GroupData } from './store';
import { catOf, categoryMap, type Expense, type Meta, type Person, type Settlement } from './model';

export const useMe = () => sdk().identity().me;

/** The group (null once it's gone, e.g. after leaving). */
export const useGroup = (gid: string | null): GroupData | null => useSplit((s) => (gid ? s.groups[gid] ?? null : null));

/** How a person is shown: "You", their name in your friends list, or the name the group gave them. */
export function useNames() {
  const chats = sdk().useChats();
  const me = useMe();
  return useMemo(() => {
    const names = new Map(chats.map((c) => [c.peer, c.name]));
    return (p: Pick<Person, 'id' | 'name' | 'u'>) => (p.u === me || p.id === me ? 'You' : (p.u && names.get(p.u)) || p.name);
  }, [chats, me]);
}

/** Live expenses and settlements (deleted ones left out), newest first, plus lookups. */
export function useLedger(g: GroupData | null) {
  return useMemo(() => {
    const expenses = Object.values(g?.expenses ?? {}).filter((e) => !e.deleted).sort(newest) as Expense[];
    const settles = Object.values(g?.settles ?? {}).filter((s) => !s.deleted).sort(newest) as Settlement[];
    const meta = g?.meta as Meta | null;
    const people = meta?.people ?? [];
    const cats = categoryMap(meta?.cats);
    const person = (id: string): Person => people.find((p) => p.id === id) ?? { id, name: id };
    return { meta, expenses, settles, people, cats, person, catOf: (id: string) => catOf(cats, id) };
  }, [g]);
}

const newest = (a: { date: string; edited: number }, b: { date: string; edited: number }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.edited - a.edited);

import { create } from 'zustand';

interface Action { label: string; value: string; variant?: 'primary' | 'danger' | 'secondary' }
interface Req { title: string; description?: string; actions: Action[]; resolve: (v: string | null) => void }

export const useConfirm = create<{ req: Req | null }>(() => ({ req: null }));

/** Several choices (e.g. delete for me / for everyone). Resolves with the chosen value or null. */
export function choose(o: { title: string; description?: string; actions: Action[] }) {
  return new Promise<string | null>((resolve) => useConfirm.setState({ req: { ...o, resolve } }));
}

export async function confirm(o: { title: string; description?: string; confirmText?: string; destructive?: boolean }) {
  const v = await choose({
    title: o.title, description: o.description,
    actions: [{ label: o.confirmText || 'OK', value: 'ok', variant: o.destructive ? 'danger' : 'primary' }],
  });
  return v === 'ok';
}

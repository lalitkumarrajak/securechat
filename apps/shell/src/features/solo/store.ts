// Which solo game is open. Opening one adds a history entry, so the phone's Back closes it.
import { create } from 'zustand';

export const useSolo = create<{ open: string | null }>(() => ({ open: null }));

export function openSolo(id: string) {
  if (!history.state?.solo) history.pushState({ ...history.state, solo: id }, '');
  useSolo.setState({ open: id });
}
export function closeSolo() {
  if (history.state?.solo) history.back(); // its popstate closes it
  else useSolo.setState({ open: null });
}
if (history.state?.solo) history.replaceState({ ...history.state, solo: undefined }, ''); // left over from before a reload
window.addEventListener('popstate', () => { if (useSolo.getState().open && !history.state?.solo) useSolo.setState({ open: null }); });

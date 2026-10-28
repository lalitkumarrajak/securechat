// Shows one of the other Sanga apps inside the shell: a placeholder while its code downloads (only
// the first time it's opened), and a "Try again" message if it can't load (offline, say). An app that
// crashes shows that message too; the rest of Sanga keeps working.
import { Component, Suspense, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Spinner } from '@sanga/ui/button';
import { appComponent, retryApp } from '../../lib/apps';

export function AppFrame({ id, name, onClose, params = {}, tab }: { id: string; name: string; onClose: () => void; params?: Record<string, string>; tab?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const App = appComponent(id);
  return (
    <Boundary key={attempt} name={name} onRetry={() => { void retryApp(id).then(() => setAttempt(attempt + 1)); }} onClose={onClose}>
      <Suspense fallback={
        <div className="grid flex-1 place-items-center" role="status" aria-label={`Opening ${name}`}>
          <span className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-5 text-accent" />Opening {name}…</span>
        </div>
      }>
        <App onClose={onClose} params={params} tab={tab} />
      </Suspense>
    </Boundary>
  );
}

class Boundary extends Component<{ name: string; onRetry: () => void; onClose: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('app failed', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="font-medium">Couldn’t open {this.props.name}</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={this.props.onClose} className="rounded-xl px-4 py-2 text-sm hover:bg-hover">Back</button>
            <button onClick={this.props.onRetry} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
              <RotateCcw className="size-4" /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}

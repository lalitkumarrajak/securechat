import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ConfirmHost } from './components/ui/confirm';
import { Spinner } from './components/ui/button';
import { boot, openChat } from './lib/engine';
import { useApp } from './state/app';
import { useSettings } from './state/settings';
import { Landing } from './features/auth/Landing';
import { Shell } from './features/Shell';
import { joinFromLink } from './features/games/store';

let booted = false;

export function App() {
  const status = useApp((s) => s.status);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    if (booted) return; // StrictMode runs effects twice in development
    booted = true;
    // A shared game link: /?play=<id>. Kept through sign-in; joined once connected.
    const play = new URLSearchParams(location.search).get('play');
    if (play) { history.replaceState(null, '', '/'); joinFromLink(play); }
    boot().then(() => {
      // Opened from a notification: /?chat=username
      const chat = new URLSearchParams(location.search).get('chat');
      if (chat && useApp.getState().status === 'app') {
        history.replaceState(null, '', '/');
        openChat(chat);
      }
    });
  }, []);

  return (
    <>
      {status === 'loading' && (
        <div className="grid h-full place-items-center text-accent"><Spinner className="size-8" /></div>
      )}
      {status === 'auth' && <Landing />}
      {status === 'app' && <Shell />}
      <ConfirmHost />
      <Toaster position="top-center" theme={theme === 'system' ? 'system' : theme} richColors closeButton
        toastOptions={{ className: 'rounded-xl!' }} />
    </>
  );
}

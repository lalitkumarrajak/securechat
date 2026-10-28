import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ConfirmHost } from '@sanga/ui/confirm';
import { ShellSkeleton } from './components/Skeleton';
import { boot, openChat } from './lib/engine';
import { useApp } from './state/app';
import { useSettings } from './state/settings';
import { Landing } from './features/auth/Landing';
import { Main } from './features/Shell';
import { joinFromLink } from './features/games/store';
import { LockScreen } from './features/lock/LockScreen';
import { useLock } from './lib/applock';
import { rememberGroupInvite, rememberInvite } from './lib/invite';

let booted = false;

export function App() {
  const status = useApp((s) => s.status);
  const theme = useSettings((s) => s.theme);
  const locked = useLock((s) => s.locked); // app lock: only the PIN screen is on the page

  useEffect(() => {
    if (booted) return; // StrictMode runs effects twice in development
    booted = true;
    // A shared game link: /?play=<id>. Kept through sign-in; joined once connected.
    const params = new URLSearchParams(location.search);
    const play = params.get('play');
    if (play) { history.replaceState(null, '', '/'); joinFromLink(play); }
    // "Join me on Sanga": /?add=<username>, offered as a friend request once signed in.
    const add = params.get('add');
    if (add) { history.replaceState(null, '', '/'); rememberInvite(add); }
    const group = params.get('group'); // group invite link
    if (group) { history.replaceState(null, '', '/'); rememberGroupInvite(group); }
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
      {status === 'loading' && <ShellSkeleton />}
      {status === 'auth' && <Landing />}
      {status === 'app' && (locked ? <LockScreen /> : <Main />)}
      <ConfirmHost />
      {!(status === 'app' && locked) && <Toaster position="top-center" theme={theme === 'system' ? 'system' : theme} richColors closeButton
        toastOptions={{ className: 'rounded-xl!' }} />}
    </>
  );
}

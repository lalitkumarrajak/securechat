import { CalendarDays, Gamepad2, Languages, Lock, MessageCircle, NotebookPen, Smartphone, UserPlus, Wallet, Wifi } from 'lucide-react';
import { tk } from '@sanga/i18n';

export const APPS = [
  { icon: MessageCircle, name: tk('Chat'), text: tk('Messages, groups, stories, voice notes, photos, location, and voice and video calls.'), bg: 'linear-gradient(140deg, #14b8a6, #0f3d3a)' },
  { icon: Gamepad2, name: tk('Games'), text: tk('Ludo, UNO, Snakes & Ladders, Connect Four and Tic-Tac-Toe with friends, anyone with a link, or computer players.'), bg: 'linear-gradient(140deg, #6366f1, #312e81)' },
  { icon: Wallet, name: tk('Split'), text: tk('Share trip, flat and gym costs in groups. Attach bills, see who owes whom, settle up, and see where your money went.'), bg: 'linear-gradient(140deg, #10b981, #064e3b)' },
  { icon: CalendarDays, name: tk('Calendar'), text: tk('Events and reminders, the Hindu calendar with festivals and fasts, and credit card bill reminders.'), bg: 'linear-gradient(140deg, #f43f5e, #881337)' },
  { icon: NotebookPen, name: tk('Diary'), text: tk('Private notes and a daily diary, synced and encrypted.'), bg: 'linear-gradient(140deg, #f59e0b, #92400e)' },
];

export const SAFETY = [
  { icon: Lock, title: tk('End-to-end encrypted'), text: tk('Messages, photos, calls, notes and shared expenses are locked on your device. Not even our server can read them.') },
  { icon: UserPlus, title: tk('Friends only'), text: tk('Nobody can message you until you accept their friend request.') },
  { icon: Wifi, title: tk('Made for slow networks'), text: tk('A small app with compressed photos. Each part loads only when you open it, and messages wait offline and send when you’re back.') },
  { icon: Smartphone, title: tk('Works like an app'), text: tk('Install it from your browser on any phone or computer. No app store needed.') },
  { icon: Languages, title: tk('In English, Hindi or Marathi'), text: tk('Switch the whole app to Hindi or Marathi in Settings, any time.') },
];

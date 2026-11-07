import { KeyRound, CalendarDays, CircleDashed, CreditCard, Gamepad2, HandCoins, Languages, Link2, Lock, MessageCircle, NotebookPen, ShoppingBag, Smartphone, UserPlus, UserRound, Wallet, Wifi } from 'lucide-react';
import { tk } from '@sanga/i18n';

export const APPS = [
  { icon: MessageCircle, name: tk('Chat'), text: tk('Messages, groups, stories, voice notes, photos, location, and voice and video calls.'), bg: 'linear-gradient(140deg, #14b8a6, #0f3d3a)',
    tags: [tk('Group calls'), tk('Screen sharing'), tk('Voice notes'), tk('Tabs in a chat')] },
  { icon: CircleDashed, name: tk('Stories'), text: tk('A photo or a few words, with a song if you like, for your friends. Gone after 24 hours.'), bg: 'linear-gradient(140deg, #ec4899, #831843)',
    tags: [tk('Photos'), tk('Songs'), tk('Likes and replies')] },
  { icon: Gamepad2, name: tk('Games'), text: tk('Ludo, UNO, Snakes & Ladders, Connect Four and Tic-Tac-Toe with friends, anyone with a link, or computer players.'), bg: 'linear-gradient(140deg, #6366f1, #312e81)',
    tags: [tk('Ludo'), tk('UNO'), tk('Snakes & Ladders'), tk('Connect Four'), tk('Tic-Tac-Toe')] },
  { icon: Wallet, name: tk('Split'), text: tk('Share trip, flat and gym costs in groups. Attach bills, see who owes whom, settle up, and see where your money went.'), bg: 'linear-gradient(140deg, #10b981, #064e3b)',
    tags: [tk('Settle up'), tk('Insights'), tk('Card bills'), tk('Lending')] },
  { icon: CalendarDays, name: tk('Calendar'), text: tk('Events and reminders, the Hindu calendar with festivals and fasts, and credit card bill reminders.'), bg: 'linear-gradient(140deg, #f43f5e, #881337)',
    tags: [tk('Festivals'), tk('Fast tracker'), tk('Card bills')] },
  { icon: NotebookPen, name: tk('Diary'), text: tk('Private notes and a daily diary, synced and encrypted.'), bg: 'linear-gradient(140deg, #f59e0b, #92400e)',
    tags: [tk('Daily diary'), tk('Notes')] },
];

export const STEPS = [
  { icon: UserRound, title: tk('Pick a username'), text: tk('Choose a username and a password. Your keys are made on your device.') },
  { icon: Link2, title: tk('Invite your people'), text: tk('Share your link on WhatsApp or anywhere. They sign up and add you as a friend in one tap.') },
  { icon: MessageCircle, title: tk('Chat, play and split'), text: tk('Talk, call, start a game of Ludo or add the dinner bill, all in one place.') },
];

/** What a Split group can be for: only spending counts as spending. */
export const SPLIT_KINDS = [
  { icon: ShoppingBag, title: tk('Spending'), text: tk('Trips, rent, groceries. Counted in what you spend each month.') },
  { icon: CreditCard, title: tk('Credit card bills'), text: tk('Record each bill once, so purchases aren’t counted twice.') },
  { icon: HandCoins, title: tk('Lending & borrowing'), text: tk('Money you lent or borrowed, person to person, kept apart from spending.') },
];

export const SAFETY = [
  { icon: Lock, title: tk('End-to-end encrypted'), text: tk('Messages, photos, calls, notes and shared expenses are locked on your device. Not even our server can read them.') },
  { icon: UserPlus, title: tk('Friends only'), text: tk('Nobody can message you until you accept their friend request.') },
  { icon: Wifi, title: tk('Made for slow networks'), text: tk('A small app with compressed photos. Each part loads only when you open it, and messages wait offline and send when you’re back.') },
  { icon: Smartphone, title: tk('Works like an app'), text: tk('Install it from your browser on any phone or computer. No app store needed.') },
  { icon: KeyRound, title: tk('Lock it with a PIN'), text: tk('Ask for a PIN each time Sanga opens on this phone. Set it in Settings → Privacy.') },
  { icon: Languages, title: tk('In English, Hindi or Marathi'), text: tk('Switch the whole app to Hindi or Marathi in Settings, any time.') },
];

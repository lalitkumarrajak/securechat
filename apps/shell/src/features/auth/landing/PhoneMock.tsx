import { CalendarDays, CircleDashed, Gamepad2, LayoutGrid, Lock, MessageCircle, Mic, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '@sanga/i18n';

const RING = 'linear-gradient(140deg, #14b8a6, #6366f1, #f59e0b)';

function Story({ name, bg, me }: { name: string; bg: string; me?: boolean }) {
  return (
    <span className="flex w-12 flex-col items-center gap-1">
      <span className="rounded-full p-[2px]" style={{ background: me ? 'var(--line)' : RING }}>
        <span className="grid size-10 place-items-center rounded-full border-2 border-bg text-sm font-bold text-white" style={{ background: bg }}>{name[0]}</span>
      </span>
      <span className="w-full truncate text-center text-[9px] text-muted">{name}</span>
    </span>
  );
}

function Row({ avatar, bg, name, text, time, unread }: { avatar: ReactNode; bg: string; name: string; text: ReactNode; time: string; unread?: number }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: bg }}>{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="flex-1 truncate text-[13px] font-semibold">{name}</span>
          <span className={`text-[9px] ${unread ? 'font-semibold text-accent-ink' : 'text-muted'}`}>{time}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] text-muted">{text}</span>
          {!!unread && <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] leading-4 font-bold text-white">{unread}</span>}
        </span>
      </span>
    </div>
  );
}

function Tab({ icon, label, on }: { icon: ReactNode; label: string; on?: boolean }) {
  return (
    <span className={`flex flex-1 flex-col items-center gap-0.5 text-[8px] font-medium ${on ? 'text-accent-ink' : 'text-muted'}`}>
      <span className={`grid h-5 w-9 place-items-center rounded-full [&_svg]:size-3.5 ${on ? 'bg-accent/15' : ''}`}>{icon}</span>
      {label}
    </span>
  );
}

/** A floating card beside the phone, for what the other apps are saying. */
function Bubble({ className, icon, bg, title, text }: { className: string; icon: ReactNode; bg: string; title: string; text: string }) {
  return (
    <div className={`absolute z-10 hidden w-44 items-center gap-2.5 rounded-2xl border border-line bg-panel/95 p-2.5 shadow-xl backdrop-blur xl:flex ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white [&_svg]:size-4" style={{ background: bg }}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-muted">{text}</span>
      </span>
    </div>
  );
}

// Sanga's Chats screen, as it is after signing in, drawn with plain HTML so it costs no download.
export function PhoneMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px] select-none md:max-w-[320px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-accent/15 blur-2xl" />
      <Bubble className="top-20 -left-[150px]" icon={<Gamepad2 />} bg="linear-gradient(140deg, #6366f1, #312e81)"
        title={t('Ludo with Lakshya')} text={t('Your turn')} />
      <Bubble className="top-[45%] -right-[150px]" icon={<Wallet />} bg="linear-gradient(140deg, #10b981, #064e3b)"
        title={t('Goa trip')} text={t('You get back {amount}', { amount: '₹450' })} />
      <Bubble className="bottom-16 -left-[150px]" icon={<CalendarDays />} bg="linear-gradient(140deg, #f43f5e, #881337)"
        title={t('Ekadashi in 2 days')} text={t('Card bill due Friday')} />
      <div className="relative overflow-hidden rounded-[2.6rem] border-[10px] border-slate-900 bg-bg shadow-2xl dark:border-slate-700">
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-slate-900 dark:bg-slate-700" />
        <div className="px-4 pt-3">
          <p className="text-center text-base font-bold">{t('Chats')}</p>
          <div className="mt-3 flex gap-1.5">
            <Story name={t('My story')} bg="#64748b" me />
            <Story name="Lakshya" bg="#0ea5e9" />{/* i18n-ok: a name */}
            <Story name="Ananya" bg="#ec4899" />{/* i18n-ok: a name */}
            <Story name="Rohan" bg="#f59e0b" />{/* i18n-ok: a name */}
            <Story name="Meera" bg="#8b5cf6" />{/* i18n-ok: a name */}
          </div>
          <div className="mt-2 divide-y divide-line/70">
            <Row avatar="L" bg="#0ea5e9" name="Lakshya" time="9:41" unread={2} text={t('Ludo tonight? 🎲')} />{/* i18n-ok: a name */}
            <Row avatar={<Users className="size-4" />} bg="linear-gradient(140deg, #10b981, #064e3b)" name={t('Goa trip')} time="9:12"
              text={t('Lakshya added {amount} for dinner', { amount: '₹2,400' })} />
            <Row avatar="A" bg="#ec4899" name="Ananya" time="8:30" unread={1} text={<><Mic className="size-3 shrink-0 text-accent-ink" />{t('Voice message')}</>} />{/* i18n-ok: a name */}
            <Row avatar={<Users className="size-4" />} bg="linear-gradient(140deg, #f59e0b, #92400e)" name={t('Family')} time={t('Yesterday')}
              text={t('Ekadashi is on Tuesday 🙏')} />
          </div>
          <p className="mt-2 mb-3 flex items-center justify-center gap-1 text-[9px] text-muted"><Lock className="size-2.5" /> {t('End-to-end encrypted')}</p>
        </div>
        <div className="flex border-t border-line bg-panel px-1 pt-1.5 pb-3">
          <Tab icon={<MessageCircle />} label={t('Chats')} on />
          <Tab icon={<CircleDashed />} label={t('Stories')} />
          <Tab icon={<CalendarDays />} label={t('Calendar')} />
          <Tab icon={<Wallet />} label={t('Split')} />
          <Tab icon={<LayoutGrid />} label={t('More')} />
        </div>
      </div>
    </div>
  );
}

import { Gamepad2, MessageCircle, NotebookPen, Phone, Wallet } from 'lucide-react';
import { MockTile } from './MockTile';

// A phone showing Sanga, drawn with plain HTML so it costs no download.
export function PhoneMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px] select-none md:max-w-[320px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-accent/15 blur-2xl" />
      <div className="relative rounded-[2.6rem] border-[10px] border-slate-900 bg-bg shadow-2xl dark:border-slate-700">
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-slate-900 dark:bg-slate-700" />
        <div className="px-4 pt-4 pb-6">
          <p className="text-xs text-muted">Good evening,</p>
          <p className="text-xl font-bold">Ayansh 👋</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <MockTile bg="linear-gradient(140deg, #14b8a6, #0f3d3a)" icon={<MessageCircle className="size-4" />} name="Chat" stat="3 unread" />
            <MockTile bg="linear-gradient(140deg, #6366f1, #312e81)" icon={<Gamepad2 className="size-4" />} name="Games" stat="Your turn" />
            <MockTile bg="linear-gradient(140deg, #f59e0b, #92400e)" icon={<NotebookPen className="size-4" />} name="Diary" stat="Today" />
            <MockTile bg="linear-gradient(140deg, #64748b, #1e293b)" icon={<Wallet className="size-4" />} name="Split" stat="Soon" />
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-panel p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-pink-500 text-xs font-bold text-white">P</span>
              <span className="flex-1 text-sm font-semibold">Priya</span>
              <Phone className="size-4 text-accent-ink" />
            </div>
            <p className="mt-2 w-fit rounded-2xl rounded-tl-sm bg-panel-2 px-3 py-1.5 text-xs">Ludo tonight? 🎲</p>
            <p className="mt-1.5 ml-auto w-fit rounded-2xl rounded-tr-sm bg-bubble-out px-3 py-1.5 text-xs">I’m in! 🔥</p>
          </div>
        </div>
      </div>
    </div>
  );
}

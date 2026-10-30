import { dayDate } from '../notes';
import { dayLabel } from './dayLabel';

export function DayHeading({ day }: { day: string }) {
  const d = dayDate(day);
  return (
    <h3 className="flex items-baseline gap-2 px-1 pt-5 pb-2">
      <span className="text-2xl font-bold tabular-nums">{d.getDate()}</span>
      <span className="text-sm font-semibold text-muted">{dayLabel(day)}</span>
    </h3>
  );
}

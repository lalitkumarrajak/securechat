import { fmtDay } from '@sanga/ui/format';
import { dayDate } from '../notes';

export const dayLabel = (day: string) => fmtDay(dayDate(day).getTime());

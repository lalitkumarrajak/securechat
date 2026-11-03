import { Copy, Download, Forward, Info, Pencil, Pin, Reply, RotateCcw, SquareCheck, Trash2 } from 'lucide-react';

export const ICONS: Record<string, React.ReactNode> = {
  retry: <RotateCcw />, reply: <Reply />, copy: <Copy />, save: <Download />, forward: <Forward />, pin: <Pin />, edit: <Pencil />, // i18n-ok
  select: <SquareCheck />, info: <Info />, delete: <Trash2 />, // i18n-ok
};

// Pieces shared by the list and the preview: a file's icon, its picture, and its menu.
import type { ReactNode } from 'react';
import {
  Download, EllipsisVertical, File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder,
  FolderInput, Info, Pencil, Play, Presentation, RotateCcw, Share2, Star, StarOff, Trash2,
} from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@sanga/ui/menu';
import { IconButton } from '@sanga/ui/button';
import { fmtDuration } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { KIND_COLOR, kindOf, type Kind } from './kinds';
import { canShare, inTrash, type Entry } from './store';

const ICON: Record<Kind, typeof File> = {
  image: FileImage, video: FileVideo, audio: FileAudio, pdf: FileText, text: FileText, doc: FileText,
  sheet: FileSpreadsheet, slides: Presentation, archive: FileArchive, other: File,
};

export const kindOfEntry = (e: Entry): Kind => kindOf(e.mime ?? '', e.name);

export function KindIcon({ e, className }: { e: Entry; className?: string }) {
  if (e.type === 'folder') return <Folder className={cn('fill-current', className)} style={{ color: 'var(--accent)' }} aria-hidden />;
  const k = kindOfEntry(e);
  const Icon = ICON[k];
  return <Icon className={className} style={{ color: KIND_COLOR[k] }} aria-hidden />;
}

/** The file's picture, or its kind's icon on a soft tint of its colour. */
export function Preview({ e, className, big }: { e: Entry; className?: string; big?: boolean }) {
  const k = kindOfEntry(e);
  if (e.thumb) {
    return (
      <span className={cn('relative block overflow-hidden bg-panel-2', className)}>
        <img src={e.thumb} alt="" loading="lazy" decoding="async" draggable={false} className={cn('size-full', k === 'pdf' ? 'object-cover object-top' : 'object-cover')} />
        {k === 'video' && (
          <span className="absolute inset-0 grid place-items-center">
            <span className={cn('grid place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm', big ? 'size-12' : 'size-7')}><Play className={cn('fill-current', big ? 'size-6' : 'size-3.5')} /></span>
          </span>
        )}
        {k === 'video' && big && e.duration != null && <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">{fmtDuration(e.duration)}</span>}
      </span>
    );
  }
  const color = e.type === 'folder' ? 'var(--accent)' : KIND_COLOR[k];
  return (
    <span className={cn('grid place-items-center', className)} style={{ background: `color-mix(in oklab, ${color} 10%, var(--panel-2))` }}>
      <KindIcon e={e} className={big ? 'size-12' : 'size-5'} />
    </span>
  );
}

export type Action = 'open' | 'download' | 'share' | 'rename' | 'move' | 'star' | 'info' | 'trash' | 'restore' | 'forever';

export function ItemMenu({ e, onAction, trigger, className }: { e: Entry; onAction: (a: Action, e: Entry) => void; trigger?: ReactNode; className?: string }) {
  const trashed = inTrash(e);
  const item = (a: Action, icon: ReactNode, label: string, danger?: boolean) => (
    <MenuItem key={a} icon={icon} danger={danger} onSelect={() => onAction(a, e)}>{label}</MenuItem>
  );
  return (
    <Menu>
      <MenuTrigger asChild>
        {trigger ?? (
          <IconButton label={t('More for {name}', { name: e.name })} size="icon-sm" className={cn('shrink-0 [&_svg]:size-[1.15rem]', className)} onClick={(ev) => ev.stopPropagation()}>
            <EllipsisVertical />
          </IconButton>
        )}
      </MenuTrigger>
      <MenuContent onClick={(ev) => ev.stopPropagation()} className="min-w-52">
        {trashed ? (
          <>
            {item('restore', <RotateCcw />, t('Restore'))}
            {item('forever', <Trash2 />, t('Delete forever'), true)}
          </>
        ) : (
          <>
            {e.type === 'file' && item('download', <Download />, t('Download'))}
            {e.type === 'file' && canShare() && item('share', <Share2 />, t('Send to…'))}
            {item('rename', <Pencil />, t('Rename'))}
            {item('move', <FolderInput />, t('Move'))}
            {item('star', e.starred ? <StarOff /> : <Star />, e.starred ? t('Remove from Starred') : t('Add to Starred'))}
            {item('info', <Info />, t('Details'))}
            <MenuSeparator />
            {item('trash', <Trash2 />, t('Move to Trash'), true)}
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

// Start a game: pick the game, then tick friends to invite, or invite nobody and share a link.
import { useGames } from './store';
import { PickerDialog } from './PickerDialog';

export function NewGameDialog() {
  const picker = useGames((s) => s.picker);
  return picker ? <PickerDialog initial={picker.pre} pool={picker.pool} start={picker.type} /> : null;
}


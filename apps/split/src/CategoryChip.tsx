import { catName, type Category } from './model';

/** A category as a small coloured label. */
export function CategoryChip({ cat }: { cat: Category }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: cat.color + '22', color: 'var(--text)' }}>
      <span aria-hidden>{cat.emoji}</span>{catName(cat)}
    </span>
  );
}

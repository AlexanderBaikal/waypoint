import { CATEGORY_META, type Category } from "../../domain/categories";
import styles from "./search.module.css";

interface CategoryChipsProps {
  available: readonly Category[];
  selected: readonly Category[];
  onToggle: (category: Category) => void;
}

export function CategoryChips({ available, selected, onToggle }: CategoryChipsProps) {
  if (available.length === 0) return null;

  const active = new Set(selected);

  return (
    <div className={styles.chips} role="group" aria-label="Filter by category">
      {available.map((category) => {
        const isActive = active.has(category);

        return (
          <button
            key={category}
            type="button"
            className={styles.chip}
            data-active={String(isActive)}
            aria-pressed={isActive}
            // The chip's dot and its selected fill are both drawn from this.
            style={{ "--cat": CATEGORY_META[category].colour } as React.CSSProperties}
            onClick={() => {
              onToggle(category);
            }}
          >
            {CATEGORY_META[category].label}
          </button>
        );
      })}
    </div>
  );
}

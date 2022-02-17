import { CategoryGlyph } from "../../components/CategoryGlyph";
import { BOOKMARK } from "../../components/glyphs";
import { CATEGORY_META, type Category } from "../../domain/categories";
import styles from "./search.module.css";

interface FilterChipsProps {
  available: readonly Category[];
  selected: readonly Category[];
  onToggle: (category: Category) => void;
  /**
   * Whether to offer the saved chip at all. A visitor who has saved nothing has
   * nothing to filter to, and a chip that can only ever produce an empty list
   * is worse than no chip. It appears with the first bookmark.
   */
  savedOffered: boolean;
  savedOnly: boolean;
  onToggleSaved: () => void;
}

/**
 * The row under the search field: everything that narrows the list without
 * being typed. Saved comes first, since it is about the visitor rather than
 * about the city.
 */
export function FilterChips({
  available,
  selected,
  onToggle,
  savedOffered,
  savedOnly,
  onToggleSaved,
}: FilterChipsProps) {
  if (available.length === 0 && !savedOffered) return null;

  const active = new Set(selected);

  return (
    <div className={styles.chips} role="group" aria-label="Filter places">
      {savedOffered ? (
        <button
          type="button"
          className={styles.chip}
          data-kind="saved"
          data-active={String(savedOnly)}
          aria-pressed={savedOnly}
          onClick={onToggleSaved}
        >
          {/* No coloured disc behind this one: the disc is what says "category",
              and this chip is not one. The bookmark fills when the filter is on,
              exactly as it does on the place it came from. */}
          <svg
            viewBox="0 0 16 16"
            fill={savedOnly ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={BOOKMARK} />
          </svg>
          Saved
        </button>
      ) : null}

      {available.map((category) => {
        const meta = CATEGORY_META[category];
        const isActive = active.has(category);

        return (
          <button
            key={category}
            type="button"
            className={styles.chip}
            data-active={String(isActive)}
            aria-pressed={isActive}
            // What colour the chip's mark is drawn in.
            style={{ "--cat": meta.colour } as React.CSSProperties}
            onClick={() => {
              onToggle(category);
            }}
          >
            {/* The same drawing the placeholder tile carries, and heavier here
                only because the chip shows it at half the size. */}
            <span className={styles.chipIcon}>
              <CategoryGlyph category={category} weight={2.5} />
            </span>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

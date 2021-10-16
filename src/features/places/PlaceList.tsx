import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import { OpenBadge } from "./OpenBadge";
import { PlaceImage } from "./PlaceImage";
import { Rating } from "./Rating";
import styles from "./places.module.css";

interface PlaceListProps {
  places: readonly Place[];
  savedIds: readonly string[];
  onSelect: (placeId: string) => void;
  onClearFilters: () => void;
}

export function PlaceList({ places, savedIds, onSelect, onClearFilters }: PlaceListProps) {
  if (places.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Nothing here matches.</p>
        <button type="button" className={styles.textButton} onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  const saved = new Set(savedIds);

  return (
    <>
      <p className={styles.resultCount} role="status">
        {places.length} place{places.length === 1 ? "" : "s"}
      </p>

      <ul className={styles.list}>
        {places.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              className={styles.listItem}
              onClick={() => {
                onSelect(place.id);
              }}
            >
              <span className={styles.listItemBody}>
                <span className={styles.listItemName}>
                  {place.name}
                  {saved.has(place.id) && (
                    <span className={styles.savedMark} title="Saved">
                      ✦
                    </span>
                  )}
                </span>
                <span className={styles.listItemMeta}>
                  {CATEGORY_META[categoryOf(place)].label} · {place.type}
                </span>
                <span className={styles.listItemMeta}>
                  <Rating rating={place.rating} />
                  <OpenBadge schedule={place.schedule} />
                </span>
              </span>

              <PlaceImage place={place} variant="thumb" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

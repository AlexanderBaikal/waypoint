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

/**
 * How many results the panel draws. The map shows every match; this list is a
 * reading surface, and a thousand rows is neither readable nor cheap — each one
 * costs half a dozen DOM nodes. Search and the category chips are how you get
 * to the rest, which is how a map application behaves anyway.
 */
const VISIBLE = 60;

const count = (value: number) => value.toLocaleString("en-US");

export function PlaceList({
  places,
  savedIds,
  onSelect,
  onClearFilters,
}: PlaceListProps) {
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
  const shown = places.length > VISIBLE ? places.slice(0, VISIBLE) : places;

  return (
    <>
      <p className={styles.resultCount} role="status">
        {count(places.length)} place{places.length === 1 ? "" : "s"}
        {shown.length < places.length && ` · showing ${String(shown.length)}`}
      </p>

      <ul className={styles.list}>
        {shown.map((place) => (
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

      {shown.length < places.length && (
        <p className={styles.listFooter}>
          {count(places.length - shown.length)} more on the map. Search or pick a category
          to narrow them down.
        </p>
      )}
    </>
  );
}

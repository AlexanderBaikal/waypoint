import { Mark } from "../../components/Mark";
import type { Place } from "../../domain/place";
import { OpenBadge } from "./OpenBadge";
import { PlaceImage } from "./PlaceImage";
import { Rating } from "./Rating";
import styles from "./places.module.css";

interface PlaceListProps {
  places: readonly Place[];
  savedIds: readonly string[];
  /** Whether a query, a category or the saved chip is narrowing `places`. */
  filtering: boolean;
  /** Which of those it is, where an empty result needs a different sentence. */
  savedOnly: boolean;
  onSelect: (placeId: string) => void;
  onClearFilters: () => void;
}

/**
 * How many results the panel draws. The map shows every match; this list is a
 * reading surface, and a thousand rows is neither readable nor cheap at half a
 * dozen DOM nodes each. Search and the chips reach the rest.
 */
const VISIBLE = 60;

const count = (value: number) => value.toLocaleString("en-US");

export function PlaceList({
  places,
  savedIds,
  filtering,
  savedOnly,
  onSelect,
  onClearFilters,
}: PlaceListProps) {
  // Nothing has been asked for yet. Sixty places off the top of an alphabetical
  // list answer no question, and the map is already showing all of them, so the
  // panel says what is out there and waits.
  if (!filtering) {
    return (
      <div className={styles.intro}>
        {/* The mark gives the invitation something to look at, so a panel
            holding two lines of text does not read as one that failed to
            load the rest. */}
        <span className={styles.introMark}>
          <Mark className={styles.introPin} />
        </span>
        <p className={styles.introCount}>{count(places.length)} places on the map</p>
        <p className={styles.hint}>Search for one, or pick a category.</p>
      </div>
    );
  }

  if (places.length === 0) {
    // "Nothing here matches" would be a lie to someone who has saved nothing:
    // there is no list to match against yet, and the way out is a place rather
    // than a different query.
    const nothingSaved = savedOnly && savedIds.length === 0;

    return (
      <div className={styles.empty}>
        <p>{nothingSaved ? "Nothing saved yet." : "Nothing here matches."}</p>
        {nothingSaved ? (
          <p className={styles.hint}>Open a place and press Save to keep it here.</p>
        ) : null}
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
              {/* Name, score, then type and whether it is open. The category
                  is already carried by the picture's colour, so the last line
                  spends its width on the specific type. The separator before
                  the badge is drawn in CSS, since the badge renders nothing at
                  all for a place with no hours. */}
              <span className={styles.listItemBody}>
                <span className={styles.listItemName}>
                  {place.name}
                  {saved.has(place.id) && (
                    <span className={styles.savedMark} title="Saved">
                      ✦
                    </span>
                  )}
                </span>
                <Rating rating={place.rating} />
                <span className={styles.listItemMeta}>
                  {place.type}
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

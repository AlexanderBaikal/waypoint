import { useDeferredValue, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { useListPlacesQuery } from "./app/placesApi";
import {
  categoryToggled,
  filtersCleared,
  listExpandedChanged,
  placeSelected,
  queryChanged,
} from "./app/uiSlice";
import { presentCategories } from "./domain/categories";
import { filterPlaces } from "./domain/search";
import { AccountButton } from "./features/auth/AccountButton";
import { useAuthSession } from "./features/auth/useAuthSession";
import { MapView } from "./features/map/MapView";
import { PlaceList } from "./features/places/PlaceList";
import { PlacePanel } from "./features/places/PlacePanel";
import { savedToggled } from "./features/saved/savedSlice";
import { CategoryChips } from "./features/search/CategoryChips";
import { SearchBar } from "./features/search/SearchBar";
import styles from "./App.module.css";

/** RTK Query hands back either our QueryError or a SerializedError. */
function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message) return message;
  }
  return "Could not load places.";
}

export function App() {
  useAuthSession();

  const dispatch = useAppDispatch();
  const { data: places = [], isLoading, isError, error, refetch } = useListPlacesQuery();
  const { query, categories, selectedPlaceId, listExpanded } = useAppSelector(
    (s) => s.ui,
  );
  const savedIds = useAppSelector((state) => state.saved.ids);

  // Scoring a few thousand places, re-clustering them and repainting the panel
  // is more work than a keystroke should block on. Deferring the query lets the
  // field update at once and the results catch up a frame later; the text you
  // typed never lags behind your fingers.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () => filterPlaces(places, { query: deferredQuery, categories }),
    [places, deferredQuery, categories],
  );

  const available = useMemo(() => presentCategories(places), [places]);
  const selected = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  // A deep link can name a place that has since been filtered out or removed;
  // the map still shows every marker it knows about in that case. Memoised
  // because the marker layer keys its work off this array's identity.
  const markers = useMemo(
    () => (selected && !filtered.includes(selected) ? [...filtered, selected] : filtered),
    [filtered, selected],
  );

  return (
    <div className={styles.app}>
      <aside className={styles.panel} data-expanded={String(listExpanded)}>
        <header className={styles.masthead}>
          <h1 className={styles.wordmark}>
            Waypoint<span className={styles.dot}>.</span>
          </h1>
          <AccountButton />
        </header>

        <button
          type="button"
          className={styles.grabber}
          onClick={() => dispatch(listExpandedChanged(!listExpanded))}
          aria-label={listExpanded ? "Collapse list" : "Expand list"}
        />

        <div className={styles.panelBody}>
          {selected ? (
            <PlacePanel
              place={selected}
              saved={savedIds.includes(selected.id)}
              onBack={() => dispatch(placeSelected(null))}
              onToggleSaved={(id) => dispatch(savedToggled(id))}
            />
          ) : (
            <>
              <div className={styles.filters}>
                <SearchBar
                  value={query}
                  resultCount={filtered.length}
                  onChange={(value) => dispatch(queryChanged(value))}
                />
                <CategoryChips
                  available={available}
                  selected={categories}
                  onToggle={(category) => dispatch(categoryToggled(category))}
                />
              </div>

              {isLoading ? (
                <p className={styles.state}>Loading places…</p>
              ) : isError ? (
                <div className={styles.state}>
                  <p>{errorMessage(error)}</p>
                  <button
                    type="button"
                    className={styles.retry}
                    onClick={() => void refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <PlaceList
                  places={filtered}
                  savedIds={savedIds}
                  onSelect={(id) => dispatch(placeSelected(id))}
                  onClearFilters={() => dispatch(filtersCleared())}
                />
              )}
            </>
          )}
        </div>
      </aside>

      <main className={styles.map}>
        <MapView
          places={markers}
          selected={selected}
          filtered={deferredQuery.trim() !== "" || categories.length > 0}
          onSelect={(id) => dispatch(placeSelected(id))}
        />
      </main>
    </div>
  );
}

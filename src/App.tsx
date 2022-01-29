import { useDeferredValue, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { useListPlacesQuery } from "./app/placesApi";
import {
  categoryToggled,
  filtersCleared,
  listExpandedChanged,
  placeSelected,
  queryChanged,
  themeToggled,
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

/**
 * The wordmark's mark is the pin the map draws — same circle, same stem. It is
 * inline rather than the favicon file so it inherits the palette's tokens and
 * cannot drift away from the markers it stands for.
 */
function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 20 26" aria-hidden="true">
      <circle cx="10" cy="9" r="6.5" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <path d="M10 17v7" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function App() {
  useAuthSession();

  const dispatch = useAppDispatch();
  const { data: places = [], isLoading, isError, error, refetch } = useListPlacesQuery();
  const { query, categories, selectedPlaceId, listExpanded, theme } = useAppSelector(
    (s) => s.ui,
  );
  const savedIds = useAppSelector((state) => state.saved.ids);

  // On the document element rather than on our own root, because the theme has
  // to reach things React does not render inside it: Leaflet's controls, its
  // attribution, and the scrollbars the UA paints from `color-scheme`.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  // Whether the user has asked for anything. Decides both whether the map
  // reframes and whether the panel lists results at all.
  const filtering = deferredQuery.trim() !== "" || categories.length > 0;

  return (
    <div className={styles.app}>
      {/* The map is painted first and fills the window; the panel floats over
          it. Source order matters here — the panel has to come second to sit
          on top without a z-index war against Leaflet's own controls. */}
      <main className={styles.map}>
        <MapView
          places={markers}
          selected={selected}
          filtered={filtering}
          onSelect={(id) => dispatch(placeSelected(id))}
          theme={theme}
          onToggleTheme={() => dispatch(themeToggled())}
        />
      </main>

      <aside className={styles.panel} data-expanded={String(listExpanded)}>
        <header className={styles.masthead}>
          <h1 className={styles.wordmark}>
            <Mark />
            Waypoint
          </h1>
          <AccountButton />
        </header>

        <button
          type="button"
          className={styles.grabber}
          onClick={() => dispatch(listExpandedChanged(!listExpanded))}
          aria-label={listExpanded ? "Collapse list" : "Expand list"}
        />

        {/* Outside the scroller on purpose. The field is how you get anything
            out of this panel, so it does not get to scroll away with the
            results it produces. */}
        {selected ? null : (
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
        )}

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
                  places={filtering ? filtered : places}
                  savedIds={savedIds}
                  filtering={filtering}
                  onSelect={(id) => dispatch(placeSelected(id))}
                  onClearFilters={() => dispatch(filtersCleared())}
                />
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

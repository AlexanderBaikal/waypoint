import { useCallback, useDeferredValue, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { errorMessage, useListPlacesQuery } from "./app/placesApi";
import {
  selectAvailableCategories,
  selectCategories,
  selectEditor,
  selectFiltering,
  selectKnownTypes,
  selectListExpanded,
  selectMarkerPlaces,
  selectQuery,
  selectSavedIds,
  selectSavedOnly,
  selectSelectedPlace,
  selectTheme,
  selectVisiblePlaces,
} from "./app/selectors";
import {
  categoryToggled,
  editorOpened,
  filtersCleared,
  listExpandedChanged,
  placeSelected,
  queryChanged,
  savedOnlyToggled,
  themeToggled,
} from "./app/uiSlice";
import { INITIAL_VIEW } from "./config";
import { Colophon } from "./components/Colophon";
import { Mark } from "./components/Mark";
import type { Place } from "./domain/place";
import { mayEdit } from "./data/repository";
import { AccountButton } from "./features/auth/AccountButton";
import { useAuthSession } from "./features/auth/useAuthSession";
import { useWriteIdentity } from "./features/auth/useAuthor";
import { MapView } from "./features/map/MapView";
import { PlaceForm } from "./features/places/PlaceForm";
import { PlaceList } from "./features/places/PlaceList";
import { PlacePanel } from "./features/places/PlacePanel";
import { ReviewForm } from "./features/places/ReviewForm";
import { savedToggled } from "./features/saved/savedSlice";
import { FilterChips } from "./features/search/FilterChips";
import { SearchBar } from "./features/search/SearchBar";
import styles from "./App.module.css";

/** One array rather than a fresh one per render, so the selectors below can
    memoise across the load as well as after it. */
const NO_PLACES: readonly Place[] = [];

export function App() {
  useAuthSession();

  const dispatch = useAppDispatch();
  const {
    data: places = NO_PLACES,
    isLoading,
    isError,
    error,
    refetch,
  } = useListPlacesQuery();

  const query = useAppSelector(selectQuery);
  const categories = useAppSelector(selectCategories);
  const savedOnly = useAppSelector(selectSavedOnly);
  const listExpanded = useAppSelector(selectListExpanded);
  const theme = useAppSelector(selectTheme);
  const editor = useAppSelector(selectEditor);
  const savedIds = useAppSelector(selectSavedIds);
  const { author } = useWriteIdentity();

  // On the document element rather than our own root, because the theme has to
  // reach what React does not render: Leaflet's controls, its attribution, and
  // the scrollbars the browser paints from `color-scheme`.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Scoring the dataset and repainting the panel is more work than a keystroke
  // should block on. Deferring the query lets the field update immediately and
  // the results catch up a frame later.
  const deferredQuery = useDeferredValue(query);

  // The places and the deferred query are not the store's to hold, so they are
  // handed to the selectors instead. Every one of these is memoised on them.
  const filtered = useAppSelector((state) =>
    selectVisiblePlaces(state, places, deferredQuery),
  );
  const markers = useAppSelector((state) =>
    selectMarkerPlaces(state, places, deferredQuery),
  );
  const filtering = useAppSelector((state) =>
    selectFiltering(state, places, deferredQuery),
  );
  const selected = useAppSelector((state) => selectSelectedPlace(state, places));
  const available = useAppSelector((state) => selectAvailableCategories(state, places));
  const knownTypes = useAppSelector((state) => selectKnownTypes(state, places));

  const editing = editor === "edit" ? selected : null;

  // Stable, so the memoised map is not re-rendered by a keystroke in the panel
  // it does not draw.
  const selectPlace = useCallback(
    (placeId: string) => {
      dispatch(placeSelected(placeId));
    },
    [dispatch],
  );
  const toggleTheme = useCallback(() => {
    dispatch(themeToggled());
  }, [dispatch]);

  return (
    <div className={styles.app}>
      {/* The map fills the window and the panel floats over it. Source order
          matters: the panel comes second so it sits on top without a z-index
          war against Leaflet's own controls. */}
      <main className={styles.map}>
        <MapView
          places={markers}
          selected={selected}
          filtered={filtering}
          onSelect={selectPlace}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </main>

      <aside className={styles.panel} data-expanded={String(listExpanded)}>
        <button
          type="button"
          className={styles.grabber}
          onClick={() => dispatch(listExpandedChanged(!listExpanded))}
          aria-label={listExpanded ? "Collapse list" : "Expand list"}
        />

        {/* Outside the scroller on purpose: the field must not scroll away
            with the results it produces. */}
        <div className={styles.header}>
          <header className={styles.masthead}>
            <h1 className={styles.wordmark}>
              <Mark className={styles.mark} />
              Waypoint
            </h1>
            <div className={styles.mastheadActions}>
              {/* Hidden while a form is open: the panel is the only place a
                  form fits, and there is nowhere for a second one to go. */}
              {author && !editor ? (
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => dispatch(editorOpened("create"))}
                >
                  + Add
                </button>
              ) : null}
              <AccountButton />
            </div>
          </header>

          {selected || editor ? null : (
            <div className={styles.filters}>
              <SearchBar
                value={query}
                resultCount={filtered.length}
                onChange={(value) => dispatch(queryChanged(value))}
              />
              <FilterChips
                available={available}
                selected={categories}
                onToggle={(category) => dispatch(categoryToggled(category))}
                savedOffered={savedIds.length > 0 || savedOnly}
                savedOnly={savedOnly}
                onToggleSaved={() => dispatch(savedOnlyToggled())}
              />
            </div>
          )}
        </div>

        <div className={styles.panelBody}>
          {editor === "review" && selected ? (
            <ReviewForm placeId={selected.id} placeName={selected.name} />
          ) : editor === "create" || editing ? (
            <PlaceForm
              place={editing}
              origin={selected?.coords ?? INITIAL_VIEW.center}
              knownTypes={knownTypes}
            />
          ) : selected ? (
            <PlacePanel
              place={selected}
              saved={savedIds.includes(selected.id)}
              onBack={() => dispatch(placeSelected(null))}
              onToggleSaved={(id) => dispatch(savedToggled(id))}
              canEdit={mayEdit(selected, author?.uid ?? null)}
              onEdit={() => dispatch(editorOpened("edit"))}
              onReview={() => dispatch(editorOpened("review"))}
            />
          ) : (
            <>
              {isLoading ? (
                <p className={styles.state}>Loading places…</p>
              ) : isError ? (
                <div className={styles.state}>
                  <p>{errorMessage(error, "Could not load places.")}</p>
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
                  savedOnly={savedOnly}
                  onSelect={selectPlace}
                  onClearFilters={() => dispatch(filtersCleared())}
                />
              )}
            </>
          )}
        </div>

        <Colophon />
      </aside>
    </div>
  );
}

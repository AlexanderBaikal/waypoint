import { useDeferredValue, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { errorMessage, useListPlacesQuery } from "./app/placesApi";
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
import { Mark } from "./components/Mark";
import { presentCategories } from "./domain/categories";
import { filterPlaces } from "./domain/search";
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

export function App() {
  useAuthSession();

  const dispatch = useAppDispatch();
  const { data: places = [], isLoading, isError, error, refetch } = useListPlacesQuery();
  const { query, categories, savedOnly, selectedPlaceId, listExpanded, theme, editor } =
    useAppSelector((s) => s.ui);
  const savedIds = useAppSelector((state) => state.saved.ids);
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

  // Saved is applied after the search rather than inside it: which places this
  // browser bookmarked is not something the domain scores.
  //
  // In two steps rather than one so that `savedIds` is not a dependency of the
  // search. Bookmarking replaces that array, and folding the two together would
  // re-run the search and hand back a new array of the same places on every
  // press — which the marker layer reads as a new dataset and rebuilds, and the
  // map as a reason to reframe.
  const matched = useMemo(
    () => filterPlaces(places, { query: deferredQuery, categories }),
    [places, deferredQuery, categories],
  );
  const filtered = useMemo(() => {
    if (!savedOnly) return matched;

    const saved = new Set(savedIds);
    return matched.filter((place) => saved.has(place.id));
  }, [matched, savedOnly, savedIds]);

  const available = useMemo(() => presentCategories(places), [places]);
  const selected = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  // A deep link can name a place the current filter excludes, and the map still
  // has to show it. Memoised because the marker layer keys its work off this
  // array's identity.
  const markers = useMemo(
    () => (selected && !filtered.includes(selected) ? [...filtered, selected] : filtered),
    [filtered, selected],
  );

  // Whether the user has asked for anything. Decides both whether the map
  // reframes and whether the panel lists results at all.
  const filtering = deferredQuery.trim() !== "" || categories.length > 0 || savedOnly;

  const knownTypes = useMemo(() => places.map((place) => place.type), [places]);
  const editing = editor?.mode === "edit" ? selected : null;

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
          onSelect={(id) => dispatch(placeSelected(id))}
          theme={theme}
          onToggleTheme={() => dispatch(themeToggled())}
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
                  onClick={() => dispatch(editorOpened({ mode: "create" }))}
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
          {editor?.mode === "review" && selected ? (
            <ReviewForm placeId={selected.id} placeName={selected.name} />
          ) : editor?.mode === "create" || editing ? (
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
              onEdit={() =>
                dispatch(editorOpened({ mode: "edit", placeId: selected.id }))
              }
              onReview={() =>
                dispatch(editorOpened({ mode: "review", placeId: selected.id }))
              }
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

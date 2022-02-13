import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Theme } from "../../config";
import type { Place } from "../../domain/place";
import { useLeafletMap } from "./useLeafletMap";
import { useMarkerLayer } from "./useMarkerLayer";
import styles from "./MapView.module.css";

interface MapViewProps {
  places: readonly Place[];
  selected: Place | null;
  /**
   * Whether the current list is the result of a filter. Only then is reframing
   * worthwhile: fitting the unfiltered set just zooms out to the whole city.
   */
  filtered: boolean;
  onSelect: (placeId: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

/** Keeps a fitted marker clear of the panel edges. */
const FIT_PADDING: L.PointExpression = [64, 64];

export function MapView({
  places,
  selected,
  filtered,
  onSelect,
  theme,
  onToggleTheme,
}: MapViewProps) {
  const { ref, map } = useLeafletMap(theme);

  useMarkerLayer(map, places, selected?.id ?? null, onSelect);

  useEffect(() => {
    if (!map || !selected) return;
    map.flyTo([selected.coords.lat, selected.coords.lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
  }, [map, selected]);

  // When a filter narrows the list, frame what is left. `places` is memoised
  // upstream and changes identity only when its contents do, so comparing the
  // reference is enough, and stays free as the dataset grows.
  const lastPlaces = useRef(places);
  useEffect(() => {
    if (!map || selected) return;
    if (places === lastPlaces.current) return;
    lastPlaces.current = places;

    if (!filtered || places.length === 0) return;
    const bounds = L.latLngBounds(
      places.map((place) => [place.coords.lat, place.coords.lng]),
    );
    map.flyToBounds(bounds, { padding: FIT_PADDING, maxZoom: 16, duration: 0.6 });
  }, [map, places, selected, filtered]);

  const zoomBy = useCallback(
    (delta: number) => {
      map?.setZoom(map.getZoom() + delta);
    },
    [map],
  );

  const locate = useCallback(() => {
    map?.locate({ setView: true, maxZoom: 15 });
  }, [map]);

  const dark = theme === "dark";

  return (
    <div className={styles.root}>
      <div ref={ref} className={styles.canvas} data-testid="map-canvas" />

      <div className={styles.controls}>
        {/* A half-filled disc rather than a sun and moon: this switches how
            everything is drawn, not what time it is. */}
        <button
          type="button"
          className={styles.round}
          onClick={onToggleTheme}
          aria-pressed={dark}
          aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
          title={dark ? "Light theme" : "Dark theme"}
        >
          <svg
            className={styles.glyph}
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.round}
          onClick={locate}
          aria-label="Find my location"
          title="Your location"
        >
          <svg
            className={styles.glyph}
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" strokeLinecap="round" />
          </svg>
        </button>

        <div className={styles.zoom}>
          <button
            type="button"
            onClick={() => {
              zoomBy(1);
            }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              zoomBy(-1);
            }}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}

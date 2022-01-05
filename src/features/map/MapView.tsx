import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Basemap } from "../../config";
import type { Place } from "../../domain/place";
import { useLeafletMap } from "./useLeafletMap";
import { useMarkerLayer } from "./useMarkerLayer";
import styles from "./MapView.module.css";

interface MapViewProps {
  places: readonly Place[];
  selected: Place | null;
  /**
   * Whether the current list is the result of a filter. Only then is it worth
   * reframing the map — the dataset spans two continents, so fitting the
   * unfiltered set just zooms out to the whole world.
   */
  filtered: boolean;
  onSelect: (placeId: string) => void;
  basemap: Basemap;
  onToggleBasemap: () => void;
}

/** Keeps a fitted marker clear of the panel edges. */
const FIT_PADDING: L.PointExpression = [64, 64];

export function MapView({
  places,
  selected,
  filtered,
  onSelect,
  basemap,
  onToggleBasemap,
}: MapViewProps) {
  const { ref, map } = useLeafletMap(basemap);

  useMarkerLayer(map, places, selected?.id ?? null, onSelect);

  useEffect(() => {
    if (!map || !selected) return;
    map.flyTo([selected.coords.lat, selected.coords.lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
  }, [map, selected]);

  // When a filter narrows the list, frame what is left so the user is not left
  // staring at empty streets. `places` is memoised upstream and changes
  // identity only when its contents do, so comparing the reference is enough —
  // and unlike joining every id into a string, it stays free as the dataset
  // grows into the thousands.
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

  const dark = basemap === "dark";

  return (
    <div className={styles.root} data-basemap={basemap}>
      <div ref={ref} className={styles.canvas} data-testid="map-canvas" />

      <div className={styles.controls}>
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
        <button type="button" onClick={locate} aria-label="Find my location">
          ⌖
        </button>

        {/* A half-filled disc rather than a sun and a moon: this changes how
            the map is drawn, not what time it is. It sits below the zoom pair
            because it is the one control here you press once and forget. */}
        <button
          type="button"
          onClick={onToggleBasemap}
          aria-pressed={dark}
          aria-label={dark ? "Use the light map" : "Use the dark map"}
          title={dark ? "Light map" : "Dark map"}
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
      </div>
    </div>
  );
}

import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
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
}

/** Keeps a fitted marker clear of the panel edges. */
const FIT_PADDING: L.PointExpression = [64, 64];

export function MapView({ places, selected, filtered, onSelect }: MapViewProps) {
  const { ref, map } = useLeafletMap();

  useMarkerLayer(map, places, selected?.id ?? null, onSelect);

  useEffect(() => {
    if (!map || !selected) return;
    map.flyTo([selected.coords.lat, selected.coords.lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
  }, [map, selected]);

  // When a filter narrows the list, frame what is left so the user is not left
  // staring at empty streets. Tracking the signature keeps this to actual
  // changes rather than every render.
  const signature = places.map((place) => place.id).join(",");
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (!map || selected) return;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;

    if (!filtered || places.length === 0) return;
    const bounds = L.latLngBounds(
      places.map((place) => [place.coords.lat, place.coords.lng]),
    );
    map.flyToBounds(bounds, { padding: FIT_PADDING, maxZoom: 16, duration: 0.6 });
  }, [map, places, selected, signature, filtered]);

  const zoomBy = useCallback(
    (delta: number) => {
      map?.setZoom(map.getZoom() + delta);
    },
    [map],
  );

  const locate = useCallback(() => {
    map?.locate({ setView: true, maxZoom: 15 });
  }, [map]);

  return (
    <div className={styles.root}>
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
      </div>
    </div>
  );
}

import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import { tileOptions, tiles, type Theme } from "../../config";
import type { Coords } from "../../domain/place";
import styles from "./placeForm.module.css";

interface LocationPickerProps {
  value: Coords;
  onChange: (coords: Coords) => void;
  theme: Theme;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Position by moving the map under a fixed crosshair, rather than by dragging a
 * marker. On a phone your thumb is over the marker exactly when you need to see
 * where it is going, and the crosshair never ends up under it.
 *
 * Its own Leaflet instance rather than a mode on the main map: the picker is
 * mounted only while the form is open, and keeping it separate means the map
 * behind the panel does not have to know that a form exists.
 */
export function LocationPicker({ value, onChange, theme }: LocationPickerProps) {
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.TileLayer | null>(null);
  // What we last told the parent. Re-centring on our own value would fight the
  // gesture that produced it.
  const emitted = useRef<Coords>(value);
  const changed = useRef(onChange);

  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;

    const start = emitted.current;
    const instance = L.map(element, {
      center: [start.lat, start.lng],
      zoom: 16,
      zoomControl: true,
      // The main map behind the panel carries the credit for these tiles; a
      // second copy inside a form field would only crowd it.
      attributionControl: false,
      // The picker sits partway down a scrolling form. Left on, the wheel would
      // zoom the map instead of scrolling past it, and there would be no way to
      // reach the fields below without the scrollbar.
      scrollWheelZoom: false,
    });

    const source = tiles[theme];
    layer.current = L.tileLayer(source.url, {
      ...tileOptions,
      detectRetina: true,
    }).addTo(instance);

    const report = () => {
      const centre = instance.getCenter();
      const coords = { lat: round(centre.lat), lng: round(centre.lng) };
      emitted.current = coords;
      changed.current(coords);
    };
    instance.on("moveend", report);

    const observer = new ResizeObserver(() => {
      instance.invalidateSize({ animate: false });
    });
    observer.observe(element);

    map.current = instance;

    return () => {
      observer.disconnect();
      instance.off("moveend", report);
      instance.remove();
      map.current = null;
      layer.current = null;
    };
    // The theme is read once, at creation; the effect below switches it after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layer.current?.setUrl(tiles[theme].url);
  }, [theme]);

  // Follows the value only when it moved somewhere other than here — typing
  // into the coordinate fields, or the form opening on an existing place.
  useEffect(() => {
    if (value.lat === emitted.current.lat && value.lng === emitted.current.lng) return;
    emitted.current = value;
    map.current?.setView([value.lat, value.lng], map.current.getZoom());
  }, [value]);

  return (
    <div className={styles.picker}>
      <div ref={ref} className={styles.pickerCanvas} data-testid="location-picker" />

      {/* Purely decorative: the coordinates below are the accessible readout. */}
      <svg className={styles.crosshair} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="9" />
        <path d="M20 3v7M20 30v7M3 20h7M30 20h7" />
      </svg>

      <button
        type="button"
        className={styles.locate}
        onClick={() => map.current?.locate({ setView: true, maxZoom: 17 })}
      >
        Use my location
      </button>
    </div>
  );
}

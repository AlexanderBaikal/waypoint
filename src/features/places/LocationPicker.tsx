import L from "leaflet";
import { useCallback, useEffect, useRef } from "react";
import { tileLayer } from "../map/tileLayer";
import type { Coords } from "../../domain/place";
import styles from "./placeForm.module.css";

interface LocationPickerProps {
  value: Coords;
  onChange: (coords: Coords) => void;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Position by moving the map under a fixed crosshair rather than by dragging a
 * marker, which on a phone puts your thumb over the marker exactly when you
 * need to see where it is going.
 *
 * Runs its own Leaflet instance, mounted only while the form is open, so the
 * map behind the panel does not have to know a form exists.
 *
 * Always uses the light basemap: CARTO holds native tiles to zoom 19 and serves
 * a 2x, where the dark source runs out at 16 and gets stretched at exactly the
 * zoom a pin is placed at.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const map = useRef<L.Map | null>(null);
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
      // The main map behind the panel already credits these tiles.
      attributionControl: false,
      // The picker sits partway down a scrolling form; left on, the wheel would
      // zoom the map instead of reaching the fields below it.
      scrollWheelZoom: false,
    });

    tileLayer("light").addTo(instance);

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
    };
  }, []);

  // Follows the value only when it moved somewhere other than here: the form
  // opening on an existing place, or a coordinate typed in directly.
  useEffect(() => {
    if (value.lat === emitted.current.lat && value.lng === emitted.current.lng) return;
    emitted.current = value;
    map.current?.setView([value.lat, value.lng], map.current.getZoom());
  }, [value]);

  // `data-theme` pins the subtree to the light palette, because the zoom
  // buttons and crosshair sit over the light basemap rather than over the
  // panel behind them.
  return (
    <div className={styles.picker} data-theme="light">
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

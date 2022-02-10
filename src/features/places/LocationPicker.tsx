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
 * Position by moving the map under a fixed crosshair, rather than by dragging a
 * marker. On a phone your thumb is over the marker exactly when you need to see
 * where it is going, and the crosshair never ends up under it.
 *
 * Its own Leaflet instance rather than a mode on the main map: the picker is
 * mounted only while the form is open, and keeping it separate means the map
 * behind the panel does not have to know that a form exists.
 *
 * Always the light basemap, whatever the interface is wearing. Placing a pin is
 * the one task here that is about the map's detail rather than its mood, and
 * the light source is the better map for it: CARTO holds native tiles to zoom
 * 19 and serves a 2x, where the dark source runs out at 16 and gets stretched.
 * A dark map that goes soft at exactly the zoom you place a pin at is worse
 * than a bright rectangle in a dark form.
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
      // The main map behind the panel carries the credit for these tiles; a
      // second copy inside a form field would only crowd it.
      attributionControl: false,
      // The picker sits partway down a scrolling form. Left on, the wheel would
      // zoom the map instead of scrolling past it, and there would be no way to
      // reach the fields below without the scrollbar.
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

  // Follows the value only when it moved somewhere other than here — typing
  // into the coordinate fields, or the form opening on an existing place.
  useEffect(() => {
    if (value.lat === emitted.current.lat && value.lng === emitted.current.lng) return;
    emitted.current = value;
    map.current?.setView([value.lat, value.lng], map.current.getZoom());
  }, [value]);

  // `data-theme` pins the subtree to the light palette. The tiles under this
  // chrome are the light basemap whatever the interface is wearing, so the zoom
  // buttons and the crosshair have to read against those rather than against a
  // dark panel that is not underneath them.
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

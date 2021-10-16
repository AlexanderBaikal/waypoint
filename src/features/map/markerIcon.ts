import L from "leaflet";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import styles from "./MapView.module.css";

const SIZE = 30;
const SELECTED_SIZE = 42;

/**
 * divIcon rather than the default image icon: no sprite to bundle, no broken
 * icon paths under Vite, and the marker can be styled and animated from CSS
 * like the rest of the interface.
 */
export function markerIcon(place: Place, selected: boolean): L.DivIcon {
  const size = selected ? SELECTED_SIZE : SIZE;
  const glyph = CATEGORY_META[categoryOf(place)].glyph;

  // CSS module lookups are `string | undefined` under noUncheckedIndexedAccess,
  // and these go into raw HTML rather than a className prop.
  const wrapperClass = styles.pinWrapper ?? "";
  const pinClass = styles.pin ?? "";

  return L.divIcon({
    className: wrapperClass,
    html: `<span class="${pinClass}" data-selected="${String(selected)}">${glyph}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    // Keeps the tooltip clear of the pin at either size.
    tooltipAnchor: [0, -size / 2],
  });
}

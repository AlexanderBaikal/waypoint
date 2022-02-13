import L from "leaflet";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import styles from "./MapView.module.css";

const SIZE = 26;
const SELECTED_SIZE = 38;

/**
 * A divIcon is raw HTML and place names are third-party data containing quotes
 * and ampersands. Leaflet's `alt` option is no help: it only reaches the DOM
 * for image icons.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * divIcon rather than the default image icon: no sprite to bundle, no broken
 * icon paths under Vite, and the marker is styled from the same CSS as the rest
 * of the interface.
 */
export function markerIcon(place: Place, selected: boolean): L.DivIcon {
  const size = selected ? SELECTED_SIZE : SIZE;
  const category = CATEGORY_META[categoryOf(place)];
  const label = escapeHtml(`${place.name}, ${place.type}`);

  // CSS module lookups are `string | undefined` under noUncheckedIndexedAccess,
  // and these go into raw HTML rather than a className prop.
  const wrapperClass = styles.pinWrapper ?? "";
  const pinClass = styles.pin ?? "";

  return L.divIcon({
    className: wrapperClass,
    // The colour is interpolated unescaped, which is safe only because it comes
    // from CATEGORY_META, a local table of hex literals. Nothing from the place
    // itself reaches this line unescaped.
    html:
      `<span class="${pinClass}" role="img" aria-label="${label}"` +
      ` style="--cat:${category.colour}"` +
      ` data-selected="${String(selected)}">${category.glyph}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    // Keeps the tooltip clear of the pin at either size.
    tooltipAnchor: [0, -size / 2],
  });
}

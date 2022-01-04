import L from "leaflet";
import { CATEGORY_META, categoryOf } from "../../domain/categories";
import type { Place } from "../../domain/place";
import styles from "./MapView.module.css";

const SIZE = 26;
const SELECTED_SIZE = 38;

/**
 * A divIcon is raw HTML, and place names are third-party data — the imported
 * dataset contains quotes and ampersands. Leaflet's own `alt` option is no help
 * here: it only reaches the DOM for image icons.
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
 * icon paths under Vite, and the marker can be styled and animated from CSS
 * like the rest of the interface.
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
    // The colour is interpolated into a style attribute unescaped, which is
    // safe only because it comes from CATEGORY_META — our own table of hex
    // literals. The place's own fields never reach this line unescaped.
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

/**
 * A cluster is drawn as the count itself. Its size grows with the logarithm of
 * that count rather than with the count: the difference between 5 and 50 places
 * should read at a glance, the difference between 500 and 550 should not.
 */
export function clusterIcon(count: number): L.DivIcon {
  const size = Math.round(34 + Math.min(Math.log10(count), 3) * 9);
  const wrapperClass = styles.pinWrapper ?? "";
  const clusterClass = styles.cluster ?? "";

  return L.divIcon({
    className: wrapperClass,
    html:
      `<span class="${clusterClass}" role="img"` +
      ` aria-label="Cluster of ${String(count)} places">` +
      `${count > 999 ? "999+" : String(count)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

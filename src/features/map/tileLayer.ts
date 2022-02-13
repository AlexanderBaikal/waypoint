import L from "leaflet";
import { tileOptions, tiles, type Theme } from "../../config";

/**
 * Builds the tile layer for a theme. Cache depth and retina support are
 * construction-time options, so switching themes builds a new layer rather than
 * repointing an existing one. Both maps in the app go through here, which keeps
 * each source's quirks declared in one place.
 */
export function tileLayer(theme: Theme): L.TileLayer {
  const source = tiles[theme];
  return L.tileLayer(source.url, {
    attribution: source.attribution,
    subdomains: tileOptions.subdomains,
    maxZoom: tileOptions.maxZoom,
    maxNativeZoom: source.maxNativeZoom,
    detectRetina: source.retina,
    // Spread rather than named: Leaflet merges options with a plain `for…in`,
    // so a key present but undefined replaces the default instead of falling
    // back to it, and a layer with no tile size draws nothing.
    ...(source.tileSize === undefined ? {} : { tileSize: source.tileSize }),
    ...(source.zoomOffset === undefined ? {} : { zoomOffset: source.zoomOffset }),
  });
}

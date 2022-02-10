import L from "leaflet";
import { tileOptions, tiles, type Theme } from "../../config";

/**
 * The two sources differ in more than their URL — how deep their cache goes and
 * whether they have a 2x tile — and those are construction-time options, which
 * is why switching builds a layer rather than repointing one.
 *
 * Both maps in the application build theirs here so a source's quirks are
 * declared once. The location picker used to spell its own layer out and left
 * the dark source's depth cap off it, which is exactly how a form field ended
 * up full of Esri's "Map data not yet available".
 */
export function tileLayer(theme: Theme): L.TileLayer {
  const source = tiles[theme];
  return L.tileLayer(source.url, {
    attribution: source.attribution,
    subdomains: tileOptions.subdomains,
    maxZoom: tileOptions.maxZoom,
    maxNativeZoom: source.maxNativeZoom,
    detectRetina: source.retina,
  });
}

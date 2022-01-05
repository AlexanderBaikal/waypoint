import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_VIEW, tiles, type Basemap } from "../../config";

export interface LeafletBinding {
  /** Attach to the element that should host the map. */
  ref: (element: HTMLDivElement | null) => void;
  map: L.Map | null;
}

/**
 * Owns the Leaflet instance for the lifetime of its container element.
 *
 * This hangs off a ref callback rather than an effect: the map's life is tied
 * to the DOM node, not to a render pass, and React 17 runs the returned
 * cleanup when that node goes away. Doing it in an effect would also mean
 * calling setState during the effect, which is exactly the cascading-render
 * pattern the hooks lint warns about.
 */
export function useLeafletMap(basemap: Basemap): LeafletBinding {
  const [map, setMap] = useState<L.Map | null>(null);
  const layer = useRef<L.TileLayer | null>(null);

  // The ref callback must not depend on the basemap — rebuilding it would tear
  // the map down and put it back on every switch. It reads the current value
  // through a ref instead, so a map created later still starts on the right
  // tiles, and the effect below handles switching an existing one.
  const current = useRef(basemap);

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;

    const instance = L.map(element, {
      center: [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lng],
      zoom: INITIAL_VIEW.zoom,
      zoomControl: false,
      attributionControl: true,
    });

    layer.current = L.tileLayer(tiles[current.current], {
      attribution: tiles.attribution,
      subdomains: tiles.subdomains,
      maxZoom: tiles.maxZoom,
      detectRetina: true,
    }).addTo(instance);

    // Leaflet caches the container size, so it has to be told when the layout
    // shifts under it — the results sheet expanding, or a phone rotating.
    const observer = new ResizeObserver(() => {
      instance.invalidateSize({ animate: false });
    });
    observer.observe(element);

    setMap(instance);

    return () => {
      observer.disconnect();
      instance.remove();
      layer.current = null;
      setMap(null);
    };
  }, []);

  // setUrl rather than swapping layers: Leaflet keeps the tiles already on
  // screen until the replacements load, so the map darkens in place instead of
  // blinking through empty grey.
  useEffect(() => {
    current.current = basemap;
    layer.current?.setUrl(tiles[basemap]);
  }, [basemap]);

  return { ref, map };
}

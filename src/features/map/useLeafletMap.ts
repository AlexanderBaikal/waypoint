import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_VIEW, tileOptions, tiles, type Theme } from "../../config";

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
export function useLeafletMap(theme: Theme): LeafletBinding {
  const [map, setMap] = useState<L.Map | null>(null);
  const layer = useRef<L.TileLayer | null>(null);

  // The ref callback must not depend on the theme — rebuilding it would tear
  // the map down and put it back on every switch. It reads the current value
  // through a ref instead, so a map created later still starts on the right
  // tiles, and the effect below handles switching an existing one.
  const current = useRef(theme);

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;

    const instance = L.map(element, {
      center: [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lng],
      zoom: INITIAL_VIEW.zoom,
      zoomControl: false,
      attributionControl: true,
    });

    const source = tiles[current.current];
    layer.current = L.tileLayer(source.url, {
      attribution: source.attribution,
      ...tileOptions,
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
  // screen until the replacements load, so the map changes in place instead of
  // blinking through empty grey. The credit has to be moved by hand, though —
  // the two basemaps come from different providers, and setUrl does not touch
  // what the layer told the attribution control when it was added.
  useEffect(() => {
    const previous = current.current;
    if (previous === theme) return;
    current.current = theme;

    if (!layer.current || !map) return;
    layer.current.setUrl(tiles[theme].url);
    map.attributionControl
      .removeAttribution(tiles[previous].attribution)
      .addAttribution(tiles[theme].attribution);
  }, [theme, map]);

  return { ref, map };
}

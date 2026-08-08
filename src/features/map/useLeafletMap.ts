import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_VIEW, type Theme } from "../../config";
import { tileLayer } from "./tileLayer";

export interface LeafletBinding {
  /** Attach to the element that should host the map. */
  ref: (element: HTMLDivElement | null) => void;
  map: L.Map | null;
}

/**
 * Owns the Leaflet instance for the lifetime of its container element.
 *
 * Hangs off a ref callback rather than an effect, because the map's life is
 * tied to the DOM node rather than to a render pass and React 19 runs the
 * returned cleanup when that node goes away. An effect would also mean calling
 * setState from inside it.
 */
export function useLeafletMap(theme: Theme): LeafletBinding {
  const [map, setMap] = useState<L.Map | null>(null);
  const layer = useRef<L.TileLayer | null>(null);

  // The ref callback must not depend on the theme: rebuilding it would tear the
  // map down and recreate it on every switch. It reads the value through a ref
  // instead, and the effect below switches an existing map.
  const current = useRef(theme);

  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;

    const instance = L.map(element, {
      center: [INITIAL_VIEW.center.lat, INITIAL_VIEW.center.lng],
      zoom: INITIAL_VIEW.zoom,
      zoomControl: false,
      attributionControl: true,
    });

    layer.current = tileLayer(current.current).addTo(instance);

    // Leaflet caches the container size, so it has to be told when the layout
    // shifts under it: the results sheet expanding, or a phone rotating.
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

  // The new layer goes on over the old one, which only comes off once the new
  // tiles have painted, so the map does not blink through empty ground.
  // Removing the outgoing layer takes its credit off the attribution control
  // with it, which is why nothing here touches attribution by hand.
  useEffect(() => {
    if (current.current === theme) return;
    current.current = theme;
    if (!map) return;

    const outgoing = layer.current;
    const incoming = tileLayer(theme).addTo(map);
    layer.current = incoming;

    let done = false;
    const drop = () => {
      if (done) return;
      done = true;
      outgoing?.remove();
    };

    // `load` is the signal; the timer is the backstop, because a layer whose
    // tiles are all already cached can settle without firing it.
    incoming.once("load", drop);
    const backstop = setTimeout(drop, 2000);

    return () => {
      clearTimeout(backstop);
      drop();
    };
  }, [theme, map]);

  return { ref, map };
}

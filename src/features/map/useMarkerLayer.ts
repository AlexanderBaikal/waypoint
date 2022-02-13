import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { Place } from "../../domain/place";
import { markerIcon } from "./markerIcon";
import { revealZooms } from "./prominence";

/**
 * Below this many places every one gets its own pin. A filtered list should
 * read literally: five results, five pins.
 */
const THINNING_THRESHOLD = 60;

/**
 * How far past the edge of the screen a pin is still built, as a fraction of
 * the viewport. Without it a pin would appear the instant its coordinate
 * crossed the edge, which is where the eye already is.
 */
const OVERSCAN = 0.2;

interface Live {
  marker: L.Marker;
  selected: boolean;
}

/**
 * Keeps a Leaflet layer in step with a list of places.
 *
 * Two things keep this cheap on the full dataset. `revealZooms` gives each
 * place the zoom at which it first has room, so a crowded neighbourhood shows
 * its most prominent place and holds the rest back; the DOM then holds a marker
 * per drawn pin rather than one per place. Markers are also diffed by id rather
 * than rebuilt, so panning touches only the pins that entered or left, and
 * changing the selection repaints two icons.
 */
export function useMarkerLayer(
  map: L.Map | null,
  places: readonly Place[],
  selectedId: string | null,
  onSelect: (placeId: string) => void,
): void {
  const live = useRef(new Map<string, Live>());

  // Marker handlers are bound once, so they must not close over a stale
  // callback.
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  // Read through a ref rather than a dependency: a selection change must
  // repaint two icons, not tear the whole layer down and build it again.
  const selectedRef = useRef(selectedId);
  const renderRef = useRef<(() => void) | null>(null);

  /** Null below the threshold, where thinning is not worth its cost. */
  const reveal = useMemo(
    () => (places.length < THINNING_THRESHOLD ? null : revealZooms(places)),
    [places],
  );

  useEffect(() => {
    if (!map) return;
    const current = live.current;

    /** What should be on the map right now, given the viewport. */
    const wanted = (): readonly Place[] => {
      if (!reveal) return places;

      const bounds = map.getBounds().pad(OVERSCAN);
      const zoom = map.getZoom();

      return places.filter((place) => {
        // The open place keeps its pin wherever the map is pointing and however
        // crowded its corner: the panel and the map have to agree on what is
        // open.
        if (place.id === selectedRef.current) return true;
        if ((reveal.get(place.id) ?? 0) > zoom) return false;
        return bounds.contains([place.coords.lat, place.coords.lng]);
      });
    };

    const build = (place: Place, selected: boolean): L.Marker =>
      L.marker([place.coords.lat, place.coords.lng], {
        icon: markerIcon(place, selected),
        title: place.name,
        // Leaflet stacks markers by latitude, and the open place has to sit
        // above whatever shares its corner. The selection is drawn whether or
        // not the thinning left room for it.
        zIndexOffset: selected ? 1000 : 0,
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(place.name, { direction: "top", opacity: 1 })
        .on("click", () => {
          selectRef.current(place.id);
        })
        .on("keypress", (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === "Enter") selectRef.current(place.id);
        });

    const render = () => {
      const drawn = wanted();
      const selectedId = selectedRef.current;
      const keys = new Set(drawn.map((place) => place.id));

      for (const [id, existing] of current) {
        if (!keys.has(id)) {
          existing.marker.remove();
          current.delete(id);
        }
      }

      for (const place of drawn) {
        const selected = place.id === selectedId;
        const existing = current.get(place.id);

        if (!existing) {
          current.set(place.id, { marker: build(place, selected).addTo(map), selected });
          continue;
        }

        // Same place, changed selection: repaint in place instead of churning
        // the DOM node.
        if (existing.selected !== selected) {
          existing.marker.setIcon(markerIcon(place, selected));
          existing.marker.setZIndexOffset(selected ? 1000 : 0);
          existing.selected = selected;
        }
      }
    };

    renderRef.current = render;
    render();
    map.on("moveend", render);

    return () => {
      map.off("moveend", render);
      renderRef.current = null;
      for (const { marker } of current.values()) marker.remove();
      current.clear();
    };
  }, [map, places, reveal]);

  useEffect(() => {
    selectedRef.current = selectedId;
    renderRef.current?.();
  }, [selectedId]);
}

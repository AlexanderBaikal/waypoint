import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Place } from "../../domain/place";
import { markerIcon } from "./markerIcon";

/**
 * Keeps a Leaflet layer in step with a list of places.
 *
 * The markers are diffed by id rather than rebuilt: filtering the list touches
 * only the pins that appeared or disappeared, and changing the selection
 * repaints exactly two icons instead of every marker on screen. That matters
 * here because selection changes on every click and on every list hover.
 */
export function useMarkerLayer(
  map: L.Map | null,
  places: readonly Place[],
  selectedId: string | null,
  onSelect: (placeId: string) => void,
): void {
  const markers = useRef(new Map<string, L.Marker>());
  const previousSelected = useRef<string | null>(null);

  // Marker click handlers are bound once, so they must not close over a stale
  // callback.
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map) return;

    const group = L.layerGroup().addTo(map);
    const current = markers.current;

    return () => {
      group.remove();
      current.clear();
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const current = markers.current;
    const wanted = new Set(places.map((place) => place.id));

    for (const [id, marker] of current) {
      if (!wanted.has(id)) {
        marker.remove();
        current.delete(id);
      }
    }

    for (const place of places) {
      const existing = current.get(place.id);

      if (existing) {
        const position = existing.getLatLng();
        if (position.lat !== place.coords.lat || position.lng !== place.coords.lng) {
          existing.setLatLng([place.coords.lat, place.coords.lng]);
        }
        continue;
      }

      const marker = L.marker([place.coords.lat, place.coords.lng], {
        icon: markerIcon(place, place.id === selectedId),
        title: place.name,
        alt: `${place.name}, ${place.type}`,
        keyboard: true,
        riseOnHover: true,
      })
        .bindTooltip(place.name, { direction: "top", opacity: 1 })
        .on("click", () => {
          selectRef.current(place.id);
        })
        .on("keypress", (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === "Enter") selectRef.current(place.id);
        })
        .addTo(map);

      current.set(place.id, marker);
    }
    // `selectedId` is deliberately excluded: it only decides the icon of a
    // newly created marker, and the effect below owns selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places]);

  useEffect(() => {
    const current = markers.current;
    const repaint = (id: string | null, selected: boolean) => {
      if (!id) return;
      const marker = current.get(id);
      const place = places.find((candidate) => candidate.id === id);
      if (marker && place) marker.setIcon(markerIcon(place, selected));
    };

    if (previousSelected.current !== selectedId) {
      repaint(previousSelected.current, false);
      repaint(selectedId, true);
      previousSelected.current = selectedId;
    }
  }, [selectedId, places]);
}

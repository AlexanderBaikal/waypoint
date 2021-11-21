import L from "leaflet";
import Supercluster from "supercluster";
import { useEffect, useMemo, useRef } from "react";
import type { Place } from "../../domain/place";
import { clusterIcon, markerIcon } from "./markerIcon";

/**
 * Below this many places, every one gets its own pin. Clustering a handful of
 * results would hide them behind a number for no gain, and a filtered list
 * should read literally: five results, five pins.
 */
const CLUSTER_THRESHOLD = 60;

/**
 * `radius` sets how crowded the map may get before pins collapse into a count.
 * It is measured against `extent`, which defaults to 512 — the size of a vector
 * tile. Leaflet draws 256-pixel tiles, so leaving the default would silently
 * halve every radius on screen. Setting extent to 256 makes the number mean
 * screen pixels, which is what it is being tuned against.
 *
 * Past zoom 16 a city block fills the screen and there is nothing left to
 * collapse.
 */
const CLUSTER_OPTIONS = { radius: 70, extent: 256, maxZoom: 16, minPoints: 4 };

interface PointProps {
  placeId: string;
}

type Feature =
  | Supercluster.ClusterFeature<Supercluster.AnyProps>
  | Supercluster.PointFeature<PointProps>;

const isCluster = (
  feature: Feature,
): feature is Supercluster.ClusterFeature<Supercluster.AnyProps> =>
  "cluster" in feature.properties;

type Entry =
  | { kind: "place"; place: Place; selected: boolean }
  | { kind: "cluster"; clusterId: number; count: number; lat: number; lng: number };

interface Live {
  marker: L.Marker;
  entry: Entry;
}

const keyOf = (entry: Entry) =>
  entry.kind === "place" ? entry.place.id : `cluster:${String(entry.clusterId)}`;

/**
 * Keeps a Leaflet layer in step with a list of places.
 *
 * Two things stop the map falling over on the full dataset. Supercluster
 * decides what to draw: it answers with the clusters and loose points for the
 * current viewport, so the DOM holds a marker per *visible* pin rather than one
 * per place — a few hundred instead of sixteen hundred. Then the markers are
 * diffed by key rather than rebuilt, so panning touches only the pins that
 * entered or left, and changing the selection repaints exactly two icons.
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

  const byId = useMemo(() => {
    const index = new Map<string, Place>();
    for (const place of places) index.set(place.id, place);
    return index;
  }, [places]);

  /** Null below the threshold, where clustering is not worth its cost. */
  const clusters = useMemo(() => {
    if (places.length < CLUSTER_THRESHOLD) return null;

    const index = new Supercluster<PointProps>(CLUSTER_OPTIONS);
    index.load(
      places.map((place) => ({
        type: "Feature" as const,
        properties: { placeId: place.id },
        geometry: {
          type: "Point" as const,
          coordinates: [place.coords.lng, place.coords.lat],
        },
      })),
    );
    return index;
  }, [places]);

  useEffect(() => {
    if (!map) return;
    const current = live.current;

    /** What should be on the map right now, given the viewport. */
    const wanted = (): Entry[] => {
      const selectedId = selectedRef.current;

      if (!clusters) {
        return places.map((place) => ({
          kind: "place",
          place,
          selected: place.id === selectedId,
        }));
      }

      const bounds = map.getBounds();
      const found = clusters.getClusters(
        [
          bounds.getWest(),
          Math.max(bounds.getSouth(), -85),
          bounds.getEast(),
          Math.min(bounds.getNorth(), 85),
        ],
        Math.round(map.getZoom()),
      );

      const entries: Entry[] = [];
      for (const feature of found) {
        // GeoJSON positions are typed as a bare number[]; a Point always has
        // the two we need.
        const [lng, lat] = feature.geometry.coordinates;
        if (lng === undefined || lat === undefined) continue;

        if (isCluster(feature)) {
          entries.push({
            kind: "cluster",
            clusterId: feature.properties.cluster_id,
            count: feature.properties.point_count,
            lat,
            lng,
          });
          continue;
        }

        const place = byId.get(feature.properties.placeId);
        if (place) {
          entries.push({ kind: "place", place, selected: place.id === selectedId });
        }
      }

      // The open place keeps its pin even when the viewport or a cluster would
      // have swallowed it — the panel and the map must agree on what is open.
      const selected = selectedId === null ? null : byId.get(selectedId);
      if (
        selected &&
        !entries.some((e) => e.kind === "place" && e.place.id === selectedId)
      ) {
        entries.push({ kind: "place", place: selected, selected: true });
      }

      return entries;
    };

    const build = (entry: Entry): L.Marker => {
      if (entry.kind === "cluster") {
        return L.marker([entry.lat, entry.lng], {
          icon: clusterIcon(entry.count),
          title: `${String(entry.count)} places`,
          // No `alt` here: Leaflet drops it for divIcons, so the accessible
          // name is written into the icon markup by clusterIcon instead.
          keyboard: true,
        }).on("click", () => {
          // Zoom to where this cluster comes apart, which is what a user
          // clicking a count is asking for.
          map.flyTo(
            [entry.lat, entry.lng],
            clusters?.getClusterExpansionZoom(entry.clusterId) ?? map.getZoom() + 2,
            { duration: 0.4 },
          );
        });
      }

      const { place } = entry;
      return L.marker([place.coords.lat, place.coords.lng], {
        icon: markerIcon(place, entry.selected),
        title: place.name,
        // Leaflet stacks markers by latitude. The open place has to sit above
        // whatever it shares a corner with — often a cluster badge, since it is
        // pinned into view whether or not the cluster came apart.
        zIndexOffset: entry.selected ? 1000 : 0,
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
    };

    const render = () => {
      const entries = wanted();
      const keys = new Set(entries.map(keyOf));

      for (const [key, existing] of current) {
        if (!keys.has(key)) {
          existing.marker.remove();
          current.delete(key);
        }
      }

      for (const entry of entries) {
        const key = keyOf(entry);
        const existing = current.get(key);

        if (!existing) {
          const marker = build(entry).addTo(map);
          current.set(key, { marker, entry });
          continue;
        }

        // Same key, changed content: repaint in place instead of churning the
        // DOM node. This is the path a selection change takes.
        const before = existing.entry;
        if (before.kind === "place" && entry.kind === "place") {
          if (before.selected !== entry.selected) {
            existing.marker.setIcon(markerIcon(entry.place, entry.selected));
            existing.marker.setZIndexOffset(entry.selected ? 1000 : 0);
          }
        } else if (before.kind === "cluster" && entry.kind === "cluster") {
          if (before.count !== entry.count) {
            existing.marker.setIcon(clusterIcon(entry.count));
          }
          if (before.lat !== entry.lat || before.lng !== entry.lng) {
            existing.marker.setLatLng([entry.lat, entry.lng]);
          }
        }
        existing.entry = entry;
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
  }, [map, places, byId, clusters]);

  useEffect(() => {
    selectedRef.current = selectedId;
    renderRef.current?.();
  }, [selectedId]);
}

import type { Coords, Place } from "../../domain/place";

/**
 * How much room a pin claims on screen, in pixels: two pin widths, the gap at
 * which a row of markers stops reading as a smear. This is the one number that
 * sets how busy the map feels: larger thins harder.
 */
const SPACING = 52;

/** Leaflet's tile size, which is also the width of the world at zoom 0. */
const WORLD = 256;

/** Where the tile sources stop, and so does any point in thinning. */
const MAX_ZOOM = 19;

/**
 * How much a place has to say for itself, standing in for the popularity data a
 * real map ranks on and this one does not have. The proxy is how completely the
 * record is filled in, with a rating outweighing the rest as the only signal
 * here that came from people rather than a database dump.
 *
 * The scale is arbitrary; only the order it produces matters.
 *
 * Distinct from `detailRank` in domain/search, which is a coarser tie-break for
 * the results list.
 */
export function prominence(place: Place): number {
  const { rating } = place;
  return (
    (rating === null ? 0 : 6 + rating.value + Math.min(rating.count, 50) / 10) +
    (place.cover === null ? 0 : 3) +
    Math.min(place.photos.length, 3) +
    (place.about === null ? 0 : 2) +
    (place.schedule === null ? 0 : 2) +
    (place.website === null ? 0 : 1) +
    (place.phone === null ? 0 : 1) +
    (place.address === null ? 0 : 1)
  );
}

/**
 * Web Mercator, normalised to the unit square Leaflet cuts its pixel grid
 * from: multiply by `WORLD * 2 ** zoom` for pixels at that zoom.
 */
function project({ lat, lng }: Coords): readonly [number, number] {
  // The projection runs to infinity at the poles; this is the latitude the
  // square is cut at, and the one Leaflet clamps to.
  const clamped = Math.min(Math.max(lat, -85.0511), 85.0511);
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

/** The world width in normalised units is 1, so a cell is a plain fraction. */
const cellSize = (zoom: number) => SPACING / (WORLD * 2 ** zoom);

/**
 * A hash grid per zoom, sharing one map with the zoom folded into the key.
 * Cells are exactly `SPACING` wide, so anything within that distance of a
 * candidate is in one of the nine cells around it.
 */
type Grid = Map<string, [number, number][]>;

const cellKey = (zoom: number, cx: number, cy: number) =>
  `${String(zoom)}:${String(cx)}:${String(cy)}`;

function crowded(grid: Grid, zoom: number, x: number, y: number): boolean {
  const cell = cellSize(zoom);
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const bucket = grid.get(cellKey(zoom, cx + dx, cy + dy));
      if (!bucket) continue;
      for (const [ox, oy] of bucket) {
        if ((ox - x) ** 2 + (oy - y) ** 2 < cell * cell) return true;
      }
    }
  }
  return false;
}

/**
 * Decides the zoom at which each place first appears: the most prominent place
 * in a neighbourhood is drawn on its own and its neighbours wait until there is
 * room for them.
 *
 * The rule is that a place appears at the coarsest zoom where it has `SPACING`
 * pixels of clear space from every place that outranks it. Two properties
 * follow:
 *
 * - Nothing collides. If two pins are drawn together at some zoom, the
 *   lower-ranked one cleared the other by a full cell at a zoom no finer than
 *   this one, and cells only shrink as you zoom in.
 * - Nothing disappears. Zooming in only adds pins.
 *
 * Measuring against every higher-ranked place, rather than only those currently
 * drawn, is what makes the first property hold: the looser rule lets a place
 * slip into a gap at zoom 13 that a higher-ranked place claims at 14, and the
 * two then overlap from 14 up.
 *
 * The result depends only on the places, never on where the map is pointing, so
 * panning cannot make a pin flicker at a fixed zoom.
 */
export function revealZooms(places: readonly Place[]): ReadonlyMap<string, number> {
  const ordered = [...places].sort(
    // Ties are common, since most imported places carry the same three fields.
    // The id breaks them: arbitrary, but stable, and a pin that reshuffled
    // between renders would flicker.
    (a, b) => prominence(b) - prominence(a) || (a.id < b.id ? -1 : 1),
  );

  const grid: Grid = new Map();
  const zooms = new Map<string, number>();

  for (const place of ordered) {
    const [x, y] = project(place.coords);

    // `crowded` only ever goes from true to false as the zoom rises, since
    // cells shrink and never grow, so the first clear zoom is a binary search
    // rather than a walk up from the bottom.
    let low = 0;
    let high = MAX_ZOOM;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (crowded(grid, mid, x, y)) low = mid + 1;
      else high = mid;
    }
    zooms.set(place.id, low);

    for (let z = 0; z <= MAX_ZOOM; z += 1) {
      const cell = cellSize(z);
      const at = cellKey(z, Math.floor(x / cell), Math.floor(y / cell));
      const bucket = grid.get(at);
      if (bucket) bucket.push([x, y]);
      else grid.set(at, [[x, y]]);
    }
  }

  return zooms;
}

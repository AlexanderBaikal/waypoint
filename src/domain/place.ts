export interface Coords {
  lat: number;
  lng: number;
}

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  /** "HH:MM", 24h. Meaningless when `closed` or `allDay` is set. */
  open: string;
  close: string;
  allDay: boolean;
  closed: boolean;
}

export type Schedule = Record<Weekday, DayHours>;

export interface Rating {
  value: number;
  count: number;
}

/**
 * Where a cover photograph came from, and how much it claims to show.
 *
 * Most covers are borrowed: few places in OSM carry a picture of their own, so
 * the import falls back to the closest geotagged Wikimedia Commons photograph.
 * That is a picture of the surroundings, and `nearbyMetres` is how the panel
 * says so. It is null when the photograph is genuinely of this place.
 *
 * When even a nearby photograph could not be found honestly close, the cover
 * is a stock photograph representative of the place's *type* rather than of
 * the place or its surroundings at all — `generic` is how the panel says so.
 * `nearbyMetres` and `generic` are never both set.
 *
 * The rest is attribution, which nearly every Commons licence requires wherever
 * the photograph appears.
 */
export interface PhotoCredit {
  /** "Wikimedia Commons", or the host an OSM `image` tag pointed at. */
  source: string;
  /** The file's description page, where the full licence terms live. */
  sourceUrl: string | null;
  author: string | null;
  /** Short form, as Commons states it: "CC BY-SA 4.0", "Public domain". */
  licence: string | null;
  /** Metres from the place, when the photograph is only of its surroundings. */
  nearbyMetres: number | null;
  /** True when the cover is a stock photo of the place's type, not the place. */
  generic: boolean;
}

export interface Place {
  id: string;
  name: string;
  /** Free-text type as stored ("Shopping mall"). Mapped to a category for UI. */
  type: string;
  coords: Coords;
  address: string | null;
  phone: string | null;
  website: string | null;
  about: string | null;
  cover: string | null;
  /** Set only for covers this project sourced; a pasted link has none. */
  coverCredit: PhotoCredit | null;
  photos: string[];
  rating: Rating | null;
  schedule: Schedule | null;
  authorId: string | null;
}

/**
 * The order places are listed in. Most of the dataset is Russian, so the
 * comparison is run under that locale rather than by code point.
 */
export const byName = (a: Pick<Place, "name">, b: Pick<Place, "name">): number =>
  a.name.localeCompare(b.name, "ru");

export interface Review {
  id: string;
  placeId: string;
  author: { name: string; photoUrl: string | null };
  rating: number;
  text: string;
  date: string | null;
  photos: string[];
}

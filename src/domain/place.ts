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
  photos: string[];
  rating: Rating | null;
  schedule: Schedule | null;
  authorId: string | null;
}

export interface Review {
  id: string;
  placeId: string;
  author: { name: string; photoUrl: string | null };
  rating: number;
  text: string;
  date: string | null;
  photos: string[];
}

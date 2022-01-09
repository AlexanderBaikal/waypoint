import { parseTime } from "./hours";
import { WEEKDAYS, type Coords, type Schedule } from "./place";

/**
 * What a person can supply about a place, as opposed to what a place *is*:
 * no id, no rating, no author. Those are assigned by whoever stores it.
 *
 * The rules in firestore.rules enforce the same bounds this file checks. That
 * duplication is deliberate and one-directional: this layer exists to give a
 * useful message before a round trip, and the rules exist because a browser
 * cannot be trusted to have run it.
 */
export interface PlaceInput {
  name: string;
  type: string;
  coords: Coords;
  address: string | null;
  phone: string | null;
  website: string | null;
  about: string | null;
  /**
   * A photograph, as a link to one that is already on the web. The app stores
   * the address and never the bytes: no upload, no bucket, and — since the
   * link can rot, as this project's own Firebase Storage links did — a
   * placeholder is the normal state rather than the error state.
   */
  cover: string | null;
  schedule: Schedule | null;
}

export interface ReviewInput {
  /** Whole stars, 1 to 5. */
  rating: number;
  text: string;
}

/** Who is writing. Taken from the session rather than from the form. */
export interface Author {
  uid: string;
  name: string;
  photoUrl: string | null;
}

export const LIMITS = {
  name: 80,
  type: 40,
  address: 120,
  phone: 32,
  website: 200,
  about: 600,
  cover: 500,
  reviewText: 1000,
} as const;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const tooLong = (field: keyof typeof LIMITS) =>
  `Keep this under ${String(LIMITS[field])} characters`;

/** Trims, and treats a field left empty as absent rather than as "". */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parses a web address the way a person types one — usually without a scheme.
 *
 * Parsed rather than matched against a pattern. A regular expression that
 * looks like it accepts hostnames will also accept `javascript:` with a
 * hostname-shaped tail, and this value ends up in an `href` and an `img src`.
 * Asking the URL parser what the protocol is leaves no room for that.
 */
export function webUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  try {
    // Only prepend a scheme when there is none; `example.com:8080` has a colon
    // but no scheme, so look for a scheme shape rather than for a colon.
    const url = new URL(
      /^[a-z][\w+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // A host with no dot is a typo far more often than it is an intranet name.
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

/**
 * A schedule is valid when every day either says it is closed, says it is open
 * all day, or carries two readable times. Partially filled days are the common
 * mistake and the one worth a message.
 */
function scheduleError(schedule: Schedule | null): string | undefined {
  if (!schedule) return undefined;

  for (const day of WEEKDAYS) {
    const hours = schedule[day];
    if (hours.closed || hours.allDay) continue;
    if (parseTime(hours.open) === null || parseTime(hours.close) === null) {
      return "Every open day needs both an opening and a closing time";
    }
  }
  return undefined;
}

export function validatePlace(input: PlaceInput): FieldErrors<PlaceInput> {
  const errors: FieldErrors<PlaceInput> = {};

  const name = input.name.trim();
  if (name === "") errors.name = "A place needs a name";
  else if (name.length > LIMITS.name) errors.name = tooLong("name");

  const type = input.type.trim();
  if (type === "") errors.type = "Say what kind of place this is";
  else if (type.length > LIMITS.type) errors.type = tooLong("type");

  const { lat, lng } = input.coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.coords = "Drop the pin somewhere on the map";
  } else if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    errors.coords = "Those coordinates are off the map";
  }

  if (input.address && input.address.length > LIMITS.address) {
    errors.address = tooLong("address");
  }
  if (input.phone && input.phone.length > LIMITS.phone) errors.phone = tooLong("phone");
  if (input.about && input.about.length > LIMITS.about) errors.about = tooLong("about");

  if (input.website) {
    if (input.website.length > LIMITS.website) errors.website = tooLong("website");
    // Bare hostnames are what people type; a scheme is added on the way out.
    else if (!webUrl(input.website)) {
      errors.website = "That does not look like a web address";
    }
  }

  if (input.cover) {
    const url = webUrl(input.cover);
    // A scheme is required here, unlike for `website`. "Copy image address"
    // always yields one, and a bare "photo.jpg" parses as a hostname — so
    // guessing would accept a filename and then quietly fail to load it.
    const hasScheme = /^https?:\/\//i.test(input.cover.trim());

    if (input.cover.length > LIMITS.cover) errors.cover = tooLong("cover");
    else if (!url || !hasScheme) {
      errors.cover = "Paste the image's full address, starting with https://";
    }
    // A page served over https cannot show an http image — the browser blocks
    // it — so accepting one here would only produce a silent placeholder.
    else if (url.protocol !== "https:") {
      errors.cover = "Use an https:// link; browsers block plain http images";
    }
  }

  const schedule = scheduleError(input.schedule);
  if (schedule) errors.schedule = schedule;

  return errors;
}

export function validateReview(input: ReviewInput): FieldErrors<ReviewInput> {
  const errors: FieldErrors<ReviewInput> = {};

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.rating = "Pick a rating from one to five";
  }

  const text = input.text.trim();
  if (text === "") errors.text = "Say something about the place";
  else if (text.length > LIMITS.reviewText) errors.text = tooLong("reviewText");

  return errors;
}

export const isValid = (errors: FieldErrors<unknown>): boolean =>
  Object.keys(errors).length === 0;

/** An empty day, which the form starts every weekday from. */
const CLOSED_DAY = { open: "09:00", close: "18:00", allDay: false, closed: false };

export function blankSchedule(): Schedule {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, { ...CLOSED_DAY }])) as Schedule;
}

/** A blank form, centred whereever the map is looking. */
export function blankPlace(coords: Coords): PlaceInput {
  return {
    name: "",
    type: "",
    coords,
    address: null,
    phone: null,
    website: null,
    about: null,
    cover: null,
    schedule: null,
  };
}

/** An existing place, in the shape the form edits. */
export function toInput(place: PlaceInput): PlaceInput {
  return {
    name: place.name,
    type: place.type,
    coords: place.coords,
    address: place.address,
    phone: place.phone,
    website: place.website,
    about: place.about,
    cover: place.cover,
    schedule: place.schedule,
  };
}

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
    else if (!/^([a-z]+:\/\/)?[\w-]+(\.[\w-]+)+/i.test(input.website)) {
      errors.website = "That does not look like a web address";
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
    schedule: null,
  };
}

/** An existing place, in the shape the form edits. */
export function toInput(place: {
  name: string;
  type: string;
  coords: Coords;
  address: string | null;
  phone: string | null;
  website: string | null;
  about: string | null;
  schedule: Schedule | null;
}): PlaceInput {
  return {
    name: place.name,
    type: place.type,
    coords: place.coords,
    address: place.address,
    phone: place.phone,
    website: place.website,
    about: place.about,
    schedule: place.schedule,
  };
}

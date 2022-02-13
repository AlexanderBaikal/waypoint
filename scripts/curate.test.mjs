import { asLink, curate, field, photo, soundSchedule } from "./curate.mjs";

const BOX = { south: 52.2, west: 104.15, north: 52.36, east: 104.42 };

/** A hand-entered place, as the 2021 database left it. */
const place = (over = {}) => ({
  id: "somewhere",
  name: "Somewhere",
  type: "Cafe",
  coords: { lat: 52.28, lng: 104.3 },
  address: "Lenina 1",
  phone: null,
  website: null,
  about: null,
  cover: null,
  coverCredit: null,
  photos: [],
  rating: null,
  schedule: null,
  authorId: "u1",
  ...over,
});

const open = (hours) => ({
  monday: hours,
  tuesday: hours,
  wednesday: hours,
  thursday: hours,
  friday: hours,
  saturday: hours,
  sunday: hours,
});

const HOURS = { open: "09:00", close: "18:00", allDay: false, closed: false };

describe("field", () => {
  it("drops the old editor's own prompts", () => {
    expect(field("Add website")).toBeNull();
    expect(field("no phone number yet")).toBeNull();
    expect(field("No data yet")).toBeNull();
  });

  it("keeps a real value, trimmed", () => {
    expect(field("  Lenina 1 ")).toBe("Lenina 1");
    // Only the exact prompts go; a place may legitimately be called this.
    expect(field("Add Cafe")).toBe("Add Cafe");
  });
});

describe("asLink", () => {
  it("gives a bare hostname a scheme", () => {
    expect(asLink("slata.ru")).toBe("https://slata.ru");
  });

  it("does the same for a hostname that is not in Latin", () => {
    expect(asLink("яркомолл-ирк.рф")).toBe("https://яркомолл-ирк.рф");
  });

  it("leaves a written scheme alone", () => {
    expect(asLink("http://www.kfc.ru/restaurants/605")).toBe(
      "http://www.kfc.ru/restaurants/605",
    );
  });

  it("refuses something that is not an address at all", () => {
    expect(asLink("ask at the door")).toBeNull();
  });
});

describe("photo", () => {
  it("refuses the retired Cloud Storage bucket", () => {
    expect(
      photo("https://firebasestorage.googleapis.com/v0/b/g-maps-clone.appspot.com/o/x"),
    ).toBeNull();
  });

  it("refuses a picture the browser would block", () => {
    expect(photo("http://example.com/a.jpg")).toBeNull();
  });

  it("keeps one that is still served", () => {
    expect(photo("https://upload.wikimedia.org/a.jpg")).toBe(
      "https://upload.wikimedia.org/a.jpg",
    );
  });
});

describe("soundSchedule", () => {
  it("drops a week containing a day that opens and closes at once", () => {
    const schedule = open(HOURS);
    schedule.monday = { open: "01:02", close: "01:02", allDay: false, closed: false };
    expect(soundSchedule(schedule)).toBeNull();
  });

  it("keeps a closed day, which is not the same thing", () => {
    const schedule = open(HOURS);
    schedule.sunday = { open: "00:00", close: "00:00", allDay: false, closed: true };
    expect(soundSchedule(schedule)).toBe(schedule);
  });
});

describe("curate", () => {
  it("drops a place the import could not have found", () => {
    const panama = place({ id: "parque-omar", coords: { lat: 8.99, lng: -79.5 } });
    const { curated, rejected } = curate([place(), panama], BOX);

    expect(curated.map((entry) => entry.id)).toEqual(["somewhere"]);
    expect(rejected).toHaveLength(1);
    // The report has to name it, or a re-import silently loses a place.
    expect(rejected[0]).toContain("parque-omar");
  });

  it("scrubs the fields of the places it keeps", () => {
    const { curated } = curate(
      [
        place({
          phone: "No data yet",
          website: "slata.ru",
          photos: [
            "https://firebasestorage.googleapis.com/v0/b/g-maps-clone.appspot.com/o/x",
            "https://upload.wikimedia.org/a.jpg",
          ],
        }),
      ],
      BOX,
    );

    expect(curated[0].phone).toBeNull();
    expect(curated[0].website).toBe("https://slata.ru");
    expect(curated[0].photos).toEqual(["https://upload.wikimedia.org/a.jpg"]);
  });
});

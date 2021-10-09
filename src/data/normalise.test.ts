import {
  readCoords,
  readDate,
  readSchedule,
  readString,
  readTime,
  slugify,
} from "./normalise";

describe("readString", () => {
  it("keeps real values and trims them", () => {
    expect(readString("  Sberbank ")).toBe("Sberbank");
  });

  it("treats the old editor's placeholders as absent", () => {
    expect(readString("Add website")).toBeNull();
    expect(readString("add phone number")).toBeNull();
    expect(readString("No website yet")).toBeNull();
  });

  it("rejects empty strings and non-strings", () => {
    expect(readString("   ")).toBeNull();
    expect(readString(42)).toBeNull();
    expect(readString(null)).toBeNull();
  });
});

describe("readCoords", () => {
  it("reads a Firestore GeoPoint", () => {
    expect(readCoords({ latitude: 52.28, longitude: 104.29 })).toEqual({
      lat: 52.28,
      lng: 104.29,
    });
  });

  // Two rows in the live dataset store coordinates this way. Missing it left
  // Leaflet with (undefined, undefined) and took the whole map down.
  it("reads the [lat, lng] array form some rows were written with", () => {
    expect(readCoords([52.2625, 104.2612])).toEqual({ lat: 52.2625, lng: 104.2612 });
  });

  it("rejects out-of-range and malformed values", () => {
    expect(readCoords({ latitude: 91, longitude: 0 })).toBeNull();
    expect(readCoords({ latitude: 0, longitude: 181 })).toBeNull();
    expect(readCoords({ latitude: "52.28", longitude: 104 })).toBeNull();
    expect(readCoords([52.28])).toBeNull();
    expect(readCoords(null)).toBeNull();
    expect(readCoords("52,104")).toBeNull();
  });
});

describe("readTime", () => {
  it("pads and normalises", () => {
    expect(readTime("9:00")).toBe("09:00");
    expect(readTime("18:30")).toBe("18:30");
  });

  it("tolerates the wrong separator, which the dataset contains", () => {
    expect(readTime("10;00")).toBe("10:00");
  });

  it("rejects impossible times", () => {
    expect(readTime("24:00")).toBeNull();
    expect(readTime("10:75")).toBeNull();
    expect(readTime("noon")).toBeNull();
  });
});

describe("readSchedule", () => {
  const day = { open: "9:00", close: "18:00", allDay: false, closed: false };
  const week = Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
      (name) => [name, day],
    ),
  );

  it("normalises every day", () => {
    const schedule = readSchedule(week);
    expect(schedule?.monday).toEqual({
      open: "09:00",
      close: "18:00",
      allDay: false,
      closed: false,
    });
  });

  it("drops the schedule when a day is missing", () => {
    const { sunday: _sunday, ...incomplete } = week;
    expect(readSchedule(incomplete)).toBeNull();
  });

  it("drops the schedule when an open day has unusable times", () => {
    expect(readSchedule({ ...week, friday: { ...day, open: "later" } })).toBeNull();
  });

  it("allows unusable times on a day that is closed anyway", () => {
    const schedule = readSchedule({
      ...week,
      friday: { open: "", close: "", allDay: false, closed: true },
    });
    expect(schedule?.friday.closed).toBe(true);
  });
});

describe("readDate", () => {
  it("unwraps a Firestore Timestamp", () => {
    const timestamp = { toDate: () => new Date("2026-01-05T10:00:00.000Z") };
    expect(readDate(timestamp)).toBe("2026-01-05T10:00:00.000Z");
  });

  it("passes strings through and rejects the rest", () => {
    expect(readDate("2026-01-05")).toBe("2026-01-05");
    expect(readDate(undefined)).toBeNull();
  });
});

describe("slugify", () => {
  it("builds url-safe ids", () => {
    expect(slugify("Dikaya Loshad'  ")).toBe("dikaya-loshad");
    expect(slugify("O'key")).toBe("okey");
    expect(slugify("City clinical hospital N1")).toBe("city-clinical-hospital-n1");
  });
});

import { describe, expect, it } from "vitest";
import {
  assignNearby,
  commonsImageUrl,
  commonsPageUrl,
  commonsTagFile,
  isImageUrl,
  isPhotograph,
  isPhotoShaped,
  readImageSize,
  isView,
  readSiteImage,
  readAuthor,
} from "./photos.mjs";
import { metres } from "./geo.mjs";

const at = (id, lat, lng) => ({ id, coords: { lat, lng } });
const file = (title, lat, lng) => ({ title, lat, lng });

describe("isPhotograph", () => {
  it("accepts the usual camera formats", () => {
    expect(isPhotograph("File:Irkutsk house.jpg")).toBe(true);
    expect(isPhotograph("File:Театр.JPEG")).toBe(true);
  });

  it("rejects files that are not photographs", () => {
    expect(isPhotograph("File:Plan.svg")).toBe(false);
    expect(isPhotograph("File:Guidebook.pdf")).toBe(false);
  });

  it("rejects documents about a place rather than views of it", () => {
    // Commons geosearch answers with these at the coordinates they describe,
    // and they would otherwise land as some neighbouring shop's photograph.
    expect(isPhotograph("File:Coat of arms of Irkutsk.png")).toBe(false);
    expect(isPhotograph("File:Карта города 1890.jpg")).toBe(false);
  });
});

describe("isView", () => {
  it("accepts a picture of a street, a square or the city", () => {
    expect(isView("File:Irkutsk, Karl Marx Street, Russia.jpg")).toBe(true);
    expect(isView("File:Улица Горная (Иркутск).jpg")).toBe(true);
    expect(isView("File:Sedova Street in Irkutsk (September 2025).jpg")).toBe(true);
  });

  it("rejects a portrait of one named thing", () => {
    // Each of these was handed to a shop across the road by an earlier run,
    // which is what a nearby photograph must never look like.
    expect(isView("File:Иркутск. Успенская церковь.jpg")).toBe(false);
    expect(isView("File:Памятник жёнам декабристов (Иркутск).jpg")).toBe(false);
    expect(isView("File:St. Hovhannes church, Irkutsk.png")).toBe(false);
    expect(isView("File:Irkutsk trolleybus VMZ-170 264.jpg")).toBe(false);
  });

  it("reads a percent-encoded title", () => {
    // Titles arrive encoded from Wikidata's Special:FilePath URLs.
    expect(isView("File:%D0%A6%D0%B5%D1%80%D0%BA%D0%BE%D0%B2%D1%8C.jpg")).toBe(false);
  });
});

describe("readSiteImage", () => {
  const page = "https://cafe.example/about";

  it("takes the picture a page publishes of itself", () => {
    const html = `<meta property="og:image" content="https://cafe.example/hall.jpg">`;
    expect(readSiteImage(html, page)).toBe("https://cafe.example/hall.jpg");
  });

  it("reads the attributes in either order, and resolves a relative path", () => {
    const html = `<meta content='/img/room.jpg' property='og:image'/>`;
    expect(readSiteImage(html, page)).toBe("https://cafe.example/img/room.jpg");
  });

  it("falls back to twitter:image, but prefers Open Graph", () => {
    expect(readSiteImage(`<meta name="twitter:image" content="/t.jpg">`, page)).toBe(
      "https://cafe.example/t.jpg",
    );
    expect(
      readSiteImage(
        `<meta name="twitter:image" content="/t.jpg"><meta property="og:image" content="/og.jpg">`,
        page,
      ),
    ).toBe("https://cafe.example/og.jpg");
  });

  it("unescapes what sits inside a content attribute", () => {
    const html = `<meta property="og:image" content="https://cdn.example/p.jpg?w=800&amp;h=600">`;
    expect(readSiteImage(html, page)).toBe("https://cdn.example/p.jpg?w=800&h=600");
  });

  it("refuses the site's furniture", () => {
    // A link preview is as often the letterhead as the dining room.
    expect(readSiteImage(`<meta property="og:image" content="/logo.png">`, page)).toBe(
      null,
    );
    expect(
      readSiteImage(`<meta property="og:image" content="/img/no-photo.jpg">`, page),
    ).toBe(null);
  });

  it("refuses plain http, which a page served over https cannot show", () => {
    expect(
      readSiteImage(
        `<meta property="og:image" content="http://cafe.example/a.jpg">`,
        page,
      ),
    ).toBe(null);
  });

  it("returns null for a page that says nothing", () => {
    expect(readSiteImage("<html><body>Hello</body></html>", page)).toBe(null);
    expect(readSiteImage(null, page)).toBe(null);
  });
});

describe("isImageUrl", () => {
  it("accepts an https address that ends in a photograph", () => {
    expect(isImageUrl("https://cafe.example/photos/hall.jpg")).toBe(true);
    expect(isImageUrl("https://cafe.example/a.JPEG?v=2")).toBe(true);
  });

  it("rejects a link to a page that merely shows one", () => {
    // What half the OSM `image` tags in this city actually hold. An <img> on
    // one of these loads an HTML document and reports a broken image.
    expect(isImageUrl("https://disk.yandex.ru/i/QSljF2gYGIcZow")).toBe(false);
  });

  it("rejects plain http, which a page served over https cannot show", () => {
    expect(isImageUrl("http://cafe.example/hall.jpg")).toBe(false);
    expect(isImageUrl("not a url")).toBe(false);
  });
});

describe("commonsImageUrl", () => {
  it("builds a resized Special:FilePath link", () => {
    expect(commonsImageUrl("File:Old house.jpg", 400)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Old_house.jpg?width=400",
    );
  });

  it("escapes everything a MediaWiki title may contain", () => {
    const url = commonsImageUrl("File:Дом «Европа» (1).jpg");
    expect(url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/")).toBe(
      true,
    );
    // Spaces and non-ASCII are what break an `img src`; brackets are legal in
    // a path and are left alone.
    expect(url).not.toMatch(/[\s«»Ѐ-ӿ]/);
  });

  it("links the description page, where the licence is stated", () => {
    expect(commonsPageUrl("File:Old house.jpg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Old_house.jpg",
    );
  });
});

describe("commonsTagFile", () => {
  it("takes the File: form and leaves the Category: form", () => {
    expect(commonsTagFile("File:Church.jpg")).toBe("File:Church.jpg");
    // A category is a list of photographs, not one; picking from it would be
    // a guess made by this script rather than by a mapper.
    expect(commonsTagFile("Category:Churches in Irkutsk")).toBe(null);
  });

  it("takes the first of a semicolon list, as the rest of the import does", () => {
    expect(commonsTagFile("File:One.jpg;File:Two.jpg")).toBe("File:One.jpg");
  });
});

describe("readAuthor", () => {
  it("reduces the linked byline Commons stores to a line of text", () => {
    expect(readAuthor('<a href="/wiki/User:Ann" title="User:Ann">Ann</a>')).toBe("Ann");
  });

  it("drops a byline too long to sit under a photograph", () => {
    expect(readAuthor(`<p>${"name ".repeat(30)}</p>`)).toBe(null);
    expect(readAuthor("")).toBe(null);
  });
});

describe("assignNearby", () => {
  it("gives each place the closest photograph within the radius", () => {
    const places = [at("a", 52.28, 104.28)];
    const files = [
      file("File:Far.jpg", 52.2805, 104.28),
      file("File:Near.jpg", 52.2801, 104.28),
    ];

    const assigned = assignNearby(places, files, { radius: 100 });
    expect(assigned.get("a")?.title).toBe("File:Near.jpg");
    expect(assigned.get("a")?.metres).toBe(11);
  });

  it("leaves a place with nothing in range uncovered", () => {
    const places = [at("a", 52.28, 104.28)];
    const files = [file("File:Elsewhere.jpg", 52.3, 104.28)];
    expect(assignNearby(places, files, { radius: 100 }).size).toBe(0);
  });

  /**
   * The whole point of ranking pairs globally: taken place by place, the first
   * place in the list would take the photograph that was shot outside the
   * second one's door.
   */
  it("hands a photograph to the nearer of two places competing for it", () => {
    const places = [at("far", 52.2806, 104.28), at("near", 52.2801, 104.28)];
    const files = [file("File:One.jpg", 52.28, 104.28)];

    const assigned = assignNearby(places, files, { radius: 200, maxUses: 1 });
    expect(assigned.get("near")?.title).toBe("File:One.jpg");
    expect(assigned.has("far")).toBe(false);
  });

  it("stops one photographed corner from supplying a whole street", () => {
    const places = [
      at("a", 52.2801, 104.28),
      at("b", 52.2802, 104.28),
      at("c", 52.2803, 104.28),
    ];
    const files = [file("File:One.jpg", 52.28, 104.28)];

    const assigned = assignNearby(places, files, { radius: 500, maxUses: 2 });
    expect(assigned.size).toBe(2);
  });

  it("ignores files that are not photographs", () => {
    const places = [at("a", 52.28, 104.28)];
    const files = [file("File:Coat of arms.svg", 52.28, 104.28)];
    expect(assignNearby(places, files, { radius: 100 }).size).toBe(0);
  });

  it("lets a portrait of one building reach no further than its own doorstep", () => {
    // 111 m north of the shop: a fair distance for a picture of the street, and
    // much too far for a picture of a named church to stand in for it.
    const shop = [at("shop", 52.28, 104.28)];
    const church = [file("File:Иркутск. Успенская церковь.jpg", 52.281, 104.28)];
    const street = [file("File:Karl Marx Street, Irkutsk.jpg", 52.281, 104.28)];

    const options = { radius: 150, portraitRadius: 25 };
    expect(assignNearby(shop, church, options).size).toBe(0);
    expect(assignNearby(shop, street, options).size).toBe(1);
  });

  it("still gives a landmark the picture taken of it", () => {
    // The same photograph, and the same rule: this is how the memorials and
    // churches on the map get their own portraits.
    const memorial = [at("memorial", 52.28, 104.28)];
    const files = [file("File:Памятник Ленину.jpg", 52.28008, 104.28)];

    const assigned = assignNearby(memorial, files, { radius: 150, portraitRadius: 25 });
    expect(assigned.get("memorial")?.metres).toBe(9);
  });
});

describe("metres", () => {
  it("measures a short distance both ways round", () => {
    const a = { lat: 52.28, lng: 104.28 };
    const b = { lat: 52.281, lng: 104.281 };
    expect(metres(a, b)).toBeCloseTo(metres(b, a), 6);
    expect(metres(a, b)).toBeGreaterThan(100);
    expect(metres(a, b)).toBeLessThan(180);
  });
});

describe("readImageSize", () => {
  const png = (width, height) => {
    const bytes = Buffer.alloc(32);
    bytes[0] = 0x89;
    bytes[1] = 0x50;
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes;
  };

  it("reads a PNG header", () => {
    expect(readImageSize(png(1200, 630))).toEqual({ width: 1200, height: 630 });
  });

  it("walks a JPEG to its start-of-frame", () => {
    // SOI, then a comment segment to be skipped, then SOF0.
    const bytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x41, 0x42, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02,
      0x58, 0x04, 0xb0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 1200, height: 600 });
  });

  it("has no opinion about a container it does not know", () => {
    expect(readImageSize(Buffer.alloc(64))).toBe(null);
    expect(readImageSize(Buffer.alloc(4))).toBe(null);
  });
});

describe("isPhotoShaped", () => {
  it("takes a landscape picture off a camera", () => {
    expect(isPhotoShaped({ width: 1200, height: 800 })).toBe(true);
    expect(isPhotoShaped({ width: 1383, height: 630 })).toBe(true);
  });

  it("refuses the shapes a logo comes in", () => {
    // Every one of these was a real `og:image` on a place in this dataset.
    expect(isPhotoShaped({ width: 512, height: 512 })).toBe(false);
    expect(isPhotoShaped({ width: 1065, height: 961 })).toBe(false);
    expect(isPhotoShaped({ width: 504, height: 84 })).toBe(false);
    expect(isPhotoShaped({ width: 504, height: 755 })).toBe(false);
    expect(isPhotoShaped({ width: 320, height: 200 })).toBe(false);
  });

  it("passes anything it could not measure", () => {
    expect(isPhotoShaped(null)).toBe(true);
  });
});

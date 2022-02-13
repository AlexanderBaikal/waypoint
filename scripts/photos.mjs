/**
 * Matching places to photographs. Pure half of the photo import; the network
 * half is in import-photos.mjs.
 *
 * Covers come in tiers, and the UI states which one it is showing:
 *
 *   own      the place's own OSM tags say this is its picture
 *            (`image`, `wikimedia_commons`, or `wikidata` -> P18)
 *   nearby   the closest geotagged Wikimedia Commons photograph, i.e. a picture
 *            of the surroundings. The distance is stored and displayed.
 *   generic  a stock photograph of the place's *type*. Not of the place, not of
 *            its surroundings, and labelled as neither. See STOCK.
 *
 * The later tiers exist because fewer than one place in a hundred carries an
 * image tag, so an app showing only the first tier shows almost nothing.
 */
import { metres } from "./geo.mjs";

/** Commons holds plenty that is not a photograph of a physical place. */
const NOT_A_PHOTOGRAPH = /\.(svg|pdf|djvu|tiff?|ogv|webm|ogg|oga|wav|mid|stl|xcf)$/i;

/**
 * Titles that are a document about a place rather than a view of one. Commons
 * geosearch returns scanned maps, coats of arms and plaque transcriptions at
 * the coordinates they describe, and each one lands as a "photo" of whatever
 * shop happens to share the corner.
 */
const NOT_A_VIEW =
  /(coat[ _]of[ _]arms|герб|флаг|flag[ _]of|logo|логотип|map[ _]of|карта|схема|plan[ _]of|diagram|blank|signature|подпись|coin|banknote|stamp|марка)/i;

/**
 * Titles naming one specific subject, which cannot stand in for its
 * surroundings. A shot of Karl Marx Street is a fair picture of everything on
 * it; a shot of the Epiphany Cathedral handed to the café opposite reads as a
 * mistake however honestly the distance is labelled.
 *
 * Judged from the title, which is all Commons gives without a second request
 * per file. It over-matches deliberately: the pool is large enough that a
 * rejected photograph costs a place nothing, while a wrong one is on screen.
 */
const A_PORTRAIT = new RegExp(
  [
    // Churches, mosques, synagogues, and the parts of them people photograph.
    "церк|собор|храм|часовн|монаст|костёл|синагог|мечет|купол|колокольн",
    "church|cathedral|chapel|monaster|synagog|mosque|cerkiew|kirche|kloster",
    // Monuments, memorials, statues, graves.
    "памятник|монумент|мемориал|бюст|статуя|обелиск|стела|могил",
    "monument|memorial|statue|obelisk|pomnik|denkmal|grave\\b",
    // Named buildings: a picture of that building, not of the street.
    "усадьб|особняк|дворец|palace|manor|mansion|музей|museum|театр|theatre|theater",
    // Vehicles. Commons geotags a lot of transport, which is how a bank
    // ended up illustrated by a trolleybus.
    "троллейбус|трамва|автобус|локомотив|вагон|поезд|электричк|теплоход|корабл|самол[её]т",
    "trolleybus|tramway|\\btram\\b|\\bbus\\b|locomotive|\\btrain\\b|aircraft|\\bplane\\b|\\bship\\b",
    // People, and things photographed indoors or up close.
    "портрет|portrait|интерьер|interior|экспонат|витрин|табличк|мемориальная доска|plaque",
  ].join("|"),
  "i",
);

/** "File:Old house.jpg" → "Old house.jpg". Commons titles arrive prefixed. */
export const fileName = (title) => title.replace(/^File:/i, "").trim();

export function isPhotograph(title) {
  const name = fileName(title);
  return Boolean(name) && !NOT_A_PHOTOGRAPH.test(name) && !NOT_A_VIEW.test(name);
}

/** A photograph of the surroundings rather than of one named thing. */
export function isView(title) {
  return !A_PORTRAIT.test(decodeURIComponent(fileName(title)));
}

/**
 * An OSM `image` tag is a URL to anywhere, and half of them point at a page
 * showing a photograph rather than at the photograph. `<img src>` on one of
 * those loads an HTML document and fires `onerror`, so the file extension is
 * required: it is the only thing separating the two before the browser tries.
 */
export function isImageUrl(value) {
  if (typeof value !== "string" || !/^https:\/\//i.test(value)) return false;
  try {
    return /\.(jpe?g|png|webp)$/i.test(new URL(value).pathname) && isPhotograph(value);
  } catch {
    return false;
  }
}

/**
 * A title as MediaWiki writes it into a path: spaces underscored, then escaped.
 *
 * The comma is put back. `encodeURIComponent` escapes it, but it is legal in a
 * path segment and Commons' own canonical URL keeps it literal — and a third of
 * these titles carry one, so escaping it means every link in the fixture
 * disagrees with the link Commons gives for the same file.
 */
const segment = (title) =>
  encodeURIComponent(fileName(title).replace(/ /g, "_")).replace(/%2C/g, ",");

/**
 * The image itself, at a width worth downloading. Special:FilePath redirects to
 * the file and resizes on the way, so the app holds a plain URL rather than a
 * MediaWiki file name, exactly like a cover pasted into the form. Originals on
 * Commons routinely run to 10 MB.
 */
export function commonsImageUrl(title, width = 800) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${segment(title)}?width=${String(width)}`;
}

/** The file's description page, where the licence and author are stated. */
export function commonsPageUrl(title) {
  return `https://commons.wikimedia.org/wiki/File:${segment(title)}`;
}

/** `wikimedia_commons=File:X.jpg` is usable; the `Category:` form is not. */
export function commonsTagFile(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.split(";")[0].trim();
  return /^File:/i.test(trimmed) && isPhotograph(trimmed) ? trimmed : null;
}

/**
 * A file name that says the picture is furniture rather than a photograph:
 * the site's logo, a placeholder, a share icon. `og:image` is whatever the site
 * chose to show in a link preview, and on a small business site that is as
 * often the letterhead as the dining room.
 */
const SITE_FURNITURE =
  /(logo|логотип|favicon|sprite|icon|placeholder|no[-_]?(photo|image)|default|share|preview[-_]?default|banner[-_]?bg)/i;

/**
 * The picture a site publishes of itself, out of its own HTML.
 *
 * `og:image` exists to be shown by somebody else, being what a link to the page
 * looks like in a chat window, so this is the one photograph on the open
 * web that a business has already decided third parties may display, at a URL
 * meant to stay put. It is also, for a café, incomparably more relevant than
 * the best picture of the street outside.
 *
 * Returns an absolute https URL, or null. Nothing here is a judgement about
 * whether the image loads or how big it is; that needs the network and lives in
 * import-photos.mjs.
 */
export function readSiteImage(html, pageUrl) {
  if (typeof html !== "string") return null;

  // Attribute order is not fixed and neither is the quoting, so each candidate
  // is matched twice rather than with one clever pattern. Open Graph first:
  // twitter:image is often a crop or a logo where both are present, and the
  // schema.org forms are what a site built on a CMS emits instead.
  const patterns = [
    /<meta[^>]+?property=["']og:image(?::url)?["'][^>]*?content=["']([^"']+)["']/i,
    /<meta[^>]+?content=["']([^"']+)["'][^>]*?property=["']og:image(?::url)?["']/i,
    /<meta[^>]+?name=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i,
    /<meta[^>]+?content=["']([^"']+)["'][^>]*?name=["']twitter:image["']/i,
    /<meta[^>]+?itemprop=["']image["'][^>]*?content=["']([^"']+)["']/i,
    /<link[^>]+?rel=["']image_src["'][^>]*?href=["']([^"']+)["']/i,
    // JSON-LD, where `image` is a string, an array, or an ImageObject.
    /"image"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i,
    /"image"\s*:\s*\[\s*"([^"]+)"/i,
    /"contentUrl"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const found = pattern.exec(html)?.[1]?.trim();
    if (!found) continue;
    try {
      const url = new URL(decodeHtml(found.replace(/\\\//g, "/")), pageUrl);
      if (url.protocol !== "https:") continue;
      if (SITE_FURNITURE.test(decodeURIComponent(url.pathname))) continue;
      return url.href;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Width and height out of the first few kilobytes of an image file.
 *
 * The header carries them, so a ranged request is enough and the picture never
 * has to be downloaded. PNG states them at a fixed offset; JPEG hides them in
 * whichever start-of-frame marker turns up while walking the segment chain;
 * WebP has three container forms. Anything unrecognised returns null, and the
 * caller treats that as "no opinion" rather than as a rejection.
 */
export function readImageSize(bytes) {
  if (!bytes || bytes.length < 24) return null;

  // PNG: 8-byte signature, then an IHDR chunk whose first two fields are the
  // dimensions.
  if (bytes[0] === 0x89 && bytes[1] === 0x50)
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at < bytes.length - 9) {
      if (bytes[at] !== 0xff) {
        at += 1;
        continue;
      }
      const marker = bytes[at + 1];
      // SOF0..SOF15, less the four that are not start-of-frame at all.
      const isFrame =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame)
        return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
      at += 2 + bytes.readUInt16BE(at + 2);
    }
    return null;
  }

  if (
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP"
  ) {
    const form = bytes.toString("latin1", 12, 16);
    if (form === "VP8X")
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    if (form === "VP8 ")
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    if (form === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * Is this the shape of a photograph, or of a logo?
 *
 * The site tier is the business's own `og:image`, and about a third of those
 * are the letterhead rather than the dining room. Names do not give it away —
 * a CMS serves `tild6561-3338-4136….png` either way — but the shape does. A
 * photograph off a camera is landscape and reasonably large; a logo is square,
 * an avatar, or a thin strip.
 *
 * A `null` size (an unrecognised container) passes: the check is here to catch
 * the obvious cases, not to be the arbiter of what may ship.
 */
export function isPhotoShaped(size) {
  if (!size) return true;
  const { width, height } = size;
  if (!width || !height) return true;
  if (width < 500) return false;
  const ratio = width / height;
  // Square within a whisker is the logo convention; taller than wide is a
  // poster; four times wider than tall is a banner strip.
  return ratio > 1.15 && ratio < 4;
}

/** The handful of entities that turn up inside a `content` attribute. */
const decodeHtml = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/**
 * The extmetadata `Artist` field is a fragment of HTML: usually a link, often
 * with markup around it, occasionally a whole table. Reduced to a line of text
 * short enough to sit under a photograph, or dropped.
 */
export function readAuthor(html) {
  if (typeof html !== "string") return null;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 60) return null;
  return text;
}

/**
 * One Commons photograph per kind of place, for the tier of last resort.
 *
 * This is the weakest thing the import can offer and the only one that is not a
 * picture of the place or of anywhere near it: a bar in Irkutsk illustrated by
 * a pub in Hertfordshire. It ships because a panel of coloured placeholders
 * reads as an app that failed to load rather than as a city with few
 * photographs, and because the alternative — reaching further out for a real
 * photograph of somewhere else nearby — was worse: at 150 m the map filled up
 * with a sunset over the embankment on a burger place, honestly labelled and
 * still read as a mistake.
 *
 * What makes it defensible is that the panel says so. Every one of these
 * carries "Generic photo, not of this place" above the credit, so it decorates
 * without claiming anything. Nothing is inferred from a stock photograph and
 * nothing links to it; a place that has one is still a place with no picture.
 *
 * Interiors, deliberately: an exterior invites the reader to match it against
 * the building in front of them, and an interior of the right kind of room does
 * not. Keys are the display `type` import-osm.mjs derives from OSM tags; a type
 * that is not here gets no cover, which is the honest answer for the long tail
 * of shops.
 */
export const STOCK = {
  "Art gallery":
    "File:HK Sheung Wan 220 Hollywood Road art gallery exhibition hall interior June-2012.JPG",
  Bank: "File:Bank of America branch interior in Palo Alto CA.jpg",
  Bar: "File:Brickendon The Farmers Boy pub bar interior Hertfordshire England 01.jpg",
  "Books shop": "File:Entrance to Constant Reader bookshop August 2025.jpg",
  Cafe: "File:Interior of 1UP Cafe 2024-02-18.jpg",
  Clinic: "File:Exam room in a doctor's office.jpg",
  "Clothing shop": "File:Clothing store interior Son Moro Cala Millor.jpg",
  "Fast food":
    "File:A Chick-fil-A fast food restaurant interior in Cornelia, Georgia 03.jpg",
  Gym: "File:Weight training in the gym, c1981.jpg",
  Hostel: "File:Hostel 6-bed dorm room, Kuching, Malaysia.jpg",
  Hotel:
    "File:Lobby hall with couches and chandelier at The Fullerton Bay Hotel Singapore.jpg",
  "Movie theater": "File:Lichtburg-Essen-Kinosaal-2025.jpg",
  Museum: "File:Kelvingrove Art Gallery and Museum Central Hall.jpg",
  Park: "File:Across park with paths towards west from the Stable Block at Wollaton Park, Nottingham, England.jpg",
  Pharmacy: "File:Brest Greenberg Pharmacy Interior 2024-09-20 3798.jpg",
  "Post office": "File:Tallulah Post Office interior 02.jpg",
  Restaurant:
    "File:The interior dining room of a Red Lobster restaurant in Knoxville, Tennessee 03.jpg",
  "Shopping mall": "File:CH.ZG.Zug 2024-04-24 Shopping-Mall-Metalli.jpg",
  Supermarket: "File:Maxima supermarket in Jelgava - the interior 02.jpg",
  Theatre: "File:Katowice Silesian Theatre auditorium 2022.jpg",
  "Tourist attraction": "File:756Rizal Park Landmarks Tourist Attractions 15.jpg",
  University: "File:Physics Building on Campus Riedberg, Goethe University Frankfurt.jpg",
};

/** The stock photograph for a place's type, or null for the long tail. */
export function stockPhoto(type) {
  return typeof type === "string" ? (STOCK[type] ?? null) : null;
}

/**
 * Hands each place the closest photograph nobody nearer has claimed.
 *
 * Every candidate pair is ranked by distance and taken in that order, so a
 * photograph goes to the place it was taken outside rather than to whichever
 * place the loop reached first. `maxUses` stops one well-photographed corner
 * supplying a whole street: repeating the same picture down the results column
 * reads as an error even when every individual match is defensible.
 *
 * Two reaches, not one. A view of the street may stand for a place up to
 * `radius` away; a portrait of one named building may not stand for anything
 * but itself, so it is only offered within `portraitRadius`: close enough that
 * the thing in the picture is what somebody standing at that address is looking
 * at. That is what keeps the memorials and the churches on this map supplied
 * with pictures of themselves without lending them to the shop down the road.
 */
export function assignNearby(
  places,
  files,
  { radius = 100, maxUses = 2, portraitRadius = radius } = {},
) {
  const usable = files
    .filter((file) => isPhotograph(file.title))
    .map((file) => ({ ...file, reach: isView(file.title) ? radius : portraitRadius }));

  const pairs = [];
  for (const place of places) {
    for (const file of usable) {
      const distance = metres(place.coords, file);
      if (distance <= file.reach) pairs.push({ place, file, distance });
    }
  }

  // Ties are settled by title so a re-run of the import produces the same
  // fixture: an unstable sort here would show up as a diff of shuffled URLs.
  pairs.sort(
    (a, b) => a.distance - b.distance || a.file.title.localeCompare(b.file.title),
  );

  const taken = new Map();
  const uses = new Map();
  for (const { place, file, distance } of pairs) {
    if (taken.has(place.id)) continue;
    const used = uses.get(file.title) ?? 0;
    if (used >= maxUses) continue;
    uses.set(file.title, used + 1);
    taken.set(place.id, { title: file.title, metres: Math.round(distance) });
  }
  return taken;
}

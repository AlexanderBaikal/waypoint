/**
 * Gives the map photographs.
 *
 * OpenStreetMap has almost none: of the places this fixture ships, a handful
 * carry an `image` tag and a few more a `wikidata` one. So this writes a cover
 * URL into src/data/fixtures/places.json from four sources, in the order of
 * how much each one is a picture of the place itself:
 *
 *   1. the place's own tags: `image`, `wikimedia_commons`, `wikidata` -> P18.
 *      A picture of the place, said so by whoever mapped it, and the only tier
 *      that arrives with an author and a licence.
 *   2. the place's own website: the `og:image` it publishes for link previews.
 *      A picture the business chose to represent itself with, at a URL meant to
 *      be embedded by strangers. For an ordinary café this is the only
 *      photograph of it that exists anywhere we may use.
 *   3. the closest photograph anchored within RADIUS metres of it: a picture
 *      of the surroundings, and stored as such: the distance goes into the
 *      fixture and the panel prints it. Two databases anchor photographs to a
 *      point: Commons geosearch, which holds ~1,800 geotagged files of this
 *      city, and Wikidata, whose items carry both coordinates and a picture,
 *      about a hundred of which are files geosearch does not know are here.
 *      Only *views* travel this far; a portrait of one named building may not
 *      stand in for its neighbours. See assignNearby.
 *   4. a stock photograph of the place's *type*, for the places the three
 *      tiers above leave bare. Not a picture of the place or of anywhere near
 *      it, and the panel says so in as many words. See STOCK in photos.mjs for
 *      why this ships at all.
 *
 * Every cover in the fixture is then fetched, including the ones already there
 * when the script started, and dropped if it does not answer with an image. A
 * URL that 402s is not a photograph, and the app cannot tell the difference
 * until a visitor is looking at the empty frame.
 *
 *     node scripts/import-photos.mjs             fetch and rewrite
 *     node scripts/import-photos.mjs --dry-run   report without writing
 *     node scripts/import-photos.mjs --radius 60 tighten the nearby tier
 *
 * Run it after import-osm.mjs, which preserves what this wrote for any place
 * it re-imports.
 *
 * Both sources are free content, and both require credit rather than merely
 * inviting it: every cover this writes carries its author, licence and file
 * page, and PlacePanel shows them under the photograph.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { postOverpass } from "./overpass.mjs";
import {
  assignNearby,
  commonsImageUrl,
  commonsPageUrl,
  commonsTagFile,
  isImageUrl,
  isPhotograph,
  isPhotoShaped,
  readImageSize,
  readSiteImage,
  readAuthor,
  stockPhoto,
} from "./photos.mjs";

const PLACES = new URL("../src/data/fixtures/places.json", import.meta.url);

/** Irkutsk. Same box the OSM import uses. south,west,north,east */
const BBOX = { south: 52.2, west: 104.15, north: 52.36, east: 104.42 };

/**
 * How far a "nearby" photograph may have been taken.
 *
 * Set by what the result looks like rather than by what it counts to. Raising
 * this to 150 m did carry the map to 81% covered, and what filled the gap was a
 * sunset over the embankment on a burger place and somebody's wooden house on a
 * supermarket — every one of them a real photograph, honestly labelled with its
 * distance, and every one of them read as a mistake.
 *
 * At 50 m the median is 25: the building the place is in, or the one across the
 * road. That covers about half the map, and the other half draws its category
 * placeholder, which is what a maps application does when it has no picture.
 *
 * The number is shown under every photograph, so a reader can judge it
 * themselves rather than take the word of whoever set this constant.
 */
const DEFAULT_RADIUS = 50;

/**
 * And how far a photograph of one named building may reach. A cathedral 100 m
 * from a café is a picture of the cathedral; at 25 m it is what you are looking
 * at while you stand outside the café. Short enough that in practice this tier
 * only supplies the memorials, churches and museums with pictures of
 * themselves. See assignNearby.
 */
const PORTRAIT_RADIUS = 25;

/** One photograph may stand for at most this many places. See photos.mjs. */
const MAX_USES = 2;

const UA = "waypoint-fixture-import/1.0 (https://github.com/AlexanderBaikal)";

/**
 * The same identification, wrapped in the shape a browser sends. The Wikimedia
 * APIs want to be told plainly who is asking; a small business's hosting panel
 * answers 403 to anything it does not recognise, which is most of the reason a
 * first pass over these sites came back with a fifth of what was there.
 */
const BROWSER_UA = `Mozilla/5.0 (compatible; ${UA})`;

const nap = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Wikimedia APIs answer 429 to a script that asks as fast as it can, and
 * they are within their rights to. Back off and try again rather than shipping
 * a fixture whose coverage depends on how the network felt that afternoon.
 */
async function getJson(url, attempt = 0) {
  const retry = async (why) => {
    if (attempt >= 4) throw new Error(`${why} after 5 attempts: ${url}`);
    await nap(2000 * 2 ** attempt);
    return getJson(url, attempt + 1);
  };

  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
  } catch (error) {
    // A connection that timed out or was reset. This is a run of several
    // hundred requests over some minutes, so one of them failing to connect is
    // ordinary; losing the whole harvest to it is not.
    return retry(error.message);
  }

  if (response.status === 429 || response.status >= 500)
    return retry(String(response.status));
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}: ${url}`);
  return response.json();
}

/**
 * Does this URL actually serve a picture?
 *
 * Asked of every cover the fixture ends up with. Some hosts refuse HEAD, so a
 * failed HEAD is retried as a GET and the body dropped unread; what counts is
 * the status and the content type. A network error is treated as a bad URL,
 * which errs towards a fixture with fewer photographs and no broken frames.
 */
async function servesAnImage(url, method = "HEAD", attempt = 0) {
  const again = () =>
    method === "HEAD" ? servesAnImage(url, "GET", attempt) : Promise.resolve(false);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "image/*" },
    });
    await response.body?.cancel();

    // Too many requests, or the host having a bad minute. Saying "dead" here
    // would quietly strip photographs from the fixture for the duration of an
    // outage, so wait and ask again.
    if (response.status === 429 || response.status >= 500) {
      if (attempt >= 3) return true;
      await nap(2000 * 2 ** attempt);
      return servesAnImage(url, method, attempt + 1);
    }
    if (!response.ok) return again();
    return response.headers.get("content-type")?.startsWith("image/") ? true : again();
  } catch {
    return again();
  }
}

/** The same question of a list, a few at a time so as not to flood one host. */
async function checkAll(urls, concurrency = 8) {
  const results = new Map();
  const queue = [...new Set(urls)];
  const workers = Array.from({ length: concurrency }, async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      results.set(url, await servesAnImage(url));
    }
  });
  await Promise.all(workers);
  return results;
}

// --- source 1: the places' own OpenStreetMap tags ------------------------

async function fetchOsmTags() {
  const box = `${String(BBOX.south)},${String(BBOX.west)},${String(BBOX.north)},${String(BBOX.east)}`;
  const query = `[out:json][timeout:120];
(
  nwr["image"](${box});
  nwr["wikimedia_commons"](${box});
  nwr["wikidata"](${box});
);
out center tags;`;

  const json = await postOverpass(query);
  const byId = new Map();
  for (const element of json.elements ?? []) {
    byId.set(`osm-${element.type[0]}${String(element.id)}`, element.tags ?? {});
  }
  return byId;
}

/** P18 ("image") for the Wikidata items our places point at, 50 at a time. */
async function fetchWikidataImages(ids) {
  const images = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims" +
      `&ids=${batch.join("|")}`;
    const json = await getJson(url);

    for (const [id, entity] of Object.entries(json.entities ?? {})) {
      const claim = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (typeof claim === "string" && isPhotograph(claim))
        images.set(id, `File:${claim}`);
    }
    await nap(500);
  }
  return images;
}

// --- source 3a: geotagged photographs on Wikimedia Commons ---------------

/**
 * Every geotagged file in the city.
 *
 * Geosearch answers with at most 500 files per call however wide the radius,
 * so the box is walked as a grid and the results unioned. Asking once from
 * the centre would quietly return the 500 nearest and call the outskirts
 * unphotographed.
 */
async function fetchCommonsFiles(steps = 7) {
  const files = new Map();
  for (let row = 0; row < steps; row += 1) {
    for (let column = 0; column < steps; column += 1) {
      const lat = BBOX.south + ((BBOX.north - BBOX.south) * (row + 0.5)) / steps;
      const lng = BBOX.west + ((BBOX.east - BBOX.west) * (column + 0.5)) / steps;
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch" +
        `&gsnamespace=6&gsradius=3000&gslimit=500&gscoord=${String(lat)}|${String(lng)}`;

      const json = await getJson(url);
      for (const hit of json.query?.geosearch ?? []) {
        files.set(hit.title, { title: hit.title, lat: hit.lat, lng: hit.lon });
      }
      await nap(400);
    }
    process.stderr.write(
      `  commons: ${String(files.size)} files after row ${String(row + 1)}\n`,
    );
  }
  return [...files.values()];
}

// --- source 2: the picture a place publishes of itself --------------------

/**
 * How small an `og:image` may be and still be a photograph. Logos that got past
 * the name check are the reason: 15 kB of JPEG is a thumbnail, not a dining
 * room.
 */
const MIN_PHOTO_BYTES = 15_000;

/** How much of an image file has to arrive before its size can be read. */
const HEADER_BYTES = 65_536;

/** Sites answer differently to a crawler; this one says what it is and waits. */
const SITE_TIMEOUT = 12_000;

/**
 * Reads each place's own website and takes the picture it publishes of itself.
 *
 * This is the only source here that is a photograph *of the place* for an
 * ordinary café or bank: Commons has the landmarks, and the landmarks are the
 * places that least need help. A site is asked once, its HTML is parsed for
 * `og:image` (see readSiteImage), and the result is kept only if it answers as
 * an image of a plausible size.
 *
 * Everything that can go wrong here (a site that is gone, a certificate that
 * expired, a host that hangs) costs one place its photograph, never a
 * failed import.
 */
async function fetchSiteImages(places) {
  const found = new Map();
  const missed = new Map();
  const queue = places.filter((place) => place.website);
  let done = 0;

  const miss = (why) => missed.set(why, (missed.get(why) ?? 0) + 1);

  /** The page, and if that page says nothing, the site's front door. */
  const readPage = async (url) => {
    const page = await fetch(url, {
      // A plain hosting panel or WAF answers 403 to a client it does not
      // recognise, so this says what it is inside the shape browsers send.
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(SITE_TIMEOUT),
    });
    if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) {
      await page.body?.cancel();
      return { status: page.status };
    }
    // The head is all this needs, and some of these pages are megabytes.
    const html = (await page.text()).slice(0, 300_000);
    return { image: readSiteImage(html, page.url), url: page.url };
  };

  const worker = async () => {
    for (let place = queue.pop(); place; place = queue.pop()) {
      done += 1;
      if (done % 25 === 0)
        process.stderr.write(
          `  sites: ${String(done)} asked, ${String(found.size)} found\n`,
        );
      try {
        let page = await readPage(place.website);
        if (!page.image) {
          // A deep link into a menu or a booking form often carries nothing;
          // the home page of the same site usually carries the good picture.
          const root = new URL("/", place.website).href;
          if (root !== place.website) page = await readPage(root);
        }
        if (!page.image) {
          miss(page.status ? `http ${String(page.status)}` : "no image in page");
          continue;
        }
        const image = page.image;

        // The header is enough to size the picture, so this asks for the first
        // few kilobytes rather than the whole file. Hosts that ignore Range
        // send all of it; the body is dropped either way.
        const check = await fetch(image, {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "image/*",
            Range: `bytes=0-${String(HEADER_BYTES - 1)}`,
          },
          redirect: "follow",
          signal: AbortSignal.timeout(SITE_TIMEOUT),
        });
        const type = check.headers.get("content-type") ?? "";
        const stated = Number(check.headers.get("content-length") ?? 0);

        if (!check.ok || !type.startsWith("image/")) {
          await check.body?.cancel();
          miss(`image ${String(check.status)} ${type.split(";")[0]}`);
          continue;
        }
        // Vector art is a logo or an icon; it is never a photograph.
        if (type.includes("svg")) {
          await check.body?.cancel();
          miss("vector, not a photograph");
          continue;
        }
        // A missing length is not a small image; only a stated small one is.
        if (check.status === 200 && stated && stated < MIN_PHOTO_BYTES) {
          await check.body?.cancel();
          miss("image too small to be a photograph");
          continue;
        }

        const head = Buffer.from(await check.arrayBuffer());
        if (!isPhotoShaped(readImageSize(head))) {
          miss("shaped like a logo, not a photograph");
          continue;
        }

        found.set(place.id, image);
      } catch (error) {
        // Unreachable, untrusted certificate, too slow.
        miss(error.name === "TimeoutError" ? "timed out" : "unreachable");
      }
    }
  };

  await Promise.all(Array.from({ length: 8 }, worker));

  for (const [why, count] of [...missed].sort((a, b) => b[1] - a[1]))
    process.stderr.write(`  sites: ${String(count)} × ${why}\n`);
  return found;
}

// --- source 3b: Wikidata items that carry both a picture and a place -----

/**
 * Every Wikidata item inside the box with a P18 picture, anchored at the item's
 * own coordinates.
 *
 * These are the churches, the listed houses and the monuments: the things
 * somebody wrote an article about. Their photographs live on Commons like
 * everything else, but a file is only in geosearch if the *file* was geotagged,
 * and plenty were not: about a hundred of these are pictures Commons cannot
 * tell us are here. They are the best subjects in the pool, too, being pictures
 * of buildings rather than of a street.
 *
 * A failure here is not fatal. The query service is a shared resource that
 * times out under load, and the map is better off importing without it than
 * refusing to import at all.
 */
async function fetchWikidataPlaces() {
  const sparql = `SELECT ?image ?coord WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(${String(BBOX.west)} ${String(BBOX.south)})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(${String(BBOX.east)} ${String(BBOX.north)})"^^geo:wktLiteral .
  }
  ?item wdt:P18 ?image .
}`;

  let json;
  try {
    json = await getJson(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
    );
  } catch (error) {
    process.stderr.write(`  wikidata: ${error.message}; carrying on without it\n`);
    return [];
  }

  const files = [];
  for (const row of json.results?.bindings ?? []) {
    // P18 comes back as a Special:FilePath URL; the file name is the last
    // segment, percent-encoded, with underscores for spaces as MediaWiki
    // writes them.
    const name = /Special:FilePath\/(.+)$/.exec(row.image?.value ?? "")?.[1];
    const point = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord?.value ?? "");
    if (!name || !point) continue;
    files.push({
      title: `File:${decodeURIComponent(name).replace(/_/g, " ")}`,
      lat: Number(point[2]),
      lng: Number(point[1]),
    });
  }
  return files;
}

/** Author and licence for the files actually used, 40 titles at a time. */
async function fetchCredits(titles) {
  const credits = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map((title) => encodeURIComponent(title));
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
      `&iiprop=extmetadata&iiextmetadatafilter=Artist|LicenseShortName&titles=${batch.join("|")}`;
    const json = await getJson(url);

    for (const page of Object.values(json.query?.pages ?? {})) {
      const meta = page.imageinfo?.[0]?.extmetadata;
      if (!meta) continue;
      credits.set(page.title, {
        author: readAuthor(meta.Artist?.value),
        licence: meta.LicenseShortName?.value ?? null,
      });
    }
    await nap(500);
  }
  return credits;
}

// --- run -----------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const radiusFlag = args.indexOf("--radius");
const radius = radiusFlag === -1 ? DEFAULT_RADIUS : Number(args[radiusFlag + 1]);

/**
 * A cover this script wrote is one it may withdraw; a cover it did not write
 * is somebody's own and stays. That is what makes a second run mean the same
 * as the first; otherwise every place found last time is already covered,
 * every place is skipped, and `--radius` silently does nothing.
 */
const onDisk = JSON.parse(readFileSync(PLACES, "utf8")).map((place) =>
  place.coverCredit ? { ...place, cover: null, coverCredit: null } : place,
);

/**
 * What is left is somebody's own cover: the hand-entered places, and anything
 * typed into the form. Kept if it loads. Fourteen of these pointed into a
 * Firebase Storage bucket that has since been closed and answered 402 for
 * every one of them, and a place holding a dead URL is worse off than a place
 * holding none: it is skipped below as already covered, so it could never be
 * offered a photograph that works.
 */
const priorCovers = onDisk.filter((place) => place.cover).map((place) => place.cover);
process.stderr.write(`fixture: checking ${String(priorCovers.length)} existing covers\n`);

// Overpass and the image hosts are unrelated services, so the two openings of
// the run are asked together. Everything below needs one or the other.
process.stderr.write("openstreetmap: reading image tags\n");
const [priorOk, tags] = await Promise.all([checkAll(priorCovers), fetchOsmTags()]);

const places = onDisk.map((place) =>
  place.cover && !priorOk.get(place.cover) ? { ...place, cover: null } : place,
);
const deadCovers = priorCovers.filter((url) => !priorOk.get(url)).length;
process.stderr.write(`fixture: ${String(deadCovers)} of them are dead, and dropped\n`);

const wikidataIds = [
  ...new Set(
    places
      .map((place) => tags.get(place.id)?.wikidata)
      .filter((id) => typeof id === "string" && /^Q\d+$/.test(id)),
  ),
];
process.stderr.write(`wikidata: ${String(wikidataIds.length)} items to look up\n`);
const wikidataImages = wikidataIds.length
  ? await fetchWikidataImages(wikidataIds)
  : new Map();

/** Tier 1, in the order a mapper's own statement should be trusted. */
function ownPhoto(place) {
  const placeTags = tags.get(place.id);
  if (!placeTags) return null;

  const commons = commonsTagFile(placeTags.wikimedia_commons);
  if (commons) return { title: commons };

  const fromWikidata = wikidataImages.get(placeTags.wikidata);
  if (fromWikidata) return { title: fromWikidata };

  // `image` is a bare URL to anywhere, often a business's own photograph of
  // itself, which is the best picture in this dataset when it is one, and a
  // link to a file-sharing page when it is not. Held to an https address that
  // ends in an image, which is as far as a string can be checked.
  const image = placeTags.image?.split(";")[0].trim();
  if (isImageUrl(image)) return { url: image };

  return null;
}

const own = new Map();
for (const place of places) {
  const photo = ownPhoto(place);
  if (photo) own.set(place.id, photo);
}
process.stderr.write(`openstreetmap: ${String(own.size)} places picture themselves\n`);

/**
 * Tier 2. Asked only of places tier 1 did not settle, because a mapper's
 * statement about a place comes with a licence and an author and a site's own
 * picture comes with neither.
 */
process.stderr.write("websites: reading what each place publishes of itself\n");

// Tier 3's two harvests depend on nothing above and are slow in their own
// right: the Commons grid sleeps between 49 calls, and the query service takes
// its time. Started here so they run under the site crawl, which is the long
// pole. Four unrelated hosts, so nothing is being hammered by the overlap.
process.stderr.write("commons: harvesting geotagged files\n");
process.stderr.write("wikidata: items in the box with a picture\n");
const anchoredSoon = Promise.all([fetchCommonsFiles(), fetchWikidataPlaces()]);

const fromSite = await fetchSiteImages(
  places.filter((place) => !place.cover && !own.has(place.id)),
);
process.stderr.write(`websites: ${String(fromSite.size)} places picture themselves\n`);

const [commonsFiles, wikidataFiles] = await anchoredSoon;

// One pool, keyed by file, because the two sources overlap: a photograph both
// databases place is the same photograph, and Commons' own coordinates are the
// ones taken with the camera.
const anchored = new Map(wikidataFiles.map((file) => [file.title, file]));
for (const file of commonsFiles) anchored.set(file.title, file);
process.stderr.write(
  `photographs anchored to a point: ${String(anchored.size)} (${String(anchored.size - commonsFiles.length)} of them only Wikidata knows about)\n`,
);

// Places already holding a picture of themselves (the hand-entered ones, plus
// tiers 1 and 2) are not offered a nearby photograph, and do not use one
// up.
const uncovered = places.filter(
  (place) => !place.cover && !own.has(place.id) && !fromSite.has(place.id),
);
const nearby = assignNearby(uncovered, [...anchored.values()], {
  radius,
  maxUses: MAX_USES,
  portraitRadius: PORTRAIT_RADIUS,
});
process.stderr.write(
  `commons: ${String(nearby.size)} places have one within ${String(radius)} m\n`,
);

/**
 * Tier 4, for what the three above leave bare. Decided here rather than in the
 * loop below so its files are credited in the same round trip as the others.
 */
const generic = new Map();
for (const place of uncovered) {
  if (nearby.has(place.id)) continue;
  const stock = stockPhoto(place.type);
  if (stock) generic.set(place.id, stock);
}
process.stderr.write(
  `stock: ${String(generic.size)} places take a photograph of their type\n`,
);

const titles = [
  ...new Set([
    ...[...own.values()].map((photo) => photo.title).filter(Boolean),
    ...[...nearby.values()].map((photo) => photo.title),
    ...generic.values(),
  ]),
];
process.stderr.write(`commons: crediting ${String(titles.length)} files\n`);
const credits = await fetchCredits(titles);

/** A Commons file, with whatever it is a picture of stated alongside. */
const commonsCredit = (title, { distance = null, generic: stock = false } = {}) => {
  const found = credits.get(title) ?? { author: null, licence: null };
  return {
    source: "Wikimedia Commons",
    sourceUrl: commonsPageUrl(title),
    author: found.author,
    licence: found.licence,
    nearbyMetres: distance,
    generic: stock,
  };
};

/**
 * A picture off somebody's own site or an `image` tag: credited to the host it
 * came from and linked back to it, with no author and no licence, because
 * neither is stated anywhere and inventing either is the one thing this import
 * must never do.
 *
 * Named for the page the picture belongs to rather than for the picture: a site
 * commonly serves its `og:image` off a CDN, and "cdn-eu-3.example.net" credits
 * nobody. For an `image` tag the two are the same URL.
 */
const hostCredit = (pageUrl) => ({
  source: new URL(pageUrl).hostname.replace(/^www\./, ""),
  sourceUrl: pageUrl,
  author: null,
  licence: null,
  nearbyMetres: null,
  generic: false,
});

const updated = places.map((place) => {
  const mine = own.get(place.id);
  if (mine?.title) {
    return {
      ...place,
      cover: commonsImageUrl(mine.title),
      coverCredit: commonsCredit(mine.title),
    };
  }
  if (mine?.url) {
    return { ...place, cover: mine.url, coverCredit: hostCredit(mine.url) };
  }

  const site = fromSite.get(place.id);
  if (site) {
    return { ...place, cover: site, coverCredit: hostCredit(site, place.website) };
  }

  const near = nearby.get(place.id);
  if (near) {
    return {
      ...place,
      cover: commonsImageUrl(near.title),
      coverCredit: commonsCredit(near.title, { distance: near.metres }),
    };
  }

  const stock = generic.get(place.id);
  if (stock) {
    return {
      ...place,
      cover: commonsImageUrl(stock),
      coverCredit: commonsCredit(stock, { generic: true }),
    };
  }

  // Every row carries the field, covered or not, so the shape a component
  // reads is the same one the type promises.
  return { ...place, coverCredit: place.coverCredit ?? null };
});

/**
 * And the same question of everything this run picked. Commons answers 404 for
 * a file that has been renamed or deleted since the geosearch index was built,
 * and an `image` tag can point at a host that has gone away; neither shows up
 * as anything but a placeholder in the app, so it is asked here instead.
 */
const chosen = updated.filter((place) => place.coverCredit).map((place) => place.cover);
process.stderr.write(`\nchecking ${String(chosen.length)} chosen covers\n`);
const chosenOk = await checkAll(chosen);
const unreachable = chosen.filter((url) => !chosenOk.get(url)).length;

const checked = updated.map((place) =>
  place.coverCredit && !chosenOk.get(place.cover)
    ? { ...place, cover: null, coverCredit: null }
    : place,
);

const json = `${JSON.stringify(checked)}\n`;
const covered = checked.filter((place) => place.cover).length;

process.stderr.write(
  [
    "",
    `places:     ${String(checked.length)}`,
    `osm tag:    ${String(own.size)}`,
    `own site:   ${String(fromSite.size)}`,
    `nearby:     ${String(nearby.size)} (views within ${String(radius)} m, portraits within ${String(PORTRAIT_RADIUS)} m)`,
    `dead:       ${String(deadCovers)} already in the fixture, ${String(unreachable)} picked here`,
    `covered:    ${String(covered)} (${((100 * covered) / checked.length).toFixed(1)}%)`,
    `size:       ${(json.length / 1024).toFixed(0)} kB`,
    "",
  ].join("\n"),
);

if (dryRun) {
  process.stderr.write("dry run: nothing written\n");
} else {
  writeFileSync(PLACES, json);
  process.stderr.write(`written: ${PLACES.pathname}\n`);
}

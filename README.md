# Waypoint

A map client for exploring points of interest, built on **Leaflet** and **OpenStreetMap** data.
Search 199 places across a city, filter by category, and open one to see its hours, contact
details, photograph and reviews.

**[Live demo](https://g-maps-clone.web.app/)** · React 17 · TypeScript · Redux Toolkit · Vite · Firebase

![The map and results panel](docs/screenshot-map.jpg)

---

## Why not the Google Maps API

Every tile, marker, popup and control on screen is rendered by Leaflet against open data.

- **No vendor lock-in.** The basemap is a URL template, so switching from MapTiler to Stadia, to a
  self-hosted tile server, or to raw OSM tiles is one environment variable.
- **No API to be locked out of.** The Google Maps JavaScript API bills per map load and holds the
  places, the geocoder and the rendering behind one key. Here the only keyed service is the
  basemap: set `VITE_MAPTILER_KEY` for MapTiler Streets, leave it unset and the map falls back to
  CARTO and Esri basemaps that need no account. Nothing else changes either way.
- **Control over rendering.** Markers are DOM elements styled with the same CSS as the rest of the
  interface, so each pin can carry its category's colour and the map is legible by kind as well as
  by position.

The trade: no routing, no Street View, no places database. For a viewer over a dataset you own,
none of those are needed.

## Running it

```bash
npm install
npm run dev
```

That is the whole setup — no `.env`, no API keys, no Firebase account. With no configuration the
app serves the 199-place dataset bundled in `src/data/fixtures/`, and every feature except sign-in
works offline.

To read live data from Firestore, copy `.env.example` to `.env` and fill it in. The app switches
adapters on its own.

The same file takes a `VITE_MAPTILER_KEY`, which swaps the fallback basemaps for MapTiler Streets.
It is a public client identifier and cannot be hidden, so restrict it by origin in the MapTiler
console; that is what protects the quota.

```bash
npm run verify   # types, lint, formatting, unit tests
npm run e2e      # Playwright, against the production build
```

## Architecture

```
src/
  domain/      Types and pure logic: opening hours, search ranking, categories
  data/        PlacesRepository port + Firestore and fixture adapters
  app/         Store, RTK Query endpoints, UI state
  components/  Shared presentational pieces
  features/    map · places · search · auth · saved
```

Data flows one way: **repository → RTK Query → selector → component**. Components never touch
Firebase, and the domain layer imports neither React nor Firebase, so the logic that is easiest to
get subtly wrong is testable in isolation.

### The repository port

`PlacesRepository` is five methods. Two implementations satisfy it, Firestore and fixtures, and
`src/data/index.ts` picks one at runtime based on whether Firebase is configured.

Two things follow. Reviewers get a working app from `git clone` with no credentials, and the test
suite runs against real code paths rather than mocked SDK calls. The backend is also a replaceable
part: a Postgres or Supabase adapter would be a new file implementing the same interface.

### Reading an inherited schema

The legacy Firestore adapter is an anti-corruption layer rather than a `map()`. The data behind
this app was written by an earlier version of it in 2021:

- Place data is split across two collections that have since drifted apart, each holding rows the
  other lacks. The adapter reads the union and merges by document id.
- The old editor saved its own input placeholders as real values, so `"Add website"` means an
  absent field rather than a website.
- Opening times were free text and contain typos such as `"10;00"`.
- Coordinates exist in two shapes: most rows hold a GeoPoint, a couple hold a plain `[lat, lng]`
  array. The old client read both with `Object.values()`, which flattened them by accident.
  Missing this on the rewrite handed Leaflet `(undefined, undefined)` and took the whole map down.
  It is now explicit and pinned by a test.

All of it lives in `src/data/normalise.ts`. None of it reaches a component.

## Where the data comes from

The 19 hand-entered places carry the ratings and reviews. The other 180 are imported from
OpenStreetMap by `scripts/import-osm.mjs`, which queries Overpass, maps OSM tags on to the app's
own types, and rewrites the fixture. Re-running it keeps any photograph already attached to a place,
and copies the hand-entered rows through — after checking them.

Four decisions there are worth naming:

- **Opening hours are parsed, not passed through.** OSM stores them as a small language
  (`Mo-Fr 08:00-13:00,14:00-20:00; Su off`). `scripts/opening-hours.mjs` reads the subset this app
  can represent and rejects the rest rather than approximating it, so a place whose hours cannot be
  stated exactly shows none. It has its own test suite.
- **3,666 candidates are cut to 180 by how well known each place is**, not by how completely it is
  filled in. Ranking on completeness measures the mapper rather than the place: it handed the map
  to whichever tyre fitter had typed in their opening hours. `scripts/popularity.mjs` scores each
  candidate on signals OSM already records — a Wikipedia article or Wikidata item, a photograph
  filed against it, what kind of place it is, how complete the record is, and how central it is.
  A small table and a sum, and it is tested.
- **Two ceilings on top of the ranking.** No kind may take more than a fifteenth of the map, and no
  chain more than two branches. Without them the top of the ranking is cafés and hotels all the way
  down: seven branches of one café and six parcel counters came through the first cut.
- **The inherited rows are checked rather than trusted.** They are the only ones nothing else in
  the pipeline reads, so whatever was wrong with them in 2021 rode through every import since. One
  of them was a park in Panama, which stretched the map to two continents the moment anyone
  filtered to Leisure; others stored the old editor's own prompts as values (`No data yet` as a
  phone number), an opening time of 01:02 to 01:02, and photographs in a Cloud Storage bucket this
  project has retired, all of which now answer 402. `scripts/curate.mjs` drops a place outside the
  city and scrubs those fields, naming what it dropped; `src/data/fixtures.test.ts` fails if any of
  it comes back.

Ratings are left empty on imported places. OSM has none, and inventing them would make every other
number in the app suspect.

## Photographs

Only **21** of the 199 places carry a picture of themselves in OSM — an `image` tag, a
`wikimedia_commons` file, or a Wikidata item with a portrait. A map where nine places in ten have
no photograph looks broken rather than sparse, so `scripts/import-photos.mjs` fills the rest from
three more sources, in order of how much each is a picture of the place itself:

- **What the place publishes of itself.** 137 of these places record a website, and a website's
  `og:image` is the picture it puts in a link preview: chosen by the business, at a URL meant to be
  embedded by strangers. **16 places** are covered this way, and for an ordinary café it is the
  only usable photograph of it that exists. Of the rest, 110 sites are unreachable, answer 403 to
  anything that is not a person, or carry no picture in their markup at all — and eleven more were
  turned down for being the logo rather than the place. A CMS names both `tild6561-3338….png`, so
  what gives it away is the shape: the header is read from the first 64 kB, and a square, a poster
  or a thin strip is not a photograph off a camera. See `isPhotoShaped`.
- **The nearest photograph anchored to a point.** Wikimedia Commons geosearch holds roughly 1,800
  geotagged files of this city, and Wikidata another hundred that Commons does not know are here.
  The closest one within **50 metres** goes to each place still uncovered, addressed through
  `Special:FilePath`, a plain URL that resizes on the way. The distance is stored beside the URL and
  the panel prints it: _Nearby · 28 m away_. On the shipped fixture this tier lands on **nothing**:
  the places it could serve are the landmarks, and the landmarks were already covered by their own
  tags. It stays because it is the right answer whenever the harvest says otherwise.
- **A stock photograph of the place's type.** The tier of last resort, and the weakest thing here:
  a bar in Irkutsk illustrated by a pub in Hertfordshire. **52 places**, from a table of 22
  interiors in `STOCK`. It is not a picture of the place, not of anywhere near it, and the panel
  says exactly that above the credit — _Generic photo, not of this place_. Nothing is inferred from
  one and nothing links to it; a place with a stock cover is still a place with no picture.

**94 of 199 places, 47%, show a photograph.** The other 105 draw their category's mark, which is
what a maps application does when it has no picture.

The app may show borrowed data, but it may not present it as something it is not — which is the
whole argument for that last tier, and the reason it is the last one. The nearby radius reached
150 m at one point and the map was 81% covered, filled out with a sunset over the embankment on a
burger place and a stranger's wooden house on a supermarket. Every one of those was a real
photograph taken where it said it was, honestly labelled with its distance, and every one read as a
mistake. A stock interior of the right kind of room does not: it is plainly decoration, and it is
labelled as decoration. So the knob that was turned down was the one that put a picture of a
specific other place on a place, and the coverage was made up with pictures that claim nothing.

Six more decisions:

- **A view may stand in for its neighbours; a portrait may not.** A shot of Karl Marx Street fairly
  pictures everything on it; a shot of the Epiphany Cathedral handed to the café opposite reads as
  a bug however honestly the distance is labelled, as did the trolleybus an earlier run gave a
  bank. The pool is split by what each photograph is _of_, and a portrait may only reach **25 m**,
  enough to cover the memorials, churches and museums that are themselves the subject.
- **Photographs are ranked globally, not per place.** Every pair inside the radius is sorted by
  distance and taken in that order, so a picture goes to the place it was shot outside rather than
  to whichever the loop reached first. No photograph is used more than twice.
- **Attribution travels with the picture.** Author and licence are stored per place, shown under
  the photograph and linked to the file page. The seed script writes them to Firestore too. A
  picture off a business's own site carries the domain it came from instead: the site states no
  author and no licence, and inventing either is the one thing this import must not do.
- **No scraped photo libraries.** TripAdvisor and the rest have a picture of every café in this
  city, on stable URLs that would work. They are also somebody else's photographs, published under
  terms that forbid exactly this and with no licence that could be printed under them. That is the
  same line as everything else here, and being short of coverage does not move it.
- **Stock photography decorates; it never illustrates.** One picture of a café behind every café
  would reach 100% coverage, so the table is deliberately 22 types long rather than exhaustive: the
  long tail of shops gets its category mark instead. What makes the 52 defensible is the label
  above them. An unlabelled stock cover would be false about every place it decorated.
- **Interiors, not exteriors, for the stock table.** An exterior invites the reader to match it
  against the building in front of them and fails; the inside of the right kind of room does not
  make that offer in the first place.
- **Every cover is fetched before it ships,** including those already in the fixture; a URL that
  does not answer with an image is dropped. Fourteen hand-entered places lost theirs this way, to a
  closed Firebase Storage bucket answering 402. A dead link is worse than none, because it counts
  as covered and is never offered one that works.

Re-running the script is safe: it withdraws the covers it wrote before assigning new ones.

## The map layer

Leaflet is driven directly rather than through `react-leaflet`:

- **A crowd is thinned, not collapsed.** Instead of a numbered bubble, every place gets the zoom
  at which it first appears: the most prominent place in a neighbourhood is drawn on its own and
  its neighbours wait until zooming in makes room. Prominence stands in for the popularity data
  this map lacks — a rating first, then record completeness (`prominence.ts`). Below 60 results
  thinning switches off, so a filtered list reads literally.
- **Only what is on screen exists.** Pins outside the viewport are not built.
- **Markers are diffed by key.** Panning touches only the pins that entered or left; changing the
  selection repaints two icons rather than rebuilding the layer.
- **The map's lifetime follows its DOM node,** via a ref callback with a cleanup function rather
  than an effect synchronising state on mount.
- **Pins are `divIcon`s:** no sprite to bundle, no broken icon paths, and markers styled from the
  same CSS as everything else. Leaflet forwards `alt` only for image icons, so the accessible name
  is written into the icon markup, with the place name escaped as third-party data.

One dependency fewer than `react-leaflet`, and the imperative boundary sits in one file
(`useMarkerLayer.ts`).

### Why not MapLibre

MapLibre GL renders on the GPU and would hold this dataset many times over without thinning. So
would Leaflet: measured rather than assumed, **Leaflet with DOM markers stays under one frame up to
about 1,000 pins**. The thinning stays because it is a legibility requirement before a performance
one, and because a Firestore deployment can take the whole import.

Against that, MapLibre costs roughly five times the bundle, needs a vector tile source where the
raster basemap here is one URL template, and needs WebGL, which headless CI does not reliably have.
The trade starts paying at tens of thousands of points, or when the map needs tilt, rotation or
data-driven styling.

![A place, with a credited photograph, hours and contact details, in the dark theme](docs/screenshot-place.jpg)

## Writing

Adding, correcting and reviewing a place all happen in the panel, in the column the list came
from; a modal over the map would cover the thing the form is about. One form, where the old version
had five modals.

- **It works with no backend.** The fixture repository implements the same write methods as the
  Firestore one and stores edits in `localStorage`, which is how the published demo shows writing
  at all.
- **Position by moving the map under a crosshair,** not by dragging a marker: on a phone your thumb
  covers the marker exactly when you need to see where it is going. The picker is its own small
  Leaflet map, mounted only while the form is open.
- **The photo field validates by showing you the photo.** Every string test for an image URL either
  rejects a working link or accepts a dead one, and the browser settles it in a moment.

Mutations patch the RTK Query cache rather than invalidating it, since invalidating `listPlaces`
would re-read the whole collection to learn about one row already in hand. A write the rules refuse
is rolled back.

## Testing

| Layer   | Tool                     | What it covers                                                                                   |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| Domain  | Jest                   | Opening hours across midnight, search ranking, category mapping, schema normalisation            |
| Import  | Jest                   | The OSM opening-hours grammar, which places make the map, and which photograph a place may claim |
| App     | Jest + Testing Library | Filtering, selection, deep links, saved places, load failures                                    |
| Browser | Playwright               | Leaflet actually rendering, marker thinning, marker/list sync, mobile sheet                      |

172 unit tests and 42 browser tests, run on desktop and mobile viewports in CI.

The map is stubbed in the jsdom tests, since Leaflet needs real layout and a real canvas and a test
that mocks both proves nothing. Playwright covers it against the production build instead.

## Security model

`firestore.rules` is in the repository, reviewed like any other change, and deployed by CI on every
push to `master` — before the app itself, so a release cannot go out assuming an access model that
failed to land. What is committed here is what the database enforces.

| Path                       | Read   | Write                                           |
| -------------------------- | ------ | ----------------------------------------------- |
| `places/{id}`              | anyone | its author, or anyone signed in if it has none  |
| `places/{id}/reviews/{id}` | anyone | anyone signed in; never edited or deleted after |
| `users/{uid}`              | owner  | owner, shape-validated, list capped at 500      |

A place someone created belongs to them. A place with no author — every one of the 180 imported
from OpenStreetMap — is community-maintained and correctable by anyone signed in.
`src/domain/placeInput.ts` checks the same lengths, but only to say so before a round trip.

Two limits worth stating:

- Posting a review moves the place's average, so the review and the average are written in one
  transaction. The rules can check that the count rose by exactly one and the average stayed in
  range, but cannot recompute it without reading every review. Closing that gap properly means
  writing it in a Cloud Function, which needs a billing plan this project does not use.
- A cover photo is a link to an image rather than an upload: no bucket, no billing plan, and a link
  that rots looks exactly like a place that never had one. The rules hold it to `https://` and 500
  characters. Provenance is not a client's to state, so the rules refuse any credit a browser
  writes and accept only the one the import wrote.

> The previous revision shipped no rules file at all, which left every collection world-writable by
> anyone who found the endpoint.

## Numbers

- 7 runtime dependencies, down from 40. The removed set included `sharp`, `firebase-admin` and
  `firebase-functions`, none of which were ever imported, and `node-sass`, which made
  `npm install` fail on any Node newer than 16.
- ~3,100 lines of application code, down from ~10,900, for a wider feature set.
- 147 kB gzipped initial JavaScript. The dataset (23 kB gzipped, down from 100 kB when the fixture
  held 1,620 places) and the Firebase SDK are both dynamically imported; a fixtures build never
  fetches the SDK at all.
- First contentful paint ~85 ms, pins on screen ~105 ms, 10 MB heap. Throttled to a quarter of the
  CPU on a simulated fast-3G connection, the pins are there in 1.5 s and the last tile lands at
  4.3 s, so it is network-bound rather than compute-bound. Clearing a search and putting every
  place back takes about 10 ms, against Chrome's 200 ms threshold for a responsive interaction.

## What is next

More than one photograph per place, since Commons usually has several where it has one, and a way
to report a place that should not be on the map. Neither needs anything the access model above does
not already have.

## History

This repository began in July 2021 as `google-maps-clone`, a deliberately close visual copy of
Google Maps. That version is tagged
**[`v0.1-google-maps-clone`](../../tree/v0.1-google-maps-clone)** and its commits are still in the
history.

The rewrite kept the idea and the dataset and replaced everything else, including the interface,
which had been a pixel copy down to the Material components it was assembled from. What it keeps is
the palette and the shape of the furniture — Google's greys and blue, its place-icon colours, a
full-height results column, pill filters, round actions under a place's name — and not the copy,
the component library, the marks, or the layout beyond that outline.

## Licence

MIT. Place data and map data © OpenStreetMap contributors
([ODbL](https://www.openstreetmap.org/copyright)), tiles ©
[MapTiler](https://www.maptiler.com/copyright/) where a key is configured and © CARTO (light) /
© Esri, HERE, Garmin (dark) where one is not. The attribution control names whichever is on screen.

Photographs are © their authors — via [Wikimedia Commons](https://commons.wikimedia.org/) under
each file's own licence, mostly CC BY-SA and CC BY with some public domain, or published by the
places themselves. The app names the author and the licence under every one and links to the file
page; the fixture stores the same, so the credit cannot be separated from the picture.

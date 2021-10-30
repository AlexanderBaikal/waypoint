# Waypoint

A map client for exploring points of interest, built on **Leaflet** and **OpenStreetMap** data.
Search, filter by category, and open a place to see its hours, contact details and reviews.

**[Live demo](https://g-maps-clone.web.app/)** · React 17 · TypeScript · Redux Toolkit · Vite · Firebase

![The map and results panel](docs/screenshot-map.jpg)

---

## Why not the Google Maps API

Every tile, marker, popup and control on screen is rendered by Leaflet against open data.
Nothing here is an embedded Google map, and that was the point of building it:

- **No vendor lock-in.** The basemap is a URL template. Switching from CARTO to Stadia, to a
  self-hosted tile server, or to raw OSM tiles is one environment variable.
- **No metered API.** The Google Maps JavaScript API bills per map load. This runs on tiles that
  cost nothing at this scale, so a demo can stay online indefinitely.
- **Control over rendering.** Markers are DOM elements styled with the same CSS as the rest of the
  interface, so the map is part of the design rather than an iframe with its own opinions.

The trade is real and worth stating: there is no routing, no Street View, and no places database.
For a viewer over a dataset you own, none of those are needed.

## Running it

```bash
npm install
npm run dev
```

That is the whole setup. **No `.env`, no API keys, no Firebase account.** With no configuration
the app serves a 20-place dataset bundled in `src/data/fixtures/`, and every feature except
sign-in works offline.

To read live data from Firestore instead, copy `.env.example` to `.env` and fill it in. The app
switches adapters on its own; nothing else changes.

```bash
npm run verify   # types, lint, formatting, unit tests
npm run e2e      # Playwright, against the production build
```

## How it is put together

```
src/
  domain/      Types and pure logic — opening hours, search ranking, categories
  data/        PlacesRepository port + Firestore and fixture adapters
  app/         Store, RTK Query endpoints, UI state
  features/    map · places · search · auth · saved
```

Data flows one way: **repository → RTK Query → selector → component**. Components never touch
Firebase, and the domain layer imports neither React nor Firebase, so the logic that is easy to
get subtly wrong is testable in isolation.

### The repository port

`PlacesRepository` is three methods. Two implementations satisfy it — Firestore and fixtures —
and `src/data/index.ts` picks one at runtime based on whether Firebase is configured.

Two things fall out of that. Reviewers get a working app from `git clone` with no credentials,
and the test suite runs against real code paths rather than mocked SDK calls. It also means the
backend is a replaceable part: adding a Postgres or Supabase adapter is a new file implementing
the same interface, not a rewrite.

### Reading a schema you inherited

The Firestore adapter is an anti-corruption layer, not a `map()`. The data behind this app was
written by an earlier version of it in 2021, and it shows:

- Place data is split across two collections that have since **drifted apart** — each holds rows
  the other lacks. The adapter reads the union and merges by document id.
- The old editor **saved its own input placeholders** as real values, so `"Add website"` is an
  absent field rather than a website.
- Opening times were free text and contain typos such as `"10;00"`.
- Coordinates exist in **two different shapes** — most rows hold a GeoPoint, a couple hold a
  plain `[lat, lng]` array. The old client read both with `Object.values()`, which flattened them
  by accident; missing this on the rewrite handed Leaflet `(undefined, undefined)` and took the
  whole map down. It is now explicit, and pinned by a test.

All of that lives in `src/data/normalise.ts`. None of it reaches a component.

### The map layer

Leaflet is driven directly rather than through `react-leaflet`:

- **Markers are diffed by id.** Filtering the list touches only the pins that appeared or
  disappeared; changing the selection repaints exactly two icons rather than every marker.
- **The map's lifetime follows its DOM node,** via a ref callback with a cleanup function, not an
  effect that has to synchronise state on mount.
- **Pins are `divIcon`s,** so there is no image sprite to bundle, no broken icon paths, and the
  markers are styled from the same CSS as everything else.

One dependency fewer, and the imperative/declarative boundary sits in one file
(`useMarkerLayer.ts`) instead of being spread across components.

![A place, with hours, contact details and reviews](docs/screenshot-place.jpg)

## Testing

| Layer   | Tool                     | What it covers                                                                        |
| ------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Domain  | Jest                   | Opening hours across midnight, search ranking, category mapping, schema normalisation |
| App     | Jest + Testing Library | Filtering, selection, deep links, saved places, load failures                         |
| Browser | Playwright               | Leaflet actually rendering, marker/list sync, mobile sheet                            |

54 unit tests and 16 browser tests, run on desktop and mobile viewports in CI.

The map is stubbed in the jsdom tests — Leaflet needs real layout and a real canvas, and a test
that mocks all of that proves nothing. Playwright covers it against the production build instead.

## Security model

`firestore.rules` and `storage.rules` are in the repository and reviewed like any other change.

| Collection                           | Read   | Write                                      |
| ------------------------------------ | ------ | ------------------------------------------ |
| `places`, `descriptions`, `comments` | anyone | nobody                                     |
| `users/{uid}`                        | owner  | owner, shape-validated, list capped at 500 |

Reference data is maintained out-of-band and is immutable from a browser. Signing in does not
unlock editing anything; it carries a saved list, which lives in `localStorage` when signed out
and merges into the user's document on sign-in.

> The previous revision shipped **no rules file at all**, which left every collection
> world-writable by anyone who found the endpoint.

## Notes on the numbers

- 8 runtime dependencies, down from 40. The removed set included `sharp`, `firebase-admin` and
  `firebase-functions` — server-side packages that were never imported — and `node-sass`, which
  made `npm install` fail on any Node newer than 16.
- ~2,900 lines of application code, down from ~10,900, for a comparable feature set.
- 137 kB gzipped initial JavaScript. The Firebase SDK is dynamically imported and never enters
  the bundle when running on fixtures.

## What is next

Place editing — create and edit a place, drag its pin, upload a cover photo, post a review — as a
single schema-driven form rather than the five separate modals the old version used. That work
extends the rules above with authenticated, owner-scoped writes.

## History

This repository began in July 2021 as `google-maps-clone`, a deliberately close visual copy of
Google Maps. That version is tagged **[`v0.1-google-maps-clone`](../../tree/v0.1-google-maps-clone)**
and its commits are still in the history.

The rewrite kept the idea and the dataset and replaced everything else — including the interface,
because a faithful copy of Google Maps reads as an embedded Google map no matter who wrote it.

## Licence

MIT. Map data © OpenStreetMap contributors, tiles © CARTO.

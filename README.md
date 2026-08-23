# Nashik Monitor

Interactive map of Nashik–Trimbakeshwar civic and Kumbh Mela 2027 infrastructure:
ghats, CCTV, parking, ring road, hospitals, police stations, mandirs and 18 more
layers. An initiative by **Kumbhathon Innovation Foundation**.

Static site. No backend, no accounts, no API keys.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc && vite build
npm run typecheck
npm test           # export-format checks
```

## Stack

Vite + TypeScript + MapLibre GL. No framework. Three runtime dependencies:
`maplibre-gl`, `@fontsource/jost`, and the GeoJSON type package.

Basemap is [OpenFreeMap](https://openfreemap.org) — `positron` for light,
`dark` for dark. Keyless, no account, no usage cap to manage.

This is a from-scratch rewrite. It replaces a fork of
[koala73/worldmonitor](https://github.com/koala73/worldmonitor) that carried
~2,700 files and an 8,694-line map component to render one city. That fork has
been deleted.

## Layout

| file | role |
|---|---|
| `src/boot.ts` | entry point: splash first, then the map after a painted frame |
| `src/main.ts` | map, lazy layer loading, sidebar, popups, theme swap |
| `src/layers.ts` | the 25-layer config table — one row per file in `public/data` |
| `src/formats.ts` | the five export converters, and the name-key list popups share |
| `src/theme.ts` | theme state, basemap URLs, point-halo colour |
| `src/splash.ts` | intro sequence timing and skip |
| `src/style.css` | design tokens, splash, shell, popup |
| `scripts/build-datasets.mjs` | splits the master NTKMA KML into per-layer GeoJSON |
| `scripts/apply-verified-coordinates.mjs` | idempotent coordinate override table |
| `scripts/test-formats.ts` | asserts each export format; `npm test` |
| `scripts/check-download-ui.mjs` | drives the real page and downloads all five formats |
| `scripts/check-splash-timing.mjs` | asserts the intro animates before the map chunk lands |

### How layers render

Every dataset gets three sublayers — `fill`, `line`, `point` — filtered on
`geometry-type`. Files holding mixed geometry (ghats: 13 polygons + 14 markers +
1 line) need no special casing, and empty sublayers simply draw nothing.

Data is fetched on **first toggle**, never re-fetched, and cached in memory so a
theme switch can rebuild layers without re-downloading. Boot pulls ~300 KB, not
the full 2.4 MB.

`setStyle()` discards custom sources along with the old style, so switching theme
re-adds every cached layer on `style.load`. That is the only non-obvious part of
`main.ts`.

### Why boot.ts exists

A module script blocks the first paint until its whole graph has evaluated. With
the map imported from the entry point, the splash could not start until ~1 MB of
maplibre-gl had loaded — it began 450 ms late and then competed with the map
build for the main thread. So `boot.ts` runs the splash, and imports the map
after two animation frames; `style.css` is a `<link>` in `index.html` rather than
a JS import, for the same reason. `scripts/check-splash-timing.mjs` asserts the
intro is already playing while the map chunk is still in flight.

### Downloads

Every sidebar row has a ↓ button: pick a layer, pick a format, get that layer
only. A layer that was never switched on is fetched on demand, so downloading
does not require displaying.

| format | for |
|---|---|
| GeoJSON | QGIS, Leaflet, the raw file |
| CSV | Excel, Google Sheets, pandas — UTF-8 BOM so Devanagari names survive |
| KML | Google Earth, Google My Maps — carries the layer colour |
| GPX | GPS units, OsmAnd, Garmin — points as waypoints, shapes as tracks |
| GeoJSON Lines | one feature per line, for streaming tools |

All five are text formats, so `Blob` + `<a download>` is the whole pipeline and
no dependency was added. Shapefile, GeoPackage and xlsx are absent on purpose:
each is a binary container needing a library to write, and CSV plus GeoJSON
already reach every tool a student is likely to open.

Exports keep **all** properties, `locationConfidence` included — an approximate
point has to stay labelled approximate outside this map too. In CSV, polygons
and lines leave `longitude`/`latitude` empty and put the shape in a `wkt`
column, rather than passing one vertex off as "the" location.

## Brand

Terracotta **#B34A2E**, sampled from the filled circle in the Kumbhathon logo.
Warm ink `#14110F` on warm paper `#FDFCFB`; the dark theme is a warm counterpart
(`#191512`), not a blue-black. Jost approximates the KUMBHATHON wordmark.

Terracotta is reserved for UI chrome. No data layer uses it — a layer wearing the
brand colour reads as "selected".

The splash background is exactly `#FEFEFE` because that is the logo PNG's own
opaque ground; any other value shows its rectangle as a seam.

## Data honesty

`public/data/` holds 25 GeoJSON files, 7,806 features, 2.4 MB.

**581 features have no real coordinate.** The 12 "kumbhdoot" source sheets carried
names and addresses only, so each point was placed by matching address text to a
locality centroid plus jitter (`locationConfidence: "locality-match"`, 348) or
near the city centre when even that failed (`"approximate"`, 233). Popups label
both. `"verified"` means confirmed against an independent source and gets a
checkmark.

This matters. Two real errors found by cross-checking:

- **Ghats** were 10 spreadsheet points sitting **344–402 m off the Godavari**, in
  one consistent direction. The correct data — 14 surveyed areas — was already in
  the master KML, tagged `category=ghat`, never surfaced. Now 3–65 m from the
  river (OSM centreline), mean 30 m.
- **City Centre Mall** was **688 m** from the building, from a "Parijat Nagar"
  locality match. OSM's `shop=mall` footprint and the Photon geocoder agree on
  19.99055, 73.76197.

Method that caught both: pull ground truth from OpenStreetMap via Overpass, then
measure. For a class of POI with enough OSM coverage, compare the *mean offset
vector* — mandirs across 382 matches came to 8 m, which is how we know the
pipeline is unbiased and the ghats sheet was uniquely wrong.

Raw sources (KML, KMZ, GeoPackage, PDF) and a full dataset inventory live outside
this repo, in `Downloads/Nashik Monitor/` — see `datasets/README.md` there for
per-file provenance and the dated corrections.

## Not built yet

- **Clustering.** Mandirs (1,089), grocery shops (745) and CCTV (4,079) draw as
  raw circles. Needs per-layer cluster config, so decide first which layers are
  "browse" and which are "look up".
- **Search**, URL state, deploy config.
- **9 of 11 malls remain `locality-match`** — unknown to OSM, Nominatim and
  Photon alike. Spot-check them and add to `apply-verified-coordinates.mjs`.
- **Two ghats dropped**: Kushavarta Kund (Trimbakeshwar, outside the KML) and
  Godavari Ghat (Someshwar, old coordinate ~5 km off). Both need a verified pin.
- The logo PNG is 192 KB of flat-colour art; a real quantizer gets it under 30 KB.

## License

AGPL-3.0-only, inherited from the upstream project the original fork came from.

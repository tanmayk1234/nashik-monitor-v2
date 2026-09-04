# Nashik Monitor

[![CI](https://github.com/tanmayk1234/nashik-monitor-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/tanmayk1234/nashik-monitor-v2/actions/workflows/ci.yml)

Interactive map of Nashik–Trimbakeshwar civic and Kumbh Mela 2027 infrastructure:
ghats, CCTV, parking, ring road, hospitals, police stations, bus stops, mandirs,
waste collection rounds and 27 more layers. An initiative by **Kumbhathon
Innovation Foundation**.

Static site. No backend, no accounts. Keyless by default — the optional
satellite basemap is the one thing that needs an API key, and it is opt-in.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc && vite build
npm run typecheck
npm test           # export-format and confidence-vocabulary assertions

# Browser checks, against a running dev server. Set CHROMIUM_PATH if the
# installed browser build does not match the one @playwright/test pins.
node scripts/check-splash-timing.mjs
node scripts/check-download-ui.mjs
```

## Stack

Vite + TypeScript + MapLibre GL. No framework. Three runtime dependencies:
`maplibre-gl`, `@fontsource/jost`, and the GeoJSON type package.

Basemap is [OpenFreeMap](https://openfreemap.org) — `positron` for light,
`dark` for dark. Keyless, no account, no usage cap to manage.

## Layout

| file | role |
|---|---|
| `src/boot.ts` | entry point: splash first, then the map after a painted frame |
| `src/main.ts` | map, lazy layer loading, sidebar, popups, theme swap |
| `src/layers.ts` | the 33-layer config table — one row per file in `public/data` |
| `src/formats.ts` | the five export converters, and the name-key list popups share |
| `src/download.ts` | the per-layer format menu and the file save |
| `src/theme.ts` | theme state, basemap URLs, terrain and point-halo colours |
| `src/confidence.ts` | the accuracy vocabularies, and what each grade tells a reader |
| `src/descriptions.ts` | what each layer is, where it came from, and what it will mislead you about |
| `src/splash.ts` | intro sequence timing and skip |
| `src/style.css` | design tokens, splash, shell, popup |
| `scripts/build-datasets.mjs` | splits the master NTKMA KML into per-layer GeoJSON |
| `scripts/build-mobility.mjs` | splits the administrator's mobility-plan KMZ into layers |
| `scripts/build-citilink.mjs` | Citilinc bus stops and depots, from the RTI annexure |
| `scripts/build-waste-fleet.mjs` | NMC waste collection routes, zones and checkpoints, from the tracking RTI |
| `scripts/apply-verified-coordinates.mjs` | idempotent coordinate override table |
| `scripts/test-formats.ts` | asserts each export format; `npm test` |
| `scripts/test-confidence.ts` | asserts every confidence value in the data has a caveat |
| `scripts/check-download-ui.mjs` | drives the real page and downloads all five formats |
| `scripts/check-splash-timing.mjs` | asserts the intro animates before the map chunk lands |
| `scripts/browser.mjs` | shared Playwright launch for the two checks |

### How layers render

Every dataset gets three sublayers — `fill`, `line`, `point` — filtered on
`geometry-type`. Files holding mixed geometry (ghats: 13 polygons + 14 markers +
1 line) need no special casing, and empty sublayers simply draw nothing.

Data is fetched on **first toggle**, never re-fetched, and cached in memory so a
theme switch can rebuild layers without re-downloading. Boot pulls ~300 KB, not
the full 6.6 MB.

`setStyle()` discards custom sources along with the old style, so switching theme
re-adds every cached layer on `style.load`.

Hit-testing runs on every `mousemove`, so the list of live sublayer ids is cached
when a layer mounts rather than rebuilt per event.

### Why boot.ts exists

A module script blocks the first paint until its whole graph has evaluated. With
the map imported from the entry point, the splash could not start until ~1 MB of
maplibre-gl had loaded — it began 450 ms late and then competed with the map
build for the main thread. So `boot.ts` runs the splash, and imports the map
after two animation frames; `style.css` is a `<link>` in `index.html` rather than
a JS import, for the same reason. `scripts/check-splash-timing.mjs` asserts the
intro is already playing while the map chunk is still in flight.

### What a popup says

Clicking a feature used to answer with its raw spreadsheet columns and nothing
else. That tells you what was recorded and never what you are looking at: "HOLDING
AREA 60" with an area in square metres does not say whether it is a crowd ground
or a car park, and `geocodeConfidence: LOW` does not say who graded it.

So `src/descriptions.ts` carries, per layer, what a single feature **is**, where
the data **came from**, and what the layer will **mislead** you about. Raw keys
get a readable label — `actualReachTime` shows as "Actual Reach Time" — with the
original key kept on hover so a reader can still match a popup against a
downloaded CSV.

Each entry was drafted from that layer's own fields and its build script, then
fact-checked by a second reader whose brief was to refute it. **That pass
rewrote 31 of the 36.** What it caught was not stylistic:

- the **ghats** layer described as following the KMZ's folders, when it is the
  one layer that does not — its two named ghats sit in the Railway station and
  VIP routes folders, and the rest were pulled out of Holding Areas by measuring
  against the river
- the **ring road** called a stretch of road, when all eight features are closed
  loops that end on their own start point
- the **parking** merge described as appending polygons, when it also replaced
  the geometry of an existing zone
- **congestion points** presented as measured crowding, when "congestion" is the
  build script's own label for whatever polygons were left over

The layer caveat is deliberately separate from the per-feature confidence badge:
that one says how sure the map is about *this* point, the caveat says what the
whole dataset gets wrong. For a layer where every position is a locality guess,
the badge repeats per dot while the caveat gives the proportion — 40 of 46
hotels placed by locality name, 6 more near the city centre.

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

### Layer colours

All 36 layers have their own colour. They did not used to: colour encoded only
the group, and layers inside a group were lightness steps of a single hue, which
put Emergency routes and Bus stops at ΔE 1.5 — indistinguishable — with 89 of the
630 pairs under ΔE 10.

Hue still carries the family, so "is this emergency or shopping" still reads at a
glance. What changed is that separation *within* a family is now bought with
lightness and chroma. Each layer was pinned to a ±35° window around the hue it
already wore, and forbidden to drift nearer another group's hue than its own —
without that second rule the optimiser put malls in pure red and police in tan.
Within those bounds a search maximised the smallest of all 630 pairwise
distances.

**Worst pair is now ΔE 7.6, with 2 pairs under ΔE 10 instead of 89.** Both
survivors are inside Shops, where five layers share the orange-brown corner of
the gamut and there is no more room.

Colour-vision deficiency is enforced as a floor rather than the goal: no pair
collapses below ΔE 4 under protanopia, deuteranopia or tritanopia (Machado 2009
matrices), and the per-layer glyph remains the identifier that does not depend on
colour at all. Optimising *for* CVD caps the whole palette at ΔE 4.9, which is
worse for everybody — 36 hues that survive colour blindness do not exist, which
is what the original six-family scheme was right about.

Hospitals and Ghats keep their exact previous colour, and the five layers the map
opens with are held to a vivid chroma; the other 31 may use the muted end, which
is where most of the separation is won. Lightness runs 0.455–0.755 OKLCH, and
every symbol carries a halo — white on the light theme, near-black on the dark —
so both ends stay legible on either basemap.

## Data honesty

`public/data/` holds 36 GeoJSON files, 12,128 features, 6.6 MB.

**579 features have no real coordinate.** The 12 "kumbhdoot" source sheets carried
names and addresses only, so each point was placed by matching address text to a
locality centroid plus jitter (`locationConfidence: "locality-match"`, 350) or
near the city centre when even that failed (`"approximate"`, 229). Popups label
both. `"verified"` means confirmed against an independent source and gets a
checkmark.

**A further 495 hospitals are graded, not surveyed.** That layer arrived with its
own vocabulary — `geocodeConfidence` HIGH/MEDIUM/LOW, 206/115/174 — and no script
here produces it, so what the upstream grades mean is recorded nowhere. What is
measurable is how often a grade stacks several hospitals on one coordinate: LOW
75%, MEDIUM 60%, HIGH 35%, with 19 piled on the worst single point. The gradient
is real and none of the three is a surveyed position, so all three say so in the
popup. `scripts/test-confidence.ts` asserts that every value present in the data
has something to say for itself — it exists because for a while LOW did not, and
174 hospitals rendered with no badge at all.

The **1,854 Citilinc bus stops** are the opposite case: geofence centres straight
out of the operator's own AVL system, every coordinate distinct, and spot checks
against OSM land 5–20 m out (Tapovan Depot 5 m, Gangapur Dam 17 m, Nashik Road
railway station 20 m). Six rows of that annexure sit in **Ahmedabad**, 570 km
away — Iscon Cross Road, Prahladnagar, Karnavati and three more — and are dropped
by `build-citilink.mjs`, which asserts the count so a seventh has to be looked at.

The **NMC waste collection** layers come from a vehicle tracking RTI covering a
single day, 30 August 2026: 408 vehicle folders holding 254 planned rounds, 398
geofenced service areas and 1,563 timing checkpoints.

**The raw GPS is deliberately not in the repo.** The export also carries 355,246
position fixes — every vehicle's whole shift at roughly one fix per second. That
is 77 MB against a `public/data` of 6.6 MB, and more to the point a vehicle maps
to a crew, so publishing it would put named workers' entire working day on a
public map. The route, the area and the checkpoints are what a resident actually
needs. The pings stay local, where they are still the way to check the rounds
against where the vehicles really went.

What the fleet is rests on the requester, not the document: the export has no
covering letter and no field naming the service. The payload alone supports only
"a municipal fleet running residential rounds" — 13% of checkpoints fall within
100 m of a Citilinc bus stop, median speed is 11 km/h, and the checkpoint names
are mandirs, nagars, kirana shops and housing societies. It is measurably not
the city bus fleet. If the identification is ever withdrawn, the layer labels
are what to revisit.

Three things in that data are recorded rather than resolved:

- **The checkpoint clock is a slot, not a timetable.** 84% of `expected_time`
  values land exactly on `:00` or `:30`, while `actual_reach_time` is spread
  across every minute. So `deviationMinutes` is plain subtraction — half the
  rows more than 5 minutes early, a third more than 5 minutes late — and it
  measures against a nominal half-hour slot. It is a spread, not a punctuality
  score, and nothing in the map calls it one.
- **47 vehicle folders hold checkpoints naming a different vehicle.** Either the
  round changed hands during the day or the export mislabels it; the reply does
  not say. Both the folder plate and the export's own `route_name` ship, as
  `vehicle` and `routeLabel`, instead of one being picked as the winner.
- **Ward numbers are half-hidden.** 110 checkpoints name a ward outright
  (`W6 R9`, `Ward 1 Route 3`) and 350 carry a trailing `A1`–`A6` code. Wherever
  a row has both they agree, 110 times out of 110, across wards 1, 3, 4 and 6 —
  good evidence that the A code *is* the ward, and still not something the reply
  says. So `ward` is only set from an explicit W, and `areaCode` ships beside it
  unread, for anyone who wants to act on the correlation themselves.

Coordinates arrive at full float precision — `19.99096999999999836` and forty
more digits — which is the binary expansion of the number, not survey accuracy.
They are rounded to 6 decimal places, about 0.11 m, finer than any fix in the
file.

**The 4,079 CCTV points are indicative, not an inventory.** 2,200 of them were
never surveyed: a generator scattered them at random inside the ghat and
core-city polygons — 400 named `G-###`, 1,200 named `C-####`, and 600 named
`M-###` around the core perimeter — and the same script deleted the legacy camera
placemarks it found on the way through. The other 1,280 `Z<n>-C<m>` and 599
`RRC` points came from the master KML, and nothing here establishes those as
surveyed either, so the whole layer carries `locationConfidence: "indicative"`
rather than splitting a distinction the source does not support. Each point also
carries `placement`, which is the one thing that genuinely differs between them.

A caveat in a popup was not enough here: 4,079 dots read as "the city is covered
in cameras" before anyone clicks anything. So this is the one layer that says so
on selection — switching it on raises a notice, once per page load. `notice` in
`src/descriptions.ts` is that mechanism, and CCTV is deliberately its only user.

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
vector* — mandirs across 382 matches came to 8 m, which is what establishes that
the pipeline is unbiased and the ghats sheet was uniquely wrong.

The raw survey sources (KML, KMZ, GeoPackage, PDF) are not in the repo — only the
GeoJSON built from them. The one exception is `scripts/source/`: the Citilinc RTI
reply is a 198-page 300 DPI scan with no text layer, so nothing can parse it. That
table was read off the page by hand, which makes the transcription itself the
source — it is committed, and `citilink-routes.json` beside it holds the 51 route
duty schedules from pages 3–136. Those carry no coordinates in the reply, so they
stay a reference table rather than a map layer: drawing a line between a route's
named endpoints would invent a path the document never gives. `scripts/build-datasets.mjs` takes the KML path as its
first argument, so regenerating the four KML-derived layers needs a local copy of
the NTKMA master file.

## Roadmap

- **Clustering.** Mandirs (1,089), grocery shops (745) and CCTV (4,079, indicative) draw as
  raw circles. Needs per-layer cluster config, so decide first which layers are
  "browse" and which are "look up".
- **Search**, URL state, deploy config.
- **9 of 11 malls remain `locality-match`** — unknown to OSM, Nominatim and
  Photon alike. Spot-check them and add to `apply-verified-coordinates.mjs`.
- **Two ghats dropped**: Kushavarta Kund (Trimbakeshwar, outside the KML) and
  Godavari Ghat (Someshwar, old coordinate ~5 km off). Both need a verified pin.
- The logo PNG is 192 KB of flat-colour art; a real quantizer gets it under 30 KB.

## License

AGPL-3.0-only — see [LICENSE](LICENSE). Inherited from
[koala73/worldmonitor](https://github.com/koala73/worldmonitor), which an earlier
version of this project was forked from before being rewritten.

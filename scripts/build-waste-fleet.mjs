// Usage: node scripts/build-waste-fleet.mjs "<path to the RTI export folder>" [outDir]
//
//   node scripts/build-waste-fleet.mjs "~/Downloads/Nashik Monitor/RTI/20260830" public/data
//
// Imports the NMC waste collection (ghantagadi) vehicle tracking export: one
// folder per vehicle, named by its registration plate, holding up to four files
// from the operator's AVL system.
//
//   vehicle_details.json  raw GPS pings, ~1 s apart          NOT IMPORTED, see below
//   default_route.json    the planned round, as a path       -> waste-routes.geojson
//   route_polygon.json    the geofenced service area         -> waste-zones.geojson
//   checkpoints.json      timing points, expected vs actual  -> waste-checkpoints.geojson
//
// What the fleet is, and how that is known: the export carries no covering
// letter and no field naming the service. It was identified as NMC waste
// collection by the person who filed the RTI. The payload itself only supports
// the weaker statement — a municipal fleet running residential rounds — so if
// that identification is ever withdrawn, the layer labels are what to revisit.
// Measurable in the data: only 13% of checkpoints fall within ~100 m of a
// Citilinc bus stop, median speed is 11 km/h, and the checkpoint names are
// mandirs, nagars, colonies, kirana shops and housing societies. It is not the
// city bus fleet, and it is not intercity.
//
// The 355,246 raw GPS pings are deliberately NOT emitted. Two reasons, and the
// second is the one that decides it:
//   - 77 MB, against a public/data that is 6.6 MB in total.
//   - Each vehicle_details.json is one vehicle's entire shift at roughly one
//     fix per second on a named date. A vehicle maps to a crew, so publishing
//     it would put a worker's whole working day on a public map. The route,
//     the zone and the checkpoints are what a resident actually needs.
// They are still worth keeping locally: they are how the routes below can be
// checked against where the vehicles really went.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const srcDir = process.argv[2];
const outDir = process.argv[3] ?? 'public/data';
assert.ok(srcDir, 'usage: node scripts/build-waste-fleet.mjs <RTI export folder> [outDir]');

const SOURCE = 'NMC waste collection vehicle tracking export, 30 Aug 2026 (RTI)';

// The source writes coordinates at full float precision — 19.99096999999999836
// and 48 more digits of it. That is the binary expansion of the number, not
// survey accuracy. 6 decimal places is ~0.11 m at this latitude, finer than any
// GPS fix in the file, and it cuts the output roughly in half.
const DP = 1e6;
const round = (n) => Math.round(n * DP) / DP;

// Each file is a bare comma-separated run of objects with no enclosing array,
// so it is not valid JSON on its own and JSON.parse rejects it as written.
const readRows = (file) => JSON.parse(`[${fs.readFileSync(file, 'utf8').trim()}]`);

// Consecutive repeats are the vehicle sitting still; they add vertices and no
// shape. Anything non-finite is dropped rather than becoming a NaN coordinate.
function toPath(rows) {
  const out = [];
  for (const row of rows) {
    const point = [round(Number(row.longitude)), round(Number(row.latitude))];
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const previous = out[out.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  return out;
}

const vehicles = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.ok(vehicles.length > 0, `no vehicle folders in ${srcDir}`);

const has = (vehicle, file) => fs.existsSync(path.join(srcDir, vehicle, file));
const rowsOf = (vehicle, file) => readRows(path.join(srcDir, vehicle, file));

// The plate is the operator's own identifier for the round, and it is the only
// one the export gives. Kept verbatim, double spaces and trailing "(G)" / "- G"
// / "G SATPUR" included: those suffixes clearly mean something to NMC, nothing
// in the reply says what, and normalising them would be a guess written into
// the data. `verified` for the same reason the Citilinc stops are: these are
// coordinates out of the operator's own tracking system, not address matches.
const provenance = { locationConfidence: 'verified', locationSource: SOURCE };

// The export keys every folder on a plate, but checkpoints.json carries its own
// `route_name`, and that is where the round's real identity lives: 110 rows name
// a ward outright ("W6 R9", "Ward 1 Route 3"), 350 carry a trailing A1-A6 code,
// and 325 rows across 47 folders name a different plate from the folder they
// sit in.
//
// The A code looks like the ward number — wherever a row carries both, they
// agree, 110 times out of 110, across wards 1, 3, 4 and 6. That is good evidence
// and it is still not a statement the reply makes, so `ward` is only set from an
// explicit W/Ward and the A value ships beside it, unread, as `areaCode`.
// Anyone who wants to act on the correlation can see it in the data.
const WARD = /\bW\s?(\d+)\b|\bWard\s+(\d+)\b/i;
const ROUTE_NUMBER = /\bR\s?(\d+)\b|\bRoute\s+(\d+)\b/i;
const AREA_CODE = /\bA(\d+)\b/;

const matchNumber = (pattern, value) => {
  const found = pattern.exec(value);
  return found ? Number(found[1] ?? found[2]) : undefined;
};

// Two plates are "the same round" if their digits and letters match once the
// operator's own trailing tags are taken off — NEW, CHECK, a bare A6, a lone
// letter. Whitespace differs constantly between the folder and route_name and
// means nothing ("MH15FV1015 (P)" against "MH 15 FV 1015").
const plateCore = (value) =>
  String(value)
    .toUpperCase()
    .replace(/\b(NEW|CHECK|ROUT|W\s?\d+|R\s?\d+|A\d+)\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '');

// Service areas overlap heavily — sampling the city on a 0.005 degree grid, a
// covered point sits under 10 zones at the median and 21 at the worst. The app's
// default fill-opacity of 0.18 compounds over 10 layers to 0.86, which is why
// the first render was one opaque green mass with Nashik somewhere underneath
// it. At 0.03 the same stack reaches 0.26, and 0.47 at the very worst point, so
// the basemap stays readable everywhere while the boundaries still read.
//
// Emitted as simplestyle properties, the same convention the mobility KMZ uses,
// so this is a property on the data and needs no special case in the app.
//
// Opacities only, deliberately no `fill` or `stroke`: with the colour keys
// absent the app falls back to the layer's own colour, so src/layers.ts stays
// the one place the palette lives and a colour change there does not have to be
// chased into a rebuilt data file.
const ZONE_STYLE = { 'fill-opacity': 0.03, 'stroke-width': 1, 'stroke-opacity': 0.5 };

const routes = [];
const zones = [];
const checkpoints = [];

let unclosedRings = 0;
const reassigned = new Map();

for (const vehicle of vehicles) {
  if (has(vehicle, 'default_route.json')) {
    const rows = rowsOf(vehicle, 'default_route.json');
    const line = toPath(rows);
    // A LineString needs two positions. Nothing in this export falls short, but
    // a future one that does should drop the feature, not emit a broken shape.
    if (line.length >= 2) {
      routes.push({
        type: 'Feature',
        properties: { Name: vehicle, routeId: rows[0]?.route_id, points: line.length, ...provenance },
        geometry: { type: 'LineString', coordinates: line },
      });
    }
  }

  if (has(vehicle, 'route_polygon.json')) {
    const rows = rowsOf(vehicle, 'route_polygon.json');
    const ring = toPath(rows);
    if (ring.length >= 3) {
      // 243 of the 398 rings arrive open. KML had the same habit; GeoJSON
      // requires the first and last position to be identical.
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([...first]);
        unclosedRings++;
      }
      zones.push({
        type: 'Feature',
        properties: { Name: vehicle, routeId: rows[0]?.route_id, ...ZONE_STYLE, ...provenance },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    }
  }

  if (has(vehicle, 'checkpoints.json')) {
    for (const row of rowsOf(vehicle, 'checkpoints.json')) {
      const longitude = round(Number(row.longitude));
      const latitude = round(Number(row.latitude));
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      const label = String(row.route_name ?? '').trim();
      // Where route_name names a different vehicle from the folder it sits in,
      // both are kept. One of them is wrong, or the round changed hands during
      // the day, and nothing in the reply says which — so picking a winner here
      // would be inventing the answer. The pairs are printed at the end.
      if (label && plateCore(label) !== plateCore(vehicle)) {
        reassigned.set(`${vehicle} -> ${label}`, (reassigned.get(`${vehicle} -> ${label}`) ?? 0) + 1);
      }
      checkpoints.push({
        type: 'Feature',
        properties: {
          Name: row.location,
          vehicle,
          routeLabel: label || undefined,
          ward: matchNumber(WARD, label),
          routeNumber: matchNumber(ROUTE_NUMBER, label),
          areaCode: matchNumber(AREA_CODE, label),
          expectedTime: row.expected_time,
          actualReachTime: row.actual_reach_time,
          deviationMinutes: deviation(row.expected_time, row.actual_reach_time),
          ...provenance,
        },
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
      });
    }
  }
}

// Plain subtraction of two clock times, in minutes, negative for early. It is
// NOT a punctuality score, and the README says so too: 84% of expected_time
// values land exactly on :00 or :30 while actual_reach_time is spread across
// every minute, so the schedule the deviation is measured against is a nominal
// half-hour slot rather than a timetable anyone promised to hit.
function deviation(expected, actual) {
  const clock = (value) => {
    const parts = /^(\d+):(\d+):(\d+)$/.exec(String(value));
    return parts ? Number(parts[1]) * 60 + Number(parts[2]) + Number(parts[3]) / 60 : null;
  };
  const from = clock(expected);
  const to = clock(actual);
  return from === null || to === null ? undefined : Math.round(to - from);
}

function write(file, features, expected) {
  assert.equal(features.length, expected, `${file}: expected ${expected} features, got ${features.length}`);
  assert.ok(features.every((f) => f.geometry), `${file}: a feature lost its geometry`);
  const outPath = path.join(outDir, file);
  fs.writeFileSync(outPath, `${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`${file.padEnd(28)} ${String(features.length).padStart(5)} features  ${String(kb).padStart(5)} KB`);
}

fs.mkdirSync(outDir, { recursive: true });
write('waste-routes.geojson', routes, 254);
write('waste-zones.geojson', zones, 398);
write('waste-checkpoints.geojson', checkpoints, 1563);

console.log(`\n${vehicles.length} vehicle folders read`);
console.log(`${unclosedRings} service-area ring(s) arrived open and were closed`);

const withWard = checkpoints.filter((f) => f.properties.ward !== undefined).length;
const withArea = checkpoints.filter((f) => f.properties.areaCode !== undefined).length;
console.log(`${withWard} checkpoint(s) name a ward outright, ${withArea} carry an A1-A6 code`);

const rows = [...reassigned.values()].reduce((n, count) => n + count, 0);
console.log(`\n${rows} checkpoint(s) in ${reassigned.size} folder(s) name a different vehicle than the folder they sit in.`);
console.log('Both are kept — the reply does not say which is right:');
for (const pair of [...reassigned.keys()].sort().slice(0, 10)) console.log(`  ${pair}`);
if (reassigned.size > 10) console.log(`  ... and ${reassigned.size - 10} more`);

const deviations = checkpoints.map((f) => f.properties.deviationMinutes).filter((v) => v !== undefined);
const sorted = [...deviations].sort((a, b) => a - b);
const share = (fn) => `${Math.round((deviations.filter(fn).length / deviations.length) * 100)}%`;
console.log(`\ncheckpoint arrival vs its nominal slot, ${deviations.length} rows:`);
console.log(`  median ${sorted[Math.floor(sorted.length / 2)]} min   more than 5 min early ${share((d) => d < -5)}   within 5 min ${share((d) => Math.abs(d) <= 5)}   more than 5 min late ${share((d) => d > 5)}`);
console.log('  (expected_time is a nominal :00/:30 slot — this is a spread, not a punctuality score)');

console.log(`\nraw GPS pings deliberately not imported — see the note at the top of this file`);

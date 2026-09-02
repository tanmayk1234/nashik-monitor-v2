// node scripts/build-citilink.mjs
//
// Turns the transcribed Citilinc annexure into the two layers that have real
// coordinates: every geofenced bus stop, and the two depots.
//
// The source is an RTI reply from Nashik Mahanagar Parivahan Mahamandal Ltd
// (letter 3120/2026, 17 Aug 2026) — 198 pages of 300 DPI scan with no text
// layer at all, so scripts/source/citilink-bus-stops.psv was read off the page
// rather than parsed. That file is the input here; the PDF is not in the repo,
// same as every other raw survey source.
//
// The route duty schedules on pages 3-136 carry no coordinates, so they stay in
// scripts/source/citilink-routes.json as a reference table. Drawing a line
// between a route's named endpoints would invent a path the source never gives.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'scripts', 'source', 'citilink-bus-stops.psv');
const OUT = join(ROOT, 'public', 'data');

// Nashik district, generously. Anything outside is not a Nashik bus stop.
const BOUNDS = { minLat: 19.5, maxLat: 20.5, minLon: 73.3, maxLon: 74.3 };

// (U) and (D) are the up and down sides of the same road — two geofences, two
// real kerbside positions, so both are kept. Recorded as a property rather than
// left buried in the name, because "which side" is the question anyone standing
// at the stop is actually asking.
function direction(name) {
  if (/\((?:U)\)\s*\d*$/.test(name)) return 'up';
  if (/\((?:D)\)\s*\d*$/.test(name)) return 'down';
  return undefined;
}

const rows = readFileSync(SRC, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => {
    const [sr, depot, city, name, lat, lon] = line.split('|');
    return { sr: Number(sr), depot, city, name, lat: Number(lat), lon: Number(lon) };
  });

assert.equal(rows.length, 1860, `expected 1,860 source rows, got ${rows.length}`);
rows.forEach((r, i) => assert.equal(r.sr, i + 1, `row ${i + 1} is out of sequence (sr ${r.sr})`));

const inRegion = (r) =>
  r.lat >= BOUNDS.minLat && r.lat <= BOUNDS.maxLat && r.lon >= BOUNDS.minLon && r.lon <= BOUNDS.maxLon;

// Six rows in the source sit at 23.02 N, 72.50 E — Iscon Cross Road,
// Prahladnagar, Karnavati and friends are in Ahmedabad, ~570 km away, and are
// not Nashik bus stops however the operator's geofence list came by them. They
// are dropped rather than silently plotted, and the count is asserted so a
// future edit that adds a seventh has to come and look at this.
const foreign = rows.filter((r) => !inRegion(r));
assert.equal(foreign.length, 6, `expected 6 out-of-region rows, got ${foreign.length}`);

const stops = rows.filter(inRegion);

// The depots are two of the stops. They are lifted into their own layer because
// 1,854 stop pins bury them, and because the fleet numbers from page 1 of the
// reply hang off them.
const DEPOTS = [
  {
    name: 'Tapovan Depot',
    match: 'Tapovan Depot (D)',
    buses: 150,
    cng: 120,
    diesel: 30,
  },
  {
    name: 'Nashik Road Depot',
    match: 'Nashik Road Depot',
    buses: 100,
    cng: 80,
    diesel: 20,
  },
];

const feature = (lon, lat, properties) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

const stopFeatures = stops.map((r) =>
  feature(r.lon, r.lat, {
    Name: r.name,
    depot: r.depot,
    side: direction(r.name),
    // Every one of these is a surveyed geofence centre from the operator's own
    // AVL system, not an address match, so it says so.
    locationConfidence: 'verified',
    locationSource: 'NMPML (Citilinc) RTI reply 3120/2026, 17 Aug 2026',
  }),
);

const depotFeatures = DEPOTS.map((d) => {
  const hit = stops.find((r) => r.name === d.match);
  assert.ok(hit, `depot "${d.match}" not found in the stop table`);
  return feature(hit.lon, hit.lat, {
    Name: d.name,
    buses: d.buses,
    cngBuses: d.cng,
    dieselBuses: d.diesel,
    electricBuses: 0,
    stopsServed: stops.filter((r) => r.depot === d.name).length,
    locationConfidence: 'verified',
    locationSource: 'NMPML (Citilinc) RTI reply 3120/2026, 17 Aug 2026',
  });
});

const write = (file, features) => {
  writeFileSync(join(OUT, file), `${JSON.stringify({ type: 'FeatureCollection', features }, null, 1)}\n`);
  console.log(`${file.padEnd(24)} ${features.length.toLocaleString('en-IN')} features`);
};

write('bus-stops.geojson', stopFeatures);
write('bus-depots.geojson', depotFeatures);

console.log(`\ndropped ${foreign.length} out-of-region rows (Ahmedabad):`);
for (const r of foreign) console.log(`  sr ${r.sr}  ${r.name}  ${r.lat}, ${r.lon}`);

const sides = stopFeatures.filter((f) => f.properties.side).length;
console.log(`\n${sides.toLocaleString('en-IN')} of ${stopFeatures.length.toLocaleString('en-IN')} stops name an up/down side`);

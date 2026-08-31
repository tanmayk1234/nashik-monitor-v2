// Usage: node scripts/build-mobility.mjs "<path to doc.kml>" [outDir]
//
// Imports the NTKMA "Mobility plan Nashik" KMZ. A KMZ is a zip holding one
// doc.kml, so unzip it first and pass the doc.kml path — that keeps a zip
// library out of the dependency list:
//
//   unzip -o "Mobility plan Nashik.kmz" -d /tmp/mobility
//   node scripts/build-mobility.mjs /tmp/mobility/doc.kml public/data
//
// The KMZ is a Google Earth Pro export: 315 placemarks in 58 nested folders,
// and the folder path is the only category the data carries. So the split below
// follows the administrator's own folders rather than inventing groupings.
//
// Outputs:
//   staging-areas.geojson       13 Points
//   holding-areas.geojson       48 Polygons + 48 centroid markers
//   railway-station.geojson     89 mixed (station plans, drop/pickup, holding)
//   vip-routes.geojson          19 mixed
//   emergency-routes.geojson    67 mixed (ghat -> hospital routes)
//   movement-routes.geojson     40 LineStrings
//   ghats.geojson                2 Polygons + 2 centroid markers
//   parking-zones.geojson       merged into the existing file, see below
//
// Two things this file gets right that a naive import would not:
//
// 1. Parking is 94% a repeat of the existing parking-zones.geojson. 16 of the 17
//    "Inner parking" polygons are byte-identical to features already there —
//    same vertex count, same area to the m², 0.0 m max vertex offset. Emitting
//    them again would draw every one of those zones twice. So parking is merged,
//    not appended: identical geometry keeps its existing feature and only gains
//    the new attributes, one revised polygon replaces its old geometry, and the
//    20 genuinely new "Outer parking" polygons are appended.
//
// 2. The 5 Google Earth HTML balloon descriptions are an attribute table, not
//    prose: Two_Wheeler, Motor_Vehicle, Bus_Parking, Nivara_Shed, Area in
//    hectares, a Drive photo link. Those are parsed into real properties. The
//    Area values corroborate the geometry — APMC Market's stated 4.270192 ha
//    against 42,827 m² measured off its own ring.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { XMLParser } from 'fast-xml-parser';

const srcPath = process.argv[2];
const outDir = process.argv[3] ?? 'public/data';
assert.ok(srcPath, 'usage: node scripts/build-mobility.mjs <doc.kml> [outDir]');

const SOURCE = 'Mobility plan Nashik KMZ (NTKMA)';

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => ['Placemark', 'Document', 'Folder'].includes(name),
});
const doc = parser.parse(fs.readFileSync(srcPath, 'utf8'));

// Folder path per placemark: it is the only category in the file, and two
// folders deep is where the meaning lives ("Routes / Emergency routes").
const rows = [];
(function walk(node, trail) {
  for (const key of ['Document', 'Folder']) {
    for (const child of node[key] ?? []) walk(child, [...trail, String(child.name ?? '').trim()]);
  }
  for (const pm of node.Placemark ?? []) rows.push({ pm, trail, name: String(pm.name ?? '').trim() });
})(doc.kml, []);

assert.ok(rows.length > 0, 'no placemarks found — is this the doc.kml from inside the KMZ?');

// ── Geometry ───────────────────────────────────────────────────────────────

function parseCoords(raw) {
  return String(raw)
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(',').map(Number))
    // KML allows a third altitude value; the app is 2D, so drop it.
    .map(([lon, lat]) => [lon, lat])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

function closeRing(ring) {
  const first = ring[0];
  const last = ring[ring.length - 1];
  // KML does not require the ring to close; GeoJSON does.
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}

// Holes are read even though this file has none: innerBoundaryIs is where a
// silent import bug hides, and a dropped hole looks like valid data.
function polygonRings(node) {
  const outer = parseCoords(node.outerBoundaryIs?.LinearRing?.coordinates);
  if (outer.length < 4) return null;
  const innerRaw = node.innerBoundaryIs;
  const inners = (Array.isArray(innerRaw) ? innerRaw : innerRaw ? [innerRaw] : [])
    .map((h) => parseCoords(h.LinearRing?.coordinates))
    .filter((r) => r.length >= 4)
    .map(closeRing);
  return [closeRing(outer), ...inners];
}

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function simpleGeometry(node, kind) {
  if (kind === 'Point') {
    const [position] = parseCoords(node.coordinates);
    return position ? { type: 'Point', coordinates: position } : null;
  }
  if (kind === 'LineString') {
    const line = parseCoords(node.coordinates);
    return line.length >= 2 ? { type: 'LineString', coordinates: line } : null;
  }
  const rings = polygonRings(node);
  return rings ? { type: 'Polygon', coordinates: rings } : null;
}

function geometryOf(pm) {
  for (const kind of ['Point', 'LineString', 'Polygon']) {
    if (pm[kind] !== undefined) return simpleGeometry(pm[kind], kind);
  }
  if (pm.MultiGeometry === undefined) return null;
  // All 5 MultiGeometry placemarks in this file wrap a single Polygon, so they
  // unwrap to a plain Polygon. A homogeneous group of several becomes a Multi*.
  // A mixed one would need GeometryCollection, which the app's per-geometry
  // sublayer filters cannot match, so that asserts rather than silently drops.
  const present = ['Point', 'LineString', 'Polygon'].filter((k) => pm.MultiGeometry[k] !== undefined);
  assert.strictEqual(present.length, 1, `MultiGeometry mixing ${present.join('+')} is not supported`);
  const kind = present[0];
  const parts = asArray(pm.MultiGeometry[kind]).map((n) => simpleGeometry(n, kind)).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return { type: `Multi${kind}`, coordinates: parts.map((p) => p.coordinates) };
}

// ── Properties ─────────────────────────────────────────────────────────────

const stripTags = (html) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Google Earth balloon: an outer table whose first cell is a heading, wrapping
// an inner table of key/value cells. Everything after the heading pairs up.
function parseBalloon(html) {
  const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => {
    const href = m[1].match(/href="([^"]+)"/i);
    return href ? href[1] : stripTags(m[1]);
  });
  const out = {};
  for (let i = 1; i + 1 < cells.length; i += 2) {
    const key = cells[i];
    const value = cells[i + 1];
    // The trailing cell of the balloon is an inlined onclick script.
    if (!key || /^function\b/.test(key) || key.includes('{')) continue;
    if (value === undefined || value === '' || /^function\b/.test(value)) continue;
    // Picture is a Google Drive link to the administrator's own site photo.
    // public/data ships in a public repo and every export carries all
    // properties, so republishing someone else's Drive file IDs is not this
    // project's call to make. The capacities beside it are the useful part.
    if (key === 'Picture') continue;
    out[key] = value;
  }
  return out;
}

function propertiesOf({ pm, name, trail }) {
  const props = { name };
  const raw = String(pm.description ?? '').trim();
  if (raw) {
    if (/<td[^>]*>/i.test(raw)) Object.assign(props, parseBalloon(raw));
    else props.description = stripTags(raw);
  }
  // Full folder path, minus the two wrapper levels every placemark shares. It
  // is what tells a "HOLDING AREA 60" in PLANE-A from the same one in PLANE-B.
  const folder = trail.slice(2).filter(Boolean).join(' / ');
  if (folder) props.sourceFolder = folder;
  props.source = SOURCE;
  return props;
}

function toFeature(row, extra = {}) {
  const geometry = geometryOf(row.pm);
  if (!geometry) return null;
  return { type: 'Feature', properties: { ...propertiesOf(row), ...extra }, geometry };
}

// ── Measurement, for the merge and the report ──────────────────────────────

const outerRing = (g) =>
  g.type === 'Polygon' ? g.coordinates[0] : g.type === 'LineString' ? g.coordinates : null;

function metres(a, b) {
  const R = 6371000;
  const lat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(((b[1] - a[1]) * Math.PI * R) / 180, (((b[0] - a[0]) * Math.PI * R) / 180) * Math.cos(lat));
}

const centroid = (ring) => [
  ring.reduce((sum, [lon]) => sum + lon, 0) / ring.length,
  ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length,
];

// Shoelace on an equirectangular projection about the ring's own latitude.
// Good to a fraction of a percent at these sizes; no projection library needed.
function areaM2(ring) {
  const R = 6371000;
  const lat0 = (ring.reduce((s, [, y]) => s + y, 0) / ring.length) * (Math.PI / 180);
  const flat = ring.map(([x, y]) => [((x * Math.PI) / 180) * R * Math.cos(lat0), ((y * Math.PI) / 180) * R]);
  let sum = 0;
  for (let i = 0; i < flat.length - 1; i++) sum += flat[i][0] * flat[i + 1][1] - flat[i + 1][0] * flat[i][1];
  return Math.abs(sum / 2);
}

const sameRing = (a, b) =>
  a.length === b.length && a.every((v, i) => Math.abs(v[0] - b[i][0]) < 1e-9 && Math.abs(v[1] - b[i][1]) < 1e-9);

// Polygons this small are a pixel or two at the default zoom 11 — right
// coordinates, invisible anyway. Each area also gets a centroid Point, which the
// app's per-geometry sublayers draw as a symbol at every zoom while the polygon
// shows the true footprint once you zoom in. Vertex mean is enough for shapes
// this size; no centroid library needed.
function withMarkers(features) {
  return features.flatMap((feature) => {
    const ring = outerRing(feature.geometry);
    if (!ring) return [feature];
    return [
      { ...feature, properties: { ...feature.properties, role: 'area' } },
      {
        type: 'Feature',
        properties: { ...feature.properties, role: 'marker' },
        geometry: { type: 'Point', coordinates: centroid(ring) },
      },
    ];
  });
}

// ── Classification, by the KMZ's own folder names ──────────────────────────

const at = (row, depth) => row.trail[depth] ?? '';
// Two polygons are ghat areas rather than the plan furniture around them:
// "Ramkund and near by Ghats" (18,343 m², 15 m from the surveyed Ganga Ghat 2)
// and "Odha Ghat - Proposed" (5,691 m²). Both sit in folders named for something
// else, so they are matched by name, and asserted to be exactly two.
const isGhatArea = (row) => /^(Ramkund and near by Ghats|Odha Ghat - Proposed)$/i.test(row.name);

const ghatRows = rows.filter(isGhatArea);
const rest = rows.filter((r) => !isGhatArea(r));

// Three placemarks in this file cannot become valid GeoJSON: a linear ring needs
// four positions, and they carry none or one. They are recorded here and printed
// at the end rather than vanishing into a filter(Boolean).
const dropped = [];
const keep = (row, feature) => {
  if (feature) return true;
  dropped.push(row);
  return false;
};

const pick = (fn) => rest.filter(fn).map((r) => ({ r, f: toFeature(r) })).filter(({ r, f }) => keep(r, f)).map(({ f }) => f);

const staging = pick((r) => at(r, 2).startsWith('Staging Area'));
const railway = pick((r) => at(r, 2) === 'Railway station');
const holding = pick((r) => at(r, 2) === 'Holding Areas');
const vip = pick((r) => at(r, 2) === 'Routes' && at(r, 3).startsWith('VIP routes'));
const emergency = pick((r) => at(r, 2) === 'Routes' && at(r, 3) === 'Emergency routes');
const movement = pick((r) => at(r, 2) === 'Routes' && at(r, 3) === 'Movement');
const ghats = ghatRows.map((r) => toFeature(r, { category: 'ghat' })).filter(Boolean);

const parkingRows = rest.filter((r) => at(r, 2) === 'Parking');
const inner = parkingRows.filter((r) => at(r, 3) === 'Inner parking');
const outer = parkingRows.filter((r) => at(r, 3) === 'Outer parking');

// Nothing may fall through the classifier unnoticed: every placemark is either
// in a layer, in the parking merge, or in the dropped list with a reason.
const classified = staging.length + railway.length + holding.length + vip.length + emergency.length +
  movement.length + ghats.length + inner.length + outer.length;
assert.strictEqual(
  classified + dropped.length,
  rows.length,
  `${rows.length - classified - dropped.length} placemark(s) matched no folder rule`,
);
assert.strictEqual(dropped.length, 3, `expected 3 unusable placemarks, found ${dropped.length}`);
assert.strictEqual(ghats.length, 2, `expected 2 ghat areas, found ${ghats.length}`);

// ── Parking merge ──────────────────────────────────────────────────────────

const parkingPath = path.join(outDir, 'parking-zones.geojson');
const existing = JSON.parse(fs.readFileSync(parkingPath, 'utf8'));

// Re-runnable: a previous run's appended Outer polygons are removed first, or a
// second run would silently double them. Keyed on sourceFolder, which only this
// script writes — the revised inner polygon also carries `source`, so matching
// on that alone would delete it. Revised geometry is idempotent anyway (it gets
// rewritten to the same rings) and untouched features never move.
const priorRun = existing.features.filter((f) => String(f.properties.sourceFolder ?? '').startsWith('Parking / Outer parking'));
existing.features = existing.features.filter((f) => !priorRun.includes(f));
const before = existing.features.length;
if (priorRun.length) console.log(`dropped ${priorRun.length} Outer polygon(s) from a previous run before re-merging\n`);

// Only geometry the KMZ actually changes gets rewritten; everything else keeps
// the feature that is already on the map, so its id and history stay put.
let identical = 0;
let revised = 0;
let enriched = 0;
const report = [];

for (const row of inner) {
  const feature = toFeature(row, {});
  if (!feature) continue;
  const ring = outerRing(feature.geometry);
  if (!ring) continue;
  const match = existing.features
    .map((f) => ({ f, d: metres(centroid(ring), centroid(f.geometry.coordinates[0])) }))
    .sort((a, b) => a.d - b.d)[0];
  assert.ok(match && match.d < 200, `Inner parking "${row.name}" has no counterpart within 200 m — merge rule needs a look`);

  // Attributes the KMZ adds (capacities, area, photo) land on the existing
  // feature either way; name and sourceFolder do not overwrite what is there.
  // `source` is deliberately excluded: on a byte-identical polygon this KMZ is
  // corroboration, not the origin, and claiming otherwise would rewrite where
  // the coordinate actually came from. It is set below only where the geometry
  // is genuinely replaced.
  const { name: _n, sourceFolder: _s, source: _src, ...gained } = feature.properties;
  const added = Object.keys(gained).filter((k) => match.f.properties[k] === undefined);
  if (added.length) {
    Object.assign(match.f.properties, gained);
    enriched++;
  }

  if (sameRing(ring, match.f.geometry.coordinates[0])) {
    identical++;
  } else {
    const wasArea = Math.round(areaM2(match.f.geometry.coordinates[0]));
    match.f.geometry = feature.geometry;
    match.f.properties.source = SOURCE;
    revised++;
    report.push(`  revised  ${match.f.properties.name}: ${wasArea} -> ${Math.round(areaM2(ring))} m2, centroid moved ${match.d.toFixed(0)} m`);
  }
  if (added.length) report.push(`  enriched ${match.f.properties.name}: +${added.join(', ')}`);
}

// `zone` is the field this layer already uses for the distinction — the 32
// existing features are 20 outer and 12 inner — so the new polygons join that
// vocabulary rather than introducing a second, contradicting one.
for (const row of outer) {
  const feature = toFeature(row, { category: 'parking', zone: 'outer' });
  if (feature) existing.features.push(feature);
}

// ── Write ──────────────────────────────────────────────────────────────────

function write(file, features, expected) {
  assert.strictEqual(features.length, expected, `${file}: expected ${expected} features, got ${features.length}`);
  assert.ok(features.every((f) => f.geometry), `${file}: a feature lost its geometry`);
  const outPath = path.join(outDir, file);
  fs.writeFileSync(outPath, `${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
  const types = {};
  for (const f of features) types[f.geometry.type] = (types[f.geometry.type] ?? 0) + 1;
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`${file.padEnd(26)} ${String(features.length).padStart(5)} features  ${String(kb).padStart(5)} KB  ${JSON.stringify(types)}`);
}

fs.mkdirSync(outDir, { recursive: true });
write('staging-areas.geojson', staging, 13);
write('holding-areas.geojson', withMarkers(holding), 96); // 48 areas + 48 markers
write('railway-station.geojson', railway, 86); // 89 in the KMZ, 3 have no usable ring
write('vip-routes.geojson', vip, 19);
write('emergency-routes.geojson', emergency, 67);
write('movement-routes.geojson', movement, 40);
write('ghats.geojson', withMarkers(ghats), 4); // 2 areas + 2 markers
write('parking-zones.geojson', existing.features, before + outer.length);

console.log(`\nparking-zones.geojson ${before} -> ${existing.features.length} features`);
console.log(`  ${identical} Inner polygons byte-identical to what was already there (geometry untouched)`);
console.log(`  ${revised} revised, ${enriched} gained attributes, ${outer.length} Outer polygons appended`);
for (const line of report) console.log(line);

// The administrator's own gaps, not the parser's. Named rather than swallowed.
console.log(`\n${dropped.length} placemark(s) in the KMZ have no usable geometry and were not imported:`);
for (const row of dropped) {
  const node = row.pm.Polygon ?? row.pm.MultiGeometry?.Polygon;
  const raw = String(node?.outerBoundaryIs?.LinearRing?.coordinates ?? '').trim();
  const points = raw ? raw.split(/\s+/).length : 0;
  console.log(`  ${(row.name || '(no name)').padEnd(18)} ${points} coordinate(s) — a ring needs 4 — in ${row.trail.slice(2).join(' / ')}`);
}

// Usage: node scripts/build-datasets.mjs "<path to updated_main.kml>" public/data
//
// Splits the NTKMA master KML into the layers the app actually shows. The
// previous pipeline dumped all 53 polygons into cctv-cameras.geojson under
// invented categories, so the ghat areas — which were in the KML all along —
// never surfaced, the parking zones were drawn twice, and the "ghats" layer
// was wired to spreadsheet points sitting ~800 m off the river.
//
// Outputs (one file per real-world thing):
//   cctv-cameras.geojson     4079 Points, zone parsed off the Z<n>-C<m> label
//   congestion-points.geojson   8 areas (crowd chokepoints + 2 landmarks)
//   ring-road.geojson           8 LineStrings (Official Ring Road Segment 1-8)
//
// Deliberately NOT emitted: the 32 "Zone Area <n>" polygons. Every one of them
// matches a feature in parking-zones.geojson (built from the NTKMA parking KMZ,
// which carries real names and inner/outer) within ~50 m, so re-emitting them
// here would double-draw the parking layer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { XMLParser } from 'fast-xml-parser';

const srcPath = process.argv[2];
const outDir = process.argv[3] ?? 'public/data';
assert.ok(srcPath, 'usage: node scripts/build-datasets.mjs <updated_main.kml> [outDir]');

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => ['Placemark', 'Document', 'Folder'].includes(name),
});
const doc = parser.parse(fs.readFileSync(srcPath, 'utf8'));

const placemarks = [];
(function walk(node) {
  if (!node || typeof node !== 'object') return;
  for (const key of ['Document', 'Folder']) for (const child of node[key] ?? []) walk(child);
  for (const pm of node.Placemark ?? []) placemarks.push(pm);
})(doc.kml);

assert.ok(placemarks.length > 0, 'no placemarks found — is this a KML file?');

function parseCoords(raw) {
  return String(raw)
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(',').map(Number))
    // KML allows a third altitude value; the app is 2D, so drop it.
    .map(([lon, lat]) => [lon, lat])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

function geometryOf(pm) {
  if (pm.Point) {
    const [position] = parseCoords(pm.Point.coordinates);
    return position ? { type: 'Point', coordinates: position } : null;
  }
  if (pm.LineString) {
    const line = parseCoords(pm.LineString.coordinates);
    return line.length >= 2 ? { type: 'LineString', coordinates: line } : null;
  }
  if (pm.Polygon) {
    const ring = parseCoords(pm.Polygon.outerBoundaryIs?.LinearRing?.coordinates);
    if (ring.length < 4) return null;
    // KML does not require the ring to close; GeoJSON does.
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return { type: 'Polygon', coordinates: [ring] };
  }
  return null;
}

const named = placemarks.map((pm) => ({ pm, name: String(pm.name ?? '').trim() }));

const isGhat = ({ name }) => /\b(ghat|kund)\b/i.test(name);
const isZoneArea = ({ name }) => /^Zone Area\b/i.test(name);
const isRingRoad = ({ name }) => /^Official Ring Road Segment\b/i.test(name);
const isCamera = ({ pm }) => !!pm.Point;

function toFeature({ pm, name }, properties = {}) {
  const geometry = geometryOf(pm);
  if (!geometry) return null;
  const description = String(pm.description ?? '').trim();
  return {
    type: 'Feature',
    properties: { name, ...(description ? { description } : {}), ...properties },
    geometry,
  };
}

// These areas are a few hundred metres across at most, which at the default
// zoom 11 is a pixel or two — right coordinates, invisible anyway. Each area
// therefore also gets a centroid Point,
// which the app's per-geometry sublayers draw as a dot at every zoom while the
// polygon itself shows the true footprint once you zoom in. Vertex mean is good
// enough for shapes this small and convex; no centroid library needed.
function withMarkers(features) {
  return features.flatMap((feature) => {
    const ring = feature.geometry.type === 'LineString'
      ? feature.geometry.coordinates
      : feature.geometry.coordinates[0];
    const marker = {
      type: 'Feature',
      properties: { ...feature.properties, role: 'marker' },
      geometry: {
        type: 'Point',
        coordinates: [
          ring.reduce((sum, [lon]) => sum + lon, 0) / ring.length,
          ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length,
        ],
      },
    };
    return [{ ...feature, properties: { ...feature.properties, role: 'area' } }, marker];
  });
}

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

// ── CCTV cameras ──────────────────────────────────────────────────────────
// Labels read Z<zone>-C<camera>, so the zone is worth keeping as its own field.
//
// None of these is a surveyed camera position, and the layer must not be able to
// claim otherwise. 2,200 of the 4,079 were placed by a generator that scattered
// points at random inside the ghat and core-city polygons — 400 named G-###,
// 1,200 named C-#### and 600 named M-### around the core perimeter — and that
// same generator deleted the legacy camera placemarks it found. The remaining
// Z<n>-C<m> and RRC points came from the KML, and nothing here establishes them
// as surveyed either, so the whole layer is marked indicative rather than
// splitting a distinction the source does not support.
//
// `placement` keeps the one thing that IS per-point: whether the generator made
// it up or the KML supplied it. The name prefix is what tells them apart.
const GENERATED_NAME = /^[GCM]-\d+$/;
const cameras = named.filter(isCamera).map((entry) => {
  const zone = entry.name.match(/^Z(\d+)-C/)?.[1];
  return toFeature(entry, {
    ...(zone ? { zone: `Zone ${zone}` } : {}),
    locationConfidence: 'indicative',
    placement: GENERATED_NAME.test(entry.name)
      ? 'generated at random in a planning polygon'
      : 'from the NTKMA master KML',
  });
}).filter(Boolean);

// ── Congestion points ─────────────────────────────────────────────────────
// Whatever polygon is left once ghats and parking duplicates are removed:
// transit hubs, chowks, markets and the two Gandhi Talav water bodies.
const congestion = named
  .filter((e) => e.pm.Polygon && !isGhat(e) && !isZoneArea(e))
  .map((entry) => toFeature(entry, { category: /talav/i.test(entry.name) ? 'landmark' : 'congestion' }))
  .filter(Boolean);

// ── Ring road ─────────────────────────────────────────────────────────────
// Replaces a 6.5 MB Civil 3D export (AECC_ALIGNMENT entities, station-label
// groups, design-speed labels) that contained no feature named "ring road".
const ringRoad = named.filter(isRingRoad).map((entry) => toFeature(entry, { category: 'ring-road' })).filter(Boolean);

fs.mkdirSync(outDir, { recursive: true });
write('cctv-cameras.geojson', cameras, 4079);
write('congestion-points.geojson', withMarkers(congestion), 16); // 8 areas + 8 markers
write('ring-road.geojson', ringRoad, 8);

const dropped = named.filter(isZoneArea).length;
console.log(`\nskipped ${dropped} "Zone Area" polygons — duplicates of parking-zones.geojson (verified 32/32 within ~50 m)`);

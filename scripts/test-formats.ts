// node --experimental-strip-types scripts/test-formats.ts
// One check per export format, on a collection shaped like the real data:
// a named point, a polygon, a line, a comma in a value, Devanagari, and a
// feature with no name at all.
import assert from 'node:assert/strict';
import type { FeatureCollection } from 'geojson';
import { FORMATS } from '../src/formats.ts';

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Ram Kund', address: 'Panchavati, Nashik', locationConfidence: 'verified' },
      geometry: { type: 'Point', coordinates: [73.7935, 20.0055] },
    },
    {
      type: 'Feature',
      properties: { name: 'सीता कुंड', category: 'ghat' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[73.792, 20.008], [73.793, 20.008], [73.793, 20.009], [73.792, 20.008]]],
      },
    },
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[73.78, 19.99], [73.79, 20.0]] },
    },
  ],
};

const meta = { label: 'Ghats', color: '#b45309' };
const out = new Map(FORMATS.map((f) => [f.ext, f.convert(fc, meta)]));
const get = (ext: string): string => {
  const text = out.get(ext);
  assert.ok(text, `no output for .${ext}`);
  return text;
};

// GeoJSON round-trips unchanged.
assert.deepEqual(JSON.parse(get('geojson')), fc);

// GeoJSON Lines: one parseable feature per line, no trailing blank.
const lines = get('geojsonl').trimEnd().split('\n');
assert.equal(lines.length, 3);
assert.equal(JSON.parse(lines[0]!).properties.name, 'Ram Kund');

// CSV: BOM, union of keys, quoted comma, empty lon/lat for shapes, wkt column.
const csv = get('csv');
assert.ok(csv.startsWith('﻿'), 'CSV needs a BOM for Excel');
const rows = csv.slice(1).trimEnd().split('\r\n');
assert.equal(rows[0], 'name,address,locationConfidence,category,longitude,latitude,wkt');
assert.ok(rows[1]!.includes('"Panchavati, Nashik"'), 'comma must be quoted');
assert.ok(rows[1]!.includes('73.7935,20.0055'), 'point keeps its coordinates');
assert.ok(rows[2]!.includes('सीता कुंड'), 'Devanagari survives');
// The WKT holds commas, so it arrives quoted.
assert.ok(rows[2]!.includes(',,"POLYGON ((73.792 20.008,'), 'shape: blank lon/lat, wkt filled');
assert.equal(rows.length, 4);

// KML: one Placemark per feature, layer colour as aabbggrr, escaped description.
const kml = get('kml');
assert.equal(kml.match(/<Placemark>/g)?.length, 3);
assert.ok(kml.includes('<color>ff0953b4</color>'), '#b45309 becomes ff0953b4');
assert.ok(kml.includes('<name>Ram Kund</name>'));
assert.ok(kml.includes('<outerBoundaryIs><LinearRing><coordinates>73.792,20.008 '));
assert.ok(kml.includes('<name>Ghats</name>'), 'unnamed feature falls back to the layer label');

// GPX: points become waypoints, shapes become tracks, lat before lon.
const gpx = get('gpx');
assert.ok(gpx.includes('<wpt lat="20.0055" lon="73.7935">'));
assert.equal(gpx.match(/<trk>/g)?.length, 2, 'polygon and line both become tracks');
assert.ok(gpx.includes('<trkpt lat="20.008" lon="73.792"/>'));

// XML escaping, on the one input that would otherwise break the file.
const risky: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'A & B <"shop">' },
      geometry: { type: 'Point', coordinates: [73.7, 20] },
    },
  ],
};
for (const ext of ['kml', 'gpx']) {
  const text = FORMATS.find((f) => f.ext === ext)!.convert(risky, meta);
  assert.ok(text.includes('A &amp; B &lt;&quot;shop&quot;&gt;'), `${ext} must escape XML`);
  assert.ok(!text.includes('<"shop">'), `${ext} leaked a raw angle bracket`);
}

console.log(`ok — ${FORMATS.length} formats: ${FORMATS.map((f) => f.ext).join(', ')}`);

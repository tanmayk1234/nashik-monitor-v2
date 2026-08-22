// Usage: node scripts/apply-verified-coordinates.mjs [dataDir]
//
// Replaces locality-inferred coordinates with externally verified ones, one
// feature at a time, with the evidence recorded next to each entry.
//
// Why this exists: 581 of 7740 features carry no real coordinate. The 12
// "kumbhdoot" source sheets had names and addresses only, so every point in
// them was placed by matching address text to a locality centroid, plus jitter
// ("locality-match"), or to the city centre when even that failed
// ("approximate"). Those are neighbourhood-level guesses. This script is where a
// point graduates to a real position once two independent sources agree.
//
// Re-runnable and idempotent: it matches on name, asserts the feature is there,
// and rewrites the coordinate whether or not it was already corrected.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const dataDir = process.argv[2] ?? 'public/data';

const OVERRIDES = [
  {
    file: 'malls.geojson',
    name: 'Nashik City Centre Mall',
    lon: 73.76197,
    lat: 19.99055,
    source: 'OpenStreetMap way/1466134492 (shop=mall, landuse=retail, 316x119 m footprint) — centroid; corroborated by Photon geocoder at 19.99056, 73.76143 (57 m away, inside the same footprint)',
    note: 'Was 19.99660, 73.76058 from a Parijat Nagar locality match — 688 m north of the real mall. Our address string reads "Untwadi Rd, Parijat Nagar"; OSM places the footprint off Ambad Link Road (M17), with an "Untawadi Store" 145 m away, so the Untwadi name does reach this spot.',
  },
  {
    file: 'malls.geojson',
    name: 'Pinnacle Mall',
    lon: 73.78101,
    lat: 19.99660,
    source: 'OpenStreetMap (shop=mall) — corroborated by Nominatim, which returned the same point',
    note: 'Was 19.99725, 73.77919 from a Trimbak Naka locality match — 202 m off.',
  },
];

let applied = 0;
for (const [file, group] of Object.entries(Object.groupBy(OVERRIDES, (o) => o.file))) {
  const filePath = path.join(dataDir, file);
  const collection = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const override of group) {
    const feature = collection.features.find((f) => (f.properties?.Name ?? f.properties?.name) === override.name);
    assert.ok(feature, `${file}: no feature named "${override.name}" — did the dataset get rebuilt?`);
    assert.strictEqual(feature.geometry.type, 'Point', `${file}: "${override.name}" is not a Point`);

    feature.geometry.coordinates = [override.lon, override.lat];
    feature.properties.locationConfidence = 'verified';
    feature.properties.locationSource = override.source;
    applied++;
    console.log(`${file}: ${override.name} -> ${override.lat}, ${override.lon}`);
  }

  fs.writeFileSync(filePath, `${JSON.stringify(collection)}\n`);
}

assert.strictEqual(applied, OVERRIDES.length, 'not every override was applied');
console.log(`\n${applied} coordinate(s) verified. Everything still marked locality-match or approximate is a guess.`);

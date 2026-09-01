// node --experimental-strip-types scripts/test-confidence.ts
// Every confidence value the shipped data carries must be one the popup knows
// how to say out loud. This exists because it once wasn't: hospitals.geojson
// came in with its own HIGH/MEDIUM/LOW vocabulary, the caveat table only knew
// locality-match and approximate, and 174 low-confidence hospitals rendered
// with no badge at all — indistinguishable from a surveyed position.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { CAVEAT, VERIFIED } from '../src/confidence.ts';

const DATA = join(import.meta.dirname, '..', 'public', 'data');
const FIELDS = ['locationConfidence', 'geocodeConfidence'] as const;

const seen = new Map<string, number>();
let features = 0;

for (const file of readdirSync(DATA)) {
  if (!file.endsWith('.geojson')) continue;
  const fc = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as FeatureCollection;
  for (const feature of fc.features) {
    features++;
    for (const field of FIELDS) {
      const value = feature.properties?.[field];
      if (typeof value !== 'string' || value === '') continue;
      seen.set(value, (seen.get(value) ?? 0) + 1);
      assert.ok(
        value === VERIFIED || CAVEAT[value],
        `${file}: ${field} "${value}" has no entry in CAVEAT, so the popup would show nothing for it`,
      );
    }
  }
}

assert.ok(features > 0, 'no features found — is public/data populated?');

// Every caveat the code defines should be reachable from the data. An entry
// nobody hits is either a typo or a vocabulary that has since been rebuilt.
for (const key of Object.keys(CAVEAT)) {
  assert.ok(seen.has(key), `CAVEAT has "${key}" but no feature carries it`);
}

const graded = [...seen].filter(([k]) => k !== VERIFIED).reduce((n, [, c]) => n + c, 0);
console.log(
  `ok — ${features.toLocaleString('en-IN')} features, ${graded.toLocaleString('en-IN')} carrying a confidence grade, all ${seen.size} values covered`,
);

// Drives the real page: opens the Ghats download menu, clicks every format and
// asserts a file arrives. Also downloads a layer that was never switched on, to
// prove the menu fetches on demand.
// Usage: node scripts/check-download-ui.mjs [url]
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { launch } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(url, { waitUntil: 'domcontentloaded' });
// The splash intercepts clicks; skip it if it is still up, then wait it out.
const splash = page.locator('#splash');
if (await splash.count()) await splash.click().catch(() => {});
await splash.waitFor({ state: 'detached' });
await page.waitForSelector('.layer');

const row = page.locator('.layer', { hasText: 'Ghats' }).first();
await row.locator('.dl').click();
await page.waitForSelector('#download-menu:popover-open');

const formats = await page.locator('.dl-format strong').allTextContents();
assert.deepEqual(formats, ['GeoJSON', 'CSV', 'KML', 'GPX', 'GeoJSON Lines']);

async function pick(layer, format) {
  const dl = page.locator('.layer', { hasText: layer }).first().locator('.dl');
  if ((await page.locator('#download-menu:popover-open').count()) === 0) await dl.click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.dl-format', { hasText: format }).first().click(),
  ]);
  return download;
}

for (const format of formats) {
  const download = await pick('Ghats', format);
  const { size } = await stat(await download.path());
  assert.ok(size > 200, `${format}: ${size} bytes`);
  console.log(`${download.suggestedFilename()} — ${size.toLocaleString()} bytes`);
}

const csv = await pick('Malls', 'CSV');
assert.equal(csv.suggestedFilename(), 'nashik-malls.csv');
const text = await readFile(await csv.path(), 'utf8');
assert.ok(text.includes('locationConfidence'), 'the confidence column has to travel with the data');
console.log(`nashik-malls.csv — locationConfidence present, ${text.split('\r\n').length - 2} rows`);

assert.deepEqual(errors, []);
console.log('ok — download UI');
await browser.close();

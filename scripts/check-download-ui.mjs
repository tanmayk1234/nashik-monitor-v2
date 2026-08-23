// Drives the real page: opens the Ghats download menu, clicks every format,
// and asserts a file actually arrives. Run against `npm run dev`.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: 'C:/Users/Batman/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
// The splash intercepts clicks; skip it if it is still up, then wait it out.
const splash = page.locator('#splash');
if (await splash.count()) await splash.click().catch(() => {});
await splash.waitFor({ state: 'detached' });
await page.waitForSelector('.layer');

const row = page.locator('.layer', { hasText: 'Ghats' }).first();
await row.locator('.dl').click();
await page.waitForSelector('#download-menu:popover-open');
await page.screenshot({ path: 'scripts/out-download-menu.png' });

const formats = await page.locator('.dl-format strong').allTextContents();
assert.deepEqual(formats, ['GeoJSON', 'CSV', 'KML', 'GPX', 'GeoJSON Lines']);

for (const label of formats) {
  if (await page.locator('#download-menu:popover-open').count() === 0) await row.locator('.dl').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.dl-format', { hasText: label }).first().click(),
  ]);
  const path = await download.path();
  const { size } = await (await import('node:fs/promises')).stat(path);
  assert.ok(size > 200, `${label}: ${size} bytes`);
  console.log(`${download.suggestedFilename()} — ${size.toLocaleString()} bytes`);
}

// A layer never toggled on must still download: the menu fetches it on demand.
await page.locator('.layer', { hasText: 'Malls' }).first().locator('.dl').click();
const [csv] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.dl-format', { hasText: 'CSV' }).first().click(),
]);
assert.equal(csv.suggestedFilename(), 'nashik-malls.csv');
const text = await (await import('node:fs/promises')).readFile(await csv.path(), 'utf8');
assert.ok(text.includes('locationConfidence'), 'the confidence column has to travel with the data');
console.log(`nashik-malls.csv — locationConfidence present, ${text.split('\r\n').length - 2} rows`);

assert.deepEqual(errors, []);
console.log('ok — download UI');
await browser.close();

// Guards the splash against the regression it was written for: style.css used to
// arrive as a JS import behind maplibre-gl's module graph, so the intro started
// ~450 ms late and then fought the map for the main thread. Moving the stylesheet
// back into main.ts, or making boot.ts import the map eagerly, fails the
// assertion at the bottom.
// Usage: node scripts/check-splash-timing.mjs [url] [tag]
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const tag = process.argv[3] ?? 'dev';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });

// Recorded from inside the page, before any of the app's own scripts run.
await page.addInitScript(() => {
  window.__marks = { paints: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__marks.paints.push([e.name, Math.round(e.startTime)]);
  }).observe({ type: 'paint', buffered: true });
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const out = await page.evaluate(() => ({
  paints: window.__marks.paints,
  animations: document
    .getAnimations()
    .map((a) => `${a.animationName}@${Math.round(Number(a.startTime ?? -1))}`)
    .slice(0, 8),
  dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
  // /src/main.ts in dev, /assets/main-*.js in the build — either way, the
  // splash has to be moving before this finishes arriving.
  mapModule: Math.round(
    performance
      .getEntriesByType('resource')
      .filter((r) => /\/(src\/)?main[-.]/.test(r.name))
      .reduce((max, r) => Math.max(max, r.responseEnd), 0),
  ),
  logoStart: Math.round(
    Number(document.getAnimations().find((a) => a.effect?.target?.classList.contains('splash-logo'))?.startTime ?? -1),
  ),
}));
console.log(tag, JSON.stringify(out));

// Seven elements animate: logo, rule, kicker, title, sub, credit, skip.
assert.equal(out.animations.length, 7, 'every splash element should be animating');
assert.ok(out.logoStart >= 0, 'the splash never started animating');
// The point of the fix, and independent of how fast the machine is: the intro
// is already playing while the 1 MB map chunk is still in flight.
assert.ok(out.mapModule > 0, 'no map module in resource timing — check the name filter');
assert.ok(
  out.logoStart < out.mapModule,
  `splash started at ${out.logoStart}ms but the map module landed at ${out.mapModule}ms`,
);
console.log('ok — splash paints and animates before the map loads');

await browser.close();

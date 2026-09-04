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
  window.__marks = { paints: [], splashAnimations: [], animEnd: -1, removed: -1, logoStart: -1, seen: false };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__marks.paints.push([e.name, Math.round(e.startTime)]);
  }).observe({ type: 'paint', buffered: true });

  // Watch the splash from document-start. Polled rather than observed: there is
  // no documentElement to attach a MutationObserver to this early, and calling
  // observe(null) throws and takes the rest of this script with it.
  const look = () => {
    const splash = document.getElementById('splash');
    if (splash) {
      const running = splash.getAnimations({ subtree: true });
      if (running.length && !window.__marks.seen) {
        window.__marks.seen = true;
        window.__marks.splashAnimations = running.map(
          (a) => `${a.animationName}@${Math.round(Number(a.startTime ?? -1))}`,
        );
        Promise.allSettled(running.map((a) => a.finished)).then(() => {
          window.__marks.animEnd = Math.round(performance.now());
        });
      }
      // startTime is null on the frame the animation is created and only gets a
      // value once the timeline picks it up, so this is read on later passes
      // rather than at first sight.
      if (window.__marks.logoStart < 0) {
        const logo = splash
          .getAnimations({ subtree: true })
          .find((a) => a.effect?.target?.classList?.contains('splash-logo'));
        if (logo && logo.startTime !== null) window.__marks.logoStart = Math.round(Number(logo.startTime));
      }
    } else if (window.__marks.seen && window.__marks.removed < 0) {
      window.__marks.removed = Math.round(performance.now());
      return;
    }
    setTimeout(look, 16);
  };
  setTimeout(look, 16);
});

await page.goto(url, { waitUntil: 'load' });
// Long enough for the intro to finish and the splash to leave on its own.
await page.waitForTimeout(9000);

const out = await page.evaluate(() => ({
  paints: window.__marks.paints,
  // Scoped to the splash's own subtree, not document.getAnimations(): maplibre
  // adds transitions of its own once the map mounts, and counting those made
  // this assertion fail on any machine where the map got going early enough.
  animations: window.__marks.splashAnimations,
  // Does the splash outlive its own intro? That is the property the dismissal
  // rewrite bought — it used to leave on a fixed timer that had drifted to
  // within 17 ms of cutting the last element off.
  removedAfterIntro: window.__marks.removed > 0 && window.__marks.removed >= window.__marks.animEnd,
  animEnd: window.__marks.animEnd,
  removed: window.__marks.removed,
  dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
  // /src/main.ts in dev, /assets/main-*.js in the build — either way, the
  // splash has to be moving before this finishes arriving.
  mapModule: Math.round(
    performance
      .getEntriesByType('resource')
      .filter((r) => /\/(src\/)?main[-.]/.test(r.name))
      .reduce((max, r) => Math.max(max, r.responseEnd), 0),
  ),
  logoStart: window.__marks.logoStart,
}));
console.log(tag, JSON.stringify(out));

// Seven elements animate: logo, rule, kicker, title, sub, credit, skip.
assert.equal(out.animations.length, 7, 'every splash element should be animating');
assert.ok(out.logoStart >= 0, 'the splash never started animating');
// The intro must never be cut off, however slow the load: the splash leaves
// when its animations have actually finished, not on a stopwatch.
assert.ok(out.animEnd > 0, 'the splash animations never finished');
assert.ok(out.removed > 0, 'the splash never left — it must not strand the map behind it');
assert.ok(
  out.removedAfterIntro,
  `splash was removed at ${out.removed}ms but its intro only finished at ${out.animEnd}ms`,
);
// The point of the fix, and independent of how fast the machine is: the intro
// is already playing while the 1 MB map chunk is still in flight.
assert.ok(out.mapModule > 0, 'no map module in resource timing — check the name filter');
assert.ok(
  out.logoStart < out.mapModule,
  `splash started at ${out.logoStart}ms but the map module landed at ${out.mapModule}ms`,
);
console.log('ok — splash paints before the map loads, and plays out in full before it leaves');

await browser.close();

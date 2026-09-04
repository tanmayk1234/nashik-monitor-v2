// Brand intro. Sequencing lives in CSS (animation-delay per element); this only
// decides when to leave and lets the viewer cut it short. It plays on every
// load; gating it on sessionStorage would be one `if` here and no other change.
//
// Leaving is tied to the animations THEMSELVES finishing, not to a stopwatch.
// It used to be a flat setTimeout(3900), which drifted both ways because the
// timer and the animations are started by different things and both get starved
// by the map building on the same thread. Measured over repeated reloads: on a
// fast load the splash was removed 17 ms after the last animation ended — one
// frame of jank from cutting the intro off — and with the CPU throttled 4x the
// intro finished at 4.9 s and the splash then sat there until 10.7 s, nearly six
// seconds of nothing. Waiting on the real animations fixes both ends at once:
// it cannot cut them short, and it leaves as soon as they are done.
const FADE_MS = 700;

// Beat after the last element lands, so the finished composition is readable
// rather than snatched away on the same frame.
const HOLD_AFTER_MS = 400;

// Only for a browser with no Web Animations API, where there is nothing to wait
// on. Roughly the old fixed hold.
const FALLBACK_MS = 3900;

// Absolute backstop. Nothing should reach it — a throttled load finishes around
// 5 s and clicking skips at any time — but a splash that never leaves means a
// map nobody can use, so there is always a way out.
const BACKSTOP_MS = 12000;

// Resolves when the intro has actually finished playing.
function introFinished(splash: HTMLElement): Promise<unknown> {
  if (typeof splash.getAnimations !== 'function') {
    return new Promise((resolve) => window.setTimeout(resolve, FALLBACK_MS));
  }
  return new Promise((resolve) => {
    // The animations do not exist until styles first resolve, which is after
    // this runs, so look again for a few frames before giving up on them.
    let frames = 0;
    const look = (): void => {
      const running = splash.getAnimations({ subtree: true });
      if (running.length) {
        // allSettled, not all: an animation cancelled mid-flight rejects, and a
        // cancelled intro should still let the map through.
        void Promise.allSettled(running.map((a) => a.finished)).then(resolve);
        return;
      }
      if (++frames > 30) {
        window.setTimeout(resolve, FALLBACK_MS);
        return;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}

export function runSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;

  const dismiss = (): void => {
    if (done) return;
    done = true;
    splash.classList.add('is-leaving');
    window.setTimeout(() => splash.remove(), FADE_MS);
  };

  if (reducedMotion) {
    // No motion means no reason to sit through it — show it briefly, then go.
    splash.classList.add('no-motion');
    window.setTimeout(dismiss, 1200);
    return;
  }

  splash.addEventListener('click', dismiss);
  window.addEventListener('keydown', dismiss, { once: true });

  void introFinished(splash).then(() => window.setTimeout(dismiss, HOLD_AFTER_MS));
  window.setTimeout(dismiss, BACKSTOP_MS);
}

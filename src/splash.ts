// Brand intro. Sequencing lives in CSS (animation-delay per element); this only
// decides when to leave and lets the user cut it short.
//
// ponytail: plays on every load, as asked. If it starts feeling long on repeat
// visits, gate it on sessionStorage — one `if` here, no other change.
const HOLD_MS = 3900;
const FADE_MS = 700;

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

  window.setTimeout(dismiss, HOLD_MS);
  splash.addEventListener('click', dismiss);
  window.addEventListener('keydown', dismiss, { once: true });
}

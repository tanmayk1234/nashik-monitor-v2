import type { FeatureCollection } from 'geojson';
import { FORMATS, type Format } from './formats';

// Anything downloadable: one layer, or every layer merged. id becomes the
// filename, label and color are what the KML and GPX writers stamp on the file.
export type Target = { id: string; label: string; color: string };
type Loader = () => Promise<FeatureCollection | null>;

// One menu shared by all 31 rows and the whole-map button rather than one each:
// the button that opened it sets `pending`, and that decides what gets written.
let pending: { target: Target; load: Loader } | null = null;

const title = document.createElement('p');
title.className = 'dl-title';

function save(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Firefox cancels the download if the blob URL dies too early.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function run(fmt: Format): Promise<void> {
  if (!pending) return;
  const { target, load } = pending;
  // Merging all 31 datasets means fetching whatever is not cached yet, so this
  // can sit for a second or two on a cold load. Say so rather than look stuck.
  title.textContent = `${target.label} — preparing ${fmt.label}…`;
  const geojson = await load();
  if (!geojson) {
    title.textContent = `${target.label} — download failed`;
    return;
  }
  save(fmt.convert(geojson, target), `nashik-${target.id}.${fmt.ext}`, fmt.mime);
  menu.hidePopover();
}

function buildMenu(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'download-menu';
  el.popover = 'auto'; // native light-dismiss and Esc, no outside-click handler
  el.append(title);

  for (const fmt of FORMATS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dl-format';
    const label = document.createElement('strong');
    label.textContent = fmt.label;
    const hint = document.createElement('span');
    hint.textContent = fmt.hint;
    button.append(label, hint);
    button.addEventListener('click', () => void run(fmt));
    el.append(button);
  }

  // Exports carry every property, both confidence fields included, so an
  // approximate point stays labelled approximate outside this map too. Two
  // fields because the hospitals import brought its own vocabulary; quoting
  // only locationConfidence here left all 495 hospitals out of the count.
  const note = document.createElement('p');
  note.className = 'dl-note';
  note.textContent =
    'Includes the locationConfidence and geocodeConfidence fields — 579 features are neighbourhood-level guesses, and a further 495 hospitals carry a graded position that was never surveyed.';
  el.append(note);

  document.body.append(el);
  return el;
}

const menu = buildMenu();

// Places the menu next to whichever button opened it. CSS anchor positioning is
// Chrome-only, so it is positioned by hand, clamped to stay on screen.
function arm(button: HTMLButtonElement, target: Target, load: Loader): void {
  pending = { target, load };
  title.textContent = target.label;
  const r = button.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(r.right + 8, window.innerWidth - 250))}px`;
  menu.style.top = `${Math.max(8, Math.min(r.top - 8, window.innerHeight - 290))}px`;
}

export function downloadButton(target: Target, load: Loader): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl';
  button.textContent = '↓';
  button.title = `Download ${target.label}`;
  button.setAttribute('aria-label', `Download ${target.label}`);
  button.setAttribute('popovertarget', menu.id);
  button.addEventListener('click', (e) => {
    e.stopPropagation(); // the row is a <label>; a download must not toggle it
    arm(button, target, load);
  });
  return button;
}

// The same menu, but a labelled full-width button for the whole map. Sits at the
// end of the layer list, where someone who has scrolled the whole panel and
// wants the lot ends up.
export function downloadAllButton(target: Target, load: Loader, count: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl-all';
  button.textContent = `↓  Download all ${count} datasets`;
  button.title = 'Every layer merged into one file';
  button.setAttribute('popovertarget', menu.id);
  button.addEventListener('click', () => arm(button, target, load));
  return button;
}

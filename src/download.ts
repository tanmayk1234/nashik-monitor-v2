import type { FeatureCollection } from 'geojson';
import { FORMATS, type Format } from './formats';
import type { LayerDef } from './layers';

type Loader = (def: LayerDef) => Promise<FeatureCollection | null>;

// One menu shared by all 25 rows rather than one per row: the button that opened
// it sets `pending`, and that decides what gets written.
let pending: { def: LayerDef; load: Loader } | null = null;

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
  const { def, load } = pending;
  title.textContent = `${def.label} — preparing ${fmt.label}…`;
  const geojson = await load(def);
  if (!geojson) {
    title.textContent = `${def.label} — download failed`;
    return;
  }
  save(fmt.convert(geojson, def), `nashik-${def.id}.${fmt.ext}`, fmt.mime);
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

  // Exports carry every property, locationConfidence included, so an
  // approximate point stays labelled approximate outside this map too.
  const note = document.createElement('p');
  note.className = 'dl-note';
  note.textContent =
    'Includes the locationConfidence field — 581 of 7,806 features are neighbourhood-level guesses, not surveyed positions.';
  el.append(note);

  document.body.append(el);
  return el;
}

const menu = buildMenu();

export function downloadButton(def: LayerDef, load: Loader): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl';
  button.textContent = '↓';
  button.title = `Download ${def.label}`;
  button.setAttribute('aria-label', `Download ${def.label}`);
  button.setAttribute('popovertarget', menu.id);
  button.addEventListener('click', (e) => {
    e.stopPropagation(); // the row is a <label>; a download must not toggle it
    pending = { def, load };
    title.textContent = def.label;
    // CSS anchor positioning is Chrome-only, so place it by hand, on screen.
    const r = button.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(r.right + 8, window.innerWidth - 250))}px`;
    menu.style.top = `${Math.max(8, Math.min(r.top - 8, window.innerHeight - 290))}px`;
  });
  return button;
}

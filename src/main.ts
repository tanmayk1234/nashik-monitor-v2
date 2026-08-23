import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import type { FeatureCollection } from 'geojson';
import maplibregl, { type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// style.css is a <link> in index.html, not an import here: it has to be in
// effect at first paint, and a module import lands well after it.
import { GROUPS, LAYERS, type LayerDef } from './layers';
import { FORMATS, NAME_KEYS, featureName, type Format } from './formats';
import { applyTheme, currentTheme, haloColor, styleUrl } from './theme';

const NASHIK_CENTER: [number, number] = [73.7898, 19.9975];

const map = new maplibregl.Map({
  container: 'map',
  style: styleUrl(),
  center: NASHIK_CENTER,
  zoom: 11,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' });

// Fetched GeoJSON, kept so a theme switch can rebuild every layer without
// re-downloading: setStyle() drops all custom sources with the old style.
const data = new Map<string, FeatureCollection>();
const shown = new Set<string>();
// The feature-count element of each sidebar row, so both a toggle and a
// download can report progress on the row they came from.
const counts = new Map<string, HTMLElement>();

// Every file may hold points, lines and polygons at once (cctv-cameras and
// ring-road both do), so each source gets one sublayer per geometry type and
// the empty ones simply draw nothing.
function sublayerIds(id: string): string[] {
  return [`${id}-fill`, `${id}-line`, `${id}-point`];
}

function addSublayers(def: LayerDef): void {
  const visibility = shown.has(def.id) ? 'visible' : 'none';
  map.addLayer({
    id: `${def.id}-fill`,
    type: 'fill',
    source: def.id,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { visibility },
    paint: { 'fill-color': def.color, 'fill-opacity': 0.18 },
  });
  map.addLayer({
    id: `${def.id}-line`,
    type: 'line',
    source: def.id,
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': def.color, 'line-width': 2, 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: `${def.id}-point`,
    type: 'circle',
    source: def.id,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { visibility },
    paint: {
      'circle-color': def.color,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 8],
      'circle-stroke-color': haloColor(),
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    },
  });
}

function mount(def: LayerDef): void {
  const geojson = data.get(def.id);
  if (!geojson || map.getSource(def.id)) return;
  map.addSource(def.id, { type: 'geojson', data: geojson });
  addSublayers(def);
}

// ponytail: fetched on first toggle or first download, never re-fetched.
// ring-road.geojson is 6.5 MB of 12k LineStrings — fine on demand, would be
// indefensible eagerly. Move that one file to vector tiles if it ever needs to
// be on by default.
async function loadData(def: LayerDef): Promise<FeatureCollection | null> {
  const cached = data.get(def.id);
  if (cached) return cached;
  const countEl = counts.get(def.id);
  if (countEl) countEl.textContent = '···';
  try {
    const geojson = await fetch(`data/${def.file}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<FeatureCollection>;
    });
    data.set(def.id, geojson);
    if (countEl) countEl.textContent = geojson.features.length.toLocaleString('en-IN');
    return geojson;
  } catch (err) {
    if (countEl) countEl.textContent = 'failed';
    console.error(`[${def.id}] load failed`, err);
    return null;
  }
}

async function showLayer(def: LayerDef): Promise<void> {
  shown.add(def.id);
  if (!(await loadData(def))) {
    shown.delete(def.id);
    return;
  }
  if (!shown.has(def.id)) return; // toggled back off while the fetch was in flight
  mount(def);
  for (const id of sublayerIds(def.id)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
  }
}

function hideLayer(def: LayerDef): void {
  shown.delete(def.id);
  for (const id of sublayerIds(def.id)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
}

// ── Downloads ─────────────────────────────────────────────────────────────
// One menu shared by all 25 rows rather than one per row: the button that
// opened it sets `pending`, and that decides what gets written.

let pending: LayerDef | null = null;
const dlTitle = document.createElement('p');
dlTitle.className = 'dl-title';

function save(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Firefox cancels the download if the blob URL dies too early.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function download(fmt: Format): Promise<void> {
  const def = pending;
  if (!def) return;
  dlTitle.textContent = `${def.label} — preparing ${fmt.label}…`;
  const geojson = await loadData(def);
  if (!geojson) {
    dlTitle.textContent = `${def.label} — download failed`;
    return;
  }
  save(fmt.convert(geojson, def), `nashik-${def.id}.${fmt.ext}`, fmt.mime);
  dlMenu.hidePopover();
}

function buildDownloadMenu(): HTMLElement {
  const menu = document.createElement('div');
  menu.id = 'download-menu';
  menu.popover = 'auto'; // native light-dismiss and Esc, no outside-click handler
  menu.append(dlTitle);

  for (const fmt of FORMATS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dl-format';
    const label = document.createElement('strong');
    label.textContent = fmt.label;
    const hint = document.createElement('span');
    hint.textContent = fmt.hint;
    button.append(label, hint);
    button.addEventListener('click', () => void download(fmt));
    menu.append(button);
  }

  // Exports carry every property, locationConfidence included, so an
  // approximate point stays labelled approximate outside this map too.
  const note = document.createElement('p');
  note.className = 'dl-note';
  note.textContent = 'Includes the locationConfidence field — 581 of 7,806 features are neighbourhood-level guesses, not surveyed positions.';
  menu.append(note);

  document.body.append(menu);
  return menu;
}

const dlMenu = buildDownloadMenu();

function downloadButton(def: LayerDef): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dl';
  button.textContent = '↓';
  button.title = `Download ${def.label}`;
  button.setAttribute('aria-label', `Download ${def.label}`);
  button.setAttribute('popovertarget', dlMenu.id);
  button.addEventListener('click', (e) => {
    e.stopPropagation(); // the row is a <label>; a download must not toggle it
    pending = def;
    dlTitle.textContent = def.label;
    // Anchor positioning is Chrome-only, so place it by hand and keep it on screen.
    const r = button.getBoundingClientRect();
    dlMenu.style.left = `${Math.max(8, Math.min(r.right + 8, window.innerWidth - 250))}px`;
    dlMenu.style.top = `${Math.max(8, Math.min(r.top - 8, window.innerHeight - 290))}px`;
  });
  return button;
}

function buildSidebar(): void {
  const root = document.getElementById('layers')!;
  for (const group of GROUPS) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = group;
    section.append(heading);

    for (const def of LAYERS.filter((l) => l.group === group)) {
      const row = document.createElement('label');
      row.className = 'layer';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!def.on;

      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = def.color;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = def.label;

      const count = document.createElement('span');
      count.className = 'count';
      counts.set(def.id, count);

      box.addEventListener('change', () => {
        if (box.checked) void showLayer(def);
        else hideLayer(def);
      });

      row.append(box, dot, name, count, downloadButton(def));
      section.append(row);
      if (def.on) void showLayer(def);
    }
    root.append(section);
  }
}

// Values come from scraped spreadsheets, so build the popup as DOM nodes rather
// than an HTML string — no escaping to get wrong.
function popupContent(feature: MapGeoJSONFeature, def: LayerDef): HTMLElement {
  const props = feature.properties ?? {};
  const wrapper = document.createElement('div');
  wrapper.className = 'popup';

  const title = document.createElement('h3');
  title.textContent = featureName(props) || def.label;
  wrapper.append(title);

  const layer = document.createElement('p');
  layer.className = 'popup-layer';
  const swatch = document.createElement('span');
  swatch.className = 'dot';
  swatch.style.background = def.color;
  layer.append(swatch, document.createTextNode(def.label));
  wrapper.append(layer);

  // 581 of 7740 features have no real coordinate: the 12 "kumbhdoot" source
  // sheets carried names and addresses only, so each point was placed by
  // matching address text to a locality centroid ("locality-match", 348) or to
  // the city centre when even that failed ("approximate", 233). Both are
  // neighbourhood-level guesses and both have to say so — a silent
  // locality-match is how City Centre Mall sat 688 m from the real building
  // while looking like solid data.
  const confidence = props.locationConfidence ?? props.geocodeConfidence;
  const CAVEAT: Record<string, string> = {
    'locality-match': 'Approximate — placed by locality name from its address, not a surveyed position.',
    approximate: 'Approximate — no locality match, placed near the city centre.',
  };
  if (typeof confidence === 'string' && CAVEAT[confidence]) {
    const warn = document.createElement('p');
    warn.className = 'popup-warn';
    warn.textContent = CAVEAT[confidence]!;
    wrapper.append(warn);
  } else if (confidence === 'verified') {
    const ok = document.createElement('p');
    ok.className = 'popup-verified';
    ok.textContent = 'Verified position';
    if (typeof props.locationSource === 'string') ok.title = props.locationSource;
    wrapper.append(ok);
  }

  // Already shown as the confidence badge above, or internal plumbing.
  const HIDDEN_KEYS = ['locationConfidence', 'geocodeConfidence', 'locationSource', 'role'];

  const table = document.createElement('dl');
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '') continue;
    if (NAME_KEYS.includes(key) || HIDDEN_KEYS.includes(key)) continue;
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    table.append(dt, dd);
  }
  if (table.childElementCount) wrapper.append(table);
  return wrapper;
}

function pickableLayers(): string[] {
  return LAYERS.flatMap((l) => sublayerIds(l.id)).filter((id) => map.getLayer(id));
}

map.on('click', (e) => {
  const hit = map.queryRenderedFeatures(e.point, { layers: pickableLayers() })[0];
  if (!hit) return;
  const def = LAYERS.find((l) => l.id === hit.source);
  if (!def) return;
  popup.setLngLat(e.lngLat).setDOMContent(popupContent(hit, def)).addTo(map);
});

map.on('mousemove', (e) => {
  const hits = map.queryRenderedFeatures(e.point, { layers: pickableLayers() });
  map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
});

function setupThemeToggle(): void {
  const button = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (!button) return;

  const paint = (): void => {
    const dark = currentTheme() === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  };
  paint();

  button.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    paint();
    popup.remove();
    // setStyle() replaces the whole style document, taking our sources with it.
    // Rebuild from the in-memory GeoJSON once the new basemap is ready.
    map.setStyle(styleUrl());
    map.once('style.load', () => {
      for (const def of LAYERS) if (data.has(def.id)) mount(def);
    });
  });
}

map.once('load', () => {
  buildSidebar();
  setupThemeToggle();
});

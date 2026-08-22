import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import type { FeatureCollection } from 'geojson';
import maplibregl, { type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { GROUPS, LAYERS, type LayerDef } from './layers';
import { applyTheme, currentTheme, haloColor, styleUrl } from './theme';
import { runSplash } from './splash';

const NASHIK_CENTER: [number, number] = [73.7898, 19.9975];
const NAME_KEYS = ['name', 'Name', 'Ghat Name'];

runSplash();

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

// ponytail: fetched on first toggle, never re-fetched. ring-road.geojson is
// 6.5 MB of 12k LineStrings — fine on demand, would be indefensible eagerly.
// Move that one file to vector tiles if it ever needs to be on by default.
async function showLayer(def: LayerDef, countEl: HTMLElement): Promise<void> {
  shown.add(def.id);
  if (!data.has(def.id)) {
    countEl.textContent = '···';
    try {
      const geojson = await fetch(`data/${def.file}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FeatureCollection>;
      });
      data.set(def.id, geojson);
      countEl.textContent = geojson.features.length.toLocaleString('en-IN');
    } catch (err) {
      shown.delete(def.id);
      countEl.textContent = 'failed';
      console.error(`[${def.id}] load failed`, err);
      return;
    }
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

      box.addEventListener('change', () => {
        if (box.checked) void showLayer(def, count);
        else hideLayer(def);
      });

      row.append(box, dot, name, count);
      section.append(row);
      if (def.on) void showLayer(def, count);
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
  title.textContent = NAME_KEYS.map((k) => props[k]).find((v) => v) ?? def.label;
  wrapper.append(title);

  const layer = document.createElement('p');
  layer.className = 'popup-layer';
  const swatch = document.createElement('span');
  swatch.className = 'dot';
  swatch.style.background = def.color;
  layer.append(swatch, document.createTextNode(def.label));
  wrapper.append(layer);

  // ~230 of 20,725 points were placed by matching address text to a locality
  // centroid, not by a real coordinate. Saying so is the whole difference
  // between a map and a guess.
  if (props.locationConfidence === 'approximate' || props.geocodeConfidence === 'approximate') {
    const warn = document.createElement('p');
    warn.className = 'popup-warn';
    warn.textContent = 'Approximate location — placed by locality, not a verified address.';
    wrapper.append(warn);
  }

  const table = document.createElement('dl');
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '') continue;
    if (NAME_KEYS.includes(key)) continue;
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

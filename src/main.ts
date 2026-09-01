import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import type { FeatureCollection } from 'geojson';
import maplibregl, { type DataDrivenPropertyValueSpecification, type MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CAVEAT, VERIFIED } from './confidence';
import { downloadAllButton, downloadButton } from './download';
import { NAME_KEYS, featureName } from './formats';
import { GROUPS, LAYERS, type LayerDef } from './layers';
import {
  BASEMAPS,
  applyBasemap,
  applyTerrain,
  applyTheme,
  currentBasemap,
  currentTheme,
  haloColor,
  hillshadeColors,
  skySpec,
  styleUrl,
  terrainOn,
} from './theme';

// style.css is a <link> in index.html rather than an import here: it has to be
// in effect at first paint, and a module import lands long after it.

const NASHIK_CENTER: [number, number] = [73.7898, 19.9975];

// Shown as the confidence badge above the table (see ./confidence), or
// internal plumbing.
// The last five are the source file's own paint values, read by addSublayers.
const HIDDEN_KEYS = new Set([
  'locationConfidence', 'geocodeConfidence', 'locationSource', 'role',
  'stroke', 'stroke-width', 'stroke-opacity', 'fill', 'fill-opacity',
]);

const map = new maplibregl.Map({
  container: 'map',
  style: styleUrl(),
  center: NASHIK_CENTER,
  zoom: 11,
  // Past 60 the horizon comes into frame, which is the whole point of terrain —
  // the Sahyadri skyline behind Trimbakeshwar only exists above that angle.
  maxPitch: 80,
  attributionControl: { compact: true },
});
// The compass is also the way back to north-up after tilting, so it arrives
// with terrain rather than being decoration on a flat map.
map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' });

// Cached GeoJSON. setStyle() drops custom sources along with the old style, so a
// theme switch rebuilds every layer from here instead of re-downloading.
const data = new Map<string, FeatureCollection>();
const shown = new Set<string>();
const counts = new Map<string, HTMLElement>();
const bySource = new Map(LAYERS.map((def) => [def.id, def]));

// Sublayer ids currently on the map. queryRenderedFeatures needs this on every
// mousemove, so it is cached on mount rather than rebuilt per event.
let pickable: string[] = [];

// Any file may hold points, lines and polygons at once (cctv-cameras and
// ring-road both do), so each source gets one sublayer per geometry type and
// the empty ones simply draw nothing.
// -label exists only on layers with labels: true; every consumer already
// filters on map.getLayer(), so listing it unconditionally is harmless.
const sublayerIds = (id: string): string[] => [`${id}-fill`, `${id}-line`, `${id}-point`, `${id}-label`];

// Features imported from a KML/KMZ carry the source file's own palette as
// simplestyle properties. Where one is present it wins, so the layer looks like
// the file does in Google Earth; where it is absent — every dataset that did not
// come from a styled KML — the layer colour is used exactly as before.
//
// `case`/`has` rather than the more obvious `coalesce`: on a feature without the
// property, `get` yields null, and coalesce hands that straight to a paint slot
// typed number, which MapLibre rejects with "Expected value to be of type
// number, but found null instead" and then drops the whole expression.
const styledNumber = (key: string, fallback: number): DataDrivenPropertyValueSpecification<never> =>
  ['case', ['has', key], ['to-number', ['get', key]], fallback] as never;
const styledColor = (key: string, fallback: string): DataDrivenPropertyValueSpecification<never> =>
  ['case', ['has', key], ['to-string', ['get', key]], fallback] as never;

function addSublayers(def: LayerDef): void {
  const visibility = shown.has(def.id) ? 'visible' : 'none';
  map.addLayer({
    id: `${def.id}-fill`,
    type: 'fill',
    source: def.id,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { visibility },
    paint: {
      'fill-color': styledColor('fill', def.color),
      'fill-opacity': styledNumber('fill-opacity', 0.18),
    },
  });
  map.addLayer({
    id: `${def.id}-line`,
    type: 'line',
    source: def.id,
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
    layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': styledColor('stroke', def.color),
      'line-width': styledNumber('stroke-width', 2),
      'line-opacity': styledNumber('stroke-opacity', 0.85),
    },
  });
  map.addLayer({
    id: `${def.id}-point`,
    type: 'symbol',
    source: def.id,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      visibility,
      'text-field': def.symbol,
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 18],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      // Lines and fills take the source file's palette, but text does not: the
      // KMZ is drawn over satellite imagery, where a #ffff00 route reads fine,
      // and the same yellow as label text over the pale basemap and its white
      // halo is invisible. Labels keep the layer colour, picked to hold up on
      // both themes.
      'text-color': def.color,
      'text-halo-color': haloColor(),
      'text-halo-width': 1.5,
    },
  });

  // Google Earth names every placemark. A second layer rather than a two-line
  // text-field on the one above, because these two want opposite placement
  // rules: the glyph must always draw, so it forces overlap, while 300 names at
  // once is a wall of text — so the names get MapLibre's default collision
  // handling and drop out when they will not fit, which is what Earth does too.
  if (!def.labels) return;
  map.addLayer({
    id: `${def.id}-label`,
    type: 'symbol',
    source: def.id,
    filter: ['==', ['geometry-type'], 'Point'],
    minzoom: 13,
    layout: {
      visibility,
      'text-field': ['case', ['has', 'name'], ['to-string', ['get', 'name']], ''],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'text-max-width': 12,
      'text-padding': 4,
    },
    paint: {
      'text-color': def.color,
      'text-halo-color': haloColor(),
      'text-halo-width': 1.5,
    },
  });
}

function mount(def: LayerDef): void {
  const geojson = data.get(def.id);
  if (!geojson || map.getSource(def.id)) return;
  map.addSource(def.id, { type: 'geojson', data: geojson });
  addSublayers(def);
  pickable = LAYERS.flatMap((l) => sublayerIds(l.id)).filter((id) => map.getLayer(id));
}

// Fetched on first toggle or first download, never re-fetched. ring-road.geojson
// is 6.5 MB of 12k LineStrings: fine on demand, wrong to load eagerly. Move that
// one file to vector tiles if it ever has to be on by default.
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

function setVisible(def: LayerDef, visible: boolean): void {
  for (const id of sublayerIds(def.id)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
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
  setVisible(def, true);
}

function hideLayer(def: LayerDef): void {
  shown.delete(def.id);
  setVisible(def, false);
}

function layerRow(def: LayerDef): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'layer';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!def.on;
  box.addEventListener('change', () => (box.checked ? void showLayer(def) : hideLayer(def)));

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = def.color;

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = def.label;

  const count = document.createElement('span');
  count.className = 'count';
  counts.set(def.id, count);

  row.append(box, dot, name, count, downloadButton(def, () => loadData(def)));
  return row;
}

// Every layer in one file. Each feature gains a `layer` property, or a merged
// export would be 8,057 features with no way to tell a hospital from a ghat.
// Goes through loadData, so anything already on the map is reused from cache and
// the sidebar counts fill in as the rest arrives.
async function loadEverything(): Promise<FeatureCollection | null> {
  const perLayer = await Promise.all(
    LAYERS.map(async (def) => {
      const geojson = await loadData(def);
      return (geojson?.features ?? []).map((f) => ({
        ...f,
        properties: { ...f.properties, layer: def.label },
      }));
    }),
  );
  const features = perLayer.flat();
  return features.length ? { type: 'FeatureCollection', features } : null;
}

function buildSidebar(): void {
  const root = document.getElementById('layers')!;
  for (const group of GROUPS) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = group;
    section.append(heading);
    for (const def of LAYERS.filter((l) => l.group === group)) {
      section.append(layerRow(def));
      if (def.on) void showLayer(def);
    }
    root.append(section);
  }
  root.append(
    downloadAllButton(
      { id: 'all', label: 'All datasets', color: '#b34a2e' },
      loadEverything,
      LAYERS.length,
    ),
  );
}

// Values come from scraped spreadsheets, so the popup is built as DOM nodes
// rather than an HTML string: no escaping to get wrong.
function popupContent(feature: MapGeoJSONFeature, def: LayerDef): HTMLElement {
  const props = feature.properties ?? {};
  const wrapper = document.createElement('div');
  wrapper.className = 'popup';

  const title = document.createElement('h3');
  title.textContent = featureName(props) || def.label;

  const layer = document.createElement('p');
  layer.className = 'popup-layer';
  const swatch = document.createElement('span');
  swatch.className = 'dot';
  swatch.style.background = def.color;
  layer.append(swatch, document.createTextNode(def.label));
  wrapper.append(title, layer);

  const confidence = props.locationConfidence ?? props.geocodeConfidence;
  const caveat = typeof confidence === 'string' ? CAVEAT[confidence] : undefined;
  if (caveat) {
    const warn = document.createElement('p');
    // Two tones, because 206 of the 495 hospitals are HIGH: painting every one
    // of them with the same alarm as a city-centre guess would train people to
    // stop reading the badge, which is the opposite of the point.
    warn.className = caveat.tone === 'warn' ? 'popup-warn' : 'popup-note';
    warn.textContent = caveat.text;
    wrapper.append(warn);
  } else if (confidence === VERIFIED) {
    const ok = document.createElement('p');
    ok.className = 'popup-verified';
    ok.textContent = 'Verified position';
    if (typeof props.locationSource === 'string') ok.title = props.locationSource;
    wrapper.append(ok);
  }

  const table = document.createElement('dl');
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === '') continue;
    if (NAME_KEYS.includes(key) || HIDDEN_KEYS.has(key)) continue;
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    table.append(dt, dd);
  }
  if (table.childElementCount) wrapper.append(table);
  return wrapper;
}

map.on('click', (e) => {
  const hit = map.queryRenderedFeatures(e.point, { layers: pickable })[0];
  const def = hit && bySource.get(hit.source);
  if (!hit || !def) return;
  popup.setLngLat(e.lngLat).setDOMContent(popupContent(hit, def)).addTo(map);
});

map.on('mousemove', (e) => {
  const hits = map.queryRenderedFeatures(e.point, { layers: pickable });
  map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
});

// AWS Terrain Tiles: public AWS Open Data, keyless and uncapped, the same
// position as the basemaps — nothing here can be billed or rate-limited. It is a
// mosaic (SRTM, 3DEP and others) and stops at zoom 13, which is the right
// ceiling for ground nobody resurveys per metre.
//
// Worth having on a city map because Nashik's relief is the reason for its
// layout: the city sits around 560 m and Brahmagiri above Trimbakeshwar, where
// the Godavari rises, is near 1,290 m. Flat, that road is just a line.
const TERRAIN_SOURCE = 'terrain-dem';
const HILLSHADE_LAYER = 'terrain-hillshade';

// Visual choice, not measurement: 1.2 lifts the Sahyadri edge enough to read
// without turning the Godavari valley into a canyon.
const EXAGGERATION = 1.2;

function syncTerrain(): void {
  // Sky is set either way. It costs no requests, and it is what the map shows
  // above the horizon whenever anyone tilts — with or without a terrain mesh.
  map.setSky(skySpec());

  if (!terrainOn()) {
    map.setTerrain(null);
    if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);
    return;
  }

  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 13,
      attribution:
        '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Tilezen Joerd</a>',
    });
  }

  // Skipped on satellite: the imagery already contains the real shadows the
  // hillshade is imitating, and drawing both darkens every slope twice.
  const shaded = currentBasemap() !== 'satellite';
  if (shaded && !map.getLayer(HILLSHADE_LAYER)) {
    const { shadow, highlight } = hillshadeColors();
    // Beneath the basemap's own labels so place names stay legible. Data layers
    // mount after this and carry no beforeId, so they land above both.
    const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer(
      {
        id: HILLSHADE_LAYER,
        type: 'hillshade',
        source: TERRAIN_SOURCE,
        paint: {
          'hillshade-exaggeration': 0.3,
          'hillshade-shadow-color': shadow,
          'hillshade-highlight-color': highlight,
        },
      },
      firstLabel,
    );
  }
  if (!shaded && map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER);

  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: EXAGGERATION });
}

// setStyle() replaces the whole style document, taking our sources with it, so
// every basemap or theme change rebuilds the layers from the cached GeoJSON once
// the new basemap is ready. Nothing is re-downloaded.
//
// onFailure covers the one basemap that can fail: a mistyped or origin-blocked
// MapTiler key answers 403 for the style document and leaves an empty map with
// nothing on screen to explain it. Falling back to the keyless basemap turns
// that into a visible non-event.
function restyle(onFailure?: () => void): void {
  popup.remove();
  const url = styleUrl();

  const failed = (e: { error?: { status?: number }; sourceId?: string }): void => {
    // Only the style document itself; a single missing sprite or tile is not a
    // reason to throw the whole basemap away.
    if (e.sourceId || !e.error?.status) return;
    map.off('error', failed);
    console.error(`[basemap] ${url} returned ${e.error.status} — falling back`);
    onFailure?.();
  };

  map.once('style.load', () => {
    map.off('error', failed);
    syncTerrain(); // before the data layers, so the hillshade stays under them
    for (const def of LAYERS) if (data.has(def.id)) mount(def);
  });
  if (onFailure) map.on('error', failed);
  map.setStyle(url);
}

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
    restyle();
  });
}

// One row of the available basemaps. Satellite is only in BASEMAPS when a
// MapTiler key is configured, so with no key this is a two-button control and
// nothing anywhere else has to know the difference.
function setupBasemapPicker(): void {
  const host = document.getElementById('basemaps');
  if (!host || BASEMAPS.length < 2) return;

  const buttons = BASEMAPS.map((base) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'basemap';
    button.textContent = base.label;
    button.addEventListener('click', () => {
      if (currentBasemap() === base.id) return;
      applyBasemap(base.id);
      paint();
      restyle(() => {
        applyBasemap('map');
        paint();
        restyle();
      });
    });
    host.append(button);
    return { base, button };
  });

  function paint(): void {
    const active = currentBasemap();
    for (const { base, button } of buttons) {
      button.classList.toggle('is-active', base.id === active);
      button.setAttribute('aria-pressed', String(base.id === active));
    }
  }
  paint();
}

function setupTerrainToggle(): void {
  const button = document.getElementById('terrain-toggle') as HTMLButtonElement | null;
  if (!button) return;

  const paint = (): void => {
    const on = terrainOn();
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-pressed', String(on));
    button.title = on ? 'Turn off 3D terrain' : 'Turn on 3D terrain and tilt the map';
  };
  paint();

  button.addEventListener('click', () => {
    const on = !terrainOn();
    applyTerrain(on);
    paint();
    syncTerrain();
    // Tilting is what makes a terrain mesh visible, and right-drag is not a
    // gesture anyone guesses. Switching it on does it for them; switching it
    // off puts the map back flat.
    map.easeTo({ pitch: on ? 55 : 0, duration: 700 });
  });
}

map.once('load', () => {
  syncTerrain();
  buildSidebar();
  setupThemeToggle();
  setupBasemapPicker();
  setupTerrainToggle();
});

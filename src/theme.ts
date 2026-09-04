import type { SkySpecification } from 'maplibre-gl';

export type Theme = 'light' | 'dark';
export type Basemap = 'map' | 'streets' | 'satellite';

const THEME_KEY = 'nm-theme';
const BASEMAP_KEY = 'nm-basemap';
const TERRAIN_KEY = 'nm-terrain';

// OpenFreeMap — keyless, no account, no rate limit, no usage cap to manage.
const openfreemap = (style: string): string => `https://tiles.openfreemap.org/styles/${style}`;

// Satellite is the one thing no provider gives away uncapped, so it is opt-in:
// set VITE_MAPTILER_KEY and the option appears, leave it unset and the app is
// exactly as it was. No key is committed — the repo is public, and a key in a
// static bundle is a key anyone can spend. Restrict it to the site's own origin
// in the MapTiler console before using it in production.
const maptilerKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

// `hybrid` is imagery with street and place labels drawn over it — the Google
// satellite view. `satellite` is the same imagery with no labels at all.
const maptiler = (style: string): string => `https://api.maptiler.com/maps/${style}/style.json?key=${maptilerKey}`;

type BasemapDef = { id: Basemap; label: string; light: string; dark: string };

// positron is deliberately washed out so 36 layers of data stay readable over
// it; liberty carries the full OSM label set — place names, POIs, road shields
// — for when the basemap itself is what you are reading.
export const BASEMAPS: BasemapDef[] = [
  { id: 'map', label: 'Map', light: openfreemap('positron'), dark: openfreemap('dark') },
  { id: 'streets', label: 'Streets', light: openfreemap('liberty'), dark: openfreemap('dark') },
  ...(maptilerKey
    ? [{ id: 'satellite' as const, label: 'Satellite', light: maptiler('hybrid'), dark: maptiler('hybrid') }]
    : []),
];

// Point halo — white on the pale basemap, near-black on the dark one. Paint
// properties can't read CSS variables, so these are the tokens duplicated
// outside style.css.
const HALO: Record<Theme, string> = { light: '#ffffff', dark: '#191512' };

// Hillshade. The light pair is a warm shadow against white, so relief reads as
// a paper contour rather than a grey smear over the basemap; the dark pair
// inverts it, because a black shadow on a near-black basemap is invisible.
const SHADE: Record<Theme, { shadow: string; highlight: string }> = {
  light: { shadow: '#4a3c33', highlight: '#ffffff' },
  dark: { shadow: '#000000', highlight: '#5c4e42' },
};

// Only ever seen when the map is pitched — above the horizon there is otherwise
// nothing but the style's background colour, which looks like a rendering bug.
const SKY: Record<Theme, SkySpecification> = {
  light: {
    'sky-color': '#89b4e0',
    'horizon-color': '#dfe7ee',
    'fog-color': '#eaeef2',
    'horizon-fog-blend': 0.5,
    'sky-horizon-blend': 0.8,
    'fog-ground-blend': 0.6,
  },
  dark: {
    'sky-color': '#0c141d',
    'horizon-color': '#2b2521',
    'fog-color': '#191512',
    'horizon-fog-blend': 0.5,
    'sky-horizon-blend': 0.8,
    'fog-ground-blend': 0.6,
  },
};

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function currentBasemap(): Basemap {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(BASEMAP_KEY);
  } catch {
    // Private mode / blocked storage: fall through to the default.
  }
  // A stored 'satellite' has to be re-checked, not trusted: the key may have
  // been removed since, in which case that basemap no longer exists.
  return BASEMAPS.some((b) => b.id === stored) ? (stored as Basemap) : 'map';
}

export function styleUrl(theme = currentTheme(), basemap = currentBasemap()): string {
  const def = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0]!;
  return theme === 'dark' ? def.dark : def.light;
}

export function haloColor(theme = currentTheme()): string {
  return HALO[theme];
}

export function hillshadeColors(theme = currentTheme()): { shadow: string; highlight: string } {
  return SHADE[theme];
}

export function skySpec(theme = currentTheme()): SkySpecification {
  return SKY[theme];
}

// Default on. Hillshade reads as relief at pitch 0, so terrain shows itself
// without anyone having to find the tilt gesture first.
export function terrainOn(): boolean {
  try {
    return localStorage.getItem(TERRAIN_KEY) !== 'off';
  } catch {
    return true;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the choice just won't survive a reload.
  }
}

export function applyBasemap(basemap: Basemap): void {
  remember(BASEMAP_KEY, basemap);
}

export function applyTerrain(on: boolean): void {
  remember(TERRAIN_KEY, on ? 'on' : 'off');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  remember(THEME_KEY, theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191512' : '#fdfcfb');
}

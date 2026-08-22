export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'nm-theme';

// OpenFreeMap — keyless, no account. positron is the light basemap the white
// theme needs: pale grey roads, no coloured landuse fighting the layer dots.
const STYLES: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

// Point halo — white on the pale basemap, near-black on the dark one. Paint
// properties can't read CSS variables, so this is the one token duplicated
// outside style.css.
const HALO: Record<Theme, string> = { light: '#ffffff', dark: '#191512' };

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function styleUrl(theme = currentTheme()): string {
  return STYLES[theme];
}

export function haloColor(theme = currentTheme()): string {
  return HALO[theme];
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the choice just won't survive a reload.
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191512' : '#fdfcfb');
}

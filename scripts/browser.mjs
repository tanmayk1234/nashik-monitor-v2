import { chromium } from '@playwright/test';

// Set CHROMIUM_PATH when the browser build installed locally does not match the
// one @playwright/test pins; it takes any Chromium binary. The swiftshader flags
// are required wherever there is no GPU, which includes CI: MapLibre needs WebGL.
export function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}

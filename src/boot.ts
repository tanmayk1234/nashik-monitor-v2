import { runSplash } from './splash';

runSplash();

// The map, and the ~1 MB of maplibre-gl behind it, loads only after the splash
// has painted a frame. A module script blocks the first paint until its whole
// graph has evaluated, which left the intro starting half a second late and
// then racing the map build for the main thread. Two frames: one to schedule,
// one to be sure the first has been painted.
requestAnimationFrame(() => requestAnimationFrame(() => void import('./main')));

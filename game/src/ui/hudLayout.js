// Keeps the HUD the same size relative to the screen: it is laid out for 1280 by 720 and scaled
// up with CSS zoom on bigger windows (up to 2x at 2560 by 1440), so panels never crowd into each
// other and every line keeps its room. Long names are cut with an ellipsis by the stylesheet.

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const MAX_ZOOM = 2;

export function hudZoom(width, height) {
  return Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT, MAX_ZOOM));
}

export function applyHudZoom() {
  const zoom = hudZoom(window.innerWidth, window.innerHeight);
  document.documentElement.style.setProperty('--hud-zoom', zoom.toFixed(3));
  return zoom;
}

export function watchHudZoom() {
  applyHudZoom();
  window.addEventListener('resize', applyHudZoom);
}

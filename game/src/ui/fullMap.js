// The full-screen map (M): the whole of Ondaluz with district names, landmarks, every contact,
// activity and mission blip, police and the search area, the GPS route and Kai's position,
// framed like a tourist map with a legend. The mouse wheel and + / - zoom in and out around the
// cursor, dragging pans, and a click sets a GPS waypoint (a click on it, or Backspace, clears it).
import { MAP_SCALE } from './mapPainter.js';
import { DISTRICTS } from '../world/cityPlan.js';
import { CITY_NAME } from '../core/config.js';
import { collectBlips, gpsRoute } from './blips.js';
import { drawBlip } from './minimap.js';
import { routeGoal, WAYPOINT_COLOR } from './gpsWaypoint.js';

const LANDMARKS = [
  { x: 330, z: 14, text: 'Sunwheel Pier' },
  { x: 300, z: -352, text: 'Lighthouse Point' },
  { x: -40, z: -102, text: 'Glasswater One' },
  { x: -40, z: 58, text: 'Mercado Plaza' },
  { x: -280, z: -102, text: 'Jacaranda Park' },
  { x: -90, z: 330, text: 'Cargo Docks' },
  { x: 420, z: -200, text: 'Atlantic Ocean' },
  { x: -380, z: -380, text: 'Vista Alta Hills' },
  { x: 285, z: 150, text: 'Sunwheel Beach' },
];

const LEGEND = [
  ['#ffd23f', 'Mission target'], [WAYPOINT_COLOR, 'Your waypoint'], ['#ff7aa2', 'Story contact (L / J / V)'], ['#ff9f1c', 'Street race (R)'],
  ['#e76f51', 'Pelican Express (D)'], ['#2ecc71', 'Bayside Arms ($)'], ['#4cc9f0', 'Safehouse (S)'],
  ['#ff4d6d', 'Hospital (+)'], ['#3a86ff', 'Police HQ (P)'], ['#ff2d3a', 'Police'],
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
/** A press that moves less than this many screen pixels is a click, not a drag. */
const CLICK_SLOP = 5;

export class FullMap {
  constructor(game, painter) {
    this.game = game;
    this.painter = painter;
    this.root = document.getElementById('full-map');
    this.canvas = document.getElementById('full-map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.legend = document.getElementById('map-legend');
    this.legend.innerHTML = `<h3>${CITY_NAME.toUpperCase()}</h3>${LEGEND.map(([color, text]) => `<p><i style="background:${color}"></i>${text}</p>`).join('')}<p class="keys">Click: set or clear a waypoint<br>Drag: move · Wheel or <kbd>+</kbd> <kbd>-</kbd>: zoom<br><kbd>Backspace</kbd> clear · <kbd>M</kbd> close</p>`;
    this.labels = this.districtLabels();
    this.zoom = MIN_ZOOM;
    const source = painter.canvas;
    this.center = { mx: source.width / 2, my: source.height / 2 };
    this.drag = null;
    this.bindMouse();
  }

  get open() {
    return !this.root.classList.contains('hidden');
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
    if (visible) this.draw();
  }

  districtLabels() {
    const sums = {};
    for (const plan of this.game.city.plans) {
      const entry = sums[plan.district] ?? (sums[plan.district] = { x: 0, z: 0, n: 0 });
      entry.x += plan.bounds.cx;
      entry.z += plan.bounds.cz;
      entry.n += 1;
    }
    return Object.entries(sums).map(([id, s]) => ({ x: s.x / s.n, z: s.z / s.n, text: DISTRICTS[id].name.toUpperCase() }));
  }

  /** Map pixels per canvas pixel at the current zoom. */
  get scale() {
    const source = this.painter.canvas;
    return Math.min(this.canvas.width / source.width, this.canvas.height / source.height) * this.zoom;
  }

  toScreen(x, z) {
    const [mx, my] = this.painter.toMap(x, z);
    const scale = this.scale;
    return [this.canvas.width / 2 + (mx - this.center.mx) * scale, this.canvas.height / 2 + (my - this.center.my) * scale];
  }

  toWorld(cx, cy) {
    const scale = this.scale;
    const mx = this.center.mx + (cx - this.canvas.width / 2) / scale;
    const my = this.center.my + (cy - this.canvas.height / 2) / scale;
    const [ox, oz] = this.painter.toMap(0, 0);
    return { x: (mx - ox) / MAP_SCALE, z: (my - oz) / MAP_SCALE };
  }

  /** Canvas pixels under a mouse event (the canvas is scaled to the window by CSS, letterboxed). */
  canvasPoint(event) {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const boxW = canvas.clientWidth || rect.width;
    const boxH = canvas.clientHeight || rect.height;
    const fit = Math.min(boxW / canvas.width, boxH / canvas.height);
    const left = rect.left + canvas.clientLeft + (boxW - canvas.width * fit) / 2;
    const top = rect.top + canvas.clientTop + (boxH - canvas.height * fit) / 2;
    return [(event.clientX - left) / fit, (event.clientY - top) / fit];
  }

  /** Where a world point is on the page (for tests that click the map like a player). */
  pagePoint(x, z) {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const boxW = canvas.clientWidth || rect.width;
    const boxH = canvas.clientHeight || rect.height;
    const fit = Math.min(boxW / canvas.width, boxH / canvas.height);
    const [cx, cy] = this.toScreen(x, z);
    return { x: rect.left + canvas.clientLeft + (boxW - canvas.width * fit) / 2 + cx * fit, y: rect.top + canvas.clientTop + (boxH - canvas.height * fit) / 2 + cy * fit };
  }

  /** Zooms by `factor`, keeping the map point under canvas point (cx, cy) where it is. */
  zoomBy(factor, cx = this.canvas.width / 2, cy = this.canvas.height / 2) {
    const before = this.toWorld(cx, cy);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    const after = this.toWorld(cx, cy);
    const [bx, by] = this.painter.toMap(before.x, before.z);
    const [ax, ay] = this.painter.toMap(after.x, after.z);
    this.center.mx += bx - ax;
    this.center.my += by - ay;
    this.clampCenter();
  }

  panBy(dx, dy) {
    const scale = this.scale;
    this.center.mx -= dx / scale;
    this.center.my -= dy / scale;
    this.clampCenter();
  }

  clampCenter() {
    const source = this.painter.canvas;
    this.center.mx = Math.max(0, Math.min(source.width, this.center.mx));
    this.center.my = Math.max(0, Math.min(source.height, this.center.my));
  }

  bindMouse() {
    const canvas = this.canvas;
    canvas.addEventListener('wheel', (event) => {
      if (!this.open) return;
      event.preventDefault();
      const [cx, cy] = this.canvasPoint(event);
      this.zoomBy(event.deltaY < 0 ? 1.25 : 0.8, cx, cy);
    }, { passive: false });
    canvas.addEventListener('mousedown', (event) => {
      if (!this.open || event.button !== 0) return;
      const [cx, cy] = this.canvasPoint(event);
      this.drag = { startX: cx, startY: cy, lastX: cx, lastY: cy, moved: false };
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.drag || !this.open) return;
      const [cx, cy] = this.canvasPoint(event);
      if (Math.hypot(cx - this.drag.startX, cy - this.drag.startY) > CLICK_SLOP) this.drag.moved = true;
      if (this.drag.moved) this.panBy(cx - this.drag.lastX, cy - this.drag.lastY);
      this.drag.lastX = cx;
      this.drag.lastY = cy;
    });
    window.addEventListener('mouseup', (event) => {
      const drag = this.drag;
      this.drag = null;
      if (!drag || !this.open || drag.moved || event.button !== 0) return;
      const [cx, cy] = this.canvasPoint(event);
      const point = this.toWorld(cx, cy);
      // A pick radius of a dozen screen pixels, whatever the zoom.
      this.game.waypoint.clickAt(point.x, point.z, 12 / (this.scale * MAP_SCALE));
      this.game.events.emit('uiClick', {});
    });
  }

  /** Keys while the map is open: + / - zoom, Backspace or Delete clear the waypoint. */
  handleKeys(input) {
    if (input.pressed.has('Equal') || input.pressed.has('NumpadAdd')) this.zoomBy(1.25);
    if (input.pressed.has('Minus') || input.pressed.has('NumpadSubtract')) this.zoomBy(0.8);
    if (input.pressed.has('Backspace') || input.pressed.has('Delete')) this.game.waypoint.clear();
  }

  draw() {
    const game = this.game;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const source = this.painter.canvas;
    const scale = this.scale;
    const toScreen = (x, z) => this.toScreen(x, z);
    ctx.fillStyle = '#2b8fb3';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, w / 2 - this.center.mx * scale, h / 2 - this.center.my * scale, source.width * scale, source.height * scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of this.labels) {
      const [x, y] = toScreen(label.x, label.z);
      ctx.font = 'italic 900 26px "Arial Black", "Segoe UI", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(label.text, x, y);
      ctx.fillStyle = '#5a2d4a';
      ctx.fillText(label.text, x, y);
    }
    ctx.font = 'italic 700 17px "Segoe UI", sans-serif';
    for (const mark of LANDMARKS) {
      const [x, y] = toScreen(mark.x, mark.z);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,30,40,0.6)';
      ctx.strokeText(mark.text, x, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(mark.text, x, y);
    }
    const player = game.player.character;
    const goal = routeGoal(game);
    if (goal) {
      const route = gpsRoute(game, player.x, player.z, goal.x, goal.z);
      ctx.strokeStyle = game.waypoint.active ? WAYPOINT_COLOR : '#ffcf33';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      route.forEach((point, index) => {
        const [x, y] = toScreen(point.x, point.z);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    const wanted = game.wanted;
    if (wanted.level > 0 && wanted.searching) {
      const [x, y] = toScreen(wanted.lastKnown.x, wanted.lastKnown.z);
      ctx.fillStyle = 'rgba(255,40,60,0.25)';
      ctx.beginPath();
      ctx.arc(x, y, (55 + wanted.level * 14) * MAP_SCALE * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const blip of collectBlips(game)) {
      const [x, y] = toScreen(blip.x, blip.z);
      drawBlip(ctx, blip, x, y, 1.45);
    }
    const [px, py] = toScreen(player.x, player.z);
    const heading = player.vehicle ? player.vehicle.yaw : player.yaw;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.cos(heading), Math.sin(heading)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#12121a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(11, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('YOU', px, py + 26);
    // Compass and zoom.
    ctx.fillStyle = 'rgba(18,12,26,0.75)';
    ctx.beginPath();
    ctx.arc(w - 60, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 24px "Segoe UI", sans-serif';
    ctx.fillText('N', w - 60, 52);
    ctx.fillRect(w - 62, 64, 4, 16);
    ctx.fillStyle = 'rgba(18,12,26,0.75)';
    ctx.fillRect(w - 96, 100, 72, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(`${this.zoom.toFixed(1)}×`, w - 60, 115);
  }
}

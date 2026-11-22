// The full-screen map (M): the whole of Ondaluz with district names, landmarks, every contact,
// activity and mission blip, police and the search area, the GPS route and Kai's position,
// framed like a tourist map with a legend.
import { MAP_SCALE } from './mapPainter.js';
import { DISTRICTS } from '../world/cityPlan.js';
import { CITY_NAME } from '../core/config.js';
import { collectBlips, gpsRoute } from './blips.js';
import { drawBlip } from './minimap.js';

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
  ['#ffd23f', 'Mission target'], ['#ff7aa2', 'Story contact (L / J / V)'], ['#ff9f1c', 'Street race (R)'],
  ['#e76f51', 'Pelican Express (D)'], ['#2ecc71', 'Bayside Arms ($)'], ['#4cc9f0', 'Safehouse (S)'],
  ['#ff4d6d', 'Hospital (+)'], ['#3a86ff', 'Police HQ (P)'], ['#ff2d3a', 'Police'],
];

export class FullMap {
  constructor(game, painter) {
    this.game = game;
    this.painter = painter;
    this.root = document.getElementById('full-map');
    this.canvas = document.getElementById('full-map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.legend = document.getElementById('map-legend');
    this.legend.innerHTML = `<h3>${CITY_NAME.toUpperCase()}</h3>${LEGEND.map(([color, text]) => `<p><i style="background:${color}"></i>${text}</p>`).join('')}<p class="keys"><kbd>M</kbd> close</p>`;
    this.labels = this.districtLabels();
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

  draw() {
    const game = this.game;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const source = this.painter.canvas;
    const scale = Math.min(w / source.width, h / source.height);
    const ox = (w - source.width * scale) / 2;
    const oy = (h - source.height * scale) / 2;
    const toScreen = (x, z) => {
      const [mx, my] = this.painter.toMap(x, z);
      return [ox + mx * scale, oy + my * scale];
    };
    ctx.fillStyle = '#2b8fb3';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, ox, oy, source.width * scale, source.height * scale);
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
    const goal = game.missions.routeTarget();
    if (goal) {
      const route = gpsRoute(game, player.x, player.z, goal.x, goal.z);
      ctx.strokeStyle = '#ffcf33';
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
    // Compass.
    ctx.fillStyle = 'rgba(18,12,26,0.75)';
    ctx.beginPath();
    ctx.arc(w - 60, 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 24px "Segoe UI", sans-serif';
    ctx.fillText('N', w - 60, 52);
    ctx.fillRect(w - 62, 64, 4, 16);
  }
}

// The minimap: the baked city map turned with the camera and zoomed out with speed, the GPS
// route, the police search area, blips (edge-clamped for targets), a north marker and the
// player's arrow in the middle.
import { MAP_SCALE } from './mapPainter.js';
import { damp } from '../core/mathUtils.js';

const SIZE = 400;
const RADIUS = SIZE / 2 - 14;

export class Minimap {
  constructor(canvas, painter) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.painter = painter;
    this.zoom = 1.5;
  }

  /** World offset (dx, dz) from the player to minimap pixels, given the turn and zoom. */
  project(dx, dz, cos, sin) {
    const mx = dx * MAP_SCALE * this.zoom;
    const mz = dz * MAP_SCALE * this.zoom;
    return [SIZE / 2 + mx * cos - mz * sin, SIZE / 2 + mx * sin + mz * cos];
  }

  draw(game, blips, route, dt) {
    const ctx = this.ctx;
    const player = game.player.character;
    const vehicle = player.vehicle;
    const speed = vehicle ? vehicle.speed : 0;
    this.zoom = damp(this.zoom, vehicle ? 1.25 - Math.min(speed, 40) / 40 * 0.5 : 1.6, 2, dt);
    const yaw = game.followCamera.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const theta = -Math.PI / 2 - Math.atan2(fz, fx);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    ctx.save();
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.beginPath();
    ctx.roundRect(4, 4, SIZE - 8, SIZE - 8, 46);
    ctx.clip();
    ctx.fillStyle = '#3fa6c4';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(theta);
    ctx.scale(this.zoom, this.zoom);
    const [px, py] = this.painter.toMap(player.x, player.z);
    ctx.drawImage(this.painter.canvas, -px, -py);
    ctx.restore();
    if (route && route.length > 1) {
      ctx.strokeStyle = this.routeColor ?? '#ffcf33';
      ctx.lineWidth = 9;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      route.forEach((point, index) => {
        const [x, y] = this.project(point.x - player.x, point.z - player.z, cos, sin);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const wanted = game.wanted;
    if (wanted.level > 0 && wanted.searching) {
      const [x, y] = this.project(wanted.lastKnown.x - player.x, wanted.lastKnown.z - player.z, cos, sin);
      const radius = (55 + wanted.level * 14) * MAP_SCALE * this.zoom;
      ctx.fillStyle = Math.floor(game.time * 3) % 2 === 0 ? 'rgba(255,40,60,0.22)' : 'rgba(50,100,255,0.22)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const blip of blips) {
      let [x, y] = this.project(blip.x - player.x, blip.z - player.z, cos, sin);
      const dx = x - SIZE / 2;
      const dy = y - SIZE / 2;
      const distance = Math.hypot(dx, dy);
      if (distance > RADIUS) {
        if (!blip.edge) continue;
        x = SIZE / 2 + (dx / distance) * RADIUS;
        y = SIZE / 2 + (dy / distance) * RADIUS;
      }
      drawBlip(ctx, blip, x, y, 1.6);
    }
    // North marker.
    const [nx, ny] = [SIZE / 2 + -sin * -RADIUS, SIZE / 2 + cos * -RADIUS];
    ctx.fillStyle = 'rgba(20,20,30,0.75)';
    ctx.beginPath();
    ctx.arc(nx, ny, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 1);
    // Player arrow.
    const heading = vehicle ? vehicle.yaw : player.yaw;
    const angle = theta + Math.atan2(Math.cos(heading), Math.sin(heading));
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1b1b24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(12, 13);
    ctx.lineTo(0, 6);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}

/** One blip: dot, letter disc, or icon, at (x, y) on a canvas. */
export function drawBlip(ctx, blip, x, y, scale = 1) {
  const size = blip.size * scale;
  ctx.save();
  if (blip.kind === 'waypoint') {
    // A map pin: a diamond with a white rim.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - size - 4);
    ctx.lineTo(x + size + 4, y);
    ctx.lineTo(x, y + size + 4);
    ctx.lineTo(x - size - 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = blip.color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  } else if (blip.letter) {
    ctx.fillStyle = '#1b1b24';
    ctx.beginPath();
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blip.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(size * 1.25)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(blip.letter, x, y + 1);
  } else if (blip.kind === 'target' || blip.kind === 'vehicleTarget' || blip.kind === 'checkpoint') {
    ctx.fillStyle = '#1b1b24';
    ctx.beginPath();
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blip.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#12121a';
    ctx.beginPath();
    ctx.arc(x, y, size + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blip.color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

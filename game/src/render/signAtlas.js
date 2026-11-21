// Paints every sign of the catalog into one 2048x2048 atlas (neon tubes, shop panels and
// billboards with simple art), so all the city's signs share one texture and one draw call.
import { canvasTexture } from './textures.js';
import { SIGNS } from '../world/signCatalog.js';

const SIZE = 2048;
const CELL_W = 512;
const CELL_H = 128;
const COLUMNS = SIZE / CELL_W;

function fitFont(ctx, text, maxWidth, startSize, weight, family) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    size -= 2;
  } while (ctx.measureText(text).width > maxWidth && size > 12);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNeon(ctx, sign, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#231a2e');
  bg.addColorStop(1, '#120d18');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.shadowColor = sign.fg;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = sign.fg;
  ctx.lineWidth = 5;
  roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 18);
  ctx.stroke();
  fitFont(ctx, sign.text, w - 60, 70, '900', '"Arial Black", "Segoe UI", sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = sign.fg;
  ctx.fillText(sign.text, x + w / 2, y + h / 2 + 3);
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(sign.text, x + w / 2, y + h / 2 + 3);
  ctx.restore();
}

function drawPanel(ctx, sign, x, y, w, h) {
  ctx.fillStyle = sign.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 8;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
  fitFont(ctx, sign.text, w - 56, 66, '800', '"Segoe UI", "Arial Black", sans-serif');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = sign.fg;
  ctx.fillText(sign.text, x + w / 2, y + h / 2 + 2);
}

function drawArt(ctx, art, x, y, w, h) {
  ctx.save();
  if (art === 'sun') {
    const g = ctx.createRadialGradient(x + w * 0.8, y + h * 0.42, 6, x + w * 0.8, y + h * 0.42, 70);
    g.addColorStop(0, 'rgba(255,255,220,0.95)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + w * 0.55, y, w * 0.45, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + w * 0.8, y + h * 0.42, 34, 0, Math.PI * 2);
    ctx.fill();
  } else if (art === 'wave') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 6;
    for (let line = 0; line < 3; line += 1) {
      ctx.beginPath();
      for (let px = 0; px <= w; px += 12) ctx.lineTo(x + px, y + h - 30 - line * 16 + Math.sin(px * 0.04 + line) * 8);
      ctx.stroke();
    }
  } else if (art === 'wheel') {
    const cx = x + w * 0.82;
    const cy = y + h * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.stroke();
    for (let spoke = 0; spoke < 12; spoke += 1) {
      const a = (spoke / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
      ctx.stroke();
    }
  } else if (art === 'burger') {
    const cx = x + w * 0.8;
    const cy = y + h * 0.5;
    ctx.fillStyle = '#e09f3e';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 22, 70, 36, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6a994e';
    ctx.fillRect(cx - 72, cy - 18, 144, 12);
    ctx.fillStyle = '#7f4f24';
    ctx.fillRect(cx - 70, cy - 6, 140, 24);
    ctx.fillStyle = '#e09f3e';
    ctx.fillRect(cx - 68, cy + 18, 136, 20);
  } else if (art === 'coin') {
    const cx = x + w * 0.82;
    const cy = y + h * 0.5;
    ctx.fillStyle = 'rgba(255,215,90,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,100,0,0.8)';
    ctx.font = '900 70px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', cx, cy + 4);
  }
  ctx.restore();
}

function drawBillboard(ctx, sign, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, sign.bg[0]);
  bg.addColorStop(1, sign.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  drawArt(ctx, sign.art, x, y, w, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, sign.text, w * 0.62, 64, 'italic 900', '"Arial Black", "Segoe UI", sans-serif');
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillText(sign.text, x + 26, y + h * 0.52 + 4);
  ctx.fillStyle = sign.fg;
  ctx.fillText(sign.text, x + 22, y + h * 0.52);
  fitFont(ctx, sign.sub, w * 0.6, 32, 'italic 600', '"Segoe UI", sans-serif');
  ctx.fillText(sign.sub, x + 24, y + h * 0.52 + 50);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

export function createSignAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const rects = new Map();
  let billboardSlot = 0;
  let signSlot = 0;
  for (const sign of SIGNS) {
    let column;
    let row;
    let rows;
    if (sign.rows === 2) {
      column = billboardSlot % COLUMNS;
      row = Math.floor(billboardSlot / COLUMNS) * 2;
      rows = 2;
      billboardSlot += 1;
    } else {
      column = signSlot % COLUMNS;
      row = 4 + Math.floor(signSlot / COLUMNS);
      rows = 1;
      signSlot += 1;
    }
    const x = column * CELL_W;
    const y = row * CELL_H;
    const h = rows * CELL_H;
    if (sign.style === 'neon') drawNeon(ctx, sign, x, y, CELL_W, h);
    else if (sign.style === 'billboard') drawBillboard(ctx, sign, x, y, CELL_W, h);
    else drawPanel(ctx, sign, x, y, CELL_W, h);
    const inset = 2 / SIZE;
    rects.set(sign.id, {
      u0: x / SIZE + inset,
      u1: (x + CELL_W) / SIZE - inset,
      v0: 1 - (y + h) / SIZE + inset,
      v1: 1 - y / SIZE - inset,
      aspect: CELL_W / h,
    });
  }
  const texture = canvasTexture(canvas, { repeat: false });
  return { texture, canvas, rect: (id) => rects.get(id) };
}

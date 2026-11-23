// The car gauge: a dusk-coloured arc dial in miles per hour with a needle, a digital readout
// and the gear, drawn on its own canvas every frame while driving.

const MAX_MPH = 160;
const START = Math.PI * 0.8;
const SWEEP = Math.PI * 1.4;

export function drawSpeedometer(ctx, mph, gear, health) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2;
  const cy = h * 0.47;
  const r = h * 0.42;
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(15,12,24,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, START, START + SWEEP);
  ctx.stroke();
  const share = Math.min(1, mph / MAX_MPH);
  const gradient = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  gradient.addColorStop(0, '#ffd166');
  gradient.addColorStop(0.55, '#ff8c42');
  gradient.addColorStop(1, '#ff3d7f');
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, START, START + SWEEP * share);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  for (let mark = 0; mark <= MAX_MPH; mark += 20) {
    const a = START + SWEEP * (mark / MAX_MPH);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
    ctx.lineTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9));
    ctx.stroke();
  }
  const needle = START + SWEEP * share;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needle) * (r - 14), cy + Math.sin(needle) * (r - 14));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6;
  ctx.font = 'italic 900 46px "Arial Black", "Segoe UI", sans-serif';
  ctx.fillText(String(Math.round(mph)), cx, cy + 30);
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd9a8';
  ctx.fillText(`MPH  ·  GEAR ${gear}`, cx, cy + 54);
  ctx.shadowBlur = 0;
  if (health === null || health === undefined) return;
  // Car health strip.
  ctx.fillStyle = 'rgba(15,12,24,0.55)';
  ctx.fillRect(cx - 50, cy + 64, 100, 6);
  ctx.fillStyle = health > 0.5 ? '#7bed9f' : health > 0.25 ? '#ffd166' : '#ff4757';
  ctx.fillRect(cx - 50, cy + 64, 100 * health, 6);
}

/** Gear from speed for the gauge and the engine sound. */
export function gearFor(speed, reversing) {
  if (reversing) return 'R';
  if (speed < 0.5) return 'N';
  const limits = [7, 14, 22, 31, 42];
  for (let gear = 0; gear < limits.length; gear += 1) if (speed < limits[gear]) return String(gear + 1);
  return '6';
}

// Draws the dialogue portraits of the cast on a canvas: a sunset backdrop, shoulders in their
// shirt colour, face, hair style and each character's signature detail (earrings, cap,
// moustache, shades, headband, headset).
import { CAST } from '../missions/cast.js';

function shadeColor(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((value >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

export function drawPortrait(canvas, id) {
  const person = CAST[id] ?? CAST.kai;
  const ctx = canvas.getContext('2d');
  const s = canvas.width / 168;
  ctx.save();
  ctx.scale(s, s);
  const sky = ctx.createLinearGradient(0, 0, 0, 168);
  sky.addColorStop(0, shadeColor(person.color, 40));
  sky.addColorStop(1, shadeColor(person.color, -70));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 168, 168);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(126, 46, 30, 0, Math.PI * 2);
  ctx.fill();
  const look = person.outfit;
  // Shoulders and neck.
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.ellipse(84, 176, 70, 46, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = shadeColor(look.skin, -20);
  ctx.fillRect(72, 108, 24, 26);
  // Head.
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.ellipse(84, 82, 32, 39, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shadeColor(look.skin, -25);
  ctx.beginPath();
  ctx.ellipse(51, 86, 6, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(117, 86, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (person.hair === 'bun') {
    ctx.ellipse(84, 58, 34, 22, 0, Math.PI, 0);
    ctx.arc(84, 30, 15, 0, Math.PI * 2);
  } else if (person.hair === 'bob') {
    ctx.ellipse(84, 66, 37, 32, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.rect(48, 62, 12, 40);
    ctx.rect(108, 62, 12, 40);
  } else if (person.hair === 'slick') {
    ctx.ellipse(84, 56, 33, 20, -0.1, Math.PI, 0);
  } else {
    ctx.ellipse(84, 54, 32, 17, 0, Math.PI, 0);
  }
  ctx.fill();
  // Eyes, brows, mouth.
  if (person.extra === 'shades') {
    ctx.fillStyle = '#111';
    ctx.fillRect(58, 74, 22, 12);
    ctx.fillRect(88, 74, 22, 12);
    ctx.fillRect(78, 77, 12, 3);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(71, 80, 7, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(97, 80, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.arc(72, 80, 3.2, 0, Math.PI * 2);
    ctx.arc(98, 80, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = shadeColor(look.hair, -10);
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(62, 69);
  ctx.lineTo(79, 67);
  ctx.moveTo(89, 67);
  ctx.lineTo(106, 69);
  ctx.stroke();
  ctx.strokeStyle = shadeColor(look.skin, -70);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(84, 98, 10, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // Signature detail.
  switch (person.extra) {
    case 'earrings':
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(51, 100, 7, 0, Math.PI * 2);
      ctx.moveTo(124, 100);
      ctx.arc(117, 100, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff5fa2';
      ctx.beginPath();
      ctx.arc(108, 46, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cap':
      ctx.fillStyle = look.hat ?? '#ff9f1c';
      ctx.beginPath();
      ctx.ellipse(84, 50, 35, 18, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(84, 46, 46, 7);
      break;
    case 'mustache':
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.ellipse(84, 93, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(60, 150);
      ctx.lineTo(70, 144);
      ctx.lineTo(80, 150);
      ctx.lineTo(70, 160);
      ctx.fill();
      break;
    case 'shades':
      ctx.fillStyle = look.hat ?? '#f4f1de';
      ctx.beginPath();
      ctx.ellipse(84, 48, 46, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(58, 26, 52, 22);
      break;
    case 'headband':
      ctx.fillStyle = '#e63946';
      ctx.fillRect(52, 58, 64, 8);
      break;
    case 'headset':
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(84, 70, 36, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillRect(110, 78, 10, 18);
      break;
    case 'stubble':
      ctx.fillStyle = 'rgba(40,25,15,0.25)';
      ctx.beginPath();
      ctx.ellipse(84, 104, 22, 12, 0, 0, Math.PI);
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

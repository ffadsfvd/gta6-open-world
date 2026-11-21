// Paints the city map once onto a canvas: sea and shallows, hills, beach, quay, district-tinted
// blocks with building footprints, parks, plazas and pools, white streets, the pier and wheel.
// The minimap and the full-screen map both draw from it.
import { GRID_X, GRID_Z, ROAD_HALF, SHORE, PIER } from '../core/config.js';
import { DISTRICTS } from '../world/cityPlan.js';

export const MAP_BOUNDS = { minX: -420, minZ: -400, maxX: 480, maxZ: 380 };
export const MAP_SCALE = 1.5;

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((value >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

export class MapPainter {
  constructor(plans) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round((MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * MAP_SCALE);
    this.canvas.height = Math.round((MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * MAP_SCALE);
    this.ctx = this.canvas.getContext('2d');
    this.paint(plans);
  }

  toMap(x, z) {
    return [(x - MAP_BOUNDS.minX) * MAP_SCALE, (z - MAP_BOUNDS.minZ) * MAP_SCALE];
  }

  rect(minX, minZ, maxX, maxZ, color) {
    const [x0, y0] = this.toMap(minX, minZ);
    const [x1, y1] = this.toMap(maxX, maxZ);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  paint(plans) {
    const ctx = this.ctx;
    const sea = ctx.createLinearGradient(0, 0, this.canvas.width, 0);
    sea.addColorStop(0, '#3fa6c4');
    sea.addColorStop(1, '#2b8fb3');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Shallows along the beach.
    const [sx0] = this.toMap(SHORE.shoreline - 6, 0);
    const [sx1] = this.toMap(SHORE.shoreline + 40, 0);
    const shallows = ctx.createLinearGradient(sx0, 0, sx1, 0);
    shallows.addColorStop(0, '#8fe3dc');
    shallows.addColorStop(1, 'rgba(63,166,196,0)');
    ctx.fillStyle = shallows;
    ctx.fillRect(sx0, 0, sx1 - sx0, this.toMap(0, SHORE.quayStart)[1]);
    // Hills to the west and north.
    this.rect(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, -345, SHORE.quayEdge, DISTRICTS.hills.mapColor);
    this.rect(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, 262, -345, DISTRICTS.hills.mapColor);
    ctx.strokeStyle = 'rgba(70,110,60,0.35)';
    ctx.lineWidth = 2;
    for (let ring = 1; ring < 5; ring += 1) {
      const [x, y] = this.toMap(-345 - ring * 16, -345 - ring * 16);
      ctx.beginPath();
      ctx.moveTo(x, this.canvas.height * 0.75);
      ctx.lineTo(x, y);
      ctx.lineTo(this.toMap(250, 0)[0], y);
      ctx.stroke();
    }
    // Land, beach and quay.
    this.rect(-345, -345, SHORE.promenadeEnd, SHORE.quayStart, '#ece3d1');
    this.rect(SHORE.promenadeEnd, -345, SHORE.shoreline, SHORE.quayStart, DISTRICTS.beach.mapColor);
    this.rect(-345, SHORE.quayStart, SHORE.promenadeEnd, SHORE.quayEdge, '#cfc5b6');
    this.rect(GRID_X[GRID_X.length - 1] + ROAD_HALF, -331, SHORE.promenadeEnd, SHORE.quayStart, '#f1ebdf');
    // Blocks.
    for (const plan of plans) {
      const b = plan.bounds;
      const district = DISTRICTS[plan.district];
      let ground = shade(district.mapColor, 28);
      if (plan.ground === 'grass') ground = '#b5d88f';
      if (plan.ground === 'plaza') ground = '#f4c9a0';
      this.rect(b.outerMinX, b.outerMinZ, b.outerMaxX, b.outerMaxZ, '#f6f1e7');
      this.rect(b.lotMinX, b.lotMinZ, b.lotMaxX, b.lotMaxZ, ground);
      for (const feature of plan.features) {
        if (feature.type === 'pool' || feature.type === 'pond') {
          const fx = feature.minX ?? feature.x - feature.rx;
          const fz = feature.minZ ?? feature.z - feature.rz;
          const gx = feature.maxX ?? feature.x + feature.rx;
          const gz = feature.maxZ ?? feature.z + feature.rz;
          const cx = (fx + gx) / 2;
          const cz = (fz + gz) / 2;
          this.rect(cx - Math.min(9, (gx - fx) / 2 - 3), cz - Math.min(5, (gz - fz) / 2 - 3), cx + Math.min(9, (gx - fx) / 2 - 3), cz + Math.min(5, (gz - fz) / 2 - 3), '#6fd3e6');
        } else if (feature.type === 'parking' || feature.type === 'containers') {
          this.rect(feature.minX, feature.minZ, feature.maxX, feature.maxZ, feature.type === 'parking' ? '#b9b4ab' : '#c79a7a');
        } else if (feature.type === 'fountain') {
          const [x, y] = this.toMap(feature.x, feature.z);
          ctx.fillStyle = '#6fd3e6';
          ctx.beginPath();
          ctx.arc(x, y, 6 * MAP_SCALE, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const spec of plan.buildings) {
        const tall = spec.height > 30;
        this.rect(spec.minX, spec.minZ, spec.maxX, spec.maxZ, shade(district.mapColor, tall ? -38 : -14));
      }
    }
    // Streets.
    const zMin = GRID_Z[0] - ROAD_HALF;
    const zMax = GRID_Z[GRID_Z.length - 1] + ROAD_HALF;
    const xMin = GRID_X[0] - ROAD_HALF;
    const xMax = GRID_X[GRID_X.length - 1] + ROAD_HALF;
    for (const x of GRID_X) this.rect(x - ROAD_HALF - 1, zMin - 1, x + ROAD_HALF + 1, zMax + 1, '#d2c9b9');
    for (const z of GRID_Z) this.rect(xMin - 1, z - ROAD_HALF - 1, xMax + 1, z + ROAD_HALF + 1, '#d2c9b9');
    for (const x of GRID_X) this.rect(x - ROAD_HALF, zMin, x + ROAD_HALF, zMax, '#fffdf8');
    for (const z of GRID_Z) this.rect(xMin, z - ROAD_HALF, xMax, z + ROAD_HALF, '#fffdf8');
    // Pier, wheel and lighthouse.
    this.rect(SHORE.promenadeEnd, -PIER.halfWidth, PIER.maxX, PIER.halfWidth, '#b98a5e');
    const [wx, wy] = this.toMap(384, 0);
    ctx.strokeStyle = '#ff6fb1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wx, wy, 13, 0, Math.PI * 2);
    ctx.stroke();
    const [lx, ly] = this.toMap(300, -332);
    ctx.fillStyle = '#9b8f80';
    ctx.beginPath();
    ctx.arc(lx, ly, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c1121f';
    ctx.beginPath();
    ctx.arc(lx, ly, 6, 0, Math.PI * 2);
    ctx.fill();
    // Ship at the quay.
    this.rect(-150, 295, -20, 317, '#1d3557');
  }
}

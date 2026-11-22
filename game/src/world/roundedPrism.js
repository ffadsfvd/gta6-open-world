// A building mass with rounded corners: a rounded-rectangle footprint extruded upward, its walls
// tiled with a facade texture in metres (so windows line up with the square buildings) and its
// roof painted from a solid corner of the texture. Streamline-moderne hotels and round towers.
import * as THREE from 'three';

const ROOF = new THREE.Color();
const WALL = new THREE.Color();

/**
 * Adds to `builder` a prism over the footprint (minX..maxX, minZ..maxZ) from y0 up `height`,
 * corners rounded by `radius`. `tile` [w, h] tiles the walls; `grow` widens it (cornices).
 */
export function addRoundedPrism(builder, footprint, y0, height, color, options = {}) {
  const { tile = null, topColor = color, radius = 3, grow = 0, solidUV = [0.01, 0.01], vStart = 0 } = options;
  const x0 = footprint.minX - grow;
  const x1 = footprint.maxX + grow;
  const z0 = footprint.minZ - grow;
  const z1 = footprint.maxZ + grow;
  const r = Math.max(0.2, Math.min(radius + grow, (x1 - x0) / 2 - 0.05, (z1 - z0) / 2 - 0.05));
  // The shape lies in (x, -z); extruding along +Z and turning it upright stands it on the ground.
  const shape = new THREE.Shape();
  shape.moveTo(x0 + r, -z1);
  shape.lineTo(x1 - r, -z1);
  shape.absarc(x1 - r, -z1 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x1, -z0 - r);
  shape.absarc(x1 - r, -z0 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x0 + r, -z0);
  shape.absarc(x0 + r, -z0 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, -z1 + r);
  shape.absarc(x0 + r, -z1 + r, r, Math.PI, Math.PI * 1.5, false);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 7 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0, 0);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const colors = new Float32Array(position.count * 3);
  ROOF.set(topColor);
  WALL.set(color);
  for (let i = 0; i < position.count; i += 1) {
    const ny = normal.getY(i);
    const target = Math.abs(ny) > 0.5 ? ROOF : WALL;
    colors[i * 3] = target.r;
    colors[i * 3 + 1] = target.g;
    colors[i * 3 + 2] = target.b;
    if (Math.abs(ny) > 0.5 || !tile) {
      uv.setXY(i, solidUV[0], solidUV[1]);
      continue;
    }
    // Along the wall in metres, whichever way it faces; up the wall from the base.
    const along = position.getX(i) * Math.abs(normal.getZ(i)) + position.getZ(i) * Math.abs(normal.getX(i));
    uv.setXY(i, along / tile[0], vStart + (position.getY(i) - y0) / tile[1]);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  builder.addGeometry(geometry, new THREE.Matrix4(), '#ffffff');
  geometry.dispose();
}

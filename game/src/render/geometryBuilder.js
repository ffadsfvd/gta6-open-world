// Builds one merged BufferGeometry from many boxes, quads and primitive shapes, each with its
// own vertex colour and UVs, so a whole city block draws in a handful of calls.
import * as THREE from 'three';

const tempColor = new THREE.Color();
const tempVector = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();
const normalMatrix = new THREE.Matrix3();

// Each box face: origin corner, u axis, v axis (normal = u x v), as multiples of the half sizes.
const BOX_FACES = [
  { o: [1, -1, 1], u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0], w: 'z', h: 'y', side: true },
  { o: [-1, -1, -1], u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0], w: 'z', h: 'y', side: true },
  { o: [-1, -1, 1], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], w: 'x', h: 'y', side: true },
  { o: [1, -1, -1], u: [-1, 0, 0], v: [0, 1, 0], n: [0, 0, -1], w: 'x', h: 'y', side: true },
  { o: [-1, 1, 1], u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0], w: 'x', h: 'z', side: false, top: true },
  { o: [-1, -1, -1], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], w: 'x', h: 'z', side: false },
];

function toColor(color) {
  if (color instanceof THREE.Color) return color;
  return tempColor.set(color);
}

export class GeometryBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  get isEmpty() {
    return this.vertexCount === 0;
  }

  pushVertex(x, y, z, nx, ny, nz, u, v, color) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.colors.push(color.r, color.g, color.b);
    this.vertexCount += 1;
  }

  /** A quad from corner `o` along axes `u` and `v` (world vectors with length), normal u x v. */
  addQuad(o, u, v, color, uv = [0, 0, 1, 1]) {
    const c = toColor(color);
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];
    const length = Math.hypot(nx, ny, nz) || 1;
    const base = this.vertexCount;
    this.pushVertex(o[0], o[1], o[2], nx / length, ny / length, nz / length, uv[0], uv[1], c);
    this.pushVertex(o[0] + u[0], o[1] + u[1], o[2] + u[2], nx / length, ny / length, nz / length, uv[2], uv[1], c);
    this.pushVertex(o[0] + u[0] + v[0], o[1] + u[1] + v[1], o[2] + u[2] + v[2], nx / length, ny / length, nz / length, uv[2], uv[3], c);
    this.pushVertex(o[0] + v[0], o[1] + v[1], o[2] + v[2], nx / length, ny / length, nz / length, uv[0], uv[3], c);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** A flat horizontal rectangle at height y, facing up. */
  addFloor(minX, minZ, maxX, maxZ, y, color, uvScale = 0) {
    const uv = uvScale > 0 ? [minX / uvScale, -maxZ / uvScale, maxX / uvScale, -minZ / uvScale] : [0, 0, 1, 1];
    this.addQuad([minX, y, maxZ], [maxX - minX, 0, 0], [0, 0, minZ - maxZ], color, uv);
  }

  /**
   * An axis-aligned box (optionally turned by `yaw` about its centre). Side faces tile their UVs
   * every `tile` metres ([width, height]) starting at `vStart`; top and bottom faces sample `solidUV`.
   */
  addBox(cx, cy, cz, sx, sy, sz, color, options = {}) {
    const c = toColor(color).clone();
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const half = { x: hx, y: hy, z: hz };
    const tile = options.tile;
    const solid = options.solidUV ?? [0.01, 0.01];
    const yaw = options.yaw ?? 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const skipBottom = options.skipBottom ?? true;
    const topColor = options.topColor !== undefined ? toColor(options.topColor).clone() : c;
    for (let index = 0; index < BOX_FACES.length; index += 1) {
      const face = BOX_FACES[index];
      if (!face.side && !face.top && skipBottom) continue;
      const width = half[face.w] * 2;
      const height = half[face.h] * 2;
      let uv;
      if (face.side && tile) {
        const vStart = options.vStart ?? 0;
        const uStart = options.uOffset ?? 0;
        uv = [uStart, vStart, uStart + width / tile[0], vStart + height / tile[1]];
      } else if (face.side && options.faceUV) {
        uv = options.faceUV;
      } else {
        uv = [solid[0], solid[1], solid[0], solid[1]];
      }
      const o = [face.o[0] * hx, face.o[1] * hy, face.o[2] * hz];
      const u = [face.u[0] * width, face.u[1] * width, face.u[2] * width];
      const v = [face.v[0] * height, face.v[1] * height, face.v[2] * height];
      // Turn about Y, then move to the centre.
      const ro = [o[0] * cos + o[2] * sin + cx, o[1] + cy, -o[0] * sin + o[2] * cos + cz];
      const ru = [u[0] * cos + u[2] * sin, u[1], -u[0] * sin + u[2] * cos];
      const rv = [v[0] * cos + v[2] * sin, v[1], -v[0] * sin + v[2] * cos];
      this.addQuad(ro, ru, rv, face.top ? topColor : c, uv);
    }
  }

  /** Merges any three.js geometry, transformed by `matrix`, painted one colour. */
  addGeometry(geometry, matrix, color, uvOverride = null) {
    const c = toColor(color).clone();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const vertexColor = geometry.getAttribute('color');
    normalMatrix.getNormalMatrix(matrix);
    const base = this.vertexCount;
    for (let index = 0; index < position.count; index += 1) {
      tempVector.fromBufferAttribute(position, index).applyMatrix4(matrix);
      if (normal) tempNormal.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
      else tempNormal.set(0, 1, 0);
      let vc = c;
      if (vertexColor) {
        vc = tempColor.setRGB(vertexColor.getX(index) * c.r, vertexColor.getY(index) * c.g, vertexColor.getZ(index) * c.b);
      }
      const u = uvOverride ? uvOverride[0] : uv ? uv.getX(index) : 0;
      const v = uvOverride ? uvOverride[1] : uv ? uv.getY(index) : 0;
      this.pushVertex(tempVector.x, tempVector.y, tempVector.z, tempNormal.x, tempNormal.y, tempNormal.z, u, v, vc);
    }
    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 1) this.indices.push(base + index.getX(i));
    } else {
      for (let i = 0; i < position.count; i += 1) this.indices.push(base + i);
    }
  }

  /** Convenience: a primitive placed at (x, y, z), turned by yaw, scaled. */
  addShape(geometry, x, y, z, color, yaw = 0, scale = 1, uvOverride = null) {
    tempMatrix.makeRotationY(yaw);
    if (scale !== 1) tempMatrix.scale(tempVector.set(scale, scale, scale));
    tempMatrix.setPosition(x, y, z);
    this.addGeometry(geometry, tempMatrix, color, uvOverride);
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : new THREE.Uint16BufferAttribute(this.indices, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

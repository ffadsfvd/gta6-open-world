// Collects geometry per material while a part of the world is built, then turns each bucket
// into one mesh. One bucket set per city block keeps draw calls low and culling useful.
import * as THREE from 'three';
import { GeometryBuilder } from './geometryBuilder.js';

export class MeshBuckets {
  constructor() {
    this.builders = new Map();
  }

  get(key) {
    let builder = this.builders.get(key);
    if (!builder) {
      builder = new GeometryBuilder();
      this.builders.set(key, builder);
    }
    return builder;
  }

  /** Builds every non-empty bucket into a mesh under `parent`. */
  flush(parent, materials, { castShadow = true, receiveShadow = true, noShadow = [] } = {}) {
    const meshes = [];
    for (const [key, builder] of this.builders) {
      if (builder.isEmpty) continue;
      const material = materials[key];
      if (!material) throw new Error(`No material named ${key}`);
      const mesh = new THREE.Mesh(builder.build(), material);
      mesh.castShadow = castShadow && !noShadow.includes(key);
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.builders.clear();
    return meshes;
  }
}

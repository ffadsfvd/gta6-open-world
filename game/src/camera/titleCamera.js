// The slow scenic drift behind the title screen: a high arc over Sunwheel Beach looking across
// Carmine Strand to the Glasswater towers and the hills.
import * as THREE from 'three';

export class TitleCamera {
  constructor() {
    this.time = 0;
    this.override = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50 };
  }

  update(dt) {
    this.time += dt;
    const angle = 0.35 + Math.sin(this.time * 0.035) * 0.22;
    const radius = 230;
    this.override.position.set(150 + Math.cos(angle) * radius, 52 + Math.sin(this.time * 0.05) * 6, 30 + Math.sin(angle) * radius);
    this.override.target.set(40, 30, -70);
    return this.override;
  }
}

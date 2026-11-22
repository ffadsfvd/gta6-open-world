// Draws every person with instanced meshes per body part (legs bare or in trousers, shorts,
// skirt, pelvis, torso, head, two hair styles, cap, arms, short or long sleeves, guns): skin,
// hair, shirt and trouser colours per instance, posed by the animator.
import * as THREE from 'three';
import { createHumanParts } from './humanModel.js';
import { poseCharacter } from './humanAnimator.js';

const CAPACITY = 170;
const DRAW_DISTANCE = 230;
const tempColor = new THREE.Color();
const flashColor = new THREE.Color('#ff3b3b');

export class HumanRenderer {
  constructor(scene) {
    const parts = createHumanParts();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
    const gunMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.6 });
    const make = (geometry, count, mat = material) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, count);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    };
    this.meshes = {
      leg: make(parts.leg, CAPACITY * 2),
      bareLeg: make(parts.bareLeg, CAPACITY),
      shorts: make(parts.shorts, CAPACITY),
      skirt: make(parts.skirt, CAPACITY / 2),
      pelvis: make(parts.pelvis, CAPACITY),
      torso: make(parts.torso, CAPACITY),
      head: make(parts.head, CAPACITY),
      hair: make(parts.hair, CAPACITY),
      longHair: make(parts.longHair, CAPACITY / 2),
      hat: make(parts.hat, CAPACITY),
      arm: make(parts.arm, CAPACITY * 2),
      sleeve: make(parts.sleeve, CAPACITY * 2),
      longSleeve: make(parts.longSleeve, CAPACITY),
      gun: make(parts.gun, CAPACITY, gunMaterial),
      longGun: make(parts.longGun, CAPACITY / 2, gunMaterial),
    };
    this.pose = {
      pelvis: new THREE.Matrix4(), legL: new THREE.Matrix4(), legR: new THREE.Matrix4(),
      torso: new THREE.Matrix4(), head: new THREE.Matrix4(), armL: new THREE.Matrix4(), armR: new THREE.Matrix4(),
    };
    this.vehicleMatrix = new THREE.Matrix4();
    this.counts = {};
  }

  push(name, matrix, color) {
    const mesh = this.meshes[name];
    const index = this.counts[name];
    if (index >= mesh.instanceMatrix.count) return;
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color);
    this.counts[name] = index + 1;
  }

  sync(characters, camera) {
    for (const name of Object.keys(this.meshes)) this.counts[name] = 0;
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (const character of characters) {
      if (!character.active) continue;
      if ((character.x - cx) ** 2 + (character.z - cz) ** 2 > DRAW_DISTANCE * DRAW_DISTANCE) continue;
      let vehicleMatrix = null;
      if (character.vehicle) {
        const vehicle = character.vehicle;
        if (!vehicle.model.glass) continue;
        const euler = new THREE.Euler(vehicle.pitch, vehicle.yaw, vehicle.roll, 'YXZ');
        this.vehicleMatrix.compose(new THREE.Vector3(vehicle.x, vehicle.y, vehicle.z), new THREE.Quaternion().setFromEuler(euler), new THREE.Vector3(1, 1, 1));
        vehicleMatrix = this.vehicleMatrix;
      }
      poseCharacter(character, this.pose, vehicleMatrix);
      const look = character.appearance;
      const pose = this.pose;
      const shirt = character.hitFlash > 0 ? tempColor.set(look.shirt).lerp(flashColor, character.hitFlash * 2) : tempColor.set(look.shirt);
      this.push('torso', pose.torso, shirt);
      const sleeve = look.sleeves === 'long' ? 'longSleeve' : 'sleeve';
      this.push(sleeve, pose.armL, shirt);
      this.push(sleeve, pose.armR, shirt);
      tempColor.set(look.pants);
      this.push('pelvis', pose.pelvis, tempColor);
      if (look.legs === 'skirt') this.push('skirt', pose.pelvis, tempColor);
      if (look.legs === 'shorts') {
        this.push('shorts', pose.legL, tempColor);
        this.push('shorts', pose.legR, tempColor);
      }
      if (look.legs === 'shorts' || look.legs === 'skirt') {
        tempColor.set(look.skin);
        this.push('bareLeg', pose.legL, tempColor);
        this.push('bareLeg', pose.legR, tempColor);
      } else {
        this.push('leg', pose.legL, tempColor);
        this.push('leg', pose.legR, tempColor);
      }
      tempColor.set(look.skin);
      this.push('head', pose.head, tempColor);
      this.push('arm', pose.armL, tempColor);
      this.push('arm', pose.armR, tempColor);
      if (look.hat) this.push('hat', pose.head, tempColor.set(look.hat));
      if (!look.bald) this.push(look.hairStyle === 'long' ? 'longHair' : 'hair', pose.head, tempColor.set(look.hair));
      if (character.weapon === 'pistol' || character.weapon === 'smg') this.push('gun', pose.armR, tempColor.set('#ffffff'));
      else if (character.weapon === 'shotgun' || character.weapon === 'rifle') this.push('longGun', pose.armR, tempColor.set('#ffffff'));
    }
    for (const [name, mesh] of Object.entries(this.meshes)) {
      mesh.count = this.counts[name];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

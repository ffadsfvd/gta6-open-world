// Draws every vehicle with instancing: per model a painted body, trim and tinted glass mesh,
// one shared wheel mesh that steers and spins, and the glows of head, brake and police lights.
import * as THREE from 'three';
import { createWheelGeometry, getVehicleModels } from './vehicleModels.js';

const CAPACITY = 36;
const tempMatrix = new THREE.Matrix4();
const wheelMatrix = new THREE.Matrix4();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tempPosition = new THREE.Vector3();
const tempScale = new THREE.Vector3(1, 1, 1);
const tempColor = new THREE.Color();
const burnt = new THREE.Color('#1c1a19');
const lampPoint = new THREE.Vector3();

export class VehicleRenderer {
  constructor(scene) {
    this.models = getVehicleModels();
    // Clear-coated paint; the windows are dark vertex colours in the same mesh, so they catch
    // the sky in the clear coat like real glass.
    this.paintMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.34, metalness: 0.45, clearcoat: 0.85, clearcoatRoughness: 0.1, envMapIntensity: 1.3,
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45 });
    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: '#1a2833', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.7, envMapIntensity: 1.7,
    });
    this.groups = {};
    for (const [type, model] of Object.entries(this.models)) {
      const paint = new THREE.InstancedMesh(model.paint, this.paintMaterial, CAPACITY);
      paint.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3).fill(1), 3);
      const trim = new THREE.InstancedMesh(model.trim, this.trimMaterial, CAPACITY);
      const glass = model.glass ? new THREE.InstancedMesh(model.glass, this.glassMaterial, CAPACITY) : null;
      for (const mesh of [paint, trim, glass]) {
        if (!mesh) continue;
        mesh.count = 0;
        mesh.castShadow = mesh !== glass;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
      }
      this.groups[type] = { paint, trim, glass, count: 0 };
    }
    this.wheels = new THREE.InstancedMesh(createWheelGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.5 }), CAPACITY * 9 * 4);
    this.wheels.count = 0;
    this.wheels.castShadow = true;
    this.wheels.frustumCulled = false;
    scene.add(this.wheels);
  }

  /** Writes this frame's instances for all active vehicles and their light glows. */
  sync(vehicles, glow, time, pools = null, night = 0) {
    for (const group of Object.values(this.groups)) group.count = 0;
    let wheelCount = 0;
    // Headlights grow from parking glows by day to bright lamps with beams on the road at night.
    const headSize = 0.9 + night * 0.9;
    const headPower = 0.9 + night * 1.6;
    for (const vehicle of vehicles) {
      if (!vehicle.active) continue;
      const group = this.groups[vehicle.type];
      if (group.count >= CAPACITY) continue;
      const index = group.count;
      group.count += 1;
      tempEuler.set(vehicle.pitch, vehicle.yaw, vehicle.roll, 'YXZ');
      tempQuaternion.setFromEuler(tempEuler);
      tempPosition.set(vehicle.x, vehicle.y, vehicle.z);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);
      group.paint.setMatrixAt(index, tempMatrix);
      group.trim.setMatrixAt(index, tempMatrix);
      if (group.glass) group.glass.setMatrixAt(index, tempMatrix);
      const wear = 1 - vehicle.healthShare;
      tempColor.copy(vehicle.paint).multiplyScalar(1 - wear * 0.35);
      if (vehicle.destroyed) tempColor.copy(burnt);
      group.paint.setColorAt(index, tempColor);
      const model = vehicle.model;
      const radius = vehicle.spec.wheelRadius;
      for (const [wx, wz, front] of model.wheels) {
        if (wheelCount >= this.wheels.instanceMatrix.count) break;
        tempEuler.set(vehicle.destroyed ? 0 : vehicle.wheelSpin, front ? vehicle.steerAngle : 0, 0, 'YXZ');
        tempQuaternion.setFromEuler(tempEuler);
        tempPosition.set(wx, radius, wz);
        wheelMatrix.compose(tempPosition, tempQuaternion, tempScale.set(1, radius, radius));
        wheelMatrix.premultiply(tempMatrix);
        this.wheels.setMatrixAt(wheelCount, wheelMatrix);
        wheelCount += 1;
      }
      tempScale.set(1, 1, 1);
      if (vehicle.destroyed) continue;
      const lit = vehicle.engineOn || vehicle.driver;
      if (lit) {
        for (const [lx, ly, lz] of model.lights.heads) {
          lampPoint.set(lx, ly, lz).applyMatrix4(tempMatrix);
          glow.add(lampPoint.x, lampPoint.y, lampPoint.z, headSize, headPower, headPower * 0.92, headPower * 0.68);
        }
        if (pools && night > 0.15) {
          // One soft beam on the road ahead of the car.
          const reach = vehicle.halfLength + 7.5;
          const beam = night * 0.55;
          pools.add(vehicle.x + Math.sin(vehicle.yaw) * reach, vehicle.y + 0.04, vehicle.z + Math.cos(vehicle.yaw) * reach, 7, 15, vehicle.yaw, beam, beam * 0.9, beam * 0.7);
        }
        const brake = vehicle.brakeLight ? 1 : 0.35;
        for (const [lx, ly, lz] of model.lights.tails) {
          lampPoint.set(lx, ly, lz).applyMatrix4(tempMatrix);
          glow.add(lampPoint.x, lampPoint.y, lampPoint.z, (vehicle.brakeLight ? 1.3 : 0.7) * (1 + night * 0.4), 0.95 * brake, 0.04 * brake, 0.03 * brake);
        }
      }
      if (vehicle.siren) {
        const phase = Math.floor(time * 7 + vehicle.id * 0.5) % 2;
        model.lights.bars.forEach(([lx, ly, lz, color], barIndex) => {
          const on = (barIndex === 0) === (phase === 0);
          lampPoint.set(lx, ly, lz).applyMatrix4(tempMatrix);
          if (color === 'red') glow.add(lampPoint.x, lampPoint.y, lampPoint.z, on ? 4.6 : 1.3, on ? 2.2 : 0.4, 0.06, 0.06);
          else glow.add(lampPoint.x, lampPoint.y, lampPoint.z, on ? 4.6 : 1.3, 0.06, on ? 0.35 : 0.06, on ? 2.6 : 0.45);
        });
        if (pools) {
          // The flashers wash the street around the cruiser red, then blue.
          const wash = 0.2 + night * 0.75;
          if (phase === 0) pools.add(vehicle.x, vehicle.y + 0.04, vehicle.z, 13, 13, 0, 0.9 * wash, 0.05 * wash, 0.06 * wash);
          else pools.add(vehicle.x, vehicle.y + 0.04, vehicle.z, 13, 13, 0, 0.05 * wash, 0.16 * wash, 1.1 * wash);
        }
      }
    }
    for (const group of Object.values(this.groups)) {
      for (const mesh of [group.paint, group.trim, group.glass]) {
        if (!mesh) continue;
        mesh.count = group.count;
        mesh.instanceMatrix.needsUpdate = true;
      }
      group.paint.instanceColor.needsUpdate = true;
    }
    this.wheels.count = wheelCount;
    this.wheels.instanceMatrix.needsUpdate = true;
  }
}

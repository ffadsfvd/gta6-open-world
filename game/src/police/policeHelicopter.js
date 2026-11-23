// The police helicopter: from four stars an OBPD helicopter flies in, circles above the suspect
// with a lag and sweeps its searchlight over where it last saw him. It spots Kai only inside
// the light, so outrunning the beam or ducking out of it still lets him get away. It leaves when
// the heat drops. Drawn as one small model: fuselage, tail boom, skids and spinning rotors.
import * as THREE from 'three';
import { GeometryBuilder } from '../render/geometryBuilder.js';

const ALTITUDE = 38;
const ORBIT = 22;
const CRUISE = 26;
const SPOT_RADIUS = 6.5;
const SIGHT_RADIUS = 14;
const ARRIVE_LEVEL = 4;

function bodyGeometry() {
  const b = new GeometryBuilder();
  const m = new THREE.Matrix4();
  const sphere = new THREE.SphereGeometry(1, 16, 10);
  m.makeScale(1.25, 1.15, 2.4).setPosition(0, 0, 0.4);
  b.addGeometry(sphere, m, '#f2f4f7');
  m.makeScale(1.0, 0.55, 1.7).setPosition(0, -0.5, 0.5);
  b.addGeometry(sphere, m, '#16243f');
  m.makeScale(0.92, 0.62, 1.1).setPosition(0, 0.28, 1.65);
  b.addGeometry(sphere, m, '#0d1520');
  const boom = new THREE.CylinderGeometry(0.22, 0.38, 5.2, 10);
  m.makeRotationX(Math.PI / 2).setPosition(0, 0.35, -3.6);
  b.addGeometry(boom, m, '#f2f4f7');
  b.addBox(0, 1.05, -5.9, 0.12, 1.5, 0.75, '#16243f', { skipBottom: false });
  b.addBox(0, 0.4, -5.6, 1.8, 0.08, 0.5, '#16243f', { skipBottom: false });
  b.addBox(0, 1.25, 0.1, 0.5, 0.35, 1.1, '#2b2f36', { skipBottom: false });
  for (const side of [-1, 1]) {
    b.addBox(side * 0.95, -1.5, 0.4, 0.09, 0.09, 3.6, '#2b2f36', { skipBottom: false });
    b.addBox(side * 0.75, -1.15, 1.2, 0.07, 0.7, 0.07, '#2b2f36', { skipBottom: false });
    b.addBox(side * 0.75, -1.15, -0.4, 0.07, 0.7, 0.07, '#2b2f36', { skipBottom: false });
  }
  const lamp = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 10);
  m.makeRotationX(Math.PI / 2).setPosition(0, -1.0, 2.25);
  b.addGeometry(lamp, m, '#e8e8e8');
  return b.build();
}

function rotorGeometry(length, width) {
  const b = new GeometryBuilder();
  b.addBox(0, 0, 0, length, 0.05, width, '#1b1d21', { skipBottom: false });
  b.addBox(0, 0, 0, width, 0.05, length, '#1b1d21', { skipBottom: false });
  return b.build();
}

/** A soft additive cone for the searchlight beam, apex at the origin pointing down -Y. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uStrength: { value: 0.3 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vAlong = -position.y;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-view.xyz);
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.6);
        float fade = smoothstep(0.0, 0.06, vAlong) * (1.0 - 0.55 * vAlong);
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.85) * rim * fade * uStrength, 1.0);
      }`,
  });
}

export class PoliceHelicopter {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 });
    this.body = new THREE.Mesh(bodyGeometry(), paint);
    this.body.castShadow = true;
    this.rotor = new THREE.Mesh(rotorGeometry(11, 0.32), paint);
    this.rotor.position.set(0, 1.55, 0.1);
    this.tailRotor = new THREE.Mesh(rotorGeometry(1.7, 0.14), paint);
    this.tailRotor.rotation.z = Math.PI / 2;
    this.tailRotor.position.set(0.2, 1.05, -5.9);
    this.group.add(this.body, this.rotor, this.tailRotor);
    // The beam is a unit cone (height 1, apex at the top) scaled to reach the ground.
    const cone = new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0);
    this.beam = new THREE.Mesh(cone, beamMaterial());
    this.beam.renderOrder = 6;
    this.beam.frustumCulled = false;
    game.scene.add(this.beam);
    this.group.visible = false;
    this.beam.visible = false;
    game.scene.add(this.group);
    this.active = false;
    this.leaving = false;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.spot = new THREE.Vector3();
    this.angle = 0;
    this.yaw = 0;
    this.seesPlayer = false;
    game.events.on('wantedChanged', (e) => {
      if (e.level >= ARRIVE_LEVEL && !this.active) this.arrive();
      if (e.level < ARRIVE_LEVEL && this.active) this.leaving = true;
    });
  }

  /** Flies in from the direction of the police station, high over the rooftops. */
  arrive() {
    const player = this.game.player.character;
    const from = Math.atan2(-120 - player.z, -169 - player.x);
    this.position.set(player.x + Math.cos(from) * 190, ALTITUDE + 12, player.z + Math.sin(from) * 190);
    this.velocity.set(0, 0, 0);
    this.spot.set(player.x, 0, player.z);
    this.angle = from;
    this.active = true;
    this.leaving = false;
    this.group.visible = true;
    this.beam.visible = true;
    this.game.events.emit('helicopterArrived', {});
  }

  /** Puts the helicopter at (x, height, z) with its searchlight on (spotX, spotZ) (screenshot scenes). */
  placeAt(x, z, spotX, spotZ, height = ALTITUDE) {
    if (!this.active) this.arrive();
    this.angle = Math.atan2(z - spotZ, x - spotX);
    this.position.set(x, height, z);
    this.velocity.set(0, 0, 0);
    this.yaw = Math.atan2(spotX - x, spotZ - z);
    this.spot.set(spotX, 0, spotZ);
    this.group.position.copy(this.position);
    this.group.rotation.set(0.12, this.yaw, 0, 'YXZ');
  }

  update(dt) {
    if (!this.active) return;
    const game = this.game;
    const player = game.player.character;
    const wanted = game.wanted;
    // Where it wants to be: circling the last place the suspect was seen (or Kai, in the light).
    const focus = this.seesPlayer || !wanted.searching ? player : wanted.lastKnown;
    let goalX;
    let goalZ;
    let goalY = ALTITUDE;
    if (this.leaving) {
      goalX = this.position.x + Math.cos(this.angle) * 300;
      goalZ = this.position.z + Math.sin(this.angle) * 300;
      goalY = ALTITUDE + 30;
    } else {
      this.angle += dt * 0.22;
      goalX = focus.x + Math.cos(this.angle) * ORBIT;
      goalZ = focus.z + Math.sin(this.angle) * ORBIT;
    }
    const dx = goalX - this.position.x;
    const dz = goalZ - this.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const speed = Math.min(CRUISE, distance * 0.9);
    const ease = 1 - Math.exp(-dt * 1.2);
    this.velocity.x += ((dx / distance) * speed - this.velocity.x) * ease;
    this.velocity.z += ((dz / distance) * speed - this.velocity.z) * ease;
    this.velocity.y = (goalY - this.position.y) * 0.8;
    this.position.addScaledVector(this.velocity, dt);
    // Nose into the direction of flight, leaning into it.
    const flat = Math.hypot(this.velocity.x, this.velocity.z);
    if (flat > 2) this.yaw += this.turnToward(Math.atan2(this.velocity.x, this.velocity.z), dt);
    this.group.position.copy(this.position);
    this.group.rotation.set(Math.min(0.28, flat * 0.012), this.yaw, 0, 'YXZ');
    this.rotor.rotation.y += dt * 38;
    this.tailRotor.rotation.x += dt * 52;
    // The searchlight drifts after its target, so a fast car can slip out of it.
    const follow = 1 - Math.exp(-dt * 1.6);
    this.spot.x += (focus.x - this.spot.x) * follow;
    this.spot.z += (focus.z - this.spot.z) * follow;
    this.seesPlayer = !this.leaving && Math.hypot(player.x - this.spot.x, player.z - this.spot.z) < SIGHT_RADIUS;
    if (this.leaving && Math.hypot(this.position.x - player.x, this.position.z - player.z) > 260) this.despawn();
  }

  turnToward(target, dt) {
    const delta = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
    return delta * Math.min(1, dt * 1.5);
  }

  /** What the air unit is doing, in dispatch words (the HUD's police panel reads it). */
  get behaviour() {
    if (this.leaving) return 'Returning to base';
    if (this.seesPlayer) return 'Spotlight on you';
    return this.game.wanted.searching ? 'Sweeping the area' : 'Tracking';
  }

  despawn() {
    this.active = false;
    this.leaving = false;
    this.seesPlayer = false;
    this.group.visible = false;
    this.beam.visible = false;
  }

  /** Beam, ground spot and blinking lights, every frame while it is up. */
  draw(glow, pools, time, night) {
    if (!this.active) return;
    const lamp = new THREE.Vector3(0, -1.05, 2.4).applyEuler(this.group.rotation).add(this.position);
    const ground = this.spot;
    const height = Math.max(1, lamp.y - ground.y);
    const across = Math.hypot(ground.x - lamp.x, ground.z - lamp.z);
    const length = Math.hypot(height, across);
    this.beam.position.copy(lamp);
    this.beam.scale.set(SPOT_RADIUS * 0.9, length, SPOT_RADIUS * 0.9);
    // Point the cone's -Y axis from the lamp at the spot on the ground.
    const direction = new THREE.Vector3(ground.x - lamp.x, ground.y - lamp.y, ground.z - lamp.z).normalize();
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    this.beam.material.uniforms.uStrength.value = 0.2 + night * 0.3;
    const power = 0.18 + night * 1.1;
    pools.add(ground.x, 0.08, ground.z, SPOT_RADIUS * 2.4, SPOT_RADIUS * 2.4, 0, power, power * 0.95, power * 0.82);
    glow.add(lamp.x, lamp.y, lamp.z, 3 + night * 3, 2.2, 2.1, 1.9);
    const blink = Math.floor(time * 2.2) % 2 === 0;
    const tail = new THREE.Vector3(0, 1.7, -6.1).applyEuler(this.group.rotation).add(this.position);
    glow.add(tail.x, tail.y, tail.z, blink ? 1.6 : 0.6, blink ? 2.4 : 0.5, 0.1, 0.1);
    const belly = new THREE.Vector3(0, -0.9, 0).applyEuler(this.group.rotation).add(this.position);
    glow.add(belly.x, belly.y, belly.z, blink ? 0.6 : 1.5, 0.1, 0.25, blink ? 0.5 : 2.4);
  }
}

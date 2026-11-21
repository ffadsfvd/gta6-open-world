// Procedural animation for people: walk and sprint cycles, jumps, aiming, punches, hands up,
// swimming, sitting behind a wheel and lying knocked down. Produces one matrix per body part.
import * as THREE from 'three';
import { clamp, damp } from '../core/mathUtils.js';
import { JOINTS } from './humanModel.js';

const root = new THREE.Matrix4();
const torso = new THREE.Matrix4();
const temp = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const position = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/** Advances the animation clocks of one character. */
export function advanceAnimation(character, dt) {
  const anim = character.anim;
  const speed = Math.hypot(character.vx, character.vz);
  const stride = character.vehicle ? 0 : clamp(speed / 5.5, 0, 1);
  anim.stride = damp(anim.stride, stride, 10, dt);
  anim.phase += speed * dt * (2.4 - Math.min(speed, 8) * 0.12);
  anim.airborne = damp(anim.airborne, character.onGround || character.swimming ? 0 : 1, 12, dt);
  const lying = character.state === 'down' || character.state === 'dead' ? 1 : 0;
  anim.down = damp(anim.down, lying, lying ? 9 : 4, dt);
  anim.aim = damp(anim.aim, character.aimYaw !== null && character.weapon !== 'fists' ? 1 : 0, 14, dt);
  anim.lean = damp(anim.lean, speed > 6.5 ? 0.16 : stride * 0.05, 6, dt);
  character.punchTimer = Math.max(0, character.punchTimer - dt);
  character.recoil = Math.max(0, character.recoil - dt * 6);
  character.hitFlash = Math.max(0, character.hitFlash - dt);
}

function compose(out, parent, x, y, z, pitch, yaw = 0, roll = 0) {
  euler.set(pitch, yaw, roll, 'YXZ');
  quaternion.setFromEuler(euler);
  position.set(x, y, z);
  temp.compose(position, quaternion, ONE);
  out.multiplyMatrices(parent, temp);
}

/**
 * Fills `pose` (an object of Matrix4 per part) for this character. `vehicleMatrix` places a
 * seated driver. Returns false when the character should not be drawn.
 */
export function poseCharacter(character, pose, vehicleMatrix = null) {
  const anim = character.anim;
  const seated = Boolean(character.vehicle);
  let legL = 0;
  let legR = 0;
  let armL = 0.05;
  let armR = 0.05;
  let rollL = 0.09;
  let rollR = 0.09;
  let headPitch = 0;
  const swing = Math.sin(anim.phase) * anim.stride;
  if (seated) {
    root.copy(vehicleMatrix);
    const seat = character.vehicle.model.seat;
    compose(root, root, seat.x, seat.y - JOINTS.hipY, seat.z, 0);
    legL = 1.45;
    legR = 1.45;
    armL = -1.05;
    armR = -1.05;
    rollL = -0.15;
    rollR = -0.15;
  } else {
    const bob = Math.abs(Math.sin(anim.phase)) * 0.05 * anim.stride;
    const lie = anim.down;
    const swimTilt = character.swimming ? 1.25 : 0;
    euler.set(anim.lean * (1 - lie) - lie * (Math.PI / 2) + swimTilt, lie > 0.5 ? character.downYaw : character.yaw, 0, 'YXZ');
    quaternion.setFromEuler(euler);
    position.set(character.x, character.y + bob * (1 - lie) + lie * 0.13 + (character.swimming ? 0.25 : 0), character.z);
    root.compose(position, quaternion, ONE);
    legL = swing * 0.75;
    legR = -swing * 0.75;
    // Arms swing against the leg on their own side.
    armL = swing * 0.65 + 0.05;
    armR = -swing * 0.65 + 0.05;
    if (anim.airborne > 0.05) {
      legL = legL * (1 - anim.airborne) - 0.55 * anim.airborne;
      legR = legR * (1 - anim.airborne) + 0.25 * anim.airborne;
      armL -= 0.5 * anim.airborne;
      armR -= 0.5 * anim.airborne;
    }
    if (character.swimming) {
      armL = -2.4 + Math.sin(anim.phase * 2) * 0.9;
      armR = -2.4 - Math.sin(anim.phase * 2) * 0.9;
    }
    if (character.handsUp) {
      armL = -2.9;
      armR = -2.9;
      rollL = 0.3;
      rollR = 0.3;
    }
    if (anim.aim > 0.01) {
      const aimArm = -Math.PI / 2 - character.aimPitch - character.recoil * 0.25;
      armR = armR * (1 - anim.aim) + aimArm * anim.aim;
      rollR = rollR * (1 - anim.aim) - 0.12 * anim.aim;
      if (character.weapon === 'smg') {
        armL = armL * (1 - anim.aim) + (aimArm + 0.35) * anim.aim;
        rollL = rollL * (1 - anim.aim) - 0.55 * anim.aim;
      }
      headPitch = -character.aimPitch * 0.6 * anim.aim;
    }
    if (character.punchTimer > 0) {
      const t = 1 - character.punchTimer / 0.35;
      armR = -0.35 - Math.sin(t * Math.PI) * 1.25;
      rollR = -0.2;
    }
    if (lie > 0.01) {
      rollL = rollL * (1 - lie) + 1.1 * lie;
      rollR = rollR * (1 - lie) + 1.1 * lie;
      armL *= 1 - lie;
      armR *= 1 - lie;
      legL = legL * (1 - lie) + 0.12 * lie;
      legR = legR * (1 - lie) - 0.12 * lie;
    }
  }
  compose(pose.pelvis, root, 0, JOINTS.pelvisY, 0, 0);
  compose(pose.legL, root, JOINTS.hipX, JOINTS.hipY, 0, -legL, 0, 0.02);
  compose(pose.legR, root, -JOINTS.hipX, JOINTS.hipY, 0, -legR, 0, -0.02);
  compose(torso, root, 0, JOINTS.waistY, 0, 0);
  compose(pose.torso, torso, 0, 0, 0, 0);
  compose(pose.head, torso, 0, JOINTS.neckY, 0, headPitch);
  compose(pose.armL, torso, JOINTS.shoulderX, JOINTS.shoulderY, 0, armL, 0, rollL);
  compose(pose.armR, torso, -JOINTS.shoulderX, JOINTS.shoulderY, 0, armR, 0, -rollR);
  return true;
}

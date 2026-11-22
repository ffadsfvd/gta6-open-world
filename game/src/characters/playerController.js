// Turns keyboard and mouse into the player's actions: run, sprint, jump and aim relative to
// the camera; enter any car with F (pulling the driver out), drive it, bail out at speed.
// While the player drives a car, the car belongs to the keyboard: no AI may steer it.
import { PLAYER_TUNING, CAMERA_TUNING } from '../core/config.js';
import { approach } from '../core/mathUtils.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
import { nearestCorner } from '../ai/sidewalkPaths.js';
import { groundHeight } from '../world/terrain.js';

const ENTER_RANGE = 4.5;
const DODGE_TIME = 0.55;
const DODGE_SPEED = 8.5;

export class PlayerController {
  constructor(game, character) {
    this.game = game;
    this.character = character;
    this.steer = 0;
    this.enabled = true;
    this.sensitivity = CAMERA_TUNING.mouseSensitivity;
    this.invertY = false;
    this.aiming = false;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const camera = game.followCamera;
    const mouse = input.takeMouse();
    this.dodgeCooldown = Math.max(0, (this.dodgeCooldown ?? 0) - dt);
    if (!this.enabled) return;
    camera.look(mouse.x, mouse.y, this.sensitivity, this.invertY);
    if (this.character.vehicle) this.updateDriving(dt);
    else this.updateOnFoot(dt);
  }

  updateOnFoot(dt) {
    const game = this.game;
    const input = game.input;
    const character = this.character;
    if (!character.canAct) {
      character.setMove(0, 0, 0);
      character.aimYaw = null;
      return;
    }
    const camYaw = game.followCamera.yaw;
    const forward = input.axis('back', 'forward');
    const strafe = input.axis('left', 'right');
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const dx = fx * forward - fz * strafe;
    const dz = fz * forward + fx * strafe;
    const armed = character.weapon !== 'fists';
    const aiming = input.isDown('aim') && armed;
    this.aiming = aiming;
    if (this.dodge || (input.wasPressed('dodge') && character.onGround && !character.swimming && !(this.dodgeCooldown > 0))) {
      this.updateDodge(dt, dx, dz, -fz, fx);
      return;
    }
    let speed = input.isDown('sprint') ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.runSpeed;
    if (aiming) speed = PLAYER_TUNING.walkSpeed;
    character.setMove(dx, dz, speed);
    character.aimYaw = aiming ? camYaw : null;
    character.aimPitch = aiming ? Math.max(-0.6, Math.min(0.6, -(game.followCamera.pitch - 0.12))) : 0;
    if (input.wasPressed('jump') && character.onGround && !character.swimming) {
      character.vy = PLAYER_TUNING.jumpSpeed;
      character.onGround = false;
    }
    if (input.wasPressed('enterVehicle')) this.tryEnterVehicle();
  }

  /**
   * A dive roll (X): a quick burst the way Kai is moving (to the right if he stands still),
   * during which bullets and fists miss him. Then a short recovery before the next one.
   */
  updateDodge(dt, dx, dz, rightX, rightZ) {
    const character = this.character;
    if (!this.dodge) {
      if (this.dodgeCooldown > 0) return;
      const length = Math.hypot(dx, dz);
      const x = length > 0.1 ? dx / length : rightX;
      const z = length > 0.1 ? dz / length : rightZ;
      this.dodge = { time: DODGE_TIME, x, z };
      character.yaw = Math.atan2(x, z);
      character.aimYaw = null;
      this.game.events.emit('dodge', { character });
    }
    const dodge = this.dodge;
    dodge.time -= dt;
    character.dodging = Math.max(0, dodge.time);
    const speed = DODGE_SPEED * (0.55 + 0.45 * (dodge.time / DODGE_TIME));
    character.setMove(dodge.x, dodge.z, speed);
    character.vx = dodge.x * speed;
    character.vz = dodge.z * speed;
    if (dodge.time <= 0) {
      this.dodge = null;
      character.dodging = 0;
      this.dodgeCooldown = 0.35;
    }
  }

  tryEnterVehicle() {
    const game = this.game;
    const character = this.character;
    const vehicle = game.vehicles.nearest(character.x, character.z, ENTER_RANGE, (v) => !v.destroyed && v.sinking === 0 && v.driver !== character);
    if (!vehicle) return false;
    if (vehicle.locked) {
      game.events.emit('notice', { text: 'This vehicle is locked.' });
      return false;
    }
    const victim = vehicle.driver;
    if (victim) this.ejectDriver(vehicle, victim);
    const parked = vehicle.role === 'parked';
    this.enterVehicle(vehicle);
    game.events.emit('vehicleEntered', { vehicle, jacked: Boolean(victim), victim, parked });
    return true;
  }

  /** Pulls an NPC driver out; they become a frightened pedestrian. */
  ejectDriver(vehicle, victim) {
    const game = this.game;
    const side = vehicle.localToWorld(-vehicle.model.door.x, vehicle.model.door.z);
    victim.vehicle = null;
    vehicle.driver = null;
    vehicle.ai = null;
    victim.x = side.x;
    victim.z = side.z;
    victim.y = groundHeight(side.x, side.z);
    victim.kind = vehicle.type === 'police' ? 'police' : 'pedestrian';
    victim.knockDown(-Math.cos(vehicle.yaw) * 3, Math.sin(vehicle.yaw) * 3, 1.4, 1.5);
    const corner = nearestCorner(victim.x, victim.z);
    victim.brain = new PedestrianBrain(victim, game.rng.fork(victim.id), { ...corner, corner: corner.corner });
    victim.brain.scare(this.character.x, this.character.z, 12);
    if (game.population) game.population.walkers.push(victim);
  }

  enterVehicle(vehicle) {
    const character = this.character;
    character.vehicle = vehicle;
    character.brain = null;
    character.setMove(0, 0, 0);
    character.aimYaw = null;
    character.handsUp = false;
    vehicle.driver = character;
    vehicle.ai = null;
    vehicle.engineOn = true;
    vehicle.clearControls();
    if (vehicle.role !== 'mission') vehicle.role = 'player';
    vehicle.siren = false;
    this.steer = 0;
  }

  exitVehicle() {
    const game = this.game;
    const character = this.character;
    const vehicle = character.vehicle;
    if (!vehicle) return;
    let door = vehicle.doorPosition();
    const blocked = game.collision.query(door.x - 0.3, door.z - 0.3, door.x + 0.3, door.z + 0.3).length > 0;
    if (blocked) door = vehicle.localToWorld(-vehicle.model.door.x, vehicle.model.door.z);
    const speed = vehicle.speed;
    character.vehicle = null;
    vehicle.driver = null;
    vehicle.clearControls();
    vehicle.controls.handbrake = speed < 9;
    vehicle.horn = false;
    character.x = door.x;
    character.z = door.z;
    character.y = groundHeight(door.x, door.z);
    character.yaw = vehicle.yaw;
    character.vx = vehicle.vx * 0.6;
    character.vz = vehicle.vz * 0.6;
    this.steer = 0;
    game.followCamera.lookBack = false;
    if (speed > 9) {
      character.knockDown(vehicle.vx * 0.7, vehicle.vz * 0.7, 1.5, 2);
      character.takeDamage(Math.min(25, speed * 0.9));
    }
    game.events.emit('vehicleExited', { vehicle, bailed: speed > 9 });
  }

  /**
   * Stands Kai at a spot ({ x, z, yaw }) as if he had just walked there: on his feet, still,
   * nothing left over from a fall, a fight or a car, and the camera behind him.
   */
  placeAt(spot) {
    const character = this.character;
    if (character.vehicle) this.exitVehicle();
    character.x = spot.x;
    character.z = spot.z;
    character.y = groundHeight(spot.x, spot.z);
    character.yaw = spot.yaw;
    character.vx = 0;
    character.vy = 0;
    character.vz = 0;
    character.onGround = true;
    character.swimming = false;
    character.state = 'idle';
    character.downTimer = 0;
    character.handsUp = false;
    character.aimYaw = null;
    character.brain = null;
    character.punchTimer = 0;
    character.recoil = 0;
    character.dodging = 0;
    this.dodge = null;
    character.anim.down = 0;
    character.anim.airborne = 0;
    character.setMove(0, 0, 0);
    this.steer = 0;
    this.aiming = false;
    this.game.followCamera.lookBack = false;
    this.game.followCamera.snapBehind(spot.yaw, 0.18);
  }

  updateDriving(dt) {
    const game = this.game;
    const input = game.input;
    const vehicle = this.character.vehicle;
    const controls = vehicle.controls;
    const speed = Math.abs(vehicle.forwardSpeed);
    const wanted = input.axis('left', 'right');
    // Keyboard steering eases in (more gently the faster the car goes) and snaps back to centre.
    const turningBack = wanted !== 0 && this.steer !== 0 && Math.sign(wanted) !== Math.sign(this.steer);
    const rate = wanted === 0 || turningBack ? 9 : 4.2 - Math.min(speed, 30) * 0.06;
    this.steer = approach(this.steer, wanted, dt * rate);
    controls.steer = this.steer;
    controls.throttle = input.isDown('forward') ? 1 : 0;
    controls.brake = input.isDown('back') ? 1 : 0;
    controls.handbrake = input.isDown('handbrake');
    vehicle.horn = input.isDown('horn');
    game.followCamera.lookBack = input.isDown('lookBack');
    if (input.wasPressed('cameraMode')) game.followCamera.cycleView();
    if (input.wasPressed('radio')) game.audio.nextStation();
    if (input.wasPressed('enterVehicle') && !vehicle.sinking) this.exitVehicle();
    else if (vehicle.destroyed && vehicle.sinking > 0) this.exitVehicle();
  }
}

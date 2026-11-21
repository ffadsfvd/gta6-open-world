// Turns keyboard and mouse into the player's actions: run, sprint, jump and aim relative to
// the camera; enter any car with F (pulling the driver out), drive it, bail out at speed.
import { PLAYER_TUNING, CAMERA_TUNING } from '../core/config.js';
import { approach } from '../core/mathUtils.js';
import { PedestrianBrain } from '../ai/pedestrianBrain.js';
import { nearestCorner } from '../ai/sidewalkPaths.js';
import { groundHeight } from '../world/terrain.js';

const ENTER_RANGE = 4.5;
const LOOK_KEYS_SPEED = 2.2;

export class PlayerController {
  constructor(game, character) {
    this.game = game;
    this.character = character;
    this.steer = 0;
    this.enabled = true;
    this.sensitivity = CAMERA_TUNING.mouseSensitivity;
    this.invertY = false;
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const camera = game.followCamera;
    const mouse = input.takeMouse();
    if (!this.enabled) return;
    camera.look(mouse.x, mouse.y, this.sensitivity, this.invertY);
    const turn = input.axis('lookLeft', 'lookRight');
    const tilt = input.axis('lookUp', 'lookDown');
    if (turn !== 0 || tilt !== 0) camera.look(turn * LOOK_KEYS_SPEED * dt / this.sensitivity, tilt * LOOK_KEYS_SPEED * 0.5 * dt / this.sensitivity, this.sensitivity);
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
    this.enterVehicle(vehicle);
    game.events.emit('vehicleEntered', { vehicle, jacked: Boolean(victim), victim, parked: vehicle.role === 'parked' });
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
    victim.kind = vehicle.role === 'police' ? 'police' : 'pedestrian';
    victim.knockDown(-Math.cos(vehicle.yaw) * 3, Math.sin(vehicle.yaw) * 3, 1.4, 1.5);
    const corner = nearestCorner(victim.x, victim.z);
    victim.brain = new PedestrianBrain(victim, game.rng.fork(victim.id), { ...corner, corner: corner.corner });
    victim.brain.scare(this.character.x, this.character.z, 12);
    if (game.population) game.population.walkers.push(victim);
  }

  enterVehicle(vehicle) {
    const character = this.character;
    character.vehicle = vehicle;
    character.setMove(0, 0, 0);
    character.aimYaw = null;
    character.handsUp = false;
    vehicle.driver = character;
    vehicle.ai = null;
    vehicle.engineOn = true;
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
    if (speed > 9) {
      character.knockDown(vehicle.vx * 0.7, vehicle.vz * 0.7, 1.5, 2);
      character.takeDamage(Math.min(25, speed * 0.9));
    }
    game.events.emit('vehicleExited', { vehicle, bailed: speed > 9 });
  }

  updateDriving(dt) {
    const game = this.game;
    const input = game.input;
    const vehicle = this.character.vehicle;
    const controls = vehicle.controls;
    const wanted = input.axis('left', 'right');
    this.steer = approach(this.steer, wanted, dt * (wanted === 0 ? 6 : 3.6));
    controls.steer = this.steer;
    controls.throttle = input.isDown('forward') ? 1 : 0;
    controls.brake = input.isDown('back') ? 1 : 0;
    controls.handbrake = input.isDown('handbrake');
    vehicle.horn = input.isDown('horn');
    game.followCamera.lookBack = input.isDown('lookBack');
    if (input.wasPressed('cameraMode')) game.followCamera.cycleView();
    if (input.wasPressed('enterVehicle') && !vehicle.sinking) this.exitVehicle();
    if (vehicle.destroyed && vehicle.sinking > 0) this.exitVehicle();
  }
}

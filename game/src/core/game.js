// The game object: builds the renderer, sky, light and city, owns every system (player,
// vehicles, people, traffic, police, combat, missions, HUD, audio) and runs one update and one
// render per animation frame in a fixed order.
import * as THREE from 'three';
import { SUN_DIRECTION, PLAYER_TUNING } from './config.js';
import { createRandom } from './random.js';
import { EventBus } from './events.js';
import { Input } from './input.js';
import { createRenderer } from '../render/renderer.js';
import { Sky, createEnvironmentMap } from '../render/sky.js';
import { Lighting } from '../render/lighting.js';
import { createTextures } from '../render/textures.js';
import { createMaterials } from '../render/materials.js';
import { createSignAtlas } from '../render/signAtlas.js';
import { CollisionWorld } from '../world/collisionWorld.js';
import { buildCity } from '../world/cityBuilder.js';
import { RoadNetwork } from '../ai/roadNetwork.js';
import { VehicleManager } from '../vehicles/vehicleManager.js';
import { CharacterManager } from '../characters/characterManager.js';
import { PlayerController } from '../characters/playerController.js';
import { OUTFITS } from '../characters/appearance.js';
import { PopulationManager } from '../ai/populationManager.js';
import { FollowCamera } from '../camera/followCamera.js';
import { GlowSprites } from '../effects/glowSprites.js';
import { EffectsDirector } from '../effects/effectsDirector.js';
import { CombatSystem } from '../combat/combatSystem.js';
import { WantedSystem } from '../police/wantedSystem.js';
import { PoliceDispatcher } from '../police/policeDispatcher.js';
import { SIGNAL_HEAD_Y } from '../world/trafficSignals.js';
import { PLACES } from '../world/cityPlan.js';

const MAX_DT = 1 / 20;
const SIGNAL_COLORS = { red: [1.4, 0.08, 0.05], yellow: [1.3, 0.75, 0.05], green: [0.1, 1.3, 0.45] };
const SIGNAL_OFFSET = { red: 0.42, yellow: 0, green: -0.42 };

export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.seed = options.seed ?? 20261124;
    this.rng = createRandom(this.seed ^ 0x5eed);
    this.events = new EventBus();
    this.time = 0;
    this.state = 'playing';
    this.timeScale = 1;
  }

  init() {
    const quality = this.options.quality ?? 'high';
    const { renderer, camera } = createRenderer(this.canvas, quality);
    this.renderer = renderer;
    this.camera = camera;
    this.scene = new THREE.Scene();
    const sun = new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z).normalize();
    this.sky = new Sky(this.scene, sun);
    this.scene.environment = createEnvironmentMap(renderer, sun);
    this.scene.environmentIntensity = 0.55;
    this.lighting = new Lighting(this.scene, sun, quality);
    this.textures = createTextures(this.seed);
    this.atlas = createSignAtlas();
    this.materials = createMaterials(this.textures, this.atlas);
    this.collision = new CollisionWorld();
    this.city = buildCity({
      scene: this.scene,
      textures: this.textures,
      materials: this.materials,
      atlas: this.atlas,
      collision: this.collision,
      events: this.events,
      rng: createRandom(this.seed),
    });
    this.input = new Input(this.canvas);
    this.followCamera = new FollowCamera(camera, this.collision);
    this.glow = new GlowSprites(this.scene);
    this.network = new RoadNetwork();
    this.vehicles = new VehicleManager(this);
    this.characters = new CharacterManager(this);
    const start = PLACES.safehouse;
    const hero = this.characters.spawn('player', start.x, start.z, OUTFITS.player, { yaw: -Math.PI / 2 });
    hero.health = PLAYER_TUNING.maxHealth;
    this.player = new PlayerController(this, hero);
    this.population = new PopulationManager(this, this.rng.fork(11));
    this.effects = new EffectsDirector(this);
    this.combat = new CombatSystem(this);
    this.wanted = new WantedSystem(this);
    this.police = new PoliceDispatcher(this);
  }

  /** One simulation step of `dt` seconds. */
  update(dt) {
    this.time += dt;
    this.city.update(dt, this.time);
    if (this.state === 'playing') {
      this.player.update(dt);
      this.combat.update(dt);
      this.population.update(dt);
      this.police.update(dt);
      this.vehicles.update(dt);
      this.characters.update(dt);
      this.wanted.update(dt);
    }
    this.effects.update(dt);
    this.input.endFrame();
  }

  focus() {
    const hero = this.player.character;
    if (hero.vehicle) return { mode: 'vehicle', vehicle: hero.vehicle };
    return { mode: 'foot', x: hero.x, y: hero.y, z: hero.z, aiming: hero.aimYaw !== null, swimming: hero.swimming };
  }

  drawSignals() {
    const signals = this.city.signals;
    const camera = this.camera.position;
    for (const head of signals.heads) {
      if ((head.lampX - camera.x) ** 2 + (head.lampZ - camera.z) ** 2 > 160 * 160) continue;
      const state = signals.state(head.junction, head.axis);
      const [r, g, b] = SIGNAL_COLORS[state];
      this.glow.add(head.lampX, 0.15 + SIGNAL_HEAD_Y + SIGNAL_OFFSET[state], head.lampZ, 0.75, r, g, b);
    }
  }

  render(dt) {
    this.followCamera.update(dt, this.focus());
    const target = this.followCamera.target;
    this.lighting.follow(target.x, target.z);
    this.sky.update(this.camera, this.time);
    this.glow.begin();
    this.drawSignals();
    this.effects.drawGlows(this.glow);
    this.vehicles.render(this.glow, this.time);
    this.characters.render(this.camera);
    this.glow.end();
    this.renderer.render(this.scene, this.camera);
  }

  /** Runs `seconds` of simulation in fixed steps (screenshot scenes, tests). */
  simulate(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) {
      this.update(step);
      if (this.onStep) this.onStep(step);
    }
  }

  start() {
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min((now - last) / 1000, MAX_DT)) * this.timeScale;
      last = now;
      if (this.onFrame) this.onFrame(dt);
      this.update(dt);
      this.render(dt);
    };
    requestAnimationFrame(frame);
  }
}

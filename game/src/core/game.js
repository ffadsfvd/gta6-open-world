// The game object: builds the renderer, sky, light and city, owns every system (player,
// vehicles, people, traffic, police, combat, missions, activities, HUD, menus, audio, saves)
// and moves between title, intro, playing, paused and map, one update and one render a frame.
import * as THREE from 'three';
import { STORYLINE } from '../missions/storyline.js';
import { MissionRunner } from '../missions/missionRunner.js';
import { WantedSystem } from '../police/wantedSystem.js';
import { PoliceDispatcher } from '../police/policeDispatcher.js';
import { VehicleManager } from '../vehicles/vehicleManager.js';
import { ActivityManager } from '../activities/activityManager.js';
import { CombatSystem } from '../combat/combatSystem.js';
import { Hud } from '../ui/hud.js';
import { AudioDirector } from '../audio/audioDirector.js';
import { PopulationManager } from '../ai/populationManager.js';
import { CharacterManager } from '../characters/characterManager.js';
import { PlayerController } from '../characters/playerController.js';
import { PlayerVitals } from '../characters/playerVitals.js';
import { OUTFITS } from '../characters/appearance.js';
import { FullMap } from '../ui/fullMap.js';
import { Menus } from '../ui/menus.js';
import { DialogueBox } from '../ui/dialogueBox.js';
import { Notifications } from '../ui/notifications.js';
import { ShopPanel } from '../ui/shopPanel.js';
import { ScreenEffects } from '../ui/screenEffects.js';
import { MapPainter } from '../ui/mapPainter.js';
import { Progress } from '../progression/progress.js';
import { SaveGame } from '../save/saveGame.js';
import { loadSettings, saveSettings } from '../save/settings.js';
import { WorldMarkers } from '../missions/worldMarkers.js';
import { IntroSequence } from '../missions/introSequence.js';
import { EffectsDirector } from '../effects/effectsDirector.js';
import { GlowSprites } from '../effects/glowSprites.js';
import { FollowCamera } from '../camera/followCamera.js';
import { TitleCamera } from '../camera/titleCamera.js';
import { buildCity } from '../world/cityBuilder.js';
import { CollisionWorld } from '../world/collisionWorld.js';
import { PLACES } from '../world/cityPlan.js';
import { SIGNAL_HEAD_Y } from '../world/trafficSignals.js';
import { RoadNetwork } from '../ai/roadNetwork.js';
import { createRenderer } from '../render/renderer.js';
import { PostProcessing } from '../render/postProcessing.js';
import { Sky, createEnvironmentMap } from '../render/sky.js';
import { Lighting } from '../render/lighting.js';
import { createTextures } from '../render/textures.js';
import { createMaterials } from '../render/materials.js';
import { createSignAtlas } from '../render/signAtlas.js';
import { SUN_DIRECTION, PLAYER_TUNING, CAMERA_TUNING, CITY_NAME } from './config.js';
import { createRandom } from './random.js';
import { EventBus } from './events.js';
import { Input } from './input.js';
import { PlayerFate } from './playerFate.js';

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
    this.state = 'title';
    this.timeScale = 1;
    this.missionLeftovers = [];
    this.cleanupTimer = 0;
    this.settings = loadSettings();
  }

  init() {
    const quality = this.options.quality ?? this.settings.quality;
    const { renderer, camera } = createRenderer(this.canvas, quality);
    this.renderer = renderer;
    this.camera = camera;
    this.post = quality === 'high' ? new PostProcessing(renderer) : null;
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
      scene: this.scene, textures: this.textures, materials: this.materials, atlas: this.atlas,
      collision: this.collision, events: this.events, rng: createRandom(this.seed),
    });
    this.input = new Input(this.canvas);
    // Losing the mouse while playing (Esc, Alt+Tab) pauses; the shop lets it go on purpose.
    this.input.onLockLost = () => {
      if (this.state === 'playing' && !this.shop.isOpen) this.pause();
    };
    this.followCamera = new FollowCamera(camera, this.collision);
    this.titleCamera = new TitleCamera();
    this.glow = new GlowSprites(this.scene);
    this.network = new RoadNetwork();
    this.progress = new Progress(this.events);
    this.vehicles = new VehicleManager(this);
    this.characters = new CharacterManager(this);
    const start = PLACES.start;
    const hero = this.characters.spawn('player', start.x, start.z, OUTFITS.player, { yaw: -Math.PI / 2 });
    hero.health = PLAYER_TUNING.maxHealth;
    this.player = new PlayerController(this, hero);
    this.vitals = new PlayerVitals(this);
    this.population = new PopulationManager(this, this.rng.fork(11));
    this.effects = new EffectsDirector(this);
    this.combat = new CombatSystem(this);
    this.wanted = new WantedSystem(this);
    this.police = new PoliceDispatcher(this);
    this.notifications = new Notifications();
    this.dialogue = new DialogueBox(this.events);
    this.painter = new MapPainter(this.city.plans);
    this.hud = new Hud(this, this.painter);
    this.fullMap = new FullMap(this, this.painter);
    this.missions = new MissionRunner(this);
    this.activities = new ActivityManager(this);
    this.markers = new WorldMarkers(this.scene);
    this.intro = new IntroSequence(this);
    this.save = new SaveGame(this);
    this.shop = new ShopPanel(this);
    this.screenEffects = new ScreenEffects(this.events);
    this.fate = new PlayerFate(this);
    this.audio = new AudioDirector(this);
    this.menus = new Menus(this);
    this.bindFeedback();
    this.applySettings();
    this.population.populateNow();
    this.followCamera.snapBehind(-Math.PI / 2);
  }

  /** Small reactions to events: toasts for money, wanted changes and unlocks; stat counters. */
  bindFeedback() {
    const events = this.events;
    events.on('money', (e) => {
      if (e.amount > 0 && e.reason !== 'tip') this.notifications.toast(`+$${Math.round(e.amount).toLocaleString('en-US')}`, 'cash', 3);
    });
    events.on('wantedChanged', (e) => {
      if (e.level > e.previous) this.progress.record('highestWanted', e.level);
    });
    events.on('wantedEscaped', () => {
      this.progress.bump('copsEscaped');
      this.notifications.toast('You lost the police.', '', 3);
    });
    events.on('vehicleEntered', (e) => {
      if (e.jacked || e.parked) this.progress.bump('carsStolen');
      this.hud.hint(`<b>${e.vehicle.name}</b>`, 2);
    });
    events.on('notice', (e) => this.hud.hint(e.text, 2.5));
    events.on('missionPassed', (e) => {
      if (e.story) this.notifications.toast(`Story ${this.progress.storyIndex}/${STORYLINE.length} complete`, '', 4);
    });
    events.on('storyComplete', () => {
      setTimeout(() => this.notifications.banner('THE END', `${CITY_NAME} is yours. Keep exploring: races, fares, deliveries and sunshells await.`, '', 8), 5000);
    });
  }

  applySettings() {
    const s = this.settings;
    this.audio.setVolumes(s);
    this.player.sensitivity = CAMERA_TUNING.mouseSensitivity * s.sensitivity;
    this.player.invertY = s.invertY;
    saveSettings(s);
  }

  // ----- State changes -----

  showTitle() {
    this.state = 'title';
    this.hud.show(false);
    this.menus.showTitle();
    this.input.wantsLock = false;
  }

  newGame() {
    this.audio.unlock();
    this.progress.reset();
    this.menus.hideTitle();
    this.state = 'intro';
    this.followCamera.override = null;
    this.intro.start(() => {
      this.state = 'playing';
      this.hud.show(true);
      this.input.wantsLock = true;
      this.followCamera.snapBehind(-Math.PI / 2);
      this.hud.hint('Auntie Lou is waiting at her taco truck in <b>Mercado Plaza</b>.<br>Follow the <b>L</b> on your minimap. <kbd>M</kbd> opens the map.', 9);
      this.input.requestLock();
    });
  }

  continueGame() {
    this.audio.unlock();
    this.save.load();
    this.menus.hideTitle();
    this.followCamera.override = null;
    this.state = 'playing';
    this.hud.show(true);
    this.input.wantsLock = true;
    this.population.reset();
    this.notifications.toast(`Welcome back to ${CITY_NAME}.`, '', 3);
    this.input.requestLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.input.releaseAll();
    this.menus.showPause();
  }

  resume() {
    this.menus.hidePause();
    this.fullMap.show(false);
    this.hud.show(true);
    this.state = 'playing';
    // Esc is Chrome's own "let go of the mouse" key: capturing again on it would be undone at
    // once, so after Esc the player clicks to capture (the HUD says so).
    if (!this.input.pressed.has('Escape')) this.input.requestLock();
  }

  openMap() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.menus.hidePause();
    this.state = 'map';
    this.input.releaseLock();
    this.input.releaseAll();
    this.hud.show(false);
    this.fullMap.show(true);
  }

  quitToTitle() {
    window.location.reload();
  }

  // ----- Frame -----

  handleGlobalInput() {
    const input = this.input;
    const before = this.state;
    const shopWasOpen = this.shop.isOpen;
    this.routeGlobalInput(input);
    // A key that opened or closed a menu has done its job: it must not also skip a line of
    // dialogue, start a mission or reopen the shop in the same frame.
    if (this.state !== before || this.shop.isOpen !== shopWasOpen) input.consumePresses();
  }

  routeGlobalInput(input) {
    if (this.state === 'title' || this.state === 'paused') {
      this.menus.handleInput(input);
      return;
    }
    if (this.state === 'map') {
      if (input.wasPressed('map') || input.wasPressed('pause')) this.resume();
      return;
    }
    if (this.state === 'intro') return;
    if (this.shop.isOpen) {
      this.shop.update(input);
      return;
    }
    if (input.wasPressed('pause')) this.pause();
    else if (input.wasPressed('map')) this.openMap();
  }

  /** One simulation step of `dt` seconds. */
  update(dt) {
    this.handleGlobalInput();
    const simulate = this.state === 'playing' || this.state === 'title' || this.state === 'intro';
    if (simulate) {
      this.time += dt;
      this.city.update(dt, this.time);
      if (this.state === 'intro') this.intro.update(dt, this.input);
      if (this.state === 'playing') {
        this.dialogue.update(dt, this.input);
        this.player.update(dt);
        this.combat.update(dt);
        this.missions.update(dt);
        this.activities.update(dt);
        this.fate.update(dt);
        this.vitals.update(dt);
        this.trackStats(dt);
      }
      this.population.update(dt);
      this.police.update(dt);
      this.vehicles.update(dt);
      this.characters.update(dt);
      this.wanted.update(dt);
      this.effects.update(dt);
      this.cleanup(dt);
    }
    this.notifications.update(dt);
    this.input.endFrame();
  }

  trackStats(dt) {
    const vehicle = this.player.character.vehicle;
    if (vehicle) this.progress.bump('distanceDriven', vehicle.speed * dt);
    this.progress.bump('playTime', dt);
  }

  /** Removes leftovers of finished missions once they are far away. */
  cleanup(dt) {
    this.cleanupTimer -= dt;
    if (this.cleanupTimer > 0) return;
    this.cleanupTimer = 2;
    const hero = this.player.character;
    this.missionLeftovers = this.missionLeftovers.filter((thing) => {
      if (!thing.active) return false;
      if (Math.hypot(thing.x - hero.x, thing.z - hero.z) < 140 || thing === hero.vehicle) return true;
      if (thing.halfLength !== undefined) this.vehicles.remove(thing);
      else this.characters.remove(thing);
      return false;
    });
  }

  focus() {
    const hero = this.player.character;
    if (hero.vehicle) return { mode: 'vehicle', vehicle: hero.vehicle };
    return { mode: 'foot', x: hero.x, y: hero.y, z: hero.z, aiming: this.player.aiming && hero.aimYaw !== null, swimming: hero.swimming };
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
    if (this.state === 'title') this.followCamera.override = this.titleCamera.update(dt);
    if (!this.settings.shake) this.followCamera.trauma = 0;
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
    const markers = this.state === 'playing' ? [...this.missions.markers(), ...this.activities.worldMarkers()] : [];
    this.markers.draw(markers, this.time);
    if (this.state === 'playing' || this.state === 'paused') this.hud.update(dt);
    if (this.state === 'map') this.fullMap.draw();
    this.screenEffects.update(dt, this.player.character);
    this.audio.update(dt);
    if (this.post) this.post.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Runs `seconds` of simulation in fixed steps (screenshot scenes, tests). */
  simulate(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) {
      if (this.onStep) this.onStep(step);
      this.update(step);
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

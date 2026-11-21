// Runs missions: offers the next story mission at its contact's marker, plays a mission's steps
// in order, tracks its time limit, spawned people and cars, markers and route, and pays out on
// MISSION PASSED or cleans up on MISSION FAILED (death and arrest fail it too).
import { STORYLINE } from './storyline.js';
import { CAST, CONTACTS } from './cast.js';
import { GangBrain } from '../ai/gangBrain.js';
import { OUTFITS } from '../characters/appearance.js';
import { formatMoney } from '../core/mathUtils.js';
import { groundHeight } from '../world/terrain.js';

const CONTACT_RADIUS = 2.6;

export class MissionRunner {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.contactPeople = {};
    this.cooldown = 0;
    this.frozen = false;
    this.lastPrompt = 0;
    this.retry = null;
    this.retryTimer = 0;
    game.events.on('playerWasted', () => this.fail('You were flatlined.'));
    game.events.on('playerBusted', () => this.fail('You were arrested.'));
  }

  get active() {
    return this.current !== null;
  }

  get ctx() {
    const mission = this.current;
    return { game: this.game, runner: this, mission, vars: mission ? mission.vars : {} };
  }

  /** The next story mission, if its contact is the one asked about. */
  nextStory() {
    return STORYLINE[this.game.progress.storyIndex] ?? null;
  }

  availableContacts() {
    const next = this.nextStory();
    if (!next) return [];
    const contact = CONTACTS[next.giver];
    return [{ ...contact, missionTitle: next.title }];
  }

  /** Keeps the giver of the next story mission standing at their spot. */
  syncContacts() {
    const next = this.nextStory();
    const wanted = next && !this.current ? next.giver : null;
    for (const [id, person] of Object.entries(this.contactPeople)) {
      if (id !== wanted) {
        this.game.characters.remove(person);
        delete this.contactPeople[id];
      }
    }
    if (wanted && !this.contactPeople[wanted]) {
      const contact = CONTACTS[wanted];
      const person = this.game.characters.spawn('npc', contact.x, contact.z, CAST[wanted].outfit, { yaw: contact.yaw });
      person.label = wanted;
      this.contactPeople[wanted] = person;
    }
  }

  freezePlayer(on) {
    const player = this.game.player;
    this.frozen = on;
    player.enabled = !on;
    const character = player.character;
    character.setMove(0, 0, 0);
    character.aimYaw = null;
    if (character.vehicle) {
      character.vehicle.clearControls();
      character.vehicle.controls.handbrake = true;
    }
  }

  hint(text) {
    this.game.hud.hint(text, 0.2);
  }

  spawnVehicle(type, x, z, yaw, options = {}) {
    const vehicle = this.game.vehicles.spawn(type, x, z, yaw, { role: 'mission', ...options });
    if (this.current) this.current.vehicles.push(vehicle);
    return vehicle;
  }

  spawnPerson(kind, x, z, outfit, options = {}) {
    const person = this.game.characters.spawn(kind, x, z, outfit ?? OUTFITS.gang, options);
    person.y = groundHeight(x, z);
    if (this.current) this.current.people.push(person);
    return person;
  }

  /** Crane's crew: [{ x, z, weapon, health, outfit }] with gang brains. */
  spawnCrew(members) {
    const rng = this.game.rng;
    return members.map((member) => {
      const look = member.outfit ?? { ...OUTFITS.gang, skin: rng.pick(['#a8754c', '#e0ac69', '#8d5524', '#f1c27d', '#c68642']), shirt: rng.pick(['#b5121b', '#9d0208', '#d00000']) };
      const person = this.spawnPerson('gang', member.x, member.z, look, { health: member.health ?? 70, yaw: member.yaw ?? 0 });
      const armed = member.weapon !== 'fists';
      person.brain = new GangBrain(person, rng.fork(person.id), { armed, weapon: armed ? member.weapon ?? 'pistol' : 'fists', accuracy: member.accuracy ?? 0.45 });
      return person;
    });
  }

  start(def) {
    if (this.current) return;
    const game = this.game;
    this.current = { def, index: -1, step: null, steps: [], vars: {}, vehicles: [], people: [], timeLimit: null };
    this.current.steps = def.steps(this.ctx);
    this.syncContacts();
    game.hud.showMissionTitle(def.title);
    game.events.emit('missionStarted', { id: def.id, title: def.title });
    this.advance();
  }

  advance() {
    const mission = this.current;
    if (!mission) return;
    if (mission.step && mission.step.end) mission.step.end(this.ctx);
    mission.index += 1;
    if (mission.index >= mission.steps.length) {
      this.pass();
      return;
    }
    mission.step = mission.steps[mission.index];
    if (mission.step.start) mission.step.start(this.ctx);
    if (this.current === mission && mission.step.objective === null && mission.step.update && mission.step.update(0, this.ctx) === true) this.advance();
  }

  pass() {
    const game = this.game;
    const mission = this.current;
    const def = mission.def;
    this.release();
    const reward = def.reward ?? 0;
    if (reward) game.progress.addMoney(reward, def.title);
    if (def.story) {
      game.progress.completed.push(def.id);
      game.progress.storyIndex += 1;
      game.progress.bump('missionsPassed');
    } else {
      game.progress.bump('sideJobs');
    }
    if (def.onPass) def.onPass(game);
    game.notifications.banner(def.story ? 'MISSION PASSED' : 'JOB DONE', reward ? `+${formatMoney(reward)}` : '', '', 4.5);
    game.events.emit('missionPassed', { id: def.id, story: Boolean(def.story), reward });
    this.cooldown = 3;
    if (def.story && game.save) game.save.autosave();
  }

  fail(reason) {
    if (!this.current) return;
    const game = this.game;
    const def = this.current.def;
    this.release();
    game.notifications.banner(def.story ? 'MISSION FAILED' : 'JOB FAILED', reason, 'fail', 4);
    game.events.emit('missionFailed', { id: def.id, reason });
    this.cooldown = 4;
    if (def.story) {
      this.retry = def;
      this.retryTimer = 14;
    }
  }

  /** Ends the mission: hands spawned cars back to the world and drops the crew. */
  release() {
    const game = this.game;
    const mission = this.current;
    if (mission.step && mission.step.end) mission.step.end(this.ctx);
    this.current = null;
    if (this.frozen) this.freezePlayer(false);
    if (game.dialogue.active) game.dialogue.skip();
    game.wanted.floor = 0;
    for (const vehicle of mission.vehicles) {
      if (vehicle.driver && vehicle.driver.kind !== 'player') {
        game.characters.remove(vehicle.driver);
        vehicle.driver = null;
      }
      vehicle.ai = null;
      if (vehicle.role === 'mission') vehicle.role = 'parked';
      game.missionLeftovers.push(vehicle);
    }
    for (const person of mission.people) {
      if (person.alive) person.brain = null;
      game.missionLeftovers.push(person);
    }
    this.syncContacts();
  }

  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.current) {
      this.syncContacts();
      if (this.offerRetry(dt)) return;
      this.offerContacts();
      return;
    }
    const mission = this.current;
    if (mission.timeLimit !== null) {
      mission.timeLimit -= dt;
      if (mission.timeLimit <= 0) {
        this.fail('Out of time.');
        return;
      }
    }
    const result = mission.step.update ? mission.step.update(dt, this.ctx) : true;
    if (this.current !== mission) return;
    if (result === true) this.advance();
    else if (typeof result === 'string' && result.startsWith('fail:')) this.fail(result.slice(5));
  }

  /** For a while after a failed story mission, E starts it again right away. */
  offerRetry(dt) {
    const game = this.game;
    if (!this.retry || this.retryTimer <= 0) return false;
    if (game.fate.active) return true;
    this.retryTimer -= dt;
    if (game.wanted.level > 0) return false;
    game.hud.hint(`Mission failed: <b>${this.retry.title}</b><br>Press <kbd>E</kbd> to retry.`, 0.2);
    if (game.input.wasPressed('interact')) {
      const def = this.retry;
      this.retry = null;
      this.cooldown = 0;
      this.start(def);
    }
    return true;
  }

  offerContacts() {
    const game = this.game;
    const player = game.player.character;
    if (this.cooldown > 0 || player.vehicle || !player.canAct || game.wanted.level > 0) return;
    const next = this.nextStory();
    if (!next) return;
    const contact = CONTACTS[next.giver];
    if (Math.hypot(player.x - contact.x, player.z - contact.z) > CONTACT_RADIUS + 1.5) return;
    game.hud.hint(`<b>${CAST[next.giver].name}</b>: "${next.title}"<br>Press <kbd>E</kbd> to start the mission.`, 0.2);
    if (game.input.wasPressed('interact')) this.start(next);
  }

  markers() {
    const list = [];
    if (this.current) {
      const step = this.current.step;
      if (step && step.markers) list.push(...step.markers(this.ctx));
    } else {
      for (const contact of this.availableContacts()) list.push({ x: contact.x, z: contact.z, type: 'column', kind: 'contact', color: '#ffd23f', radius: CONTACT_RADIUS });
    }
    return list;
  }

  routeTarget() {
    if (!this.current) {
      const next = this.nextStory();
      return next ? CONTACTS[next.giver] : null;
    }
    const step = this.current.step;
    if (!step || !step.route) return null;
    return step.route(this.ctx);
  }

  objectiveText() {
    const step = this.current ? this.current.step : null;
    if (!step) return '';
    if (step.objectiveText) return step.objectiveText(this.ctx);
    return step.objective ?? '';
  }

  timeLeft() {
    return this.current && this.current.timeLimit !== null ? this.current.timeLimit : null;
  }
}

// The in-game HUD, laid out along the screen edges so the middle stays on the action: the mission
// tracker and the police response on the left, money, clock, wanted stars, health and armour,
// street rank and the weapon bar on the right, the minimap with district and street bottom left,
// the car panel and radio bottom right, and the objective line, help box, crosshair and hit
// markers in between. Every number comes from the live game.
import { formatMoney } from '../core/mathUtils.js';
import { districtName, streetNameAt } from '../world/cityPlan.js';
import { Minimap } from './minimap.js';
import { collectBlips, gpsRoute } from './blips.js';
import { MissionTracker } from './missionTracker.js';
import { PoliceResponsePanel } from './policeResponsePanel.js';
import { WeaponBar } from './weaponBar.js';
import { VehiclePanel } from './vehiclePanel.js';
import { RadioNowPlaying } from './radioNowPlaying.js';
import { RankPanel } from './rankPanel.js';
import { watchHudZoom } from './hudLayout.js';

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor(game, painter) {
    this.game = game;
    this.root = el('hud');
    this.money = el('money-counter');
    this.stars = el('wanted-stars');
    this.help = el('help-box');
    this.title = el('mission-title');
    this.health = el('health-bar');
    this.armour = el('armour-bar');
    this.objective = el('objective-text');
    this.zone = el('zone-label');
    this.clock = el('clock');
    this.crosshair = el('crosshair');
    this.lockHint = el('lock-hint');
    this.minimap = new Minimap(el('minimap-canvas'), painter);
    this.tracker = new MissionTracker(el('mission-tracker'));
    this.police = new PoliceResponsePanel(el('police-response'));
    this.weapons = new WeaponBar(el('weapon-bar'));
    this.vehiclePanel = new VehiclePanel(el('vehicle-panel'));
    this.radio = new RadioNowPlaying(el('radio-now-playing'));
    this.rank = new RankPanel(el('rank-progress'), game.events);
    watchHudZoom();
    this.stars.innerHTML = '<span>★</span>'.repeat(5);
    this.starSpans = [...this.stars.children];
    this.healthLabel = this.health.querySelector('b');
    this.armourLabel = this.armour.querySelector('b');
    this.shownMoney = game.progress.money;
    this.domTimer = 0;
    this.lastZone = '';
    this.zoneTimer = 0;
    this.titleTimer = 0;
    this.route = null;
    this.routeTimer = 0;
    this.lastObjective = null;
    this.helpText = '';
    this.helpTimer = 0;
    // Hit feedback: the crosshair flashes on every hit Kai lands, and turns into an X on a kill;
    // a head hit turns it gold and flashes HEADSHOT beside it.
    this.hitTimer = 0;
    this.hitLabel = el('hit-label');
    game.events.on('characterHurt', (e) => {
      if (!e.attacker || e.attacker.kind !== 'player' || e.kind !== 'gun') return;
      this.hitTimer = Math.max(this.hitTimer, e.head ? 0.5 : 0.14);
      this.crosshair.classList.add('hit');
      if (e.head) this.flagHeadshot();
    });
    game.events.on('characterKilled', (e) => {
      if (!e.attacker || e.attacker.kind !== 'player') return;
      this.hitTimer = Math.max(this.hitTimer, e.head ? 0.8 : 0.4);
      this.crosshair.classList.add('hit', 'kill');
      if (e.head) this.flagHeadshot();
    });
  }

  flagHeadshot() {
    this.crosshair.classList.add('headshot');
    this.hitLabel.classList.remove('hidden', 'pop');
    void this.hitLabel.offsetWidth;
    this.hitLabel.classList.add('pop');
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A context hint in the box at the top; stays while it keeps being set. */
  hint(text, seconds = 0.25) {
    if (text !== this.helpText) {
      this.helpText = text;
      this.help.innerHTML = text;
    }
    this.helpTimer = Math.max(this.helpTimer, seconds);
  }

  showMissionTitle(text) {
    this.title.textContent = text;
    this.title.classList.remove('hidden');
    this.title.classList.remove('fade');
    this.titleTimer = 4.5;
  }

  hideMissionTitle() {
    this.titleTimer = 0;
    this.title.classList.add('hidden');
  }

  update(dt) {
    const game = this.game;
    const player = game.player.character;
    const vehicle = player.vehicle;
    this.helpTimer -= dt;
    this.help.classList.toggle('hidden', this.helpTimer <= 0 || !this.helpText);
    if (this.titleTimer > 0) {
      this.titleTimer -= dt;
      if (this.titleTimer < 1) this.title.classList.add('fade');
      if (this.titleTimer <= 0) this.title.classList.add('hidden');
    }
    // Money counts toward the real total.
    const target = game.progress.money;
    this.shownMoney += (target - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(target - this.shownMoney) < 1) this.shownMoney = target;
    // Minimap, route and the car's dial every frame.
    this.routeTimer -= dt;
    const goal = game.missions ? game.missions.routeTarget() : null;
    if (goal && this.routeTimer <= 0) {
      this.route = gpsRoute(game, player.x, player.z, goal.x, goal.z);
      this.routeTimer = 0.8;
    } else if (!goal) {
      this.route = null;
    }
    if (this.route) this.route[0] = { x: player.x, z: player.z };
    this.minimap.draw(game, collectBlips(game), this.route, dt);
    this.domTimer -= dt;
    const refresh = this.domTimer <= 0;
    this.vehiclePanel.update(game, refresh);
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) {
        this.crosshair.classList.remove('hit', 'kill', 'headshot');
        this.hitLabel.classList.add('hidden');
      }
    }
    if (!refresh) return;
    this.domTimer = 0.05;
    this.updateStatus(game, player);
    this.tracker.update(game);
    this.police.update(game);
    this.weapons.update(game);
    this.radio.update(game);
    this.rank.update(game, 0.05);
    this.updateObjective(game);
    this.updateZone(player, vehicle);
    this.crosshair.classList.toggle('hidden', !(player.aimYaw !== null && !vehicle));
    const input = game.input;
    this.lockHint.classList.toggle('hidden', game.state !== 'playing' || !input.wantsLock || input.pointerLocked || game.shop.isOpen);
  }

  /** Money, clock, wanted stars, and health and armour with their numbers. */
  updateStatus(game, player) {
    this.money.textContent = formatMoney(this.shownMoney);
    const level = game.wanted.level;
    this.stars.classList.toggle('active', level > 0);
    this.stars.classList.toggle('searching', game.wanted.searching);
    this.starSpans.forEach((span, index) => span.classList.toggle('on', index < level));
    const health = Math.max(0, Math.round(player.health));
    const armour = Math.max(0, Math.round(player.armour));
    this.health.querySelector('i').style.width = `${Math.max(0, player.health / player.maxHealth) * 100}%`;
    this.armour.querySelector('i').style.width = `${Math.min(100, armour)}%`;
    this.healthLabel.textContent = `HEALTH ${health}`;
    this.armourLabel.textContent = `ARMOUR ${armour}`;
    this.health.classList.toggle('low', player.health < 30);
    this.armour.classList.toggle('empty', player.armour <= 0);
    const clock = game.timeOfDay.clock;
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clock.textContent = clock;
    }
  }

  /** The objective line at the bottom; it steps aside while someone is talking. */
  updateObjective(game) {
    const objective = game.missions ? game.missions.objectiveText() : '';
    const line = objective && !game.dialogue.active ? objective.replace(/\*([^*]+)\*/g, '<em>$1</em>') : '';
    if (line !== this.lastObjective) {
      this.lastObjective = line;
      this.objective.innerHTML = line;
      this.objective.classList.remove('pop');
      void this.objective.offsetWidth;
      this.objective.classList.add('pop');
    }
  }

  /** District and street on the minimap's caption: always while driving, briefly on a new district. */
  updateZone(player, vehicle) {
    const zone = districtName(player.x, player.z);
    if (zone !== this.lastZone) {
      this.lastZone = zone;
      this.zoneTimer = 5;
    }
    this.zoneTimer -= 0.05;
    const street = streetNameAt(player.x, player.z);
    const html = `<b>${zone}</b>${street ? `<small>${street}</small>` : ''}`;
    if (html !== this.lastZoneHtml) {
      this.lastZoneHtml = html;
      this.zone.innerHTML = html;
    }
    this.zone.classList.toggle('shown', this.zoneTimer > 0 || Boolean(vehicle) || Boolean(street));
  }
}

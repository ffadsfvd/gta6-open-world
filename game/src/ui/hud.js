// The in-game HUD: money that counts up, wanted stars (flashing while police search), weapon
// and ammo, health and armour bars, the objective line, mission title and timer, district and
// street names, the car gauge with radio station, crosshair, help box and the minimap.
import { formatMoney } from '../core/mathUtils.js';
import { districtName, streetNameAt } from '../world/cityPlan.js';
import { Minimap } from './minimap.js';
import { collectBlips, gpsRoute } from './blips.js';
import { drawSpeedometer, gearFor } from './speedometer.js';
import { WEAPONS } from '../combat/weapons.js';

const ICONS = {
  fists: '<svg viewBox="0 0 64 40"><path d="M14 10h30a8 8 0 0 1 8 8v4a10 10 0 0 1-10 10H20a8 8 0 0 1-8-8V12z" fill="currentColor"/><path d="M22 10v12M32 10v12M42 10v12" stroke="#1a1420" stroke-width="3"/></svg>',
  pistol: '<svg viewBox="0 0 64 40"><path d="M6 10h50v9H30l-3 4h-6l-4 14H8l4-14H6z" fill="currentColor"/><rect x="50" y="6" width="5" height="4" fill="currentColor"/></svg>',
  smg: '<svg viewBox="0 0 64 40"><path d="M2 12h54v8H40l-2 4h-6l-2 12h-7l2-12H14l-2 6H4l2-10H2z" fill="currentColor"/><rect x="26" y="20" width="5" height="14" fill="currentColor"/></svg>',
  shotgun: '<svg viewBox="0 0 64 40"><path d="M1 13h44v5H1zM40 12h10l4 6-6 10h-8l3-8h-5z" fill="currentColor"/><rect x="18" y="18" width="14" height="4" fill="currentColor"/></svg>',
  rifle: '<svg viewBox="0 0 64 40"><path d="M0 16h40v4H0zM34 14h12l12 4-4 10h-7l2-6H34z" fill="currentColor"/><rect x="18" y="9" width="16" height="5" rx="2" fill="currentColor"/><rect x="22" y="20" width="4" height="8" fill="currentColor"/></svg>',
};

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor(game, painter) {
    this.game = game;
    this.root = el('hud');
    this.money = el('money-counter');
    this.stars = el('wanted-stars');
    this.weaponIcon = el('weapon-icon');
    this.ammo = el('weapon-ammo');
    this.timer = el('mission-timer');
    this.help = el('help-box');
    this.title = el('mission-title');
    this.health = el('health-bar');
    this.armour = el('armour-bar');
    this.objective = el('objective-text');
    this.zone = el('zone-label');
    this.clock = el('clock');
    this.vehiclePanel = el('vehicle-panel');
    this.vehicleName = el('vehicle-name');
    this.radio = el('radio-station');
    this.crosshair = el('crosshair');
    this.lockHint = el('lock-hint');
    this.speedCtx = el('speedometer-canvas').getContext('2d');
    this.minimap = new Minimap(el('minimap-canvas'), painter);
    this.stars.innerHTML = '<span>★</span>'.repeat(5);
    this.starSpans = [...this.stars.children];
    this.shownMoney = game.progress.money;
    this.domTimer = 0;
    this.lastZone = '';
    this.zoneTimer = 0;
    this.titleTimer = 0;
    this.route = null;
    this.routeTimer = 0;
    this.lastObjective = null;
    this.lastWeapon = null;
    this.helpText = '';
    this.helpTimer = 0;
    // Hit feedback: the crosshair flashes on every hit Kai lands, and turns into an X on a kill.
    this.hitTimer = 0;
    game.events.on('characterHurt', (e) => {
      if (!e.attacker || e.attacker.kind !== 'player' || e.kind !== 'gun') return;
      this.hitTimer = 0.14;
      this.crosshair.classList.add('hit');
    });
    game.events.on('characterKilled', (e) => {
      if (!e.attacker || e.attacker.kind !== 'player') return;
      this.hitTimer = 0.4;
      this.crosshair.classList.add('hit', 'kill');
    });
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A context hint in the top-left box; stays while it keeps being set. */
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
    // Minimap and route every frame.
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
    if (vehicle) {
      const mph = vehicle.speed * 2.237;
      drawSpeedometer(this.speedCtx, mph, gearFor(vehicle.speed, vehicle.reversing), vehicle.healthShare);
    }
    this.domTimer -= dt;
    if (this.domTimer > 0) return;
    this.domTimer = 0.05;
    this.money.textContent = formatMoney(this.shownMoney);
    const level = game.wanted.level;
    this.stars.classList.toggle('active', level > 0);
    this.stars.classList.toggle('searching', game.wanted.searching);
    this.starSpans.forEach((span, index) => span.classList.toggle('on', index < level));
    const weapon = game.combat.arsenal.current;
    if (weapon !== this.lastWeapon) {
      this.weaponIcon.innerHTML = ICONS[weapon];
      this.lastWeapon = weapon;
    }
    const ammo = game.combat.arsenal.ammo[weapon];
    this.ammo.textContent = ammo ? `${ammo.mag} / ${ammo.reserve}` : WEAPONS[weapon].name;
    this.health.querySelector('i').style.width = `${Math.max(0, player.health / player.maxHealth) * 100}%`;
    this.armour.querySelector('i').style.width = `${Math.max(0, player.armour)}%`;
    this.health.classList.toggle('low', player.health < 30);
    this.armour.classList.toggle('empty', player.armour <= 0);
    const objective = game.missions ? game.missions.objectiveText() : '';
    const mission = game.missions && game.missions.current ? game.missions.current.def.title : '';
    const line = objective ? `${mission ? `<small>${mission}</small>` : ''}${objective.replace(/\*([^*]+)\*/g, '<em>$1</em>')}` : '';
    if (line !== this.lastObjective) {
      this.lastObjective = line;
      this.objective.innerHTML = line;
      this.objective.classList.remove('pop');
      void this.objective.offsetWidth;
      this.objective.classList.add('pop');
    }
    const timeLeft = game.missions ? game.missions.timeLeft() : null;
    this.timer.classList.toggle('hidden', timeLeft === null);
    if (timeLeft !== null) {
      const seconds = Math.max(0, Math.ceil(timeLeft));
      this.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      this.timer.classList.toggle('urgent', seconds <= 10);
    }
    const zone = districtName(player.x, player.z);
    if (zone !== this.lastZone) {
      this.lastZone = zone;
      this.zoneTimer = 4;
    }
    this.zoneTimer -= 0.05;
    const street = streetNameAt(player.x, player.z);
    this.zone.innerHTML = `<b>${zone}</b>${street ? `<small>${street}</small>` : ''}`;
    this.zone.classList.toggle('shown', this.zoneTimer > 0 || Boolean(vehicle));
    const clock = game.timeOfDay.clock;
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clock.textContent = clock;
    }
    this.vehiclePanel.classList.toggle('hidden', !vehicle);
    if (vehicle) {
      this.vehicleName.textContent = vehicle.name;
      this.radio.textContent = game.audio ? game.audio.stationName() : '';
    }
    this.crosshair.classList.toggle('hidden', !(player.aimYaw !== null && !vehicle));
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.crosshair.classList.remove('hit', 'kill');
    }
    const input = game.input;
    this.lockHint.classList.toggle('hidden', game.state !== 'playing' || !input.wantsLock || input.pointerLocked || game.shop.isOpen);
  }
}

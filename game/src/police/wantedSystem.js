// The wanted level: crimes add heat (more when an officer sees them), heat sets 1-5 stars,
// officers who see the player refresh the last known position, and staying out of sight long
// enough loses them. Also decides when the player is arrested.

const THRESHOLDS = [0, 1, 3, 6, 10, 15];
const ESCAPE_SECONDS = [0, 7, 10, 14, 18, 24];
const SIGHT_RANGE = 90;
const CLOSE_RANGE = 22;

export class WantedSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.level = 0;
    this.unseen = 0;
    this.lastKnown = { x: 0, z: 0 };
    this.seen = false;
    this.bustTimer = 0;
    this.floor = 0;
    this.suspended = false;
    const events = game.events;
    const isPlayer = (who) => who && who.kind === 'player';
    events.on('gunfire', (e) => {
      if (isPlayer(e.shooter)) this.report('gunfire', 0.34, 70);
    });
    events.on('characterHurt', (e) => {
      if (!isPlayer(e.attacker) || e.victim.kind === 'player') return;
      if (e.victim.kind === 'police') this.report('assaultOfficer', 1.6, 0);
      else if (e.victim.kind !== 'gang') this.report('assault', e.kind === 'melee' ? 0.45 : 0.25, 45);
    });
    events.on('characterKilled', (e) => {
      if (!isPlayer(e.attacker)) return;
      if (e.victim.kind === 'police') this.report('copKilled', 3.4, 0);
      else if (e.victim.kind !== 'gang') this.report('murder', 1.4, 0);
    });
    events.on('pedestrianHit', (e) => {
      if (!e.vehicle.driver || !isPlayer(e.vehicle.driver)) return;
      if (e.character.kind === 'police') this.report('copRunOver', 2.2, 0);
      else this.report('hitAndRun', e.killed ? 1.2 : 0.5, 0);
    });
    events.on('vehicleEntered', (e) => {
      if (e.vehicle.role === 'police' || e.vehicle.type === 'police') this.report('policeCarTheft', 3.0, 0);
      else if (e.jacked) this.report('carjack', 0.75, 0);
      else if (e.parked) this.report('carTheft', 1.0, 35);
    });
    events.on('vehicleCrash', (e) => {
      const player = game.player.character;
      if (!player.vehicle || e.speed < 6) return;
      const other = e.a === player.vehicle ? e.b : e.b === player.vehicle ? e.a : null;
      if (other && other.type === 'police') this.report('rammedPolice', 0.9, 0);
    });
    events.on('vehicleShot', (e) => {
      if (isPlayer(e.shooter) && e.vehicle.type === 'police') this.report('shotPolice', 0.8, 0);
    });
    events.on('explosion', (e) => {
      if (isPlayer(e.source)) this.report('explosion', 1.4, 0);
    });
  }

  get stars() {
    return this.level;
  }

  get searching() {
    return this.level > 0 && this.unseen > 2;
  }

  /** Distance from (x, z) to the nearest police officer or patrol car. */
  nearestCop(x, z) {
    let best = Infinity;
    for (const vehicle of this.game.vehicles.list) {
      if (vehicle.type !== 'police' || !vehicle.active || vehicle.destroyed) continue;
      best = Math.min(best, Math.hypot(vehicle.x - x, vehicle.z - z));
    }
    for (const person of this.game.characters.list) {
      if (person.kind !== 'police' || !person.active || person.state === 'dead') continue;
      best = Math.min(best, Math.hypot(person.x - x, person.z - z));
    }
    return best;
  }

  /** Adds heat for a crime; `witnessRange` 0 means it always counts, otherwise a cop must be that close. */
  report(crime, heat, witnessRange) {
    if (this.suspended) return;
    const player = this.game.player.character;
    let amount = heat;
    if (witnessRange > 0) {
      const cop = this.nearestCop(player.x, player.z);
      if (cop > witnessRange) amount *= this.level > 0 ? 0.6 : 0.35;
    }
    this.heat = Math.min(THRESHOLDS[5] + 4, this.heat + amount);
    this.lastKnown = { x: player.x, z: player.z };
    if (this.level > 0) this.unseen = Math.min(this.unseen, 1);
    this.recompute(crime);
  }

  recompute(reason = '') {
    let level = this.floor;
    for (let stars = 1; stars <= 5; stars += 1) if (this.heat >= THRESHOLDS[stars]) level = Math.max(level, stars);
    if (level !== this.level) {
      const previous = this.level;
      this.level = level;
      if (level > previous) this.unseen = 0;
      this.game.events.emit('wantedChanged', { level, previous, reason });
    }
  }

  /** Missions force a level (and optionally keep it from dropping below). */
  setLevel(level, keepAtLeast = false) {
    this.heat = Math.max(this.heat, THRESHOLDS[level]);
    if (keepAtLeast) this.floor = level;
    const player = this.game.player.character;
    this.lastKnown = { x: player.x, z: player.z };
    this.recompute('mission');
  }

  clear(reason = 'cleared') {
    const had = this.level;
    this.heat = 0;
    this.floor = 0;
    this.unseen = 0;
    this.bustTimer = 0;
    if (had > 0) {
      this.level = 0;
      this.game.events.emit('wantedChanged', { level: 0, previous: had, reason });
    }
  }

  canSee(player) {
    const game = this.game;
    const px = player.x;
    const pz = player.z;
    const look = (x, z) => {
      const d = Math.hypot(x - px, z - pz);
      if (d < CLOSE_RANGE) return true;
      return d < SIGHT_RANGE && !game.collision.segmentBlocked(x, z, px, pz, 3);
    };
    for (const vehicle of game.vehicles.list) {
      if (vehicle.type === 'police' && vehicle.active && !vehicle.destroyed && vehicle.driver && look(vehicle.x, vehicle.z)) return true;
    }
    for (const person of game.characters.list) {
      if (person.kind === 'police' && person.active && person.canAct && look(person.x, person.z)) return true;
    }
    return false;
  }

  update(dt) {
    if (this.level === 0) {
      this.bustTimer = 0;
      return;
    }
    const game = this.game;
    const player = game.player.character;
    this.seen = this.canSee(player);
    if (this.seen) {
      this.unseen = 0;
      this.lastKnown = { x: player.x, z: player.z };
    } else {
      this.unseen += dt;
      if (this.unseen > ESCAPE_SECONDS[this.level] && this.floor === 0) {
        this.clear('escaped');
        game.events.emit('wantedEscaped', {});
        return;
      }
    }
    this.updateArrest(dt, player);
  }

  updateArrest(dt, player) {
    const game = this.game;
    if (!player.alive) return;
    const recentAttack = game.time - game.combat.lastPlayerAttack < 1.5;
    let close = false;
    for (const person of game.characters.list) {
      if (person.kind !== 'police' || !person.canAct) continue;
      const reach = player.vehicle ? 3.2 : 1.8;
      if (Math.hypot(person.x - player.x, person.z - player.z) < reach) close = true;
    }
    const still = player.vehicle ? player.vehicle.speed < 1.5 : Math.hypot(player.vx, player.vz) < 3;
    if (close && still && !recentAttack) {
      this.bustTimer += dt;
      if (this.bustTimer > (player.vehicle ? 2.2 : 1.2)) {
        this.bustTimer = 0;
        game.events.emit('playerBusted', {});
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}

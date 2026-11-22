// Fighting: the player's weapon handling (switching, firing from the crosshair, reloading,
// punching), NPC gunfire with distance-based accuracy, applying hits to people and cars,
// and the explosions of wrecked cars.
import { WEAPONS, Arsenal } from './weapons.js';
import { castBullet } from './hitscan.js';
import { explode } from './explosions.js';

const PUNCH_TIME = 0.35;

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.arsenal = new Arsenal();
    this.rng = game.rng.fork(77);
    this.lastPlayerAttack = -10;
    this.fireHold = 0;
    game.events.on('vehicleExploded', (e) => {
      const v = e.vehicle;
      const driver = v.driver;
      if (driver) {
        // Whoever is inside a car that blows up is thrown out. Kai had seconds of warning from the
        // fire to bail out; staying in costs him everything but his armour.
        if (driver.kind === 'player') game.player.exitVehicle();
        else {
          driver.vehicle = null;
          v.driver = null;
          v.ai = null;
          const side = v.localToWorld(v.model.door.x, 0);
          driver.x = side.x;
          driver.z = side.z;
        }
        const killed = driver.takeDamage(driver.kind === 'player' ? 110 : 200, v.lastImpactBy);
        driver.knockDown(-Math.cos(v.yaw) * 5, Math.sin(v.yaw) * 5, 3, 5);
        if (killed) game.events.emit('characterKilled', { victim: driver, attacker: v.lastImpactBy, weapon: 'explosion' });
      }
      explode(game, v.x, v.y + 0.6, v.z, { radius: 8, damage: 110, source: v.lastImpactBy, fromVehicle: true, spare: driver });
    });
  }

  get playerWeapon() {
    return this.arsenal.current;
  }

  updatePlayer(dt) {
    const game = this.game;
    const input = game.input;
    const hero = game.player.character;
    const arsenal = this.arsenal;
    arsenal.update(dt);
    hero.weapon = arsenal.current;
    this.fireHold = Math.max(0, this.fireHold - dt);
    if (hero.vehicle || !hero.canAct || !game.player.enabled) return;
    if (input.wasPressed('nextWeapon') || input.wheel > 0) arsenal.cycle(1);
    if (input.wheel < 0) arsenal.cycle(-1);
    if (input.wasPressed('weapon1')) arsenal.select('fists');
    if (input.wasPressed('weapon2')) arsenal.select('pistol');
    if (input.wasPressed('weapon3')) arsenal.select('shotgun');
    if (input.wasPressed('weapon4')) arsenal.select('smg');
    if (input.wasPressed('weapon5')) arsenal.select('rifle');
    if (input.wasPressed('reload')) arsenal.reload();
    const spec = arsenal.spec;
    const wantsFire = spec.auto ? input.isDown('fire') : input.wasPressed('fire');
    if (wantsFire && arsenal.trigger()) {
      if (spec.melee) this.punch(hero);
      else this.firePlayerShot(spec);
    }
    if (this.fireHold > 0 && hero.aimYaw === null) hero.aimYaw = game.followCamera.yaw;
    if (hero.aimYaw !== null && !spec.melee) this.menaceCrowd(hero);
  }

  /** Frightens people in the line of fire when the player points a gun at them. */
  menaceCrowd(hero) {
    const fx = Math.sin(hero.aimYaw);
    const fz = Math.cos(hero.aimYaw);
    for (const walker of this.game.population.walkers) {
      if (!walker.brain || !walker.canAct) continue;
      const dx = walker.x - hero.x;
      const dz = walker.z - hero.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 16 || distance < 0.5) continue;
      if ((dx * fx + dz * fz) / distance > 0.92) walker.brain.menace(hero.x, hero.z);
    }
  }

  firePlayerShot(spec) {
    const game = this.game;
    const hero = game.player.character;
    const camera = game.camera;
    const aim = camera.getWorldDirection(this.tmp ?? (this.tmp = camera.position.clone()));
    if (hero.aimYaw !== null) this.assistAim(camera.position, aim, spec.range);
    const spread = spec.spread * (hero.aimYaw !== null ? 1 : 2.2) * (Math.hypot(hero.vx, hero.vz) > 1 ? 1.6 : 1);
    const pellets = spec.pellets ?? 1;
    const dir = this.pelletDir ?? (this.pelletDir = aim.clone());
    hero.recoil = 1;
    this.fireHold = 0.6;
    hero.aimYaw = game.followCamera.yaw;
    this.lastPlayerAttack = game.time;
    if (spec.kick) game.followCamera.trauma = Math.min(1, game.followCamera.trauma + spec.kick * 0.12);
    // A shotgun fires a spray of pellets: one bang, one muzzle flash, many tracers.
    for (let pellet = 0; pellet < pellets; pellet += 1) {
      dir.copy(aim);
      dir.x += (this.rng.next() - 0.5) * 2 * spread;
      dir.y += (this.rng.next() - 0.5) * 2 * spread;
      dir.z += (this.rng.next() - 0.5) * 2 * spread;
      dir.normalize();
      // Start the ray level with the player, not at the camera, so nothing behind them is hit.
      const toHero = (hero.x - camera.position.x) * dir.x + (hero.z - camera.position.z) * dir.z;
      const start = Math.max(0, toHero);
      const ox = camera.position.x + dir.x * start;
      const oy = camera.position.y + dir.y * start;
      const oz = camera.position.z + dir.z * start;
      const hit = castBullet(game, ox, oy, oz, dir.x, dir.y, dir.z, spec.range, hero);
      const muzzle = this.muzzleOf(hero, Math.atan2(dir.x, dir.z));
      this.resolveShot(hero, hit, spec.damage, { x: dir.x, y: dir.y, z: dir.z }, muzzle, pellet > 0);
    }
  }

  muzzleOf(character, yaw) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return { x: character.x + fx * 0.75 - fz * 0.28, y: character.y + 1.42, z: character.z + fz * 0.75 + fx * 0.28 };
  }

  /** True for someone it makes sense to help the player hit: armed foes and police after him. */
  isFoe(character) {
    if (character.kind === 'gang') return true;
    if (character.kind === 'police') return this.game.wanted.level > 0;
    return Boolean(character.brain && character.brain.mode === 'fight');
  }

  /**
   * Soft aim assist while aiming down the sights: a shot that would pass within a few degrees
   * of a foe's chest bends onto it, as console-style lock-on does. Mouse aim still decides.
   */
  assistAim(origin, dir, range) {
    const hero = this.game.player.character;
    let best = null;
    let bestAngle = 0.075;
    for (const character of this.game.characters.list) {
      if (!character.active || character === hero || character.vehicle || !character.alive || !this.isFoe(character)) continue;
      const dx = character.x - origin.x;
      const dy = character.y + 1.2 - origin.y;
      const dz = character.z - origin.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > range || distance < 1) continue;
      const along = (dx * dir.x + dy * dir.y + dz * dir.z) / distance;
      const angle = Math.acos(Math.min(1, along));
      if (angle < bestAngle && !this.game.collision.segmentBlocked(hero.x, hero.z, character.x, character.z, 1.5)) {
        bestAngle = angle;
        best = { dx, dy, dz, distance };
      }
    }
    if (best) dir.set(best.dx / best.distance, best.dy / best.distance, best.dz / best.distance);
  }

  /** An NPC fires at a target character; accuracy falls with distance and target speed. */
  fireNpcShot(shooter, target, accuracy = 0.6, weapon = 'pistol') {
    const game = this.game;
    const spec = WEAPONS[weapon];
    const aimX = target.x + target.vx * 0.15;
    const aimY = (target.vehicle ? target.vehicle.y + 0.9 : target.y + 1.15);
    const aimZ = target.z + target.vz * 0.15;
    const ox = shooter.x;
    const oy = shooter.y + 1.42;
    const oz = shooter.z;
    const distance = Math.hypot(aimX - ox, aimZ - oz);
    const miss = (1 - accuracy) * (0.6 + distance * 0.03) + Math.hypot(target.vx, target.vz) * 0.04;
    let dx = aimX - ox + (this.rng.next() - 0.5) * 2 * miss;
    let dy = aimY - oy + (this.rng.next() - 0.5) * miss;
    let dz = aimZ - oz + (this.rng.next() - 0.5) * 2 * miss;
    const length = Math.hypot(dx, dy, dz) || 1;
    dx /= length;
    dy /= length;
    dz /= length;
    shooter.aimYaw = Math.atan2(dx, dz);
    shooter.recoil = 1;
    shooter.weapon = weapon;
    const hit = castBullet(game, ox, oy, oz, dx, dy, dz, spec.range, shooter);
    // NPC bullets hurt less than Kai's, so a fight is something a player can win: police more
    // the higher the stars, Crane's crew a little less.
    const level = game.wanted.level;
    const share = shooter.kind === 'police' ? 0.22 + level * 0.04 : 0.34;
    this.resolveShot(shooter, hit, spec.damage * share, { x: dx, y: dy, z: dz }, this.muzzleOf(shooter, shooter.aimYaw));
  }

  resolveShot(shooter, hit, damage, dir, muzzle, quiet = false) {
    const game = this.game;
    game.effects.tracers.add(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z);
    if (!quiet) {
      game.effects.particles.burst('muzzle', 1, muzzle.x, muzzle.y, muzzle.z);
      game.events.emit('gunfire', { shooter, x: shooter.x, z: shooter.z, weapon: shooter.weapon });
    }
    if (hit.kind === 'none') return;
    game.events.emit('bulletImpact', { kind: hit.kind, x: hit.x, y: hit.y, z: hit.z, dx: dir.x, dz: dir.z });
    if (hit.kind === 'character') this.hurt(hit.character, damage * (hit.head ? 2.4 : 1), shooter, 'gun', dir);
    else if (hit.kind === 'vehicle') {
      // NPC fire wears a getaway car down slowly; the player's shots wreck cars quickly.
      hit.vehicle.damage(damage * (shooter.kind === 'player' ? 1.7 : 0.4), shooter);
      game.events.emit('vehicleShot', { vehicle: hit.vehicle, shooter });
    }
  }

  hurt(victim, amount, attacker, kind, dir = null) {
    const game = this.game;
    // Mid-roll, bullets and fists whistle past.
    if (victim.dodging > 0.08 && (kind === 'gun' || kind === 'melee')) return false;
    const killed = victim.takeDamage(amount, attacker);
    if (dir && !killed && amount > 20 && victim.kind !== 'player') {
      victim.vx += dir.x * 1.5;
      victim.vz += dir.z * 1.5;
    }
    // Hit reaction: whoever Kai hurts flinches and loses the initiative for a moment.
    if (!killed && attacker && attacker.kind === 'player' && victim.brain && victim.brain.stagger) victim.brain.stagger(kind === 'melee' ? 0.7 : 0.45);
    if (killed && dir) {
      victim.vx = dir.x * 2.5;
      victim.vz = dir.z * 2.5;
    }
    game.events.emit('characterHurt', { victim, attacker, amount, kind });
    if (killed) game.events.emit('characterKilled', { victim, attacker, weapon: kind });
    return killed;
  }

  /** A punch at whoever stands in front of the attacker. */
  punch(attacker) {
    const game = this.game;
    attacker.punchTimer = PUNCH_TIME;
    if (attacker.kind === 'player') this.lastPlayerAttack = game.time;
    const fx = Math.sin(attacker.yaw);
    const fz = Math.cos(attacker.yaw);
    let best = null;
    let bestDistance = WEAPONS.fists.range;
    for (const other of game.characters.list) {
      if (other === attacker || !other.active || other.vehicle || other.state === 'dead') continue;
      const dx = other.x - attacker.x;
      const dz = other.z - attacker.z;
      const distance = Math.hypot(dx, dz);
      if (distance > bestDistance || distance < 0.01) continue;
      if ((dx * fx + dz * fz) / distance < 0.55) continue;
      best = other;
      bestDistance = distance;
    }
    game.events.emit('punch', { attacker, target: best, x: attacker.x, z: attacker.z });
    if (!best) return;
    // Street thugs and officers hit softer than Kai, or two of them would floor him in seconds.
    const damage = (WEAPONS.fists.damage + this.rng.next() * 5) * (attacker.kind === 'player' ? 1 : 0.6);
    best.combo = (best.comboTime ?? 0) > game.time - 1.2 ? (best.combo ?? 0) + 1 : 1;
    best.comboTime = game.time;
    const killed = this.hurt(best, damage, attacker, 'melee', { x: fx, y: 0, z: fz });
    if (!killed && best.combo >= 3) {
      best.knockDown(fx * 4, fz * 4, 2.2, 2.5);
      best.combo = 0;
    } else if (!killed) {
      best.vx += fx * 2.5;
      best.vz += fz * 2.5;
    }
    if (best.brain && best.brain.scare) best.brain.scare(attacker.x, attacker.z, 9, attacker);
  }

  update(dt) {
    this.updatePlayer(dt);
  }
}

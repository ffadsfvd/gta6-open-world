// The building blocks of every mission: talk, go somewhere, get in or steal a car, deliver it,
// take out a crew, chase and wreck a car, grab a pickup, lose the police, race, and timers.
// A step reports done (true), failure ('fail:reason') or nothing yet.
import { RaceDriver } from '../ai/raceDriver.js';

const YELLOW = '#ffd23f';
const RED = '#ff4d5e';
const BLUE = '#4cc9f0';

function near(a, b, radius) {
  return Math.hypot(a.x - b.x, a.z - b.z) < radius;
}

export function talk(lines, { freeze = true } = {}) {
  return {
    kind: 'talk',
    objective: '',
    start(ctx) {
      this.done = false;
      if (freeze) ctx.runner.freezePlayer(true);
      ctx.game.dialogue.play(lines, { auto: !freeze }).then(() => {
        this.done = true;
      });
    },
    update() {
      return this.done;
    },
    end(ctx) {
      if (freeze) ctx.runner.freezePlayer(false);
    },
  };
}

/**
 * Reach a place. vehicle: 'any' (be driving), 'foot', a vars name, or null (either). `clean`:
 * only with no police on Kai's tail (a hideout he must not lead them to).
 */
export function goTo(place, text, { radius = 5, vehicle = null, clean = false } = {}) {
  return {
    kind: 'goTo',
    place,
    radius,
    requires: vehicle,
    objective: text,
    objectiveText(ctx) {
      return clean && ctx.game.wanted.level > 0 ? `Lose the *cops* first: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
    },
    update(dt, ctx) {
      const player = ctx.game.player.character;
      if (clean && ctx.game.wanted.level > 0) return false;
      if (!near(player, place, radius)) return false;
      if (vehicle === 'any') return Boolean(player.vehicle);
      if (vehicle === 'foot') return !player.vehicle;
      if (vehicle) return player.vehicle === ctx.vars[vehicle];
      return true;
    },
    markers: () => [{ x: place.x, z: place.z, type: 'column', kind: 'target', color: YELLOW, radius: Math.min(radius, 6) }],
    route: () => place,
  };
}

export function getInAnyVehicle(text) {
  return {
    kind: 'getInAnyVehicle',
    objective: text,
    update: (dt, ctx) => Boolean(ctx.game.player.character.vehicle),
  };
}

export function enterVehicle(name, text) {
  return {
    kind: 'enterVehicle',
    name,
    objective: text,
    update(dt, ctx) {
      const vehicle = ctx.vars[name];
      if (!vehicle || vehicle.destroyed) return 'fail:The car was wrecked.';
      return ctx.game.player.character.vehicle === vehicle;
    },
    markers(ctx) {
      const vehicle = ctx.vars[name];
      return vehicle ? [{ x: vehicle.x, z: vehicle.z, y: vehicle.y + 2.6, type: 'arrow', kind: 'vehicleTarget', color: BLUE }] : [];
    },
    route: (ctx) => ctx.vars[name],
  };
}

export function deliver(name, place, text, { radius = 6 } = {}) {
  return {
    kind: 'deliver',
    name,
    place,
    radius,
    objective: text,
    update(dt, ctx) {
      const vehicle = ctx.vars[name];
      if (!vehicle || vehicle.destroyed) return 'fail:The car was wrecked.';
      const player = ctx.game.player.character;
      if (player.vehicle !== vehicle) {
        ctx.runner.hint('Get back in the car.');
        return false;
      }
      return near(vehicle, place, radius) && vehicle.speed < 7;
    },
    markers: (ctx) => {
      const player = ctx.game.player.character;
      const vehicle = ctx.vars[name];
      if (vehicle && player.vehicle !== vehicle) return [{ x: vehicle.x, z: vehicle.z, y: vehicle.y + 2.6, type: 'arrow', kind: 'vehicleTarget', color: BLUE }];
      return [{ x: place.x, z: place.z, type: 'column', kind: 'target', color: YELLOW, radius }];
    },
    route: (ctx) => (ctx.game.player.character.vehicle === ctx.vars[name] ? place : ctx.vars[name]),
  };
}

/** Runs `fn(ctx)` once (spawning, setting the wanted level...), then moves on. */
export function call(fn) {
  return {
    objective: null,
    start(ctx) {
      fn(ctx);
    },
    update: () => true,
  };
}

export function eliminate(name, text) {
  return {
    kind: 'eliminate',
    name,
    objective: text,
    update(dt, ctx) {
      const crew = ctx.vars[name] ?? [];
      return crew.every((member) => !member.alive || !member.active);
    },
    markers(ctx) {
      return (ctx.vars[name] ?? []).filter((m) => m.alive && m.active).map((m) => ({ x: m.x, z: m.z, y: m.y + 2.4, type: 'arrow', kind: 'enemy', color: RED }));
    },
    route(ctx) {
      return (ctx.vars[name] ?? []).find((m) => m.alive && m.active) ?? null;
    },
  };
}

export function chase(name, text, { escape = 240, stopShare = 0.3 } = {}) {
  return {
    kind: 'chase',
    name,
    objective: text,
    update(dt, ctx) {
      const target = ctx.vars[name];
      if (!target) return true;
      const player = ctx.game.player.character;
      if (target.destroyed || (target.healthShare < stopShare && target.speed < 3)) return true;
      // Pulling the driver out and taking the car ends the chase too.
      if (target.driver === player) return true;
      if (Math.hypot(target.x - player.x, target.z - player.z) > escape) return 'fail:The target got away.';
      return false;
    },
    markers(ctx) {
      const target = ctx.vars[name];
      return target ? [{ x: target.x, z: target.z, y: target.y + 3, type: 'arrow', kind: 'target', color: RED }] : [];
    },
    route: (ctx) => ctx.vars[name] ?? null,
  };
}

/** A pickup lying at vars[name] (a {x, z} point); done when Kai reaches it. */
export function collect(name, text, color = '#ffb703') {
  return {
    kind: 'collect',
    name,
    objective: text,
    update(dt, ctx) {
      const spot = ctx.vars[name];
      return !spot || near(ctx.game.player.character, spot, 2.4);
    },
    end(ctx) {
      ctx.game.events.emit('pickup', { name });
    },
    markers(ctx) {
      const spot = ctx.vars[name];
      return spot ? [{ x: spot.x, z: spot.z, y: spot.y ?? 0.15, type: 'pickup', kind: 'target', color }] : [];
    },
    route: (ctx) => ctx.vars[name] ?? null,
  };
}

export function loseCops(text, level = 0, routeTo = null) {
  return {
    kind: 'loseCops',
    objective: text,
    start(ctx) {
      if (level > 0) ctx.game.wanted.setLevel(level);
    },
    update: (dt, ctx) => ctx.game.wanted.level === 0,
    markers: () => (routeTo ? [{ x: routeTo.x, z: routeTo.z, type: 'column', kind: 'target', color: YELLOW, radius: 3 }] : []),
    route: () => routeTo,
  };
}

/** Keeps a vehicle alive while the inner condition runs (used with loseCops in a car). */
export function guardVehicle(name, inner) {
  return {
    ...inner,
    update(dt, ctx) {
      const vehicle = ctx.vars[name];
      if (vehicle && vehicle.destroyed) return 'fail:The car was wrecked.';
      return inner.update(dt, ctx);
    },
  };
}

export function wait(seconds) {
  return {
    objective: null,
    start() {
      this.left = seconds;
    },
    update(dt) {
      this.left -= dt;
      return this.left <= 0;
    },
  };
}

export function timeLimit(seconds) {
  return call((ctx) => {
    ctx.mission.timeLimit = seconds;
  });
}

export function clearTimeLimit() {
  return call((ctx) => {
    ctx.mission.timeLimit = null;
  });
}

/**
 * A checkpoint race against rivals spawned on the grid behind the start. `checkpoints` are
 * world points; `rivals` are { type, paint, skill }.
 */
export function race(checkpoints, rivals, title) {
  return {
    kind: 'race',
    checkpoints,
    objective: title,
    start(ctx) {
      const game = ctx.game;
      const player = game.player.character;
      const car = player.vehicle;
      const first = checkpoints[0];
      const heading = car ? car.yaw : Math.atan2(first.x - player.x, first.z - player.z);
      this.index = 0;
      this.countdown = 3.5;
      this.racers = [];
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const px = car ? car.x : player.x;
      const pz = car ? car.z : player.z;
      // Grid slots as [metres to the right, metres ahead] of the player.
      const slots = [[3.6, 0], [0, -8.5], [3.6, -8.5], [0, -17]];
      rivals.forEach((rival, slot) => {
        const [right, ahead] = slots[slot % slots.length];
        const x = px - fz * right + fx * ahead;
        const z = pz + fx * right + fz * ahead;
        const vehicle = ctx.runner.spawnVehicle(rival.type, x, z, heading, { paint: rival.paint });
        const driver = ctx.runner.spawnPerson('npc', x, z, rival.outfit);
        driver.vehicle = vehicle;
        vehicle.driver = driver;
        vehicle.engineOn = true;
        vehicle.ai = new RaceDriver(vehicle, checkpoints, rival.skill ?? 0.9);
        this.racers.push(vehicle);
      });
      ctx.runner.freezePlayer(true);
      ctx.game.events.emit('raceCountdown', {});
    },
    update(dt, ctx) {
      const game = ctx.game;
      if (this.countdown > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= dt;
        const after = Math.ceil(this.countdown);
        if (after !== before) game.notifications.banner(after > 0 ? String(after) : 'GO!', '', '', 0.9);
        if (this.countdown <= 0) {
          ctx.runner.freezePlayer(false);
          for (const racer of this.racers) racer.ai.started = true;
          game.events.emit('raceStart', {});
        }
        return false;
      }
      const player = game.player.character;
      const point = checkpoints[this.index];
      // Rivals race the car Kai brought: whatever he drives, they are never much faster.
      const cap = player.vehicle ? player.vehicle.spec.maxSpeed * 1.04 : null;
      for (const racer of this.racers) {
        if (!racer.ai) continue;
        const lead = racer.ai.index - this.index;
        racer.ai.pace = lead > 1 ? 0.84 : lead > 0 ? 0.93 : lead < -1 ? 1.06 : 1;
        racer.ai.speedCap = cap;
      }
      if (near(player, point, 10)) {
        this.index += 1;
        game.events.emit('checkpoint', { index: this.index });
        if (this.index >= checkpoints.length) {
          return this.racers.some((racer) => racer.ai && racer.ai.finished) ? 'fail:You lost the race.' : true;
        }
      }
      if (this.racers.some((racer) => racer.ai && racer.ai.finished)) return 'fail:You lost the race.';
      return false;
    },
    objectiveText() {
      if (this.countdown > 0) return 'Get ready...';
      const place = 1 + this.racers.filter((racer) => racer.ai && (racer.ai.index > this.index)).length;
      const suffix = ['st', 'nd', 'rd', 'th'][Math.min(place - 1, 3)];
      return `${title}: checkpoint *${this.index + 1}/${checkpoints.length}* · position *${place}${suffix}*`;
    },
    markers() {
      const list = [];
      const current = checkpoints[this.index ?? 0];
      if (current) list.push({ x: current.x, z: current.z, type: 'checkpoint', kind: 'checkpoint', color: YELLOW, radius: 5 });
      const next = checkpoints[(this.index ?? 0) + 1];
      if (next) list.push({ x: next.x, z: next.z, type: 'checkpoint', kind: 'checkpoint', color: '#ffe8a3', radius: 3 });
      return list;
    },
    route() {
      return checkpoints[Math.min(this.index ?? 0, checkpoints.length - 1)];
    },
  };
}

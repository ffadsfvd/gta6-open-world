// The building blocks of every mission: talk (in person, on the phone or the police radio), go
// somewhere, get in or steal a car, deliver it, take out a crew, chase and wreck a car, grab a
// pickup, lose the police and timers (races are in raceStep.js). A step reports done (true),
// failure ('fail:reason') or nothing yet, and may give the HUD a few live readouts (status).

const YELLOW = '#ffd23f';
const RED = '#ff4d5e';
const BLUE = '#4cc9f0';

function near(a, b, radius) {
  return Math.hypot(a.x - b.x, a.z - b.z) < radius;
}

/**
 * Plays dialogue lines. `freeze: false` lets Kai keep driving or running while it plays; `via`
 * ('phone' or 'radio') shows the speaker calling in rather than standing beside him.
 */
export function talk(lines, { freeze = true, via = null } = {}) {
  return {
    kind: 'talk',
    objective: '',
    lines,
    via,
    start(ctx) {
      this.done = false;
      if (freeze) ctx.runner.freezePlayer(true);
      ctx.game.dialogue.play(lines, { auto: !freeze, via }).then(() => {
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
    status: (ctx) => [['Distance', `${Math.round(Math.hypot(ctx.game.player.character.x - place.x, ctx.game.player.character.z - place.z))} m`]],
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
      return [{ x: place.x, z: place.z, type: 'column', kind: 'target', color: YELLOW, radius: Math.min(radius, 6) }];
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
    status(ctx) {
      const crew = ctx.vars[name] ?? [];
      const standing = crew.filter((m) => m.alive && m.active).length;
      return [['Crew standing', `${standing} of ${crew.length}`]];
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
    status(ctx) {
      const target = ctx.vars[name];
      if (!target) return [];
      const player = ctx.game.player.character;
      return [['Target', `${Math.round(Math.hypot(target.x - player.x, target.z - player.z))} m`], ['Damage', `${Math.round((1 - target.healthShare) * 100)}%`]];
    },
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
    status: (ctx) => [['Wanted', `${ctx.game.wanted.level} stars`], ['Out of sight', `${Math.round(ctx.game.wanted.escapeShare * 100)}%`]],
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

// Races live in raceStep.js.

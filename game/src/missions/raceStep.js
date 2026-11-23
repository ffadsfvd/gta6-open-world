// The race step of missions and street races: rivals line up on a grid behind Kai, a 3-2-1
// countdown, checkpoints in order (the next two shown), rivals paced to the car Kai brought,
// and his position and checkpoint count for the HUD. Losing to a rival who finishes first fails it.
import { RaceDriver } from '../ai/raceDriver.js';

const YELLOW = '#ffd23f';

function near(a, b, radius) {
  return Math.hypot(a.x - b.x, a.z - b.z) < radius;
}

/** 1 for first place: one more for every rival past more checkpoints than Kai. */
function placeOf(step) {
  return 1 + (step.racers ?? []).filter((racer) => racer.ai && racer.ai.index > (step.index ?? 0)).length;
}

function ordinal(place) {
  return `${place}${['st', 'nd', 'rd', 'th'][Math.min(place - 1, 3)]}`;
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
      return `${title}: checkpoint *${this.index + 1}/${checkpoints.length}* · position *${ordinal(placeOf(this))}*`;
    },
    status() {
      const racers = this.racers ?? [];
      return [['Position', `${ordinal(placeOf(this))} of ${racers.length + 1}`], ['Checkpoint', `${Math.min((this.index ?? 0) + 1, checkpoints.length)} of ${checkpoints.length}`]];
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

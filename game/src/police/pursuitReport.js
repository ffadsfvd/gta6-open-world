// The police radio in one report: every unit after Kai (cruisers, officers on foot and the
// helicopter) with its call sign, distance and what its AI is doing this moment, plus one status
// line on how the pursuit stands. The HUD's police response panel draws it.
import { AIR_UNIT_CALL_SIGN } from './callSigns.js';

/** Units closer than this are listed (metres); farther ones are only counted. */
const LIST_RANGE = 260;

export function pursuitReport(game, limit = 6) {
  const player = game.player.character;
  const own = player.vehicle;
  const wanted = game.wanted;
  const units = [];
  const distanceTo = (thing) => Math.hypot(thing.x - player.x, thing.z - player.z);
  const heli = game.helicopter;
  if (heli && heli.active) {
    units.push({ callSign: AIR_UNIT_CALL_SIGN, kind: 'air', distance: Math.hypot(heli.position.x - player.x, heli.position.z - player.z), behaviour: heli.behaviour });
  }
  for (const unit of game.police.units) {
    const vehicle = unit.vehicle;
    if (!vehicle.active || vehicle.destroyed || vehicle === own || unit.deployed || !vehicle.driver) continue;
    const behaviour = unit.roadblock ? 'Roadblock' : vehicle.ai && vehicle.ai.behaviour ? vehicle.ai.behaviour : 'Patrolling';
    units.push({ callSign: vehicle.callSign ?? 'Cruiser', kind: 'car', distance: distanceTo(vehicle), behaviour });
  }
  for (const officer of game.police.officers) {
    if (!officer.active || officer.state === 'dead') continue;
    const behaviour = officer.state === 'down' ? 'Down' : officer.brain && officer.brain.behaviour ? officer.brain.behaviour : 'On foot';
    units.push({ callSign: officer.callSign ?? 'Officer', kind: 'foot', distance: distanceTo(officer), behaviour });
  }
  const near = units.filter((unit) => unit.distance < LIST_RANGE);
  // The helicopter first while it is up, then the nearest units.
  near.sort((a, b) => (b.kind === 'air') - (a.kind === 'air') || a.distance - b.distance);
  return {
    level: wanted.level,
    units: near.slice(0, limit),
    total: units.length,
    cruisers: units.filter((unit) => unit.kind === 'car').length,
    onFoot: units.filter((unit) => unit.kind === 'foot').length,
    air: Boolean(heli && heli.active),
    status: statusLine(game, units),
    escape: wanted.escapeShare,
  };
}

function statusLine(game, units) {
  const wanted = game.wanted;
  const heli = game.helicopter;
  if (wanted.floor > 0) return 'Mission heat: the police will not let up';
  if (heli && heli.active && heli.seesPlayer) return 'Air unit overhead: you are in the searchlight';
  if (wanted.searching) return 'Searching your last known position';
  if (units.some((unit) => unit.behaviour === 'Roadblock')) return 'Roadblock set up ahead';
  if (wanted.seen) return 'Suspect in sight: units closing';
  return 'Units responding';
}

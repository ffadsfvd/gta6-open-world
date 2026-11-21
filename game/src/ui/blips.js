// What the maps show: police units, mission targets and enemies, contacts with their letter,
// activities (races, taxi, deliveries, shop, safehouse, hospital, police HQ), and the GPS route
// to the current objective along the street grid.

const CONTACT_COLORS = { lou: '#ff7aa2', juno: '#2ec4b6', voss: '#8d99ae' };

export function collectBlips(game) {
  const blips = [];
  const flash = Math.floor(game.time * 6) % 2 === 0;
  for (const vehicle of game.vehicles.list) {
    if (vehicle.type !== 'police' || !vehicle.active || vehicle.destroyed) continue;
    if (!vehicle.siren && game.wanted.level === 0) continue;
    blips.push({ x: vehicle.x, z: vehicle.z, kind: 'police', color: flash ? '#ff2d3a' : '#2f6bff', size: 5 });
  }
  for (const officer of game.police.officers) {
    if (!officer.active || officer.state === 'dead') continue;
    blips.push({ x: officer.x, z: officer.z, kind: 'police', color: flash ? '#2f6bff' : '#ff2d3a', size: 3.5 });
  }
  const missions = game.missions;
  if (missions) {
    for (const marker of missions.markers()) {
      if (marker.kind === 'contact') continue;
      blips.push({ x: marker.x, z: marker.z, kind: marker.kind ?? 'target', color: marker.color ?? '#ffd23f', size: marker.kind === 'enemy' ? 4.5 : 7, edge: marker.kind !== 'enemy', label: marker.label });
    }
    if (!missions.active) {
      for (const contact of missions.availableContacts()) {
        blips.push({ x: contact.x, z: contact.z, kind: 'contact', color: CONTACT_COLORS[contact.id] ?? '#ffd23f', letter: contact.letter, size: 9, label: contact.missionTitle });
      }
    }
  }
  if (game.activities) {
    for (const spot of game.activities.mapSpots()) blips.push({ ...spot, size: spot.size ?? 8 });
  }
  return blips;
}

/** A street-grid route from (x0, z0) to (x1, z1) as world points. */
export function gpsRoute(game, x0, z0, x1, z1) {
  const network = game.network;
  const start = network.nearestNode(x0, z0);
  const goal = network.nearestNode(x1, z1);
  const ids = network.findPath(start.id, goal.id);
  const points = [{ x: x0, z: z0 }];
  for (const id of ids) points.push({ x: network.nodes[id].x, z: network.nodes[id].z });
  points.push({ x: x1, z: z1 });
  return points;
}

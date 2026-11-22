// Explosions: damage and knock-back falling off with distance, cars caught in the blast take
// damage too (so wrecks can chain), and the street panics.

export function explode(game, x, y, z, { radius = 8, damage = 120, source = null, fromVehicle = false, spare = null } = {}) {
  for (const character of game.characters.list) {
    if (!character.active || character === spare) continue;
    const dx = character.x - x;
    const dz = character.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance > radius) continue;
    const share = 1 - distance / radius;
    if (character.vehicle) {
      continue;
    }
    const push = 6 + share * 10;
    const length = distance || 1;
    character.knockDown((dx / length) * push, (dz / length) * push, 2.5 + share * 2, 3 + share * 5);
    const killed = character.takeDamage(damage * share, source);
    game.events.emit('characterHurt', { victim: character, attacker: source, amount: damage * share, kind: 'explosion' });
    if (killed) game.events.emit('characterKilled', { victim: character, attacker: source, weapon: 'explosion' });
  }
  for (const vehicle of game.vehicles.list) {
    if (!vehicle.active || vehicle.destroyed) continue;
    const distance = Math.hypot(vehicle.x - x, vehicle.z - z);
    if (distance > radius * 1.2 || distance < 0.5) continue;
    const share = 1 - distance / (radius * 1.2);
    vehicle.damage(damage * share * 2.6, source);
    const push = share * 7;
    vehicle.vx += ((vehicle.x - x) / distance) * push;
    vehicle.vz += ((vehicle.z - z) / distance) * push;
    vehicle.yawRate += (share - 0.5) * 2;
    if (vehicle.driver && vehicle.driver.kind !== 'player') vehicle.driver.takeDamage(damage * share * 0.4, source);
  }
  if (game.population) game.population.alarm(x, z, 70, source, 12);
  game.events.emit('explosion', { x, y, z, source, fromVehicle });
}

// The player's own GPS waypoint: set by clicking a spot on the full map, shown on the full map
// and the minimap, and followed by the GPS route the way a mission target is. A click on it (or
// Backspace on the map) clears it, and so does arriving there.

const ARRIVED = 14;
export const WAYPOINT_COLOR = '#d65cff';

export class GpsWaypoint {
  constructor(events) {
    this.events = events;
    this.point = null;
  }

  get active() {
    return this.point !== null;
  }

  set(x, z) {
    this.point = { x, z };
    this.events.emit('waypointSet', { x, z });
  }

  clear() {
    if (!this.point) return;
    this.point = null;
    this.events.emit('waypointCleared', {});
  }

  /** A click on the map: on the waypoint (within `pick` metres) clears it, anywhere else sets it. */
  clickAt(x, z, pick) {
    if (this.point && Math.hypot(this.point.x - x, this.point.z - z) < pick) {
      this.clear();
      return false;
    }
    this.set(x, z);
    return true;
  }

  update(player) {
    if (this.point && Math.hypot(player.x - this.point.x, player.z - this.point.z) < ARRIVED) {
      this.clear();
      this.events.emit('notice', { text: 'You reached your waypoint.' });
    }
  }
}

/** Where the GPS leads: the player's waypoint when one is set, otherwise the mission's target. */
export function routeGoal(game) {
  if (game.waypoint && game.waypoint.point) return game.waypoint.point;
  return game.missions ? game.missions.routeTarget() : null;
}

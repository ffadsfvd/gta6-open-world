// Street lamps after dark: every standing lamp post near the camera gets a glowing head and a
// warm pool of light on the pavement below it, fading in at dusk and out at dawn. Lamps a car
// has knocked over stay dark.

const RANGE = 140;
const HEAD_REACH = 2.25;
const HEAD_HEIGHT = 7.1;

export class StreetLights {
  constructor(props) {
    this.lamps = props.items.filter((item) => item.kind === 'lamp');
  }

  draw(glow, pools, camera, night) {
    if (night < 0.04) return;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const strength = Math.min(1, night * 1.4);
    for (const lamp of this.lamps) {
      if (lamp.broken) continue;
      const dx = lamp.x - cx;
      const dz = lamp.z - cz;
      if (dx * dx + dz * dz > RANGE * RANGE) continue;
      const hx = lamp.x + Math.sin(lamp.yaw) * HEAD_REACH;
      const hz = lamp.z + Math.cos(lamp.yaw) * HEAD_REACH;
      glow.add(hx, lamp.y + HEAD_HEIGHT, hz, 1.9, 1.5 * strength, 1.05 * strength, 0.55 * strength);
      pools.add(hx, lamp.y + 0.03, hz, 15, 15, 0, 0.5 * strength, 0.33 * strength, 0.15 * strength);
    }
  }
}

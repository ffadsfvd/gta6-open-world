// The clock of Ondaluz: one in-game day passes in DAY_MINUTES real minutes. From the hour it
// works out where the sun (or the moon) is, the colours of the sky, fog, sunlight and ambient
// light, and a `night` share (0 by day, 1 at night) that lamps, lit windows, neon, headlights
// and the bloom follow. Keyframes are blended smoothly; screenshot scenes pin the hour.
import * as THREE from 'three';

const DAY_MINUTES = 24;
const SUNRISE = 6.4;
const SUNSET = 19.6;
const MOON_DIRECTION = new THREE.Vector3(0.55, 0.62, 0.56).normalize();

const NIGHT = {
  zenith: '#03060f', mid: '#091228', horizon: '#18234a', below: '#0a0f1e', fog: '#0f1730',
  sun: '#8193d6', sunI: 0.5, sky: '#34477e', ground: '#1a1522', ambI: 0.55, glow: '#33457a',
  night: 1, env: 0.16, clouds: 0.22, fogFar: 760, exposure: 1.12,
};

/** Lighting through the day. `sunI` and `ambI` are light intensities; `glow` tints the sun halo. */
const KEYS = [
  { hour: 0, ...NIGHT },
  { hour: 5.3, ...NIGHT },
  { hour: 6.0, zenith: '#141c48', mid: '#3c3470', horizon: '#b06070', below: '#4a3048', fog: '#5a4460', sun: '#d08aa0', sunI: 0.35, sky: '#5a60a0', ground: '#4a3442', ambI: 0.62, glow: '#d0605a', night: 0.7, env: 0.24, clouds: 0.5, fogFar: 860, exposure: 1.08 },
  { hour: 6.7, zenith: '#2a3d78', mid: '#8b7fb2', horizon: '#ffad86', below: '#c78c84', fog: '#d6a596', sun: '#ff9b63', sunI: 1.4, sky: '#9daed8', ground: '#c28a78', ambI: 0.8, glow: '#ff8a52', night: 0.25, env: 0.34, clouds: 0.8, fogFar: 950, exposure: 1.05 },
  { hour: 8, zenith: '#2062cc', mid: '#73a7e8', horizon: '#ffe0bd', below: '#f0c49a', fog: '#efd6ba', sun: '#ffe1ba', sunI: 2.8, sky: '#cfe0f5', ground: '#e0b896', ambI: 1.02, glow: '#ffc890', night: 0, env: 0.55, clouds: 1, fogFar: 1100, exposure: 1 },
  { hour: 13, zenith: '#1a58cf', mid: '#68a1ea', horizon: '#ffe5cb', below: '#f2c9a0', fog: '#eed8c1', sun: '#fff0da', sunI: 3.05, sky: '#d2e4f8', ground: '#e6bb94', ambI: 1.06, glow: '#ffd6a6', night: 0, env: 0.55, clouds: 1, fogFar: 1100, exposure: 1 },
  { hour: 16.6, zenith: '#1f5fd0', mid: '#6fa3e8', horizon: '#ffd7ae', below: '#f0bd8e', fog: '#f2d2b0', sun: '#ffd2a0', sunI: 3.1, sky: '#cfe0f5', ground: '#e8b48a', ambI: 1.05, glow: '#ffb86b', night: 0, env: 0.55, clouds: 1, fogFar: 1100, exposure: 1 },
  { hour: 18.3, zenith: '#2b4ea6', mid: '#9c8ccb', horizon: '#ffae6c', below: '#e5946a', fog: '#efae86', sun: '#ffa158', sunI: 3.4, sky: '#b6b4e0', ground: '#e08e6c', ambI: 0.95, glow: '#ff8a3a', night: 0.04, env: 0.5, clouds: 1, fogFar: 1050, exposure: 1.02 },
  { hour: 19.2, zenith: '#22307a', mid: '#8c5aa0', horizon: '#ff7646', below: '#ae5e78', fog: '#c67876', sun: '#ff6c3a', sunI: 2.4, sky: '#8c82c2', ground: '#a0606a', ambI: 0.8, glow: '#ff5a2a', night: 0.3, env: 0.4, clouds: 0.95, fogFar: 980, exposure: 1.05 },
  { hour: 19.75, zenith: '#161f5c', mid: '#5a3f86', horizon: '#d25a52', below: '#6a3c5a', fog: '#7a5068', sun: '#c06aa0', sunI: 0.35, sky: '#6a6aae', ground: '#5a3c4c', ambI: 0.7, glow: '#e0503a', night: 0.6, env: 0.3, clouds: 0.8, fogFar: 900, exposure: 1.08 },
  { hour: 20.4, zenith: '#0b1238', mid: '#262760', horizon: '#5e3c6e', below: '#2c2240', fog: '#2e2c50', sun: '#8a8ad8', sunI: 0.5, sky: '#44508e', ground: '#30283a', ambI: 0.58, glow: '#8a4a80', night: 0.88, env: 0.22, clouds: 0.5, fogFar: 820, exposure: 1.1 },
  { hour: 21.3, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const COLOR_KEYS = ['zenith', 'mid', 'horizon', 'below', 'fog', 'sun', 'sky', 'ground', 'glow'];
const NUMBER_KEYS = ['sunI', 'ambI', 'night', 'env', 'clouds', 'fogFar', 'exposure'];
const parsed = KEYS.map((key) => {
  const entry = { hour: key.hour };
  for (const name of COLOR_KEYS) entry[name] = new THREE.Color(key[name]);
  for (const name of NUMBER_KEYS) entry[name] = key[name];
  return entry;
});

export class TimeOfDay {
  constructor(hour = 17) {
    this.hour = hour;
    this.frozen = false;
    this.speed = 24 / (DAY_MINUTES * 60);
    this.state = { hour };
    for (const name of COLOR_KEYS) this.state[name] = new THREE.Color();
    this.sunDirection = new THREE.Vector3();
    this.lightDirection = new THREE.Vector3();
    this.evaluate();
  }

  get night() {
    return this.state.night;
  }

  /** "18:45" style clock text for the HUD. */
  get clock() {
    const minutes = Math.floor(this.hour * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  set(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    this.evaluate();
  }

  update(dt) {
    if (!this.frozen) this.hour = (this.hour + dt * this.speed) % 24;
    this.evaluate();
  }

  evaluate() {
    const hour = this.hour;
    let index = 0;
    while (index < parsed.length - 2 && parsed[index + 1].hour <= hour) index += 1;
    const a = parsed[index];
    const b = parsed[index + 1];
    const raw = (hour - a.hour) / Math.max(1e-6, b.hour - a.hour);
    const t = raw * raw * (3 - 2 * raw);
    const state = this.state;
    state.hour = hour;
    for (const name of COLOR_KEYS) state[name].copy(a[name]).lerp(b[name], t);
    for (const name of NUMBER_KEYS) state[name] = a[name] + (b[name] - a[name]) * t;
    // The sun rises over the Atlantic (east, +x), passes south (+z) and sets behind the hills.
    const arc = ((hour - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
    this.sunDirection.set(Math.cos(arc), Math.sin(arc) * 0.95, 0.42).normalize();
    // Sunlight never comes from below a few degrees; after dusk the moon lights the city.
    const daylight = hour > 6.0 && hour < SUNSET + 0.15;
    if (daylight) {
      this.lightDirection.copy(this.sunDirection);
      if (this.lightDirection.y < 0.12) {
        this.lightDirection.y = 0.12;
        this.lightDirection.normalize();
      }
    } else {
      this.lightDirection.copy(MOON_DIRECTION);
    }
    this.moonDirection = MOON_DIRECTION;
  }
}

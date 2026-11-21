// Every vehicle model of Solmara: its invented name, size, handling numbers, paint choices and
// the side profiles (body and cabin) the model builder extrudes into a car shape.

export const VEHICLE_TYPES = {
  compact: {
    name: 'Pulga', length: 3.8, width: 1.72, mass: 1050, power: 8.5, maxSpeed: 40, grip: 9.5, steerMax: 0.62, wheelRadius: 0.32, wheelBase: 1.2,
    body: [[-1.9, 0.3], [1.9, 0.3], [1.92, 0.6], [1.75, 0.82], [1.05, 0.95], [-1.7, 0.98], [-1.92, 0.85], [-1.95, 0.55]],
    cabin: [[1.05, 0.93], [0.35, 1.45], [-1.55, 1.45], [-1.75, 0.98]],
    paints: ['#e63946', '#2a9d8f', '#f4a261', '#90be6d', '#ffd166', '#8ecae6', '#f8f9fa'],
  },
  sedan: {
    name: 'Marquesa', length: 4.6, width: 1.86, mass: 1400, power: 9.5, maxSpeed: 46, grip: 9.5, steerMax: 0.58, wheelRadius: 0.36, wheelBase: 1.42,
    body: [[-2.3, 0.3], [2.3, 0.3], [2.32, 0.6], [2.1, 0.85], [0.95, 0.95], [-1.45, 0.98], [-2.2, 0.92], [-2.32, 0.7]],
    cabin: [[0.95, 0.94], [0.15, 1.42], [-0.95, 1.42], [-1.5, 0.96]],
    paints: ['#1d3557', '#e5e5e5', '#6c757d', '#9d0208', '#264653', '#bc6c25', '#3a5a40', '#f1faee', '#22223b'],
  },
  sports: {
    name: 'Vexa GT', length: 4.4, width: 1.96, mass: 1250, power: 15, maxSpeed: 64, grip: 11.5, steerMax: 0.55, wheelRadius: 0.37, wheelBase: 1.35,
    body: [[-2.2, 0.25], [2.2, 0.25], [2.25, 0.48], [2.05, 0.66], [0.6, 0.8], [-1.2, 0.84], [-2.15, 0.82], [-2.25, 0.6]],
    cabin: [[0.65, 0.78], [-0.15, 1.16], [-0.8, 1.16], [-1.6, 0.84]],
    paints: ['#d00000', '#ffba08', '#3a86ff', '#ff006e', '#f8f9fa', '#06d6a0'],
    spoiler: true,
  },
  muscle: {
    name: 'Furia SS', length: 4.8, width: 1.95, mass: 1550, power: 13, maxSpeed: 56, grip: 9, steerMax: 0.55, wheelRadius: 0.38, wheelBase: 1.5,
    body: [[-2.4, 0.3], [2.4, 0.3], [2.42, 0.62], [2.3, 0.9], [0.8, 0.98], [-1.5, 1.0], [-2.35, 0.95], [-2.42, 0.7]],
    cabin: [[0.8, 0.96], [0.05, 1.38], [-0.95, 1.38], [-1.6, 0.99]],
    paints: ['#ff7b00', '#006d77', '#000814', '#c1121f', '#ffd60a', '#7209b7'],
  },
  suv: {
    name: 'Montana XL', length: 4.8, width: 2.0, mass: 2000, power: 10, maxSpeed: 44, grip: 8.5, steerMax: 0.55, wheelRadius: 0.44, wheelBase: 1.55,
    body: [[-2.4, 0.42], [2.4, 0.42], [2.42, 0.8], [2.25, 1.08], [1.2, 1.15], [-2.3, 1.18], [-2.42, 0.95]],
    cabin: [[1.2, 1.13], [0.6, 1.78], [-2.2, 1.8], [-2.32, 1.16]],
    paints: ['#212529', '#f8f9fa', '#495057', '#7f5539', '#023e8a', '#606c38'],
  },
  pickup: {
    name: 'Rancho', length: 5.2, width: 2.0, mass: 2100, power: 10, maxSpeed: 42, grip: 8.5, steerMax: 0.52, wheelRadius: 0.44, wheelBase: 1.75,
    body: [[-2.6, 0.42], [2.6, 0.42], [2.62, 0.85], [2.45, 1.12], [1.3, 1.2], [-0.6, 1.2], [-0.6, 0.98], [-2.6, 0.98]],
    cabin: [[1.3, 1.18], [0.75, 1.85], [-0.55, 1.85], [-0.6, 1.2]],
    paints: ['#9b2226', '#005f73', '#ee9b00', '#e9d8a6', '#3d405b', '#81b29a'],
    bed: true,
  },
  van: {
    name: 'Cargo Van', length: 5.0, width: 2.05, mass: 2300, power: 8.5, maxSpeed: 38, grip: 8, steerMax: 0.52, wheelRadius: 0.4, wheelBase: 1.7,
    body: [[-2.5, 0.38], [2.5, 0.38], [2.52, 0.85], [2.35, 1.15], [1.75, 1.3], [1.2, 2.3], [-2.45, 2.35], [-2.5, 1.3]],
    cabin: null,
    paints: ['#f8f9fa', '#e9ecef', '#ffb703', '#219ebc'],
    vanWindows: true,
  },
  taxi: {
    name: 'Sunny Cab', length: 4.6, width: 1.86, mass: 1400, power: 9.5, maxSpeed: 46, grip: 9.5, steerMax: 0.58, wheelRadius: 0.36, wheelBase: 1.42,
    body: null, cabin: null, base: 'sedan',
    paints: ['#ffc300'],
    taxiSign: true,
  },
  police: {
    name: 'SBPD Cruiser', length: 4.8, width: 1.95, mass: 1650, power: 13.5, maxSpeed: 58, grip: 10.5, steerMax: 0.56, wheelRadius: 0.38, wheelBase: 1.5,
    body: null, cabin: null, base: 'muscle',
    paints: ['#f8f9fa'],
    lightBar: true,
  },
};

for (const spec of Object.values(VEHICLE_TYPES)) {
  if (spec.base) {
    spec.body = VEHICLE_TYPES[spec.base].body;
    spec.cabin = VEHICLE_TYPES[spec.base].cabin;
  }
}

/** Models that ordinary traffic and parked cars pick from, with weights. */
export const TRAFFIC_MIX = [
  ['sedan', 5], ['compact', 4], ['suv', 3], ['taxi', 2], ['pickup', 2], ['muscle', 1.5], ['van', 1.5], ['sports', 0.8],
];

export function pickTrafficType(rng) {
  const total = TRAFFIC_MIX.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [type, weight] of TRAFFIC_MIX) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return 'sedan';
}

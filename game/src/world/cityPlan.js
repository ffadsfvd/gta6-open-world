// The map of Ondaluz: a grid of avenues and streets between the Vista Alta hills (west and north),
// Sunwheel Beach on the Atlantic side (east) and the Ironwharf docks (south). Districts, the
// special blocks, street names and the named places missions and respawns use.
import { GRID_X, GRID_Z, LOT_INSET, ROAD_HALF, SIDEWALK_LINE, SHORE, PIER } from '../core/config.js';

export const BLOCKS_X = GRID_X.length - 1;
export const BLOCKS_Z = GRID_Z.length - 1;

export const DISTRICTS = {
  strand: { name: 'Carmine Strand', mapColor: '#f6c3ad', style: 'deco' },
  glass: { name: 'Glasswater', mapColor: '#a9bfd6', style: 'tower' },
  mercado: { name: 'Mercado', mapColor: '#f1cf95', style: 'shops' },
  jacaranda: { name: 'Jacaranda Heights', mapColor: '#bcd7a1', style: 'houses' },
  docks: { name: 'Ironwharf', mapColor: '#c4b8aa', style: 'warehouse' },
  norte: { name: 'Vista Norte', mapColor: '#cfc0e0', style: 'midrise' },
  beach: { name: 'Sunwheel Beach', mapColor: '#f4e0b0' },
  pier: { name: 'Sunwheel Pier', mapColor: '#c79a6e' },
  lighthouse: { name: 'Lighthouse Point', mapColor: '#d9c9a0' },
  marina: { name: 'Ondaluz Marina', mapColor: '#bdb3a6' },
  bay: { name: 'Ondaluz Bay', mapColor: '#3f9fb8' },
  hills: { name: 'Vista Alta Hills', mapColor: '#9bbf7f' },
};

export function districtOfBlock(bx, bz) {
  if (bz === 6) return 'docks';
  if (bx >= 5) return 'strand';
  if (bx <= 1) return 'jacaranda';
  if (bz === 0) return 'norte';
  if (bz <= 3) return 'glass';
  return 'mercado';
}

/** Blocks with hand-placed content instead of generated lots. */
export const SPECIAL_BLOCKS = {
  '3,4': 'plaza',
  '0,2': 'park',
  '1,2': 'police',
  '4,1': 'hospital',
  '3,2': 'tower',
  '6,4': 'safehouse',
  '2,6': 'garage',
  '4,5': 'gunshop',
  '4,6': 'depot',
  '1,5': 'gas',
  '6,2': 'hotel',
};

export function specialOfBlock(bx, bz) {
  return SPECIAL_BLOCKS[`${bx},${bz}`] ?? null;
}

/** North-south avenues, west to east (one per GRID_X line). */
export const AVENUES = [
  'Hillcrest Drive', 'Jacaranda Avenue', 'Almendro Avenue', 'Bayline Avenue',
  'Central Avenue', 'Flamingo Avenue', 'Conch Avenue', 'Seabreeze Boulevard',
];
/** East-west streets, north to south (one per GRID_Z line). */
export const STREETS = [
  'Northcliff Road', 'Lighthouse Street', 'Tower Street', 'Amber Street',
  'Pier Street', 'Mercado Street', 'Dockside Street', 'Wharf Way',
];

export function blockBounds(bx, bz) {
  const x0 = GRID_X[bx];
  const x1 = GRID_X[bx + 1];
  const z0 = GRID_Z[bz];
  const z1 = GRID_Z[bz + 1];
  return {
    bx, bz, x0, x1, z0, z1,
    cx: (x0 + x1) / 2,
    cz: (z0 + z1) / 2,
    outerMinX: x0 + ROAD_HALF, outerMaxX: x1 - ROAD_HALF,
    outerMinZ: z0 + ROAD_HALF, outerMaxZ: z1 - ROAD_HALF,
    lotMinX: x0 + LOT_INSET, lotMaxX: x1 - LOT_INSET,
    lotMinZ: z0 + LOT_INSET, lotMaxZ: z1 - LOT_INSET,
    walkMinX: x0 + SIDEWALK_LINE, walkMaxX: x1 - SIDEWALK_LINE,
    walkMinZ: z0 + SIDEWALK_LINE, walkMaxZ: z1 - SIDEWALK_LINE,
  };
}

export function forEachBlock(callback) {
  for (let bz = 0; bz < BLOCKS_Z; bz += 1) {
    for (let bx = 0; bx < BLOCKS_X; bx += 1) callback(bx, bz);
  }
}

/** Index of the grid line within half a road of `value`, or -1. */
export function roadLineAt(value, lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (Math.abs(value - lines[index]) <= ROAD_HALF) return index;
  }
  return -1;
}

export function blockAt(x, z) {
  for (let bx = 0; bx < BLOCKS_X; bx += 1) {
    if (x <= GRID_X[bx] + ROAD_HALF || x >= GRID_X[bx + 1] - ROAD_HALF) continue;
    for (let bz = 0; bz < BLOCKS_Z; bz += 1) {
      if (z > GRID_Z[bz] + ROAD_HALF && z < GRID_Z[bz + 1] - ROAD_HALF) return { bx, bz };
    }
  }
  return null;
}

/** The district id for any point of the map. */
export function districtAt(x, z) {
  if (Math.abs(z) <= PIER.halfWidth + 1 && x > SHORE.promenadeEnd && x < PIER.maxX) return 'pier';
  if (x > SHORE.shoreline + 12 || z > SHORE.quayEdge) return 'bay';
  if (x > SHORE.promenadeEnd) return z < -260 ? 'lighthouse' : 'beach';
  if (z > GRID_Z[GRID_Z.length - 1] + ROAD_HALF) return 'marina';
  if (x < GRID_X[0] - ROAD_HALF - 6 || z < GRID_Z[0] - ROAD_HALF - 6) return 'hills';
  const bx = Math.max(0, Math.min(BLOCKS_X - 1, Math.floor((x - GRID_X[0]) / 80)));
  const bz = Math.max(0, Math.min(BLOCKS_Z - 1, Math.floor((z - GRID_Z[0]) / 80)));
  return districtOfBlock(bx, bz);
}

export function districtName(x, z) {
  return DISTRICTS[districtAt(x, z)].name;
}

/** The avenue or street under (x, z), if any. */
export function streetNameAt(x, z) {
  const column = roadLineAt(x, GRID_X);
  const row = roadLineAt(z, GRID_Z);
  if (column >= 0 && row >= 0) return `${AVENUES[column]} & ${STREETS[row]}`;
  if (column >= 0) return AVENUES[column];
  if (row >= 0) return STREETS[row];
  return '';
}

/** Named spots: mission givers, drop-offs, respawns (yaw: the way Kai faces when put there). */
export const PLACES = {
  start: { x: 250, z: 39, yaw: -Math.PI / 2, label: 'Seabreeze promenade' },
  safehouse: { x: 231, z: 40, yaw: Math.PI, label: 'Seashell Apartments' },
  hospital: { x: 40, z: -169, yaw: Math.PI / 2, label: 'St. Amaro Medical' },
  policeStation: { x: -169, z: -120, yaw: 0, label: 'Ondaluz Bay Police' },
  tacoTruck: { x: -52, z: 30, label: "Lou's Taco Ola" },
  garage: { x: -120, z: 166, label: "Juno's Garage" },
  gunShop: { x: 40, z: 89, label: 'Bayside Arms' },
  depot: { x: 40, z: 169, label: 'Pelican Express' },
  hotel: { x: 218, z: -120, label: 'Suncrest Hotel' },
  pierGate: { x: 262, z: 0, label: 'Sunwheel Pier' },
  lighthouse: { x: 292, z: -318, label: 'Lighthouse Point' },
  warehouse: { x: -200, z: 262, label: 'Pier 9 Warehouse' },
  plaza: { x: -40, z: 40, label: 'Mercado Plaza' },
};

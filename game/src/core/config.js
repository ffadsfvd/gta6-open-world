// Every tuning number of Ondaluz Undercurrent in one place: city grid, road widths, shoreline,
// population sizes and the save key. Other modules import these instead of repeating numbers.

/** Road centre lines running north-south (x) and east-west (z), in metres. */
export const GRID_X = [-320, -240, -160, -80, 0, 80, 160, 240];
export const GRID_Z = [-320, -240, -160, -80, 0, 80, 160, 240];

export const ROAD_HALF = 7;
export const LANE_WIDTH = 3.5;
export const SIDEWALK = 4;
export const CURB_HEIGHT = 0.15;
/** Distance from a junction centre to the stop line of each lane. */
export const STOP_OFFSET = 11;
/** Sidewalk centre line, measured from the road centre line. */
export const SIDEWALK_LINE = ROAD_HALF + SIDEWALK / 2;
/** Inset from a road centre line to where building lots start. */
export const LOT_INSET = ROAD_HALF + SIDEWALK;

export const WATER_LEVEL = -0.6;
export const SHORE = {
  promenadeEnd: 255,
  shoreline: 300,
  quayStart: 247,
  quayEdge: 290,
};
export const PIER = { minX: 255, maxX: 402, halfWidth: 6, deck: 0.6 };
export const WORLD_BOUNDS = { minX: -345, maxX: 405, minZ: -345, maxZ: 296 };

export const SUN_DIRECTION = { x: -0.4, y: 0.66, z: 0.64 };

export const POPULATION = {
  traffic: 30,
  pedestrians: 58,
  parked: 20,
  spawnMin: 55,
  spawnMax: 170,
  despawn: 210,
};

export const PLAYER_TUNING = {
  walkSpeed: 2.2,
  runSpeed: 5.4,
  sprintSpeed: 8.2,
  jumpSpeed: 5.2,
  gravity: 18,
  radius: 0.35,
  maxHealth: 100,
  maxArmour: 100,
};

export const CAMERA_TUNING = {
  footDistance: 4.6,
  footHeight: 1.65,
  carDistance: 7.4,
  carHeight: 2.4,
  aimDistance: 2.2,
  fov: 62,
  mouseSensitivity: 0.0023,
};

export const SAVE_KEY = 'ondaluz.save.v1';
export const SETTINGS_KEY = 'ondaluz.settings.v1';
export const CITY_NAME = 'Ondaluz';
export const GAME_TITLE = 'Ondaluz Undercurrent';

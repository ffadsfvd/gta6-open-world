// The people of the story: names, colours and portrait features for dialogue, and where the
// mission givers wait for Kai.
import { PLACES } from '../world/cityPlan.js';
import { OUTFITS } from '../characters/appearance.js';

export const CAST = {
  kai: { name: 'Kai Moreno', color: '#ffb347', outfit: OUTFITS.player, hair: 'short', extra: 'stubble' },
  lou: { name: 'Auntie Lou', color: '#ff7aa2', outfit: OUTFITS.lou, hair: 'bun', extra: 'earrings' },
  juno: { name: 'Juno Park', color: '#2ec4b6', outfit: OUTFITS.juno, hair: 'bob', extra: 'cap' },
  voss: { name: 'Det. Harlan Voss', color: '#8d99ae', outfit: OUTFITS.voss, hair: 'slick', extra: 'mustache' },
  crane: { name: 'Silas Crane', color: '#e9c46a', outfit: OUTFITS.crane, hair: 'short', extra: 'shades' },
  dash: { name: 'Dash Ortega', color: '#ffbe0b', outfit: OUTFITS.dash, hair: 'short', extra: 'headband' },
  thug: { name: "Crane's Crew", color: '#e63946', outfit: OUTFITS.gang, hair: 'short', extra: 'headband' },
  dispatch: { name: 'SBPD Dispatch', color: '#3a86ff', outfit: OUTFITS.police, hair: 'short', extra: 'headset' },
  fare: { name: 'Passenger', color: '#ff9f1c', outfit: OUTFITS.fare, hair: 'bob', extra: 'none' },
};

/** Where each mission giver stands, and the letter on their map blip. */
export const CONTACTS = {
  lou: { id: 'lou', letter: 'L', x: PLACES.tacoTruck.x, z: PLACES.tacoTruck.z, yaw: -Math.PI / 2 },
  juno: { id: 'juno', letter: 'J', x: PLACES.garage.x, z: PLACES.garage.z + 4, yaw: Math.PI },
  voss: { id: 'voss', letter: 'V', x: 268, z: 3, yaw: -Math.PI / 2 },
};

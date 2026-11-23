// Radio call signs of the Ondaluz Bay Police: cruisers go by the bay's fish and a unit number,
// officers on foot by surname, and the helicopter is Skyhawk.

const CRUISER_NAMES = ['Marlin', 'Tarpon', 'Barracuda', 'Snapper', 'Wahoo', 'Grouper', 'Mako', 'Dorado'];
const SURNAMES = ['Reyes', 'Okafor', 'Lindqvist', 'Navarro', 'Castell', 'Duarte', 'Brennan', 'Sato', 'Moreau', 'Ibarra', 'Quintero', 'Hale'];

export const AIR_UNIT_CALL_SIGN = 'Skyhawk 1';

let cruisersNamed = 0;

/** A fresh cruiser call sign such as "Marlin-17". */
export function cruiserCallSign(vehicleId) {
  const name = CRUISER_NAMES[cruisersNamed % CRUISER_NAMES.length];
  cruisersNamed += 1;
  return `${name}-${10 + ((vehicleId * 7) % 40)}`;
}

/** An officer's name on the radio, such as "Ofc. Navarro". */
export function officerCallSign(rng) {
  return `Ofc. ${rng.pick(SURNAMES)}`;
}

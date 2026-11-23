// Pelican Express: take a company van from the Ironwharf depot and drop three parcels across
// town before the clock runs out. Each address is a sidewalk door: stopping the van at the curb
// on either side of the street counts.
import { call, deliver, enterVehicle, timeLimit } from '../missions/missionSteps.js';
import { CURB_REACH } from './taxiJobs.js';
import { PLACES } from '../world/cityPlan.js';

const ADDRESSES = [
  { x: 120, z: 9, label: 'Pier Street' },
  { x: -169, z: -40, label: 'Almendro Avenue' },
  { x: 9, z: -120, label: 'Central Avenue' },
  { x: 231, z: 160, label: 'Seabreeze Boulevard' },
  { x: -280, z: 89, label: 'Jacaranda Heights' },
  { x: 89, z: -280, label: 'Vista Norte' },
  { x: -40, z: 151, label: 'Mercado Street' },
];

export function deliveryJob(game) {
  const rng = game.rng;
  const stops = [];
  const pool = [...ADDRESSES];
  for (let index = 0; index < 3; index += 1) stops.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return {
    id: 'delivery',
    title: 'Pelican Express',
    kindLabel: 'Delivery job',
    reward: 750,
    status(ctx) {
      const dropped = ctx.mission.steps.slice(0, Math.max(0, ctx.mission.index)).filter((step) => step.kind === 'deliver').length;
      const van = ctx.vars.van;
      return [['Parcels', `${dropped} of ${stops.length} dropped`], ['Van', van ? `${Math.round(van.healthShare * 100)}%` : '-']];
    },
    steps: () => [
      call((ctx) => {
        ctx.vars.van = ctx.runner.spawnVehicle('van', PLACES.depot.x - 6, PLACES.depot.z - 3.5, Math.PI / 2, { paint: '#ffffff' });
      }),
      enterVehicle('van', 'Get in the *Pelican Express van*.'),
      timeLimit(170),
      ...stops.map((stop, index) => deliver('van', stop, `Drop parcel ${index + 1}/3 on *${stop.label}*.`, { radius: CURB_REACH - 3 })),
    ],
    onPass(g) {
      g.progress.bump('deliveries', 3);
    },
  };
}

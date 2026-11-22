// Story 1 — Back in the Sun. Kai is home after three years away. Auntie Lou sends him to her
// old friend Juno for work; first he needs a car, and in Ondaluz you take one.
import { PLACES } from '../../world/cityPlan.js';
import { getInAnyVehicle, goTo, talk } from '../missionSteps.js';

export default {
  id: 'backInTheSun',
  title: 'Back in the Sun',
  giver: 'lou',
  reward: 500,
  story: true,
  steps: () => [
    talk([
      ['lou', 'Kai! Look what the sea dragged in. Three years away and you come back skinny.'],
      ['kai', 'Good to see you, Auntie. The truck looks exactly the same.'],
      ['lou', "Business is slow. Silas Crane owns the docks now, and he wants my route for his 'deliveries'."],
      ['lou', "Go see Juno at her garage in Ironwharf. She'll find you work. And get a car, mijo. Nobody walks in Ondaluz."],
    ]),
    getInAnyVehicle('Get a *car*. Press *F* by any car to take it.'),
    goTo(PLACES.garage, "Drive to *Juno's Garage* in Ironwharf.", { radius: 6, vehicle: 'any' }),
    talk([
      ['juno', 'Kai Moreno, as I live and breathe. Nice ride. Yours?'],
      ['kai', 'It is now.'],
      ['juno', "Ha! Come back when you want real work. Crane's crew has been leaning on everyone down here."],
    ]),
  ],
};

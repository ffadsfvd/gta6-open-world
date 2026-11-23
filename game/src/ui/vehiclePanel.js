// The vehicle panel (bottom right, while driving): the car's name and class, the speed dial with
// the gear, and a condition bar read from the car's real damage, which turns into a fire warning
// when the engine starts burning.
import { drawSpeedometer, gearFor } from './speedometer.js';

const CLASS_NAMES = { compact: 'Compact', sedan: 'Sedan', sports: 'Sports', muscle: 'Muscle', suv: 'SUV', pickup: 'Pickup', van: 'Van', taxi: 'Taxi', police: 'Police cruiser' };

export class VehiclePanel {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <header class="panel-head"><span class="panel-title" data-part="name"></span><span class="panel-kicker" data-part="kind"></span></header>
      <canvas class="speed-dial" id="speedometer-canvas" width="280" height="150"></canvas>
      <div class="condition-row"><span>CONDITION</span><i class="meter"><b data-part="bar"></b></i><span class="condition-value" data-part="value"></span></div>
      <p class="vehicle-warning hidden" data-part="warning">ENGINE ON FIRE: GET OUT</p>`;
    this.parts = Object.fromEntries([...root.querySelectorAll('[data-part]')].map((node) => [node.dataset.part, node]));
    this.dial = root.querySelector('canvas').getContext('2d');
    this.vehicle = null;
  }

  /** The dial redraws every frame; the text only when the car changes. */
  update(game, refreshText) {
    const vehicle = game.player.character.vehicle;
    this.root.classList.toggle('hidden', !vehicle);
    if (!vehicle) {
      this.vehicle = null;
      return;
    }
    drawSpeedometer(this.dial, vehicle.speed * 2.237, gearFor(vehicle.speed, vehicle.reversing), null);
    if (vehicle !== this.vehicle) {
      this.vehicle = vehicle;
      this.parts.name.textContent = vehicle.name;
      this.parts.kind.textContent = (CLASS_NAMES[vehicle.type] ?? vehicle.type).toUpperCase();
    }
    if (!refreshText) return;
    const share = Math.max(0, vehicle.healthShare);
    this.parts.bar.style.width = `${Math.round(share * 100)}%`;
    this.parts.bar.className = share > 0.5 ? 'good' : share > 0.25 ? 'worn' : 'bad';
    this.parts.value.textContent = `${Math.round(share * 100)}%`;
    this.parts.warning.classList.toggle('hidden', !vehicle.onFire);
  }
}

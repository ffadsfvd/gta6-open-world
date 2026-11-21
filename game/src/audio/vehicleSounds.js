// Continuous car sounds: the player's engine (two oscillators through a throttle-opened filter,
// pitch from speed and gear, a dip on each upshift), tyre screech while sliding, the held horn,
// and police sirens wailing louder and panned as cruisers close in.

const GEAR_TOPS = [7, 14, 22, 31, 42, 70];

export class VehicleSounds {
  constructor(engine) {
    this.engine = engine;
    this.built = false;
  }

  build() {
    const e = this.engine;
    if (!e.ready || this.built) return;
    const ctx = e.context;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 600;
    this.saw = ctx.createOscillator();
    this.saw.type = 'sawtooth';
    this.sub = ctx.createOscillator();
    this.sub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.saw.connect(this.engineFilter);
    this.sub.connect(subGain);
    subGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(e.sfx);
    this.saw.start();
    this.sub.start();
    // Tyre screech: band-passed looping noise.
    this.screech = ctx.createBufferSource();
    this.screech.buffer = e.noise;
    this.screech.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2300;
    band.Q.value = 6;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.screech.connect(band);
    band.connect(this.screechGain);
    this.screechGain.connect(e.sfx);
    this.screech.start();
    // Horn.
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    for (const frequency of [392, 494]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = frequency;
      osc.connect(this.hornGain);
      osc.start();
    }
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 1800;
    this.hornGain.connect(hornFilter);
    hornFilter.connect(e.sfx);
    // Siren: a wailing oscillator swept by a slow LFO.
    this.siren = ctx.createOscillator();
    this.siren.type = 'sawtooth';
    this.siren.frequency.value = 900;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.32;
    const depth = ctx.createGain();
    depth.gain.value = 380;
    lfo.connect(depth);
    depth.connect(this.siren.frequency);
    this.sirenFilter = ctx.createBiquadFilter();
    this.sirenFilter.type = 'lowpass';
    this.sirenFilter.frequency.value = 2400;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenPan = ctx.createStereoPanner();
    this.siren.connect(this.sirenFilter);
    this.sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.sirenPan);
    this.sirenPan.connect(e.sfx);
    this.siren.start();
    lfo.start();
    this.lastGear = 0;
    this.shiftDip = 0;
    this.built = true;
  }

  update(dt, game, active) {
    if (!this.engine.ready) return;
    this.build();
    const now = this.engine.now;
    const player = game.player.character;
    const vehicle = active ? player.vehicle : null;
    if (vehicle && !vehicle.destroyed) {
      const speed = Math.abs(vehicle.forwardSpeed);
      let gear = GEAR_TOPS.findIndex((top) => speed < top);
      if (gear < 0) gear = GEAR_TOPS.length - 1;
      if (gear > this.lastGear) this.shiftDip = 0.18;
      this.lastGear = gear;
      this.shiftDip = Math.max(0, this.shiftDip - dt);
      const low = gear === 0 ? 0 : GEAR_TOPS[gear - 1];
      const share = (speed - low) / (GEAR_TOPS[gear] - low);
      const rpm = 900 + share * 5200 - this.shiftDip * 9000;
      const base = Math.max(28, rpm / 32) * (vehicle.type === 'sports' || vehicle.type === 'muscle' ? 0.85 : 1);
      this.saw.frequency.setTargetAtTime(base, now, 0.04);
      this.sub.frequency.setTargetAtTime(base / 2, now, 0.04);
      const throttle = vehicle.controls.throttle;
      this.engineFilter.frequency.setTargetAtTime(380 + throttle * 1600 + share * 600, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.06 + throttle * 0.07, now, 0.08);
      const skid = vehicle.slip > 3 && vehicle.speed > 4 && vehicle.onGround ? Math.min(0.14, (vehicle.slip - 3) * 0.03) : 0;
      this.screechGain.gain.setTargetAtTime(skid, now, 0.05);
      this.hornGain.gain.setTargetAtTime(vehicle.horn ? 0.07 : 0, now, 0.02);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.15);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
      this.hornGain.gain.setTargetAtTime(0, now, 0.02);
    }
    // Loudest siren within earshot.
    let best = null;
    let bestDistance = 140;
    for (const car of game.vehicles.list) {
      if (!car.siren || !car.active) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = car;
      }
    }
    if (best && active) {
      const volume = 0.11 * (1 - bestDistance / 140);
      this.sirenGain.gain.setTargetAtTime(volume, now, 0.2);
      const yaw = game.followCamera.yaw;
      const dx = best.x - game.camera.position.x;
      const dz = best.z - game.camera.position.z;
      const side = (dx * -Math.cos(yaw) + dz * Math.sin(yaw)) / (Math.hypot(dx, dz) || 1);
      this.sirenPan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, side)), now, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.4);
    }
  }
}

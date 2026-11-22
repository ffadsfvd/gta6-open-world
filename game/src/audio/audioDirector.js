// Connects the game to its sound: world events become positioned one-shots, the car radio
// plays while Kai drives (N changes station), the title theme plays on the menu, and the
// engine, screech, horn and siren layers follow the action.
import { AudioEngine } from './audioEngine.js';
import { SoundEffects } from './soundEffects.js';
import { MusicPlayer, STATIONS } from './musicPlayer.js';
import { VehicleSounds } from './vehicleSounds.js';

export class AudioDirector {
  constructor(game) {
    this.game = game;
    this.engine = new AudioEngine();
    this.sfx = new SoundEffects(this.engine);
    this.music = new MusicPlayer(this.engine);
    this.cars = new VehicleSounds(this.engine);
    this.station = 0;
    this.crashCooldown = 0;
    const events = game.events;
    events.on('gunfire', (e) => this.at(e.x, e.z, (v, p) => this.sfx.gunshot(e.weapon, v, p), 160));
    events.on('punch', (e) => this.at(e.x, e.z, (v) => (e.target ? this.sfx.punch(v) : null), 40));
    const crash = (speed, x, z) => {
      if (this.crashCooldown > 0 || speed < 4) return;
      this.crashCooldown = 0.12;
      this.at(x, z, (v, p) => this.sfx.crash(speed * v, p), 90);
    };
    events.on('vehicleImpact', (e) => crash(e.speed, e.x, e.z));
    events.on('vehicleCrash', (e) => crash(e.speed, e.x, e.z));
    events.on('explosion', (e) => this.at(e.x, e.z, (v, p) => this.sfx.explosion(v, p), 250));
    events.on('vehicleSunk', () => this.sfx.splash());
    events.on('propBroken', (e) => this.at(e.x, e.z, () => this.sfx.breakProp(e.kind), 60));
    events.on('horn', (e) => this.at(e.vehicle.x, e.vehicle.z, (v, p) => this.sfx.horn(e.duration, v, p), 70));
    events.on('money', (e) => {
      if (e.amount > 0) this.sfx.cash();
    });
    events.on('checkpoint', () => this.sfx.checkpoint());
    events.on('pickup', () => this.sfx.checkpoint());
    events.on('missionPassed', () => this.sfx.passed());
    events.on('missionFailed', () => this.sfx.failed());
    events.on('wantedChanged', (e) => {
      if (e.level > e.previous) this.sfx.wantedUp();
    });
    events.on('playerWasted', () => this.sfx.wasted());
    events.on('raceCountdown', () => this.sfx.click());
    events.on('uiClick', () => this.sfx.click());
    events.on('uiSelect', () => this.sfx.select());
  }

  /** Plays a sound for something at (x, z), quieter with distance and panned left/right. */
  at(x, z, play, range) {
    if (!this.engine.ready) return;
    const camera = this.game.camera.position;
    const dx = x - camera.x;
    const dz = z - camera.z;
    const distance = Math.hypot(dx, dz);
    if (distance > range) return;
    const yaw = this.game.followCamera.yaw;
    const side = distance > 0.5 ? (dx * -Math.cos(yaw) + dz * Math.sin(yaw)) / distance : 0;
    play(Math.max(0.05, 1 - distance / range), Math.max(-0.85, Math.min(0.85, side)));
  }

  unlock() {
    this.engine.unlock();
  }

  setVolumes(settings) {
    this.engine.setVolumes({ master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume });
  }

  stationName() {
    return this.station < 0 ? 'RADIO OFF  ·  N to tune' : `${STATIONS[this.station].name}  ·  N`;
  }

  nextStation() {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    this.sfx.click();
  }

  update(dt) {
    const game = this.game;
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    const playing = game.state === 'playing';
    this.cars.update(dt, game, playing);
    const driving = playing && Boolean(game.player.character.vehicle);
    if (game.state === 'title') this.music.playTitle();
    else if (driving && this.station >= 0) this.music.play(STATIONS[this.station]);
    else if (game.state !== 'paused') this.music.stop();
  }
}

// The opening: three camera moves over Ondaluz with captions that set up Kai's return, then a
// cut to the Seashell Apartments where play begins. Enter, E, Space or Escape skips it.
import * as THREE from 'three';

const SHOTS = [
  { from: [560, 85, 210], to: [470, 60, 70], lookFrom: [120, 25, -20], lookTo: [60, 20, -60], seconds: 5, caption: 'Ondaluz, on the Atlantic coast. Sun, sea and three hundred days of summer.' },
  { from: [246, 7, 230], to: [246, 5, 90], lookFrom: [238, 3, 60], lookTo: [236, 3, -80], seconds: 4.5, caption: 'Three years ago, Kai Moreno took the fall for a job that went wrong.' },
  { from: [262, 6, 70], to: [252, 3.4, 47], lookFrom: [250, 1.6, 39], lookTo: [250, 1.6, 30], seconds: 4, caption: 'Now he is home. And the docks have a new owner.' },
];

export class IntroSequence {
  constructor(game) {
    this.game = game;
    this.caption = document.getElementById('intro-caption');
    this.active = false;
    this.override = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 55 };
  }

  start(onDone) {
    this.active = true;
    this.index = 0;
    this.time = 0;
    // The key that chose New Game must not also skip the intro.
    this.guard = 0.6;
    this.onDone = onDone;
    this.game.followCamera.override = this.override;
    this.showCaption();
  }

  showCaption() {
    const shot = SHOTS[this.index];
    this.caption.textContent = shot.caption;
    this.caption.classList.remove('hidden');
    this.caption.style.animation = 'none';
    void this.caption.offsetWidth;
    this.caption.style.animation = '';
  }

  finish() {
    this.active = false;
    this.caption.classList.add('hidden');
    this.game.followCamera.override = null;
    if (this.onDone) this.onDone();
  }

  update(dt, input) {
    if (!this.active) return;
    this.guard = Math.max(0, this.guard - dt);
    if (this.guard <= 0 && (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('pause') || input.wasPressed('jump'))) {
      this.finish();
      return;
    }
    this.time += dt;
    const shot = SHOTS[this.index];
    const t = Math.min(1, this.time / shot.seconds);
    const ease = t * t * (3 - 2 * t);
    const lerp = (a, b) => a + (b - a) * ease;
    this.override.position.set(lerp(shot.from[0], shot.to[0]), lerp(shot.from[1], shot.to[1]), lerp(shot.from[2], shot.to[2]));
    this.override.target.set(lerp(shot.lookFrom[0], shot.lookTo[0]), lerp(shot.lookFrom[1], shot.lookTo[1]), lerp(shot.lookFrom[2], shot.lookTo[2]));
    if (t >= 1) {
      this.index += 1;
      this.time = 0;
      if (this.index >= SHOTS.length) this.finish();
      else this.showCaption();
    }
  }
}

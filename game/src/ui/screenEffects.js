// Full-screen feedback: a red vignette that flares on damage and pulses at low health, fades
// to black for respawns and cutscene cuts, and the drained colour of being flatlined or arrested.

export class ScreenEffects {
  constructor(events) {
    this.vignette = document.getElementById('damage-vignette');
    this.fade = document.getElementById('screen-fade');
    this.canvas = document.getElementById('game-canvas');
    this.hurt = 0;
    this.time = 0;
    events.on('characterHurt', (e) => {
      if (e.victim.kind === 'player') this.hurt = Math.min(1, this.hurt + e.amount / 35);
    });
    events.on('pedestrianHit', (e) => {
      if (e.character.kind === 'player') this.hurt = 1;
    });
  }

  fadeTo(opacity) {
    this.fade.style.opacity = String(opacity);
  }

  drain(on) {
    this.canvas.style.transition = 'filter 1.2s ease';
    this.canvas.style.filter = on ? 'grayscale(0.85) contrast(1.15) brightness(0.9)' : '';
  }

  update(dt, player) {
    this.time += dt;
    this.hurt = Math.max(0, this.hurt - dt * 1.4);
    const low = player.alive && player.health < 30 ? 0.35 + Math.sin(this.time * 5) * 0.15 : 0;
    this.vignette.style.opacity = String(Math.min(1, this.hurt * 0.9 + low));
  }
}

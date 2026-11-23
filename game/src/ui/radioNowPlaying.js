// The car radio's now-playing line (bottom right, above the vehicle panel): the station and the
// tune it is playing, or how to switch the radio on. Shown only behind the wheel.

export class RadioNowPlaying {
  constructor(root) {
    this.root = root;
    root.innerHTML = '<span class="radio-note">♪</span><span class="radio-track" data-part="track"></span><span class="radio-station" data-part="station"></span>';
    this.track = root.querySelector('[data-part="track"]');
    this.station = root.querySelector('[data-part="station"]');
    this.last = null;
  }

  update(game) {
    const driving = Boolean(game.player.character.vehicle);
    this.root.classList.toggle('hidden', !driving);
    if (!driving || !game.audio) return;
    const playing = game.audio.nowPlaying();
    const key = playing ? `${playing.station}|${playing.track}` : 'off';
    if (key === this.last) return;
    this.last = key;
    this.track.textContent = playing ? `${playing.track} — ${playing.artist}` : 'Radio off';
    this.station.textContent = playing ? `${playing.station} · N` : 'N to tune in';
  }
}

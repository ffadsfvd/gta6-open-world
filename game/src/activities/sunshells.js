// Twelve golden sunshells hidden around Ondaluz: courtyards, the beach, the pier's end, the
// park, the quay. Each one found pays out and counts toward the stats screen.

export const SUNSHELLS = [
  { x: 392, z: 3 }, { x: 296, z: -300 }, { x: 278, z: 205 }, { x: -276, z: -138 },
  { x: -120, z: 285 }, { x: 60, z: 282 }, { x: -40, z: -120 }, { x: 120, z: 40 },
  { x: -200, z: 120 }, { x: 200, z: -200 }, { x: -280, z: -280 }, { x: 268, z: -60 },
];

export class SunshellHunt {
  constructor(game) {
    this.game = game;
  }

  remaining() {
    const found = this.game.progress.shells;
    return SUNSHELLS.map((shell, index) => ({ ...shell, index })).filter((shell) => !found.includes(shell.index));
  }

  update() {
    const game = this.game;
    const player = game.player.character;
    for (const shell of this.remaining()) {
      if (Math.hypot(player.x - shell.x, player.z - shell.z) > 2.2) continue;
      game.progress.shells.push(shell.index);
      game.progress.bump('shells');
      game.progress.addMoney(250, 'sunshell');
      game.notifications.toast(`Sunshell ${game.progress.shells.length}/${SUNSHELLS.length} found  +$250`, 'cash', 4);
      game.events.emit('pickup', { name: 'sunshell' });
    }
  }

  markers() {
    const player = this.game.player.character;
    return this.remaining()
      .filter((shell) => Math.hypot(player.x - shell.x, player.z - shell.z) < 90)
      .map((shell) => ({ x: shell.x, z: shell.z, y: 0.2, type: 'pickup', color: '#ffd23f' }));
  }
}

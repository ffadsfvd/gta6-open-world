// The street rank panel (right edge): Kai's rank name and level, a bar of respect toward the next
// rank, and the respect count. A rank-up flashes the panel.

export class RankPanel {
  constructor(root, events) {
    this.root = root;
    root.innerHTML = `
      <header class="panel-head"><span class="panel-kicker" data-part="level"></span><span class="panel-title" data-part="name"></span></header>
      <i class="meter"><b data-part="bar"></b></i>
      <p class="rank-respect" data-part="respect"></p>`;
    this.parts = Object.fromEntries([...root.querySelectorAll('[data-part]')].map((node) => [node.dataset.part, node]));
    this.flash = 0;
    events.on('rankUp', () => {
      this.flash = 3;
    });
  }

  update(game, dt) {
    const rank = game.rank.current;
    this.parts.level.textContent = `RANK ${rank.level}/${rank.levels}`;
    this.parts.name.textContent = rank.name;
    this.parts.bar.style.width = `${Math.round(Math.max(0.03, rank.share) * 100)}%`;
    this.parts.respect.textContent = rank.next ? `${rank.respect.toLocaleString('en-US')} / ${rank.next.toLocaleString('en-US')} respect` : `${rank.respect.toLocaleString('en-US')} respect · top rank`;
    this.flash = Math.max(0, this.flash - dt);
    this.root.classList.toggle('flash', this.flash > 0);
  }
}

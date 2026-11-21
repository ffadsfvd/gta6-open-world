// Messages to the player: stacked toasts (cash, unlocks, tips), and the big centred banners
// (MISSION PASSED, MISSION FAILED, ARRESTED, FLATLINED) with a subtitle.

export class Notifications {
  constructor() {
    this.stack = document.getElementById('toast-stack');
    this.big = document.getElementById('big-message');
    this.bigTitle = document.getElementById('big-message-title');
    this.bigSub = document.getElementById('big-message-sub');
    this.bigTimer = 0;
  }

  toast(text, kind = '', seconds = 4) {
    const item = document.createElement('div');
    item.className = `toast ${kind}`;
    item.textContent = text;
    this.stack.appendChild(item);
    while (this.stack.children.length > 4) this.stack.firstChild.remove();
    setTimeout(() => item.classList.add('out'), seconds * 1000);
    setTimeout(() => item.remove(), seconds * 1000 + 700);
  }

  banner(title, subtitle = '', kind = '', seconds = 4) {
    this.bigTitle.textContent = title;
    this.bigSub.textContent = subtitle;
    this.big.className = kind;
    this.big.style.animation = 'none';
    void this.big.offsetWidth;
    this.big.style.animation = '';
    this.bigTimer = seconds;
  }

  clearBanner() {
    this.bigTimer = 0;
    this.big.classList.add('hidden');
  }

  update(dt) {
    if (this.bigTimer > 0) {
      this.bigTimer -= dt;
      if (this.bigTimer <= 0) this.big.classList.add('hidden');
    }
  }
}

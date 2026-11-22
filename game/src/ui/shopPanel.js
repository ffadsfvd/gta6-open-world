// Bayside Arms: buy guns once the story unlocks them, ammunition, body armour and first aid.
// Opens on E at the shop's marker; click or press 1-9 and 0, Escape or E to leave.
import { formatMoney } from '../core/mathUtils.js';
import { WEAPONS } from '../combat/weapons.js';

export class ShopPanel {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('shop-panel');
    this.isOpen = false;
  }

  items() {
    const game = this.game;
    const arsenal = game.combat.arsenal;
    const unlocks = game.progress.unlocks;
    const hero = game.player.character;
    const gun = (id, label, unlocked, lockedNote, rounds) => [
      { label, price: WEAPONS[id].price, ok: unlocked && !arsenal.owned[id], note: unlocked ? (arsenal.owned[id] ? 'Owned' : '') : lockedNote, buy: () => arsenal.give(id, rounds) },
      { label: `${label} ammo ×${WEAPONS[id].ammoPack}`, price: WEAPONS[id].ammoPrice, ok: arsenal.owned[id], note: arsenal.owned[id] ? '' : `Need the ${label.toLowerCase()}`, buy: () => arsenal.addAmmo(id, WEAPONS[id].ammoPack) },
    ];
    return [
      ...gun('pistol', 'Pistol', unlocks.pistol, 'Unlocks in the story', 24),
      ...gun('shotgun', 'Shotgun', unlocks.pistol, 'Unlocks in the story', 12),
      ...gun('smg', 'SMG', unlocks.smg, 'Unlocks in the story', 60),
      ...gun('rifle', 'Marksman Rifle', game.progress.storyIndex >= 5, 'Unlocks after Badge Trouble', 16),
      { label: 'Body armour', price: 250, ok: unlocks.armour && hero.armour < 100, note: unlocks.armour ? (hero.armour >= 100 ? 'Full' : '') : 'Unlocks in the story', buy: () => { hero.armour = 100; } },
      { label: 'First aid', price: 100, ok: hero.health < hero.maxHealth, note: hero.health >= hero.maxHealth ? 'Healthy' : '', buy: () => { hero.health = hero.maxHealth; } },
    ];
  }

  open() {
    this.isOpen = true;
    this.game.player.enabled = false;
    this.game.player.character.setMove(0, 0, 0);
    // The cursor is needed to click the counter; losing the mouse here is not a pause.
    this.game.input.releaseLock();
    this.game.input.releaseAll();
    this.render();
    this.root.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.game.player.enabled = true;
    this.game.input.requestLock();
  }

  buy(index) {
    const item = this.items()[index];
    if (!item || !item.ok) return;
    if (!this.game.progress.spend(item.price)) {
      this.game.notifications.toast('Not enough money.', '', 2.5);
      return;
    }
    item.buy();
    this.game.events.emit('uiSelect', {});
    this.render();
  }

  render() {
    const money = formatMoney(this.game.progress.money);
    this.root.innerHTML = `<div class="panel-card shop"><h2>Bayside Arms</h2><p class="pause-sub">"Protection for the sunshine state of mind" · You have <b>${money}</b></p><div class="menu-list"></div><p class="pause-sub"><kbd>1</kbd>-<kbd>9</kbd>, <kbd>0</kbd> buy · <kbd>E</kbd> / <kbd>Esc</kbd> leave</p></div>`;
    const list = this.root.querySelector('.menu-list');
    this.items().forEach((item, index) => {
      const element = document.createElement('button');
      element.className = 'menu-button';
      element.disabled = !item.ok;
      element.tabIndex = -1;
      element.innerHTML = `<span>${(index + 1) % 10}. ${item.label} — ${formatMoney(item.price)}</span>${item.note ? `<small>${item.note}</small>` : ''}`;
      element.addEventListener('mousedown', (event) => event.preventDefault());
      element.addEventListener('click', () => this.buy(index));
      list.appendChild(element);
    });
  }

  update(input) {
    if (!this.isOpen) return;
    for (let index = 0; index < 10; index += 1) if (input.pressed.has(`Digit${(index + 1) % 10}`)) this.buy(index);
    if (input.wasPressed('pause') || input.wasPressed('interact')) this.close();
  }
}

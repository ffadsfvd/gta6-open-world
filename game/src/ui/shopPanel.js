// Bayside Arms: buy guns once the story unlocks them, ammunition, body armour and first aid.
// Opens on E at the shop's marker; click or press 1-6, Escape or E to leave.
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
    return [
      { label: 'Pistol', price: WEAPONS.pistol.price, ok: unlocks.pistol && !arsenal.owned.pistol, note: unlocks.pistol ? (arsenal.owned.pistol ? 'Owned' : '') : 'Unlocks in the story', buy: () => arsenal.give('pistol', 24) },
      { label: `Pistol rounds ×${WEAPONS.pistol.ammoPack}`, price: WEAPONS.pistol.ammoPrice, ok: arsenal.owned.pistol, note: arsenal.owned.pistol ? '' : 'Need a pistol', buy: () => arsenal.addAmmo('pistol', WEAPONS.pistol.ammoPack) },
      { label: 'SMG', price: WEAPONS.smg.price, ok: unlocks.smg && !arsenal.owned.smg, note: unlocks.smg ? (arsenal.owned.smg ? 'Owned' : '') : 'Unlocks in the story', buy: () => arsenal.give('smg', 60) },
      { label: `SMG rounds ×${WEAPONS.smg.ammoPack}`, price: WEAPONS.smg.ammoPrice, ok: arsenal.owned.smg, note: arsenal.owned.smg ? '' : 'Need an SMG', buy: () => arsenal.addAmmo('smg', WEAPONS.smg.ammoPack) },
      { label: 'Body armour', price: 250, ok: unlocks.armour && hero.armour < 100, note: unlocks.armour ? (hero.armour >= 100 ? 'Full' : '') : 'Unlocks in the story', buy: () => { hero.armour = 100; } },
      { label: 'First aid', price: 100, ok: hero.health < hero.maxHealth, note: hero.health >= hero.maxHealth ? 'Healthy' : '', buy: () => { hero.health = hero.maxHealth; } },
    ];
  }

  open() {
    this.isOpen = true;
    this.game.player.enabled = false;
    this.game.input.releaseLock();
    this.render();
    this.root.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
    this.game.player.enabled = true;
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
    this.root.innerHTML = `<div class="panel-card shop"><h2>Bayside Arms</h2><p class="pause-sub">"Protection for the sunshine state of mind" · You have <b>${money}</b></p><div class="menu-list"></div><p class="pause-sub"><kbd>1</kbd>-<kbd>6</kbd> buy · <kbd>E</kbd> / <kbd>Esc</kbd> leave</p></div>`;
    const list = this.root.querySelector('.menu-list');
    this.items().forEach((item, index) => {
      const element = document.createElement('button');
      element.className = 'menu-button';
      element.disabled = !item.ok;
      element.innerHTML = `<span>${index + 1}. ${item.label} — ${formatMoney(item.price)}</span>${item.note ? `<small>${item.note}</small>` : ''}`;
      element.addEventListener('click', () => this.buy(index));
      list.appendChild(element);
    });
  }

  update(input) {
    if (!this.isOpen) return;
    for (let index = 0; index < 6; index += 1) if (input.pressed.has(`Digit${index + 1}`)) this.buy(index);
    if (input.wasPressed('pause') || input.wasPressed('interact')) this.close();
  }
}

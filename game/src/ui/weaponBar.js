// The weapon bar (right edge): one slot per weapon in key order 1-5 with its icon, short name and
// ammunition (magazine and reserve), the one in hand lit up, reloading shown on its slot, and the
// weapons Kai does not own yet behind a padlock.
import { WEAPONS, WEAPON_ORDER } from '../combat/weapons.js';
import { WEAPON_ICONS, LOCK_ICON } from './weaponIcons.js';

const SHORT_NAMES = { fists: 'Fists', pistol: 'Pistol', shotgun: 'Shotgun', smg: 'SMG', rifle: 'Rifle' };

export class WeaponBar {
  constructor(root) {
    this.root = root;
    root.innerHTML = WEAPON_ORDER.map((id, index) => `
      <div class="weapon-slot" data-weapon="${id}"><span class="slot-key">${index + 1}</span><span class="slot-icon">${WEAPON_ICONS[id]}</span><span class="slot-name">${SHORT_NAMES[id] ?? WEAPONS[id].name}</span><span class="slot-ammo"></span></div>`).join('');
    this.slots = Object.fromEntries([...root.querySelectorAll('.weapon-slot')].map((node) => [node.dataset.weapon, { node, ammo: node.querySelector('.slot-ammo'), last: '' }]));
  }

  update(game) {
    const arsenal = game.combat.arsenal;
    for (const id of WEAPON_ORDER) {
      const slot = this.slots[id];
      const owned = Boolean(arsenal.owned[id]);
      const ammo = arsenal.ammo[id];
      let text;
      if (!owned) text = `${LOCK_ICON}LOCKED`;
      else if (!ammo) text = '∞';
      else if (arsenal.current === id && arsenal.reloading > 0) text = 'RELOAD';
      else text = `${ammo.mag}<small>/${ammo.reserve}</small>`;
      if (text !== slot.last) {
        slot.last = text;
        slot.ammo.innerHTML = text;
      }
      slot.node.classList.toggle('locked', !owned);
      slot.node.classList.toggle('selected', arsenal.current === id);
      slot.node.classList.toggle('empty', owned && Boolean(ammo) && ammo.mag + ammo.reserve === 0);
    }
  }
}

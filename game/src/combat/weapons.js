// Weapon definitions and the player's arsenal: what is owned, what is in hand, magazines,
// reserve ammo and reloading.

export const WEAPONS = {
  fists: { name: 'Fists', icon: 'FIST', damage: 13, range: 1.7, rate: 2.6, melee: true },
  pistol: { name: 'Pistol', icon: 'PISTOL', damage: 28, range: 75, rate: 3.4, magazine: 12, spread: 0.012, reload: 1.25, price: 600, ammoPrice: 80, ammoPack: 36, headshot: 'lethal' },
  shotgun: { name: 'Shotgun', icon: 'SHOTGUN', damage: 15, pellets: 8, range: 34, rate: 1.15, magazine: 6, spread: 0.06, reload: 2.1, price: 1600, ammoPrice: 120, ammoPack: 24, kick: 2.4 },
  smg: { name: 'SMG', icon: 'SMG', damage: 16, range: 60, rate: 11, magazine: 30, spread: 0.034, reload: 1.7, price: 2800, ammoPrice: 150, ammoPack: 90, auto: true },
  rifle: { name: 'Marksman Rifle', icon: 'RIFLE', damage: 62, range: 160, rate: 1.6, magazine: 8, spread: 0.003, reload: 2.3, price: 4500, ammoPrice: 220, ammoPack: 32, zoom: 30, kick: 1.6, headshot: 'lethal' },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'shotgun', 'smg', 'rifle'];
const EMPTY_AMMO = () => ({ pistol: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 }, smg: { mag: 0, reserve: 0 }, rifle: { mag: 0, reserve: 0 } });

export class Arsenal {
  constructor() {
    this.current = 'fists';
    this.owned = { fists: true, pistol: false, shotgun: false, smg: false, rifle: false };
    this.ammo = EMPTY_AMMO();
    this.reloading = 0;
    this.cooldown = 0;
  }

  give(weapon, rounds = 0) {
    this.owned[weapon] = true;
    if (weapon !== 'fists') this.addAmmo(weapon, rounds);
  }

  addAmmo(weapon, rounds) {
    const ammo = this.ammo[weapon];
    if (!ammo) return;
    ammo.reserve += rounds;
    if (ammo.mag === 0) this.refill(weapon);
  }

  refill(weapon) {
    const ammo = this.ammo[weapon];
    const take = Math.min(WEAPONS[weapon].magazine - ammo.mag, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
  }

  select(weapon) {
    if (!this.owned[weapon]) return false;
    this.current = weapon;
    this.reloading = 0;
    return true;
  }

  cycle(step = 1) {
    let index = WEAPON_ORDER.indexOf(this.current);
    for (let tries = 0; tries < WEAPON_ORDER.length; tries += 1) {
      index = (index + step + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      if (this.owned[WEAPON_ORDER[index]]) {
        this.select(WEAPON_ORDER[index]);
        return;
      }
    }
  }

  get spec() {
    return WEAPONS[this.current];
  }

  /** Starts a reload if one is possible. */
  reload() {
    const ammo = this.ammo[this.current];
    if (!ammo || this.reloading > 0 || ammo.reserve === 0 || ammo.mag === this.spec.magazine) return false;
    this.reloading = this.spec.reload;
    return true;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.refill(this.current);
      }
    }
  }

  /** Spends one round if the gun is ready; returns true when a shot goes off. */
  trigger() {
    const spec = this.spec;
    if (this.cooldown > 0 || this.reloading > 0) return false;
    if (spec.melee) {
      this.cooldown = 1 / spec.rate;
      return true;
    }
    const ammo = this.ammo[this.current];
    if (ammo.mag <= 0) {
      this.reload();
      return false;
    }
    ammo.mag -= 1;
    this.cooldown = 1 / spec.rate;
    if (ammo.mag === 0) this.reload();
    return true;
  }

  /** Busted: the police keep your spare ammunition. */
  confiscate() {
    for (const ammo of Object.values(this.ammo)) ammo.reserve = 0;
  }

  toJSON() {
    return { current: this.current, owned: { ...this.owned }, ammo: JSON.parse(JSON.stringify(this.ammo)) };
  }

  load(data) {
    if (!data) return;
    this.owned = { fists: true, pistol: false, shotgun: false, smg: false, rifle: false, ...data.owned };
    this.ammo = { ...EMPTY_AMMO(), ...data.ammo };
    this.current = this.owned[data.current] ? data.current : 'fists';
  }
}

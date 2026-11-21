// The player's career: money, story progress, unlocks, collected sunshells and the stats
// screen (cars stolen, distance driven, races won, fares, deliveries, escapes and more).

export const STAT_LABELS = {
  missionsPassed: 'Story missions passed',
  sideJobs: 'Side jobs completed',
  racesWon: 'Street races won',
  fares: 'Taxi fares delivered',
  deliveries: 'Pelican Express drops',
  carsStolen: 'Cars stolen',
  copsEscaped: 'Police chases escaped',
  highestWanted: 'Highest wanted level',
  distanceDriven: 'Kilometres driven',
  earned: 'Money earned',
  shells: 'Sunshells found',
  arrests: 'Times arrested',
  hospital: 'Hospital visits',
  playTime: 'Time played (min)',
};

export class Progress {
  constructor(events) {
    this.events = events;
    this.reset();
  }

  reset() {
    this.money = 250;
    this.completed = [];
    this.storyIndex = 0;
    this.unlocks = { pistol: false, armour: false, smg: false };
    this.shells = [];
    this.stats = Object.fromEntries(Object.keys(STAT_LABELS).map((key) => [key, 0]));
  }

  addMoney(amount, reason = '') {
    this.money = Math.max(0, Math.round(this.money + amount));
    if (amount > 0) this.stats.earned += Math.round(amount);
    this.events.emit('money', { amount, reason, total: this.money });
  }

  spend(amount) {
    if (this.money < amount) return false;
    this.addMoney(-amount, 'purchase');
    return true;
  }

  bump(stat, amount = 1) {
    this.stats[stat] = (this.stats[stat] ?? 0) + amount;
  }

  record(stat, value) {
    this.stats[stat] = Math.max(this.stats[stat] ?? 0, value);
  }

  unlock(key) {
    if (this.unlocks[key]) return;
    this.unlocks[key] = true;
    this.events.emit('unlocked', { key });
  }

  toJSON() {
    return { money: this.money, completed: [...this.completed], storyIndex: this.storyIndex, unlocks: { ...this.unlocks }, shells: [...this.shells], stats: { ...this.stats } };
  }

  load(data) {
    this.reset();
    if (!data) return;
    this.money = data.money ?? this.money;
    this.completed = data.completed ?? [];
    this.storyIndex = data.storyIndex ?? 0;
    this.unlocks = { ...this.unlocks, ...data.unlocks };
    this.shells = data.shells ?? [];
    this.stats = { ...this.stats, ...data.stats };
  }
}

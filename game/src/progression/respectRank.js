// Street respect and the rank it buys: story missions, side jobs, races, fares, deliveries,
// police chases survived, cars taken and Crane's crew put down all earn respect, which moves
// Kai up seven ranks from Fresh Off the Bus to Owner of the Bay. It is saved with the career,
// and Bayside Arms keeps its heavier guns for customers with a name on the street.

export const RANKS = [
  { name: 'Fresh Off the Bus', respect: 0 },
  { name: 'Corner Hustler', respect: 400 },
  { name: 'Wheelman', respect: 1200 },
  { name: 'Street Fixer', respect: 2600 },
  { name: 'Strand Enforcer', respect: 4800 },
  { name: 'Dock Boss', respect: 8000 },
  { name: 'Owner of the Bay', respect: 13000 },
];

/** Respect for each kind of deed. */
export const RESPECT_FOR = {
  storyMission: 600,
  raceWon: 300,
  delivery: 220,
  fare: 70,
  sideJob: 120,
  escapePerStar: 60,
  carStolen: 8,
  crewDown: 30,
  headshot: 12,
  sunshell: 40,
};

/** Side jobs by mission id: what each one is worth. */
const JOB_RESPECT = { taxiFare: RESPECT_FOR.fare, delivery: RESPECT_FOR.delivery, wharfLoop: RESPECT_FOR.raceWon, glasswaterCircuit: RESPECT_FOR.raceWon };

export function rankIndexFor(respect) {
  let index = 0;
  while (index + 1 < RANKS.length && respect >= RANKS[index + 1].respect) index += 1;
  return index;
}

/**
 * The respect a career's record adds up to under the rules above (saves from before respect was
 * kept, and careers part-way through the story).
 */
export function respectForCareer(storyDone, stats = {}) {
  return storyDone * RESPECT_FOR.storyMission
    + (stats.fares ?? 0) * RESPECT_FOR.fare
    + (stats.racesWon ?? 0) * RESPECT_FOR.raceWon
    + Math.floor((stats.deliveries ?? 0) / 3) * RESPECT_FOR.delivery
    + (stats.copsEscaped ?? 0) * RESPECT_FOR.escapePerStar * 2
    + (stats.carsStolen ?? 0) * RESPECT_FOR.carStolen
    + (stats.shells ?? 0) * RESPECT_FOR.sunshell;
}

export class RespectRank {
  constructor(progress, events) {
    this.progress = progress;
    this.events = events;
    events.on('missionPassed', (e) => this.add(e.story ? RESPECT_FOR.storyMission : JOB_RESPECT[e.id] ?? RESPECT_FOR.sideJob, e.story ? 'Story mission' : 'Job done'));
    events.on('wantedChanged', (e) => {
      if (e.level === 0 && e.reason === 'escaped') this.add(RESPECT_FOR.escapePerStar * e.previous, 'Lost the police');
    });
    events.on('vehicleEntered', (e) => {
      if (e.jacked || e.parked) this.add(RESPECT_FOR.carStolen, '');
    });
    events.on('characterKilled', (e) => {
      if (!e.attacker || e.attacker.kind !== 'player') return;
      if (e.victim.kind === 'gang') this.add(RESPECT_FOR.crewDown + (e.head ? RESPECT_FOR.headshot : 0), e.head ? 'Headshot' : '');
    });
    events.on('pickup', (e) => {
      if (e.name === 'sunshell') this.add(RESPECT_FOR.sunshell, 'Sunshell');
    });
  }

  get respect() {
    return this.progress.respect;
  }

  get index() {
    return rankIndexFor(this.progress.respect);
  }

  /** Rank name, 1-based level, respect and the share of the way to the next rank. */
  get current() {
    const respect = this.progress.respect;
    const index = rankIndexFor(respect);
    const floor = RANKS[index].respect;
    const next = RANKS[index + 1] ?? null;
    return {
      name: RANKS[index].name,
      level: index + 1,
      levels: RANKS.length,
      respect,
      next: next ? next.respect : null,
      nextName: next ? next.name : null,
      share: next ? (respect - floor) / (next.respect - floor) : 1,
    };
  }

  /** True once Kai holds at least the named rank. */
  atLeast(name) {
    const wanted = RANKS.findIndex((rank) => rank.name === name);
    return wanted < 0 || this.index >= wanted;
  }

  add(amount, reason = '') {
    if (!(amount > 0)) return;
    const before = this.index;
    this.progress.respect += Math.round(amount);
    this.events.emit('respect', { amount: Math.round(amount), reason, total: this.progress.respect });
    const after = this.index;
    if (after > before) this.events.emit('rankUp', { level: after + 1, name: RANKS[after].name });
  }
}

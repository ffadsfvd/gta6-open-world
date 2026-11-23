// What the HUD's mission tracker shows, read from the live mission: which mission it is (story
// number or kind of job), its stages (every step that sets an objective) and the current one, the
// objective, the step after it, and the readouts of the step or job (crew left, distance to the
// target, fare and tip, race position, parcels).
import { STORYLINE } from './storyline.js';
import { CAST } from './cast.js';
import { formatMoney } from '../core/mathUtils.js';

/** A step that sets an objective (talk included); calls, waits and timers are not stages. */
function isStage(step) {
  return step.objective !== null && step.objective !== undefined;
}

/** A stage in words, for steps whose objective is empty (talks) or not yet live. */
export function stageLabel(step) {
  if (step.kind === 'talk') {
    const speaker = (step.lines ?? []).map(([who]) => who).find((who) => who !== 'kai') ?? 'kai';
    const name = (CAST[speaker] ?? CAST.kai).name;
    if (step.via === 'phone') return `Take the call from *${name}*`;
    if (step.via === 'radio') return 'Listen to the *police radio*';
    return `Talk to *${name}*`;
  }
  return step.objective ?? '';
}

export function describeMission(runner) {
  const mission = runner.current;
  if (!mission) return null;
  const def = mission.def;
  const ctx = runner.ctx;
  const stages = [];
  mission.steps.forEach((step, index) => {
    if (isStage(step)) stages.push({ step, index });
  });
  let stage = stages.findIndex(({ index }) => index >= mission.index);
  if (stage < 0) stage = stages.length - 1;
  const current = stages[stage] ?? null;
  const following = stages[stage + 1] ?? null;
  const storyNumber = STORYLINE.indexOf(def) + 1;
  const step = mission.step;
  const status = (step && step.status ? step.status(ctx) : null) ?? (def.status ? def.status(ctx) : []);
  return {
    heading: storyNumber > 0 ? `Mission ${storyNumber} of ${STORYLINE.length}` : def.kindLabel ?? 'Side job',
    story: storyNumber > 0,
    title: def.title,
    giver: def.giver ? (CAST[def.giver] ?? CAST.kai).name : null,
    stage: stage + 1,
    stages: stages.length,
    share: stages.length ? stage / stages.length : 0,
    objective: runner.objectiveText() || (current ? stageLabel(current.step) : ''),
    next: following ? stageLabel(following.step) : def.reward ? `Payday: *${formatMoney(def.reward)}*` : 'Done',
    status,
    timeLeft: runner.timeLeft(),
  };
}

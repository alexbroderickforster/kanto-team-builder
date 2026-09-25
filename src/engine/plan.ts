// Full-run planner: the best team for each gym in order, then the League,
// nudged to keep Pokémon you've already raised.
import { lineRoot } from './availability';
import { optimize, type OptimizeResult } from './optimize';
import { GYM_ORDER } from './progression';
import type { Config } from './types';

export interface PlanStep {
  badges: number;          // badges held going into this fight
  label: string;           // "Brock", …, "Elite Four"
  result: OptimizeResult;
  added: string[];         // species new to the team at this step (evolutions don't count)
  dropped: string[];       // species benched since the previous step
}

/** One-per-save choices: once a run commits to one branch, the others are gone for good. */
const BRANCHES: string[][] = [
  ['vaporeon', 'jolteon', 'flareon'],
  ['omanyte', 'omastar', 'kabuto', 'kabutops'],
  ['hitmonlee', 'hitmonchan'],
];

function commitmentsFor(chosen: string[]): string[] {
  const ban: string[] = [];
  for (const set of BRANCHES) {
    const pick = set.find(id => chosen.includes(id));
    if (!pick) continue;
    const line = lineRoot(pick);
    ban.push(...set.filter(id => lineRoot(id) !== line || (set[0] === 'vaporeon' && id !== pick)));
  }
  return ban;
}

const LABELS = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni', 'Elite Four'];

export function planRun(cfg: Config): PlanStep[] {
  const steps: PlanStep[] = [];
  let prev: OptimizeResult | null = null;
  const everUsed = new Set<string>();
  for (let b = 0; b <= GYM_ORDER.length; b++) {
    const result = optimize({
      ...cfg,
      badges: b,
      goal: b === GYM_ORDER.length ? 'league' : 'next',
      prefer: prev ? prev.team.map(m => m.species) : [],
      banSpecies: commitmentsFor([...everUsed]),
    });
    result.team.forEach(m => everUsed.add(m.species));
    const prevLines = new Set(prev?.team.map(m => lineRoot(m.species)) ?? []);
    const nowLines = new Set(result.team.map(m => lineRoot(m.species)));
    steps.push({
      badges: b,
      label: LABELS[b],
      result,
      added: result.team.filter(m => !prevLines.has(lineRoot(m.species))).map(m => m.species),
      dropped: prev ? prev.team.filter(m => !nowLines.has(lineRoot(m.species))).map(m => m.species) : [],
    });
    prev = result;
  }
  return steps;
}

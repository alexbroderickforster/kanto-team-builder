// Team search: score candidate Pokémon against the bosses in scope, then build the best six.
import { availablePool, lineRoot, SPECIES, topForms, type Availability } from './availability';
import { calcStats, critChance, effectiveness, expectedDamage, turnsToKO, TYPES, type Battler } from './gen1';
import { chooseMoveset, learnableMoves, MOVES, type ChosenMove, type MoveOption } from './movesets';
import { requiredHMs, scopeBosses, tmsFor } from './progression';
import type { Boss, Config, EnemyMon } from './types';

export interface TeamMember {
  species: string;
  name: string;
  num: number;
  types: string[];
  how: string;
  note?: string;
  minBadges: number;
  locked: boolean;
  level: number;
  moves: ChosenMove[];
  reasons: string[];
  warnings: string[];
}

export interface EnemyAnswer {
  boss: string;
  enemy: EnemyMon;
  answer: { species: string; move: string; turns: number; outspeeds: boolean; wins: boolean } | null;
}

export interface Alternate { species: string; name: string; delta: number }

export interface OptimizeResult {
  team: TeamMember[];
  readiness: number;          // 0-100: weighted confidence of winning each boss Pokémon's matchup
  wins: number;               // boss Pokémon with a winning answer
  total: number;
  coverage: { off: number[]; weak: number[]; res: number[] };
  ledger: { tm: string; move: string; who: string }[];
  hms: { id: string; move: string; who: string | null }[];
  bosses: Boss[];
  answers: EnemyAnswer[];
  alternates: Record<string, Alternate[]>;
  insights: string[];
  levelCap: number;
  evalBadges: number;
  poolSize: number;
}

interface Candidate {
  avail: Availability;
  battler: Battler;
  options: MoveOption[];
  moves: ChosenMove[];
  movesetValue: number;
  row: number[];      // matchup score vs each enemy (0-1)
  general: number;    // stat-based strength outside scripted fights (0-1)
  hmLearnable: Set<string>;
  line: string;
  group?: string;
  locked?: boolean;
  warnings: string[];
}

const PLAYER_LEAGUE_LEVEL = 55;

function makeBattler(speciesId: string, level: number, moveIds: string[], opts: { trainer?: boolean; badges?: number }): Battler {
  const sp = SPECIES[speciesId];
  const st = calcStats(sp.baseStats, level, opts);
  return { level, types: sp.types, base: sp.baseStats, ...st, moves: moveIds.map(m => MOVES[m]).filter(Boolean) };
}

function bestDamage(a: Battler, d: Battler): { dmg: number; move: string } {
  let dmg = 0, move = '';
  for (const m of a.moves) {
    const x = expectedDamage(a, d, m);
    if (x > dmg) { dmg = x; move = m.id; }
  }
  return { dmg, move };
}

const SLEEP = new Set(['sleeppowder', 'hypnosis', 'sing', 'lovelykiss']);
const PARA = new Set(['thunderwave', 'stunspore', 'glare']);

function matchup(p: Battler, e: Battler) {
  const pd = bestDamage(p, e), ed = bestDamage(e, p);
  const tp = turnsToKO(pd.dmg), te = turnsToKO(ed.dmg);
  const first = p.spe > e.spe ? 1 : p.spe === e.spe ? 0.5 : 0;
  let bonus = 0;
  if (p.moves.some(m => SLEEP.has(m.id))) bonus += 1.5;
  else if (p.moves.some(m => PARA.has(m.id))) bonus += 0.6;
  let s: number, margin: number;
  if (!isFinite(tp)) { s = 0.02; margin = -5; }
  else if (!isFinite(te)) { s = 1; margin = 5; }
  else {
    margin = te - tp + first + bonus;
    s = 1 / (1 + Math.exp(-1.4 * (margin - 0.5)));
  }
  // "Comfort": a clean win needs a couple of turns to spare (misses, crits, Gen 1 AI items).
  const comfort = 1 / (1 + Math.exp(-1.1 * (margin - 2)));
  return { s, comfort, move: pd.move, turns: tp, outspeeds: first === 1, wins: s >= 0.5 };
}

function generalStrength(id: string): number {
  const b = SPECIES[id].baseStats;
  return Math.min(1, (b.hp * 0.8 + b.atk + b.def * 0.8 + b.spc * 1.3 + b.spe * 1.3) / 700);
}

export function optimize(cfg: Config): OptimizeResult {
  const bosses = scopeBosses(cfg);
  const league = cfg.goal === 'league' || cfg.badges >= 8;
  const evalBadges = league ? 8 : cfg.badges;
  const enemiesRaw = bosses.flatMap(b => b.team.map(m => ({ boss: b.name, mon: m })));
  const aceLevel = Math.max(...enemiesRaw.map(e => e.mon.level), 5);
  const levelCap = league ? PLAYER_LEAGUE_LEVEL : aceLevel;
  const enemies = enemiesRaw.map(e => makeBattler(e.mon.species, e.mon.level, e.mon.moves, { trainer: true }));
  const weights = enemiesRaw.map(e => {
    const team = bosses.find(b => b.name === e.boss)!.team;
    return e.mon === team[team.length - 1] ? 1.5 : 1;
  });

  const tms = tmsFor(cfg);
  const pool = availablePool(cfg, evalBadges, levelCap);
  const hmNeeded = cfg.rules.hmCoverage ? requiredHMs(cfg) : [];

  const build = (avail: Availability, bannedTms: Set<string> = new Set(), forced: string[] = []): Candidate => {
    const id = avail.species;
    const options = learnableMoves(id, levelCap, evalBadges, tms).filter(o => !o.tm || !bannedTms.has(o.tm));
    const shell = makeBattler(id, levelCap, [], { badges: evalBadges });
    const { moves, value } = chooseMoveset(shell, options, enemies, forced);
    const battler = { ...shell, moves: moves.map(m => MOVES[m.move]) };
    const row = enemies.map(e => matchup(battler, e).s);
    return {
      avail, battler, options, moves, movesetValue: value, row,
      general: generalStrength(id),
      hmLearnable: new Set(options.filter(o => hmNeeded.includes(o.move)).map(o => o.move)),
      line: lineRoot(id),
      group: avail.exclusiveGroup,
      warnings: [],
    };
  };

  const excludedLines = new Set(cfg.exclude.filter(id => SPECIES[id]).map(lineRoot));
  const preferredLines = new Set((cfg.prefer ?? []).filter(id => SPECIES[id]).map(lineRoot));
  const banned = new Set(cfg.banSpecies ?? []);
  let candidates = topForms(pool)
    .filter(a => !excludedLines.has(lineRoot(a.species)) && !banned.has(a.species))
    .map(a => build(a));

  // ----- Locks: starter + must-haves (use the most evolved form available in that line).
  const locks: Candidate[] = [];
  const lockLine = (id: string, why: string) => {
    const line = lineRoot(id);
    if (locks.some(l => l.line === line)) return;
    const inPool = candidates.filter(c => c.line === line);
    // Prefer the requested species' own branch (e.g. Jolteon vs Vaporeon) when it's there.
    let pick = inPool.find(c => c.avail.species === id) ?? inPool.find(c => isDescendant(c.avail.species, id)) ?? inPool[0];
    if (!pick) {
      const c = build({ species: id, minBadges: 99, how: 'Not obtainable yet with these settings', root: id, viaTrade: false });
      c.warnings.push(`${SPECIES[id].name} isn't obtainable ${league ? 'in this version with these rules' : `with ${cfg.badges} badge${cfg.badges === 1 ? '' : 's'}`}.`);
      pick = c;
    }
    pick.locked = true;
    pick.warnings.push(...(why ? [why] : []));
    locks.push(pick);
  };
  if (cfg.rules.keepStarter) lockLine(cfg.starter, '');
  for (const id of cfg.mustHave) if (SPECIES[id]) lockLine(id, '');
  const lockedIds = new Set(locks.map(l => l.avail.species));
  candidates = candidates.filter(c => !lockedIds.has(c.avail.species));

  // ----- Team scoring.
  const W = weights.reduce((a, b) => a + b, 0);
  const teamScore = (team: Candidate[]) => {
    let battle = 0;
    for (let i = 0; i < enemies.length; i++) {
      let best = 0, second = 0;
      for (const c of team) {
        const v = c.row[i];
        if (v > best) { second = best; best = v; } else if (v > second) second = v;
      }
      battle += weights[i] * (best + 0.2 * second) / 1.2;
    }
    battle /= W;
    let cov = 0;
    for (const t of TYPES) if (team.some(c => c.battler.moves.some(m => (m.power ?? 0) > 1 && effectiveness(m.type, [t]) > 1))) cov++;
    let stack = 0;
    for (const t of TYPES) {
      const weak = team.filter(c => effectiveness(t, c.battler.types) > 1).length;
      if (weak >= 3) stack += (weak - 2) * 0.02;
    }
    const general = team.reduce((a, c) => a + c.general, 0) / Math.max(1, team.length);
    const hm = hmNeeded.length ? hmNeeded.filter(h => team.some(c => c.hmLearnable.has(h))).length / hmNeeded.length : 1;
    // Keeping a Pokémon you've already raised is worth a little (planner continuity).
    const kept = preferredLines.size ? team.filter(c => preferredLines.has(c.line)).length * 0.015 : 0;
    return 0.62 * battle + 0.08 * (cov / TYPES.length) + 0.2 * general + 0.1 * hm - stack + kept;
  };

  const allowed = (team: Candidate[], c: Candidate) =>
    !team.some(t => t.line === c.line || (c.group && t.group === c.group));

  // Greedy fill, then swap-based local search.
  const team: Candidate[] = [...locks];
  while (team.length < 6) {
    let best: Candidate | null = null, bestScore = -Infinity;
    for (const c of candidates) {
      if (!allowed(team, c)) continue;
      const s = teamScore([...team, c]);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best) break;
    team.push(best);
  }
  for (let iter = 0; iter < 20; iter++) {
    const current = teamScore(team);
    let bestGain = 1e-6, bestSwap: [number, Candidate] | null = null;
    for (let i = 0; i < team.length; i++) {
      if (team[i].locked) continue;
      const others = team.filter((_, j) => j !== i);
      for (const c of candidates) {
        if (team.includes(c) || !allowed(others, c)) continue;
        const gain = teamScore([...others.slice(0, i), c, ...others.slice(i)]) - current;
        if (gain > bestGain) { bestGain = gain; bestSwap = [i, c]; }
      }
    }
    if (!bestSwap) break;
    team[bestSwap[0]] = bestSwap[1];
  }

  // ----- Alternates for each open slot (before TM/HM adjustments, same scoring basis).
  const alternates: Record<string, Alternate[]> = {};
  const baseScore = teamScore(team);
  team.forEach((m, i) => {
    if (m.locked) return;
    const others = team.filter((_, j) => j !== i);
    alternates[m.avail.species] = candidates
      .filter(c => !team.includes(c) && allowed(others, c))
      .map(c => ({ species: c.avail.species, name: SPECIES[c.avail.species].name, delta: teamScore([...others, c]) - baseScore }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
  });

  // ----- HMs the party must carry (Gen 1 HM moves are permanent), then the single-use TM budget.
  const forcedHM = new Map<Candidate, string[]>();
  for (const h of hmNeeded) {
    if (team.some(c => c.moves.some(m => m.move === h))) continue;
    let pick: Candidate | null = null, loss = Infinity;
    for (const c of team) {
      if (!c.hmLearnable.has(h)) continue;
      const alt = build(c.avail, new Set(), [...(forcedHM.get(c) ?? []), h]);
      const l = c.movesetValue - alt.movesetValue;
      if (l < loss) { loss = l; pick = c; }
    }
    if (pick) forcedHM.set(pick, [...(forcedHM.get(pick) ?? []), h]);
  }
  let members = team.map(c => (forcedHM.has(c) ? { ...build(c.avail, new Set(), forcedHM.get(c)), locked: c.locked, warnings: c.warnings } : c));

  const bannedTms = new Map<Candidate, Set<string>>();
  const singleUse = new Set(tms.filter(t => !t.reusable).map(t => t.id));
  for (let iter = 0; iter < 12; iter++) {
    const users = new Map<string, number[]>();
    members.forEach((c, i) => c.moves.forEach(m => { if (m.tm && singleUse.has(m.tm)) users.set(m.tm, [...(users.get(m.tm) ?? []), i]); }));
    const conflict = [...users.entries()].find(([, idx]) => idx.length > 1);
    if (!conflict) break;
    const [tm, idx] = conflict;
    const rebuilt = idx.map(i => {
      const c = members[i];
      const ban = new Set([...(bannedTms.get(team[i]) ?? []), tm]);
      const alt = build(c.avail, ban, forcedHM.get(team[i]) ?? []);
      return { i, ban, alt, loss: c.movesetValue - alt.movesetValue };
    }).sort((a, b) => b.loss - a.loss);
    // The member that loses the most keeps the TM; everyone else re-picks without it.
    for (const r of rebuilt.slice(1)) {
      bannedTms.set(team[r.i], r.ban);
      members[r.i] = { ...r.alt, locked: members[r.i].locked, warnings: members[r.i].warnings };
    }
  }
  members = members.map(c => ({ ...c, row: enemies.map(e => matchup(c.battler, e).s) }));

  // ----- Outputs.
  const answers: EnemyAnswer[] = enemiesRaw.map((e, i) => {
    let best: EnemyAnswer['answer'] = null, bestS = -1;
    for (const c of members) {
      const m = matchup(c.battler, enemies[i]);
      if (m.s > bestS) { bestS = m.s; best = { species: c.avail.species, move: m.move, turns: m.turns, outspeeds: m.outspeeds, wins: m.wins }; }
    }
    return { boss: e.boss, enemy: e.mon, answer: best };
  });
  const comfort = enemies.map(e => Math.max(0, ...members.map(c => matchup(c.battler, e).comfort)));
  const readiness = Math.round(100 * comfort.reduce((a, v, i) => a + v * weights[i], 0) / W);
  const wins = answers.filter(a => a.answer?.wins).length;

  const coverage = {
    off: TYPES.map(t => Math.max(0, ...members.flatMap(c => c.battler.moves.filter(m => (m.power ?? 0) > 1 || m.flags.fixedDamage).map(m => effectiveness(m.type, [t]))))),
    weak: TYPES.map(t => members.filter(c => effectiveness(t, c.battler.types) > 1).length),
    res: TYPES.map(t => members.filter(c => effectiveness(t, c.battler.types) < 1).length),
  };

  const ledger = members.flatMap(c => c.moves.filter(m => m.tm && singleUse.has(m.tm)).map(m => ({ tm: m.tm!, move: MOVES[m.move].name, who: SPECIES[c.avail.species].name })))
    .sort((a, b) => a.tm.localeCompare(b.tm));
  const hms = hmNeeded.map(h => ({ id: MOVES[h].machine ?? 'HM', move: MOVES[h].name, who: members.find(c => c.moves.some(m => m.move === h)) ? SPECIES[members.find(c => c.moves.some(m => m.move === h))!.avail.species].name : null }));

  const teamOut: TeamMember[] = members.map(c => {
    const sp = SPECIES[c.avail.species];
    const handles = answers
      .map((a, i) => ({ a, w: weights[i] }))
      .filter(x => x.a.answer?.species === c.avail.species && x.a.answer.wins)
      .sort((x, y) => y.w - x.w || y.a.enemy.level - x.a.enemy.level);
    const reasons = handles.slice(0, 2).map(({ a }) => {
      const ans = a.answer!;
      const ko = ans.turns === 1 ? 'OHKO' : `${ans.turns}HKO`;
      return `Beats ${a.boss.replace(/ \(.*\)/, '')}'s ${SPECIES[a.enemy.species].name}: ${MOVES[ans.move]?.name ?? '—'} ${ko}${ans.outspeeds ? ', moves first' : ''}`;
    });
    if (handles.length > 2) reasons.push(`+${handles.length - 2} more boss Pokémon`);
    if (!reasons.length) {
      let bi = -1, bs = -1;
      c.row.forEach((v, i) => { if (v > bs) { bs = v; bi = i; } });
      const e = enemiesRaw[bi];
      const m = e && matchup(c.battler, enemies[bi]);
      if (e && m && bs >= 0.3 && isFinite(m.turns)) {
        reasons.push(`Backup for ${e.boss.replace(/ \(.*\)/, '')}'s ${SPECIES[e.mon.species].name}: ${MOVES[m.move]?.name} ${m.turns === 1 ? 'OHKO' : `${m.turns}HKO`}`);
      } else {
        reasons.push(bosses.length === 1 ? `Sit this fight out: nothing it knows hurts ${bosses[0].name}'s team much` : 'Bench role: general bulk and utility');
      }
    }
    return {
      species: sp.id, name: sp.name, num: sp.num, types: sp.types,
      how: c.avail.how, note: c.avail.note, minBadges: c.avail.minBadges, locked: !!c.locked,
      level: levelCap, moves: c.moves, reasons, warnings: c.warnings,
    };
  });

  return {
    team: teamOut, readiness, wins, total: answers.length, coverage, ledger, hms, bosses, answers, alternates,
    insights: insightsFor(members, answers, cfg),
    levelCap, evalBadges, poolSize: pool.size,
  };
}

function isDescendant(id: string, ancestor: string): boolean {
  let cur = SPECIES[id];
  while (cur.evolvesFrom) {
    if (cur.evolvesFrom.species === ancestor) return true;
    cur = SPECIES[cur.evolvesFrom.species];
  }
  return false;
}

function insightsFor(members: Candidate[], answers: EnemyAnswer[], cfg: Config): string[] {
  const out: string[] = [];
  answers.forEach(a => {
    if (!a.answer) return;
    const mv = MOVES[a.answer.move];
    const e = SPECIES[a.enemy.species].baseStats;
    if (!mv || effectiveness(mv.type, SPECIES[a.enemy.species].types) < 1) return;
    if (mv.category === 'Special' && e.def >= e.spc * 2) {
      out.push(`${SPECIES[a.enemy.species].name} has ${e.def} Defense but only ${e.spc} Special, so ${SPECIES[a.answer.species].name}'s ${mv.name} goes straight through it.`);
    } else if (mv.category === 'Physical' && e.spc >= e.def * 1.8) {
      out.push(`${SPECIES[a.enemy.species].name} walls special attacks (${e.spc} Special) but has only ${e.def} Defense: hit it physically with ${mv.name}.`);
    }
  });
  for (const c of members) {
    if (c.avail.note) out.push(`${SPECIES[c.avail.root].name} is only a ${c.avail.note} in ${c.avail.where} in ${cfg.version === 'red' ? 'Red' : 'Blue'}. Budget time to find one.`);
    const hc = c.battler.moves.find(m => m.flags.highCrit);
    if (hc) {
      const p = critChance(c.battler.base.spe, true);
      if (p >= 0.4) out.push(`${SPECIES[c.avail.species].name}'s ${hc.name} crits ${Math.round(p * 100)}% of the time: Gen 1 crit rate scales with base Speed.`);
    }
  }
  return [...new Set(out)].slice(0, 4);
}

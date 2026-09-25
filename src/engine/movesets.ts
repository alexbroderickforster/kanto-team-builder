// Which moves can a Pokémon know at this point, and which four should it run?
import movesJson from '../../data/moves.json';
import { SPECIES } from './availability';
import { expectedDamage, type Battler } from './gen1';
import type { Move, TmInfo } from './types';

export const MOVES = movesJson as unknown as Record<string, Move>;

export interface MoveOption { move: string; source: string; tm?: string }

/**
 * Moves learnable by `speciesId` with a party capped at `levelCap`:
 * its own level-up moves, pre-evolution level-up moves (for level evolutions, only those
 * learned before it evolves), and TMs/HMs obtainable by now.
 */
export function learnableMoves(speciesId: string, levelCap: number, badges: number, tms: TmInfo[]): MoveOption[] {
  const out = new Map<string, MoveOption>();
  const sp = SPECIES[speciesId];
  for (const l of sp.learnset.levelUp) {
    if (l.level <= levelCap && !out.has(l.move)) out.set(l.move, { move: l.move, source: `L${l.level}` });
  }
  // Walk back through pre-evolutions.
  let child = sp;
  while (child.evolvesFrom) {
    const parent = SPECIES[child.evolvesFrom.species];
    const evo = child.evolvesFrom;
    const maxLevel = evo.trigger === 'level-up' && evo.level ? Math.min(levelCap, evo.level - 1) : levelCap;
    for (const l of parent.learnset.levelUp) {
      if (l.level <= maxLevel && !out.has(l.move)) out.set(l.move, { move: l.move, source: `L${l.level} as ${parent.name}` });
    }
    child = parent;
  }
  const byMove = new Map(tms.map(t => [t.move, t]));
  for (const m of sp.learnset.tm) {
    const tm = byMove.get(m);
    if (!tm || tm.minBadges > badges) continue;
    const prev = out.get(m);
    // Prefer a level-up source over spending a TM.
    if (!prev) out.set(m, { move: m, source: tm.id, tm: tm.id });
  }
  return [...out.values()].filter(o => MOVES[o.move]);
}

// Status moves worth a slot, scored as a fraction of an enemy "handled" per opponent.
// Moves in the same group don't stack: a second sleep move adds nothing.
const UTILITY: Record<string, { group: string; value: (best: { physical: number; special: number }, spe: number) => number }> = {
  sleeppowder: { group: 'disable', value: () => 0.35 },
  hypnosis: { group: 'disable', value: () => 0.35 },
  sing: { group: 'disable', value: () => 0.35 },
  lovelykiss: { group: 'disable', value: () => 0.35 },
  thunderwave: { group: 'disable', value: () => 0.22 },
  stunspore: { group: 'disable', value: () => 0.22 },
  glare: { group: 'disable', value: () => 0.22 },
  amnesia: { group: 'boost', value: b => (b.special > 0.25 ? 0.3 : 0.03) }, // +2 Special, both offense and defense
  swordsdance: { group: 'boost', value: b => (b.physical > 0.25 ? 0.22 : 0.02) },
  growth: { group: 'boost', value: b => (b.special > 0.25 ? 0.1 : 0.02) },
  agility: { group: 'boost', value: (_, spe) => (spe < 90 ? 0.1 : 0.03) },
  recover: { group: 'heal', value: () => 0.14 },
  softboiled: { group: 'heal', value: () => 0.14 },
  rest: { group: 'heal', value: () => 0.08 },
  confuseray: { group: 'chip', value: () => 0.05 },
  leechseed: { group: 'chip', value: () => 0.05 },
  toxic: { group: 'chip', value: () => 0.04 },
  reflect: { group: 'screen', value: () => 0.04 },
  lightscreen: { group: 'screen', value: () => 0.04 },
};

function utility(moveIds: string[], holder: Battler, best: { physical: number; special: number }): number {
  const byGroup = new Map<string, number>();
  for (const id of moveIds) {
    const u = UTILITY[id];
    if (!u) continue;
    const v = u.value(best, holder.base.spe) * ((MOVES[id].accuracy ?? 100) / 100);
    byGroup.set(u.group, Math.max(byGroup.get(u.group) ?? 0, v));
  }
  let total = 0;
  for (const v of byGroup.values()) total += v;
  return total;
}

export interface ChosenMove { move: string; source: string; tm?: string }

/**
 * Greedy four-move pick maximizing expected damage across the enemies in scope
 * (each enemy counts once: the best move against it), plus a bit for strong status moves.
 * `forced` moves (e.g. HMs) are placed first.
 */
export function chooseMoveset(
  holder: Battler,
  options: MoveOption[],
  enemies: Battler[],
  forced: string[] = [],
): { moves: ChosenMove[]; value: number } {
  const chosen: MoveOption[] = options.filter(o => forced.includes(o.move));
  const dmgCache = new Map<string, number[]>();
  const dmgs = (id: string) => {
    let r = dmgCache.get(id);
    if (!r) { r = enemies.map(e => Math.min(1, expectedDamage(holder, e, MOVES[id]))); dmgCache.set(id, r); }
    return r;
  };
  const score = (set: MoveOption[]) => {
    let total = 0;
    const best = { physical: 0, special: 0 };
    for (let i = 0; i < enemies.length; i++) {
      let m = 0;
      for (const o of set) {
        const d = dmgs(o.move)[i];
        if (d > m) m = d;
        const cat = MOVES[o.move].category;
        if (cat === 'Physical' && d > best.physical) best.physical = d;
        if (cat === 'Special' && d > best.special) best.special = d;
      }
      total += m;
    }
    return total / Math.max(1, enemies.length) + utility(set.map(o => o.move), holder, best);
  };
  while (chosen.length < 4) {
    let bestOpt: MoveOption | null = null, bestScore = -1;
    const base = score(chosen);
    for (const o of options) {
      if (chosen.includes(o)) continue;
      const s = score([...chosen, o]) - base;
      // Tie-break toward cheaper sources (level-up over TM) and higher raw power.
      const adj = s - (o.tm ? 0.001 : 0) + (MOVES[o.move].power ?? 0) * 1e-6;
      if (adj > bestScore) { bestScore = adj; bestOpt = o; }
    }
    if (!bestOpt || bestScore <= 0.0005) break;
    chosen.push(bestOpt);
  }
  // Fill empty slots with whatever is strongest so the card never shows < 4 moves when more exist.
  if (chosen.length < 4) {
    const rest = options.filter(o => !chosen.includes(o)).sort((a, b) => (MOVES[b.move].power ?? 0) - (MOVES[a.move].power ?? 0));
    while (chosen.length < 4 && rest.length) chosen.push(rest.shift()!);
  }
  return { moves: chosen.map(({ move, source, tm }) => ({ move, source, tm })), value: score(chosen) };
}

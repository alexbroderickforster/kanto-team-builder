// Gen 1 battle math: stats, type effectiveness and expected damage.
import typesJson from '../../data/types.json';
import type { BaseStats, Move, TypeName } from './types';

const CHART = typesJson.chart as Record<TypeName, Record<TypeName, number>>;
export const TYPES = typesJson.types as TypeName[];

export function effectiveness(attack: TypeName, defender: readonly TypeName[]): number {
  return defender.reduce((m, t) => m * CHART[attack][t], 1);
}

export interface Battler {
  level: number;
  types: TypeName[];
  base: BaseStats;
  hp: number; atk: number; def: number; spc: number; spe: number;
  moves: Move[];
}

/** Player DVs average 8; trainer Pokémon use Atk 9 / others 8 and have no stat exp. */
export function calcStats(base: BaseStats, level: number, opts: { trainer?: boolean; badges?: number } = {}) {
  const dv = { hp: 8, atk: opts.trainer ? 9 : 8, def: 8, spc: 8, spe: 8 };
  // A rough stand-in for stat experience earned over a normal playthrough.
  const statExp = opts.trainer ? 0 : Math.min(63, Math.floor(level * 0.6));
  const s = (b: number, d: number) => Math.floor(((b + d) * 2 + statExp) * level / 100) + 5;
  const badges = opts.trainer ? 0 : opts.badges ?? 0;
  // Badge boosts: Boulder→Atk, Thunder→Def, Soul→Spe, Volcano→Spc (×9/8).
  const boost = (n: number, badgeIndex: number) => (badges > badgeIndex ? Math.floor(n * 9 / 8) : n);
  return {
    hp: Math.floor(((base.hp + dv.hp) * 2 + statExp) * level / 100) + level + 10,
    atk: boost(s(base.atk, dv.atk), 0),
    def: boost(s(base.def, dv.def), 2),
    spe: boost(s(base.spe, dv.spe), 4),
    spc: boost(s(base.spc, dv.spc), 6),
  };
}

/** Chance of a critical hit: Gen 1 ties it to base Speed; high-crit moves ×8 (capped at 255/256). */
export function critChance(baseSpe: number, highCrit: boolean): number {
  return Math.min(255, Math.floor(baseSpe / 2) * (highCrit ? 8 : 1)) / 256;
}

/**
 * Expected damage per turn as a fraction of the defender's max HP,
 * folding in accuracy, crits, multi-hit, and turn costs (charge / recharge / self-KO).
 */
export function expectedDamage(a: Battler, d: Battler, mv: Move): number {
  const f = mv.flags;
  const isDamaging = (mv.power ?? 0) > 1 || f.fixedDamage !== null || f.ohko || mv.id === 'psywave' || mv.id === 'superfang';
  if (!isDamaging) return 0;
  const eff = effectiveness(mv.type, d.types);
  if (eff === 0) return 0;

  let dmg: number;
  if (f.ohko) {
    // Gen 1 OHKO moves only land if the user is at least as fast.
    dmg = a.spe >= d.spe ? d.hp : 0;
  } else if (f.fixedDamage === 'level') {
    dmg = a.level;
  } else if (typeof f.fixedDamage === 'number') {
    dmg = f.fixedDamage;
  } else if (mv.id === 'psywave') {
    dmg = a.level * 0.75;
  } else if (mv.id === 'superfang') {
    dmg = d.hp * 0.35;
  } else {
    const special = mv.category === 'Special';
    let A = special ? a.spc : a.atk;
    let D = special ? d.spc : d.def;
    if (f.selfKO) D = Math.max(1, Math.floor(D / 2)); // Explosion/Selfdestruct halve Defense in Gen 1
    if (A > 255 || D > 255) { A = Math.floor(A / 4); D = Math.max(1, Math.floor(D / 4)); }
    const L = a.level;
    const base = ((2 * L / 5 + 2) * (mv.power ?? 0) * A / D) / 50 + 2;
    const stab = a.types.includes(mv.type) ? 1.5 : 1;
    const critMult = (4 * L / 5 + 2) / (2 * L / 5 + 2);
    const p = critChance(a.base.spe, f.highCrit);
    dmg = base * stab * eff * 0.925 * (1 + p * (critMult - 1)) * f.hits;
  }

  const acc = ((mv.accuracy ?? 100) / 100) * (255 / 256);
  dmg *= acc;
  if (f.charge) dmg *= mv.id === 'fly' || mv.id === 'dig' ? 0.55 : 0.5;
  if (f.recharge) dmg *= 0.8; // no recharge after a KO in Gen 1, so not a full half
  if (f.selfKO) dmg *= 0.35;
  if (f.trap) dmg *= a.spe > d.spe ? 1.6 : 1;
  if (f.recoil) dmg *= 0.95;
  return dmg / d.hp;
}

export function turnsToKO(dmgFraction: number): number {
  return dmgFraction <= 0 ? Infinity : Math.ceil(1 / Math.min(1, dmgFraction) - 1e-9);
}

import { describe, expect, it } from 'vitest';
import { availablePool } from '../availability';
import { calcStats, critChance, effectiveness } from '../gen1';
import { learnableMoves } from '../movesets';
import { optimize } from '../optimize';
import { tmsFor } from '../progression';
import type { Config } from '../types';

const base: Config = {
  version: 'red', starter: 'charmander', badges: 0, goal: 'next',
  rules: { trade: false, legendaries: false, gameCorner: true, hmCoverage: true, keepStarter: true },
  mustHave: [], exclude: [],
};

describe('Gen 1 mechanics', () => {
  it('uses the cartridge type chart', () => {
    expect(effectiveness('Ghost', ['Psychic'])).toBe(0);
    expect(effectiveness('Bug', ['Poison'])).toBe(2);
    expect(effectiveness('Ice', ['Fire'])).toBe(1);
    expect(effectiveness('Water', ['Rock', 'Ground'])).toBe(4);
  });
  it('ties crit rate to base Speed', () => {
    expect(critChance(100, true)).toBeCloseTo(255 / 256); // Charizard's Slash
    expect(critChance(100, false)).toBeCloseTo(50 / 256);
  });
  it('applies badge boosts only to the player', () => {
    const b = { hp: 50, atk: 100, def: 50, spc: 50, spe: 50 };
    expect(calcStats(b, 50, { badges: 1 }).atk).toBeGreaterThan(calcStats(b, 50, { badges: 0 }).atk);
    expect(calcStats(b, 50, { trainer: true, badges: 8 }).atk).toBe(calcStats(b, 50, { trainer: true }).atk);
  });
});

describe('availability', () => {
  it('respects version exclusives unless trading', () => {
    expect(availablePool(base, 8, 60).has('sandshrew')).toBe(false);
    expect(availablePool({ ...base, rules: { ...base.rules, trade: true } }, 8, 60).has('sandshrew')).toBe(true);
    expect(availablePool(base, 8, 60).has('ekans')).toBe(true);
  });
  it('blocks trade evolutions without a link cable', () => {
    const pool = availablePool(base, 8, 60);
    for (const id of ['alakazam', 'machamp', 'golem', 'gengar']) expect(pool.has(id)).toBe(false);
    expect(pool.has('kadabra')).toBe(true);
  });
  it('limits the early game to what is reachable', () => {
    const pool = availablePool(base, 0, 14);
    expect(pool.has('charmander')).toBe(true);
    expect(pool.has('squirtle')).toBe(false);
    expect(pool.has('butterfree')).toBe(true);
    expect(pool.has('lapras')).toBe(false);
  });
  it('never offers Mew and gates legendaries', () => {
    expect(availablePool(base, 8, 60).has('mew')).toBe(false);
    expect(availablePool(base, 8, 60).has('zapdos')).toBe(false);
    expect(availablePool({ ...base, rules: { ...base.rules, legendaries: true } }, 8, 60).has('zapdos')).toBe(true);
  });
});

describe('moves and TMs', () => {
  it('does not hand out a gym TM before its gym', () => {
    const tms = tmsFor(base);
    expect(tms.find(t => t.id === 'TM34')!.minBadges).toBe(1);
    expect(learnableMoves('charmander', 14, 0, tms).some(o => o.move === 'bide')).toBe(false);
  });
  it('lets evolved forms keep pre-evolution moves learned before evolving', () => {
    const opts = learnableMoves('butterfree', 14, 0, tmsFor(base));
    expect(opts.some(o => o.move === 'confusion')).toBe(true);
  });
});

describe('optimizer', () => {
  it('finds a Brock answer for Charmander (special attacker vs Onix)', () => {
    const r = optimize(base);
    expect(r.team[0].species).toBe('charmander');
    const onix = r.answers.find(a => a.enemy.species === 'onix')!;
    expect(onix.answer?.wins).toBe(true);
  });
  it('never spends a single-use TM twice', () => {
    const r = optimize({ ...base, goal: 'league' });
    const tms = r.ledger.map(l => l.tm);
    expect(new Set(tms).size).toBe(tms.length);
  });
  it('carries the required HMs for the league', () => {
    const r = optimize({ ...base, goal: 'league' });
    expect(r.hms.every(h => h.who)).toBe(true);
  });
  it('keeps must-haves and honors exclusions', () => {
    const r = optimize({ ...base, goal: 'league', mustHave: ['pikachu'], exclude: ['lapras'] });
    expect(r.team.some(m => m.species === 'raichu' || m.species === 'pikachu')).toBe(true);
    expect(r.team.some(m => m.species === 'lapras')).toBe(false);
  });
});

describe('run planner', async () => {
  const { planRun } = await import('../plan');
  it('plans all 8 gyms plus the League and keeps most of the team between stops', () => {
    const steps = planRun({ ...base, goal: 'next' });
    expect(steps.map(s => s.label)).toEqual(['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni', 'Elite Four']);
    const churn = steps.slice(1).reduce((a, s) => a + s.added.length, 0);
    expect(churn).toBeLessThan(30); // continuity bonus keeps swaps modest across 8 transitions
  });
  it('never uses two different Eevee evolutions, fossils or Dojo picks in one run', () => {
    for (const starter of ['bulbasaur', 'charmander', 'squirtle'] as const) {
      const used = new Set(planRun({ ...base, starter }).flatMap(s => s.result.team.map(m => m.species)));
      expect(['vaporeon', 'jolteon', 'flareon'].filter(x => used.has(x)).length).toBeLessThanOrEqual(1);
      expect(['hitmonlee', 'hitmonchan'].filter(x => used.has(x)).length).toBeLessThanOrEqual(1);
      expect(used.has('omastar') && used.has('kabutops')).toBe(false);
    }
  });
});

describe('TM catalog', async () => {
  const { tmCatalog } = await import('../progression');
  it('lists every TM and HM with where to find it', () => {
    const cat = tmCatalog(base);
    expect(cat).toHaveLength(55);
    expect(cat.find(t => t.id === 'TM26')!.locations[0].where).toMatch(/Silph/);
    expect(cat.find(t => t.id === 'HM03')!.reusable).toBe(true);
  });
});

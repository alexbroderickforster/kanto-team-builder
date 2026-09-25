// Config ⇄ URL query string, so any team can be shared as a link.
import type { Config, Goal, Starter, Version } from './engine';

export const DEFAULT_CONFIG: Config = {
  version: 'red',
  starter: 'charmander',
  badges: 0,
  goal: 'next',
  rules: { trade: false, legendaries: false, gameCorner: true, hmCoverage: true, keepStarter: true },
  mustHave: [],
  exclude: [],
};

const RULE_KEYS = ['trade', 'legendaries', 'gameCorner', 'hmCoverage', 'keepStarter'] as const;

export function readConfig(search: string): Config {
  const q = new URLSearchParams(search);
  const cfg = structuredClone(DEFAULT_CONFIG);
  const v = q.get('v');
  if (v === 'red' || v === 'blue') cfg.version = v as Version;
  const s = q.get('s');
  if (s === 'bulbasaur' || s === 'charmander' || s === 'squirtle') cfg.starter = s as Starter;
  const b = Number(q.get('b'));
  if (Number.isInteger(b) && b >= 0 && b <= 8) cfg.badges = b;
  const g = q.get('g');
  if (g === 'next' || g === 'league') cfg.goal = g as Goal;
  const r = q.get('r');
  if (r && /^[01]{5}$/.test(r)) RULE_KEYS.forEach((k, i) => (cfg.rules[k] = r[i] === '1'));
  cfg.mustHave = (q.get('keep') ?? '').split(',').filter(Boolean);
  cfg.exclude = (q.get('skip') ?? '').split(',').filter(Boolean);
  return cfg;
}

export function writeConfig(cfg: Config): string {
  const q = new URLSearchParams({
    v: cfg.version, s: cfg.starter, b: String(cfg.badges), g: cfg.goal,
    r: RULE_KEYS.map(k => (cfg.rules[k] ? '1' : '0')).join(''),
  });
  if (cfg.mustHave.length) q.set('keep', cfg.mustHave.join(','));
  if (cfg.exclude.length) q.set('skip', cfg.exclude.join(','));
  return `?${q.toString()}`;
}

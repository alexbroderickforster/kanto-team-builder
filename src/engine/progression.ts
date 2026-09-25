// Bosses and TM availability from the curated progression data.
import progression from '../../data/progression.json';
import type { Boss, Config, EnemyMon, Starter, TmInfo } from './types';

interface RawStage { id: string; badgesHeld: number }
interface RawTrainer {
  id: string; name: string; kind: Boss['kind']; stageBefore: string; locationDetail?: string; location: string; type?: string | null;
  team?: EnemyMon[]; teamsByPlayerStarter?: Record<Starter, EnemyMon[]>;
}
interface RawTmLocation {
  where: string; how: string; versions: string[]; typicalStage: string; earliestStage: string;
  price: { currency: 'yen' | 'coins'; amount: number } | null; note?: string;
}
interface RawTm { id: string; move: string; locations: RawTmLocation[]; unlimitedSource: string | null; notes?: string }

const data = progression as unknown as { stages: RawStage[]; trainers: RawTrainer[]; tms: RawTm[]; mechanicsNotes: string[] };

const STAGE_BADGES: Record<string, number> = Object.fromEntries(data.stages.map(s => [s.id, s.badgesHeld]));
export const MECHANICS_NOTES = data.mechanicsNotes;

export const GYM_ORDER = ['brock', 'misty', 'lt-surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni-gym'];

export function bossesFor(cfg: Pick<Config, 'starter'>): Boss[] {
  return data.trainers
    .filter(t => t.kind === 'gym' || t.kind === 'elite4' || t.kind === 'champion')
    .map(t => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      location: t.locationDetail ?? t.location,
      badgesBefore: STAGE_BADGES[t.stageBefore] ?? 0,
      specialty: t.type ?? undefined,
      team: t.team ?? t.teamsByPlayerStarter?.[cfg.starter] ?? [],
    }));
}

/** The boss(es) the player is preparing for. */
export function scopeBosses(cfg: Config): Boss[] {
  const all = bossesFor(cfg);
  if (cfg.goal === 'league' || cfg.badges >= 8) return all.filter(b => b.kind === 'elite4' || b.kind === 'champion');
  return all.filter(b => b.id === GYM_ORDER[cfg.badges]);
}

export function tmsFor(cfg: Config): TmInfo[] {
  return data.tms.map(t => {
    const sources = t.locations.filter(l => l.versions.includes(cfg.version) && (l.how !== 'prize' || cfg.rules.gameCorner));
    const best = sources
      // A gym's reward TM arrives with its badge, i.e. after that fight.
      .map(l => ({ l, b: (STAGE_BADGES[l.typicalStage] ?? 8) + (l.how === 'gym' ? 1 : 0) }))
      .sort((a, b) => a.b - b.b)[0];
    const hm = t.id.startsWith('HM');
    const unlimited = t.unlimitedSource === 'celadon-dept-store' || (t.unlimitedSource === 'game-corner' && cfg.rules.gameCorner);
    return {
      id: t.id,
      move: t.move,
      minBadges: best ? best.b : Infinity,
      reusable: hm || unlimited,
      where: best?.l.where ?? '—',
    };
  });
}

/** HMs the party must carry by this point when "carry HMs" is on (Gen 1 HM moves can't be forgotten). */
export function requiredHMs(cfg: Config): string[] {
  const b = cfg.goal === 'league' ? 8 : cfg.badges;
  const need: string[] = [];
  if (b >= 2) need.push('cut');      // Vermilion Gym is behind a Cut tree
  if (b >= 6) need.push('surf');     // Cinnabar Island
  if (b >= 8) need.push('strength'); // Victory Road boulders
  return need;
}

export interface TmCatalogEntry {
  id: string;
  move: string;
  reusable: boolean;
  notes?: string;
  locations: { where: string; how: string; price: string | null; badges: number; note?: string }[];
}

const HOW_LABEL: Record<string, string> = { ground: 'Item on the ground', buy: 'Buy', gym: 'Gym reward', npc: 'Gift from an NPC', prize: 'Game Corner prize' };

/** Every TM/HM with all the places to get it in this version, for the "where to get it" drawer. */
export function tmCatalog(cfg: Config): TmCatalogEntry[] {
  const reusable = new Map(tmsFor(cfg).map(t => [t.id, t.reusable]));
  return data.tms.map(t => ({
    id: t.id,
    move: t.move,
    reusable: reusable.get(t.id) ?? false,
    notes: t.notes,
    locations: t.locations
      .filter(l => l.versions.includes(cfg.version))
      .map(l => ({
        where: l.where,
        how: HOW_LABEL[l.how] ?? l.how,
        price: l.price ? (l.price.currency === 'yen' ? `¥${l.price.amount.toLocaleString()}` : `${l.price.amount.toLocaleString()} coins`) : null,
        badges: (STAGE_BADGES[l.typicalStage] ?? 8) + (l.how === 'gym' ? 1 : 0),
        note: l.note,
      }))
      .sort((a, b) => a.badges - b.badges),
  }));
}

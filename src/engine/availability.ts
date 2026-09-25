// Which Pokémon can the player actually have, given version, progress and house rules?
import pokemonJson from '../../data/pokemon.json';
import type { Config, Encounter, Species, Version } from './types';

export const POKEMON = pokemonJson as unknown as Species[];
export const SPECIES: Record<string, Species> = Object.fromEntries(POKEMON.map(p => [p.id, p]));

export const LEGENDARIES = new Set(['articuno', 'zapdos', 'moltres', 'mewtwo']);
export const NEVER = new Set(['mew']);
export const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;

/**
 * Fewest badges needed to reach each area and encounter Pokémon there, following the usual
 * R/B route: Brock → Misty → (S.S. Anne, Cut) → Surge → Rock Tunnel/Celadon → Erika →
 * (Silph Scope, Poké Flute, Fuchsia) → Koga → (Surf) → Sabrina → Blaine → Giovanni.
 * 9 = only after becoming Champion.
 */
const AREA_BADGES: Record<string, number> = {
  'pallet-town-area': 0, 'kanto-route-1-area': 0, 'viridian-city-area': 0,
  'kanto-route-2-south-towards-viridian-city': 0, 'viridian-forest-area': 0, 'kanto-route-22-area': 0,
  'kanto-route-2-north-towards-pewter-city': 2, // behind a Cut tree
  'kanto-route-3-area': 1, 'kanto-route-3-pokemon-center': 1,
  'mt-moon-1f': 1, 'mt-moon-b1f': 1, 'mt-moon-b2f': 1,
  'kanto-route-4-area': 1, 'kanto-route-4-pokemon-center': 1,
  'cerulean-city-area': 1, 'kanto-route-24-area': 1, 'kanto-route-25-area': 1,
  'kanto-route-5-area': 2, 'kanto-route-6-area': 2, 'kanto-underground-path-area': 2,
  'vermilion-city-area': 2, 'vermilion-city-ss-anne-dock': 2, 'kanto-route-11-area': 2, 'digletts-cave-area': 2,
  'kanto-route-9-area': 3, 'kanto-route-10-area': 3, 'rock-tunnel-b1f': 3, 'rock-tunnel-b2f': 3,
  'kanto-route-7-area': 3, 'kanto-route-8-area': 3, 'celadon-city-area': 3,
  'celadon-city-prize-corner': 3, 'celadon-city-celadon-mansion': 3,
  'pokemon-tower-3f': 4, 'pokemon-tower-4f': 4, 'pokemon-tower-5f': 4, 'pokemon-tower-6f': 4, 'pokemon-tower-7f': 4,
  'kanto-route-12-area': 4, 'kanto-route-13-area': 4, 'kanto-route-14-area': 4, 'kanto-route-15-area': 4,
  'kanto-route-16-area': 4, 'kanto-route-17-area': 4, 'kanto-route-18-area': 4,
  'fuchsia-city-area': 4, 'kanto-safari-zone-middle': 4, 'kanto-safari-zone-area-1-east': 4,
  'kanto-safari-zone-area-2-north': 4, 'kanto-safari-zone-area-3-west': 4,
  'saffron-city-fighting-dojo': 4, 'saffron-city-silph-co-7f': 4,
  'kanto-sea-route-19-area': 5, 'kanto-sea-route-20-area': 5, 'kanto-sea-route-21-area': 5,
  'seafoam-islands-1f': 5, 'seafoam-islands-b1f': 5, 'seafoam-islands-b2f': 5, 'seafoam-islands-b3f': 5, 'seafoam-islands-b4f': 5,
  'cinnabar-island-area': 5, 'cinnabar-island-cinnabar-lab': 5, 'kanto-power-plant-area': 5,
  'pokemon-mansion-1f': 5, 'pokemon-mansion-2f': 5, 'pokemon-mansion-3f': 5, 'pokemon-mansion-b1f': 5,
  'kanto-route-23-area': 8, 'kanto-victory-road-2-1f': 8, 'kanto-victory-road-2-2f': 8, 'kanto-victory-road-2-3f': 8,
  'cerulean-cave-1f': 9, 'cerulean-cave-2f': 9, 'cerulean-cave-b1f': 9,
};

/** Fewest badges before an encounter method is usable. */
const METHOD_BADGES: Record<string, number> = {
  walk: 0, gift: 0, static: 0, 'npc-trade': 0,
  'old-rod': 2,   // Vermilion fishing guru
  'good-rod': 4,  // Fuchsia
  'super-rod': 4, // Route 12, past the sleeping Snorlax
  pokeflute: 4,
  surf: 5,        // HM03 from the Safari Zone, usable with the Soul Badge
};

/** Evolution stones: Moon Stones are found (Mt. Moon onward); the rest are sold in Celadon. */
const STONE_BADGES: Record<string, number> = {
  'moon-stone': 1, 'fire-stone': 3, 'water-stone': 3, 'thunder-stone': 3, 'leaf-stone': 3,
};

/** Only one of each group can be obtained per save file. */
const EXCLUSIVE_GROUPS: Record<string, string> = {
  bulbasaur: 'starter', charmander: 'starter', squirtle: 'starter',
  hitmonlee: 'fighting-dojo', hitmonchan: 'fighting-dojo',
  omanyte: 'fossil', kabuto: 'fossil',
  eevee: 'eevee',
};

export function areaLabel(area: string): string {
  const special: Record<string, string> = {
    'celadon-city-prize-corner': 'Game Corner',
    'celadon-city-celadon-mansion': 'Celadon Mansion',
    'saffron-city-silph-co-7f': 'Silph Co. 7F',
    'saffron-city-fighting-dojo': 'Fighting Dojo',
    'vermilion-city-ss-anne-dock': 'S.S. Anne dock',
    'cinnabar-island-cinnabar-lab': 'Cinnabar Lab',
    'kanto-underground-path-area': 'Underground Path',
    'kanto-route-3-pokemon-center': 'Route 3 Poké Center',
    'kanto-route-4-pokemon-center': 'Route 4 Poké Center',
    'kanto-route-2-north-towards-pewter-city': 'Route 2',
    'kanto-route-2-south-towards-viridian-city': 'Route 2',
    'kanto-power-plant-area': 'Power Plant',
  };
  if (special[area]) return special[area];
  let s = area.replace(/^kanto-/, '').replace(/-area$/, '');
  if (s.startsWith('safari-zone')) return 'Safari Zone';
  if (s.startsWith('victory-road')) return 'Victory Road';
  s = s.replace(/^sea-route/, 'route');
  return s.split('-').map(w => (/^b?\d+f$/.test(w) ? w.toUpperCase() : w === 'mt' ? 'Mt.' : w[0].toUpperCase() + w.slice(1))).join(' ');
}

const METHOD_LABEL: Record<string, string> = {
  walk: '', gift: 'gift', static: 'static', 'npc-trade': 'in-game trade', 'old-rod': 'Old Rod',
  'good-rod': 'Good Rod', 'super-rod': 'Super Rod', pokeflute: 'Poké Flute', surf: 'Surf',
};

export interface Availability {
  species: string;
  /** Badges needed before you can have this exact species. */
  minBadges: number;
  /** Human-readable acquisition path, e.g. "Route 22 Nidoran♂ → L16 → Moon Stone". */
  how: string;
  /** Short caveat such as a rare encounter rate. */
  note?: string;
  /** Where the base form is found, e.g. "Viridian Forest". */
  where?: string;
  exclusiveGroup?: string;
  /** Base species the path starts from. */
  root: string;
  viaTrade: boolean;
}

interface Source { minBadges: number; how: string; where: string; note?: string; chance: number; viaTrade: boolean }

function bestSource(sp: Species, version: Version, cfg: Config): Source | null {
  const candidates: Source[] = [];
  const add = (enc: Encounter, viaTrade: boolean) => {
    if (enc.area === 'celadon-city-prize-corner' && !cfg.rules.gameCorner) return;
    const areaB = AREA_BADGES[enc.area];
    if (areaB === undefined) return;
    const minBadges = Math.max(areaB, METHOD_BADGES[enc.method] ?? 0);
    const label = [areaLabel(enc.area), METHOD_LABEL[enc.method]].filter(Boolean).join(' · ');
    const rare = enc.method === 'walk' || enc.method.endsWith('rod') || enc.method === 'surf';
    candidates.push({
      minBadges, chance: enc.chance, viaTrade, where: areaLabel(enc.area),
      how: viaTrade ? `${label} (${version === 'red' ? 'Blue' : 'Red'}, traded)` : label,
      note: rare && enc.chance <= 10 ? `${enc.chance}% encounter` : undefined,
    });
  };
  for (const e of sp.encounters[version]) add(e, false);
  if (cfg.rules.trade) {
    const other: Version = version === 'red' ? 'blue' : 'red';
    for (const e of sp.encounters[other]) add(e, true);
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.minBadges - b.minBadges || Number(a.viaTrade) - Number(b.viaTrade) || b.chance - a.chance);
  return candidates[0];
}

/**
 * Every species obtainable with `badges` badges and a party no higher than `levelCap`.
 * Walks evolution chains from each obtainable base form.
 */
export function availablePool(cfg: Config, badges: number, levelCap: number): Map<string, Availability> {
  const pool = new Map<string, Availability>();
  const consider = (a: Availability) => {
    const prev = pool.get(a.species);
    if (!prev || a.minBadges < prev.minBadges || (a.minBadges === prev.minBadges && prev.viaTrade && !a.viaTrade)) pool.set(a.species, a);
  };

  for (const sp of POKEMON) {
    if (NEVER.has(sp.id) || (LEGENDARIES.has(sp.id) && !cfg.rules.legendaries)) continue;
    if ((STARTERS as readonly string[]).includes(sp.id)) {
      if (sp.id === cfg.starter) consider({ species: sp.id, minBadges: 0, how: 'Starter · Pallet Town', where: 'Pallet Town', root: sp.id, viaTrade: false, exclusiveGroup: 'starter' });
      continue;
    }
    const src = bestSource(sp, cfg.version, cfg);
    if (!src || src.minBadges > badges) continue;
    consider({ species: sp.id, minBadges: src.minBadges, how: src.how, note: src.note, where: src.where, root: sp.id, viaTrade: src.viaTrade, exclusiveGroup: EXCLUSIVE_GROUPS[sp.id] });
  }

  // Evolve everything we can reach. Iterate until stable (chains are at most 3 long).
  for (let pass = 0; pass < 3; pass++) {
    for (const a of [...pool.values()]) {
      for (const evo of SPECIES[a.species].evolvesTo) {
        if (LEGENDARIES.has(evo.species) && !cfg.rules.legendaries) continue;
        let need = a.minBadges;
        let step: string;
        if (evo.trigger === 'level-up') {
          if ((evo.level ?? 0) > levelCap) continue;
          step = `L${evo.level}`;
        } else if (evo.trigger === 'use-item') {
          need = Math.max(need, STONE_BADGES[evo.item ?? ''] ?? 3);
          step = (evo.item ?? '').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        } else if (evo.trigger === 'trade') {
          if (!cfg.rules.trade) continue;
          step = 'trade';
        } else continue;
        if (need > badges) continue;
        const rootName = SPECIES[a.root].name;
        const how = a.species === a.root ? `${a.how} ${rootName} → ${step}` : `${a.how} → ${step}`;
        consider({ ...a, species: evo.species, minBadges: need, how, viaTrade: a.viaTrade || evo.trigger === 'trade' });
      }
    }
  }
  return pool;
}

/** Keep only the most evolved form available in each line (pre-evolutions are strictly worse picks). */
export function topForms(pool: Map<string, Availability>): Availability[] {
  return [...pool.values()].filter(a => !SPECIES[a.species].evolvesTo.some(e => pool.has(e.species)));
}

/** Species on the same evolutionary line share a root; used to stop two of the same line. */
export function lineRoot(id: string): string {
  let cur = SPECIES[id];
  while (cur.evolvesFrom) cur = SPECIES[cur.evolvesFrom.species];
  return cur.id;
}

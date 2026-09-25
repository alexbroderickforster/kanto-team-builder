export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Electric' | 'Grass' | 'Ice' | 'Fighting' | 'Poison'
  | 'Ground' | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon';

export type Version = 'red' | 'blue';
export type Starter = 'bulbasaur' | 'charmander' | 'squirtle';

export interface BaseStats { hp: number; atk: number; def: number; spc: number; spe: number }

export interface Evolution {
  species: string;
  trigger: 'level-up' | 'use-item' | 'trade' | null;
  level: number | null;
  item: string | null;
}

export interface Encounter { area: string; method: string; minLevel: number; maxLevel: number; chance: number }

export interface Species {
  num: number;
  id: string;
  name: string;
  types: TypeName[];
  baseStats: BaseStats;
  bst: number;
  catchRate: number;
  evolvesFrom: Evolution | null;
  evolvesTo: Evolution[];
  fullyEvolved: boolean;
  learnset: { levelUp: { level: number; move: string }[]; tm: string[] };
  encounters: Record<Version, Encounter[]>;
  sprite: string;
  spriteColor: string;
  genus: string;
}

export interface Move {
  id: string;
  num: number;
  name: string;
  type: TypeName;
  category: 'Physical' | 'Special' | 'Status';
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  machine: string | null;
  effect: string;
  flags: {
    multiHit: boolean; hits: number; recharge: boolean; charge: boolean; trap: boolean;
    recoil: boolean; selfKO: boolean; ohko: boolean; highCrit: boolean;
    fixedDamage: 'level' | number | null; drain: boolean;
  };
  status: string | null;
}

export interface Rules {
  trade: boolean;        // link-cable trading allowed (trade evolutions + other version's exclusives)
  legendaries: boolean;  // Articuno, Zapdos, Moltres, Mewtwo
  gameCorner: boolean;   // prize Pokémon and prize TMs
  hmCoverage: boolean;   // reward teams that can learn Cut / Surf / Strength / Fly
  keepStarter: boolean;  // starter is always on the team
}

export type Goal = 'next' | 'league';

export interface Config {
  version: Version;
  starter: Starter;
  badges: number;        // 0-8 badges already won
  goal: Goal;
  rules: Rules;
  mustHave: string[];    // species ids the player insists on
  exclude: string[];     // species ids the player doesn't want (their whole line is skipped)
  /** Soft preference for these lines (used by the run planner to keep a team together between gyms). */
  prefer?: string[];
  /** Exact species that are off the table (e.g. the Eevee branches you didn't pick earlier in the run). */
  banSpecies?: string[];
}

/** One enemy Pokémon in a scripted battle. */
export interface EnemyMon { species: string; level: number; moves: string[] }

export interface Boss {
  id: string;
  name: string;
  kind: 'gym' | 'elite4' | 'champion' | 'rival' | 'rocket';
  location: string;
  /** Badges the player holds when this fight happens. */
  badgesBefore: number;
  specialty?: string;
  team: EnemyMon[];
}

export interface TmInfo {
  id: string;            // "TM26" / "HM03"
  move: string;
  /** Badges needed before the player can obtain it (Infinity = not obtainable under these rules). */
  minBadges: number;
  /** Can the player get more than one? (HMs, Celadon store TMs, Game Corner prize TMs.) */
  reusable: boolean;
  where: string;
}

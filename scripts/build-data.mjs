// Merges cached PokeAPI data (Red/Blue learnsets, TMs, evolutions, encounters)
// with Pokémon Showdown's Gen 1 mod (battle-accurate stats, types, moves, type chart)
// into app-ready JSON under data/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Dex } = require('pokemon-showdown');
const gen1 = Dex.mod('gen1');

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'data');
const readRaw = async key => JSON.parse(await fs.readFile(path.join(RAW, key + '.json'), 'utf8').catch(() => fs.readFile(path.join(RAW, key + '_.json'), 'utf8')));
const ALIASES = { vicegrip: 'visegrip' }; // PokeAPI name -> Showdown id
const toId = s => { const id = s.toLowerCase().replace(/[^a-z0-9]/g, ''); return ALIASES[id] ?? id; };
const RB = 'red-blue';

const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon'];
// Gen 1 splits physical/special by type, not by move.
const SPECIAL_TYPES = new Set(['Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Psychic', 'Dragon']);

// ---------- Type chart ----------
const typeChart = {};
for (const atk of TYPES) {
  typeChart[atk] = {};
  for (const def of TYPES) {
    const mult = !gen1.getImmunity(atk, [def]) ? 0 : 2 ** gen1.getEffectiveness(atk, def);
    typeChart[atk][def] = mult;
  }
}

// ---------- Machines (TM/HM numbers for red-blue) ----------
const machineByMove = {};
const pokeMoves = new Set();
const ids = Array.from({ length: 151 }, (_, i) => i + 1);
const pokemonRaw = await Promise.all(ids.map(id => readRaw(`pokemon_${id}`)));
const speciesRaw = await Promise.all(ids.map(id => readRaw(`pokemon_species_${id}`)));
const encRaw = await Promise.all(ids.map(id => readRaw(`pokemon_${id}_encounters`)));
for (const p of pokemonRaw) for (const m of p.moves)
  if (m.version_group_details.some(d => d.version_group.name === RB)) pokeMoves.add(m.move.name);
for (const name of pokeMoves) {
  const mv = await readRaw(`move_${name.replace(/[^a-z0-9]+/gi, '_')}`);
  for (const mc of mv.machines.filter(x => x.version_group.name === RB)) {
    const id = mc.machine.url.match(/machine\/(\d+)/)[1];
    const machine = await readRaw(`machine_${id}`);
    const item = machine.item.name; // e.g. "tm01", "hm03"
    machineByMove[name] = item.toUpperCase();
  }
}

// ---------- Moves ----------
// All 165 Gen 1 moves (ids 1-165), pulled from Showdown's gen1 mod.
const moves = {};
for (const m of gen1.moves.all()) {
  if (m.num < 1 || m.num > 165 || m.isNonstandard) continue;
  const slug = m.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
  const machine = machineByMove[slug] ?? Object.entries(machineByMove).find(([k]) => toId(k) === m.id)?.[1] ?? null;
  moves[m.id] = {
    id: m.id,
    num: m.num,
    name: m.name,
    type: TYPES.includes(m.type) ? m.type : 'Normal', // Showdown marks Bide as "???"; it's Normal in Red/Blue
    category: m.category === 'Status' ? 'Status' : (SPECIAL_TYPES.has(m.type) ? 'Special' : 'Physical'),
    power: m.basePower || null,
    accuracy: m.accuracy === true ? null : m.accuracy,
    pp: m.pp,
    priority: m.priority,
    machine,
    effect: m.shortDesc || m.desc || '',
    flags: {
      multiHit: !!m.multihit,
      hits: Array.isArray(m.multihit) ? 3 : (m.multihit ?? 1), // 2-5 hit moves average 3 in Gen 1
      recharge: !!m.self?.volatileStatus?.includes?.('mustrecharge') || m.id === 'hyperbeam',
      charge: !!m.flags?.charge || ['fly', 'dig'].includes(m.id),
      trap: m.volatileStatus === 'partiallytrapped' || m.secondary?.volatileStatus === 'partiallytrapped' || ['wrap', 'bind', 'firespin', 'clamp'].includes(m.id),
      recoil: !!m.recoil,
      selfKO: !!m.selfdestruct,
      ohko: !!m.ohko,
      highCrit: (m.critRatio ?? 1) > 1,
      fixedDamage: m.damage ?? null,
      drain: !!m.drain,
    },
    secondary: m.secondary ? { chance: m.secondary.chance, status: m.secondary.status, volatile: m.secondary.volatileStatus, boosts: m.secondary.boosts } : null,
    status: m.status ?? null,
    boosts: m.boosts ?? null,
  };
}

// ---------- Evolutions ----------
const evoInfo = {}; // species slug -> { from, to: [{ species, trigger, level, item }] }
function walkChain(node, parent, parentNum = 0) {
  const name = node.species.name;
  const dexNum = Number(node.species.url.match(/(\d+)\/?$/)[1]);
  evoInfo[name] ??= { from: null, to: [] };
  if (parent && dexNum <= 151 && parentNum <= 151) {
    const d = node.evolution_details[0] ?? {};
    const edge = { species: toId(name), trigger: d.trigger?.name ?? null, level: d.min_level ?? null, item: d.item?.name ?? null };
    evoInfo[parent].to.push(edge);
    evoInfo[name].from = { species: toId(parent), trigger: edge.trigger, level: edge.level, item: edge.item };
  }
  for (const c of node.evolves_to) walkChain(c, name, dexNum);
}
const chainIds = [...new Set(speciesRaw.map(s => s.evolution_chain.url.match(/(\d+)\/?$/)[1]))];
for (const cid of chainIds) walkChain((await readRaw(`evolution_chain_${cid}`)).chain, null);

// ---------- Pokémon ----------
const pokemon = [];
for (let i = 0; i < 151; i++) {
  const p = pokemonRaw[i], s = speciesRaw[i];
  const sd = gen1.species.get(p.name === 'nidoran-f' ? 'nidoranf' : p.name === 'nidoran-m' ? 'nidoranm' : p.name);
  if (!sd.exists) throw new Error('missing showdown species ' + p.name);

  const levelUp = [], tm = [];
  for (const m of p.moves) {
    const moveId = toId(m.move.name);
    for (const d of m.version_group_details.filter(d => d.version_group.name === RB)) {
      if (d.move_learn_method.name === 'level-up') levelUp.push({ level: d.level_learned_at, move: moveId });
      if (d.move_learn_method.name === 'machine') tm.push(moveId);
    }
  }
  levelUp.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  const tmSorted = [...new Set(tm)].sort((a, b) => (moves[a]?.machine ?? '').localeCompare(moves[b]?.machine ?? ''));

  const enc = { red: [], blue: [] };
  for (const area of encRaw[i]) {
    for (const vd of area.version_details) {
      const v = vd.version.name;
      if (v !== 'red' && v !== 'blue') continue;
      const methods = {};
      for (const e of vd.encounter_details) {
        const k = e.method.name;
        methods[k] ??= { method: k, minLevel: e.min_level, maxLevel: e.max_level, chance: 0 };
        methods[k].minLevel = Math.min(methods[k].minLevel, e.min_level);
        methods[k].maxLevel = Math.max(methods[k].maxLevel, e.max_level);
        methods[k].chance += e.chance;
      }
      for (const m of Object.values(methods)) enc[v].push({ area: area.location_area.name, ...m });
    }
  }

  const slug = p.name;
  const evo = evoInfo[s.name] ?? { from: null, to: [] };
  const bs = sd.baseStats;
  pokemon.push({
    num: p.id,
    id: sd.id,
    name: { nidoranf: 'Nidoran♀', nidoranm: 'Nidoran♂' }[sd.id] ?? sd.name,
    types: sd.types,
    baseStats: { hp: bs.hp, atk: bs.atk, def: bs.def, spc: bs.spa, spe: bs.spe },
    bst: bs.hp + bs.atk + bs.def + bs.spa + bs.spe,
    catchRate: s.capture_rate,
    growthRate: s.growth_rate.name,
    baseExp: p.base_experience,
    evolvesFrom: evo.from,
    evolvesTo: evo.to,
    fullyEvolved: evo.to.length === 0,
    learnset: { levelUp, tm: tmSorted },
    encounters: enc,
    catchableIn: { red: enc.red.length > 0, blue: enc.blue.length > 0 },
    competitiveTier: sd.tier,
    sprite: `sprites/rb/${p.id}.png`,
    spriteColor: `sprites/frlg/${p.id}.png`,
    genus: s.genera.find(g => g.language.name === 'en')?.genus ?? '',
    flavor: (s.flavor_text_entries.find(f => f.language.name === 'en' && f.version.name === 'red')?.flavor_text ?? '').replace(/\s+/g, ' '),
  });
}

await fs.writeFile(path.join(OUT, 'pokemon.json'), JSON.stringify(pokemon, null, 1));
await fs.writeFile(path.join(OUT, 'moves.json'), JSON.stringify(moves, null, 1));
await fs.writeFile(path.join(OUT, 'types.json'), JSON.stringify({
  types: TYPES,
  specialTypes: [...SPECIAL_TYPES],
  note: 'Gen 1 (Red/Blue) chart as implemented in-game: Ghost→Psychic 0x (bug), Bug↔Poison 2x, Ice→Fire 1x. chart[attacking][defending] = multiplier.',
  chart: typeChart,
}, null, 1));

const tmCount = Object.values(moves).filter(m => m.machine).length;
console.log(`pokemon ${pokemon.length}, moves ${Object.keys(moves).length} (${tmCount} TM/HM), types ${TYPES.length}`);

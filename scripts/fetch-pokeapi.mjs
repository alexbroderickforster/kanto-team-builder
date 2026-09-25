// Fetches Red/Blue-specific data from PokeAPI and caches raw responses in data/raw/.
// Re-running is cheap: cached files are reused.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'data', 'raw');
const API = 'https://pokeapi.co/api/v2';

async function get(url) {
  const key = url.replace(API + '/', '').replace(/[^a-z0-9]+/gi, '_') + '.json';
  const file = path.join(RAW, key);
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      await fs.writeFile(file, JSON.stringify(json));
      return json;
    }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error('failed ' + url);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const ids = Array.from({ length: 151 }, (_, i) => i + 1);
await fs.mkdir(RAW, { recursive: true });

const pokemon = await pool(ids, 12, id => get(`${API}/pokemon/${id}`));
const species = await pool(ids, 12, id => get(`${API}/pokemon-species/${id}`));
const encounters = await pool(ids, 12, id => get(`${API}/pokemon/${id}/encounters`));
const chainUrls = [...new Set(species.map(s => s.evolution_chain.url))];
const chains = await pool(chainUrls, 12, u => get(u));

// Every move any of the 151 can learn in red-blue
const moveNames = new Set();
for (const p of pokemon) for (const m of p.moves)
  if (m.version_group_details.some(d => d.version_group.name === 'red-blue')) moveNames.add(m.move.name);
const moves = await pool([...moveNames], 12, n => get(`${API}/move/${n}`));
const machineUrls = moves.flatMap(m => m.machines.filter(x => x.version_group.name === 'red-blue').map(x => x.machine.url));
const machines = await pool(machineUrls, 12, u => get(u));

// Sprites: original Red/Blue (transparent) and FireRed/LeafGreen color, served from public/.
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions';
const spriteSets = { rb: 'generation-i/red-blue/transparent', frlg: 'generation-iii/firered-leafgreen' };
for (const [dir, remote] of Object.entries(spriteSets)) {
  const outDir = path.join(ROOT, 'public', 'sprites', dir);
  await fs.mkdir(outDir, { recursive: true });
  await pool(ids, 12, async id => {
    const file = path.join(outDir, `${id}.png`);
    try { await fs.access(file); return; } catch {}
    const res = await fetch(`${SPRITES}/${remote}/${id}.png`);
    if (!res.ok) throw new Error(`sprite ${dir}/${id}: ${res.status}`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  });
}

console.log({ pokemon: pokemon.length, species: species.length, encounters: encounters.length, chains: chains.length, moves: moves.length, machines: machines.length });

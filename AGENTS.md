# AGENTS.md — guide for coding agents

A team optimizer for **Pokémon Red & Blue (Game Boy, 1996)**, covering the original 151 only. It's a static React + TypeScript site on GitHub Pages. There's no backend: all the data ships as JSON, and the optimizer runs in the browser.

Live site: https://alexbroderickforster.github.io/kanto-team-builder/

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest, engine tests (fast, <1s)
npm run typecheck  # tsc, strict
npm run build      # production build into dist/
```

Before you say a change is done, run `npm run typecheck && npm test && npm run build`. CI runs the same three on every PR.

## Workflow (follow this every time)

`main` is protected: **nobody pushes to it directly**. Every change goes through a pull request. No review is required, but CI must pass before GitHub will merge it. Merging to `main` redeploys the live site.

```bash
git switch main && git pull                 # start from the latest main
git switch -c short-descriptive-name        # one branch per change
# …make the change, then:
npm run typecheck && npm test && npm run build
git add -A && git commit -m "What changed and why"
git push -u origin HEAD
gh pr create --fill                         # opens the PR
gh pr merge --auto --squash                 # merges by itself once CI is green
```

- Keep PRs small and focused. Two people plus two agents work in this repo, and small PRs rarely conflict.
- If `gh pr merge --auto` is waiting and CI fails, fix it on the same branch and push again. The PR updates by itself.
- If GitHub reports a merge conflict: `git switch main && git pull && git switch - && git merge main`, fix the conflicts, then commit and push.
- Never force-push `main`, and don't try to get around the protection. If something is truly stuck, ask the humans.
- After a merge, the branch is deleted on GitHub automatically. Locally, `git switch main && git pull` and carry on.

## Layout

```
src/
  engine/            Pure TypeScript, no React. All game logic lives here.
    types.ts         Config, Species, Move, Boss, TmInfo …
    gen1.ts          Stat formula, badge boosts, type chart, crit rate, expected damage
    availability.ts  Which species you can have (version, badges, level cap, rules, evolutions)
    progression.ts   Boss teams, TM/HM availability + catalog, required HMs
    movesets.ts      Learnable moves at a level cap; greedy 4-move pick
    optimize.ts      Matchups → team search → HM/TM budgeting → explanations
    plan.ts          Full-run planner (gym by gym, with continuity)
    __tests__/       Vitest specs; add one for every engine behavior you change
  components/        React UI (Rail, TeamCard, Panels, TmDrawer, RunPlan)
  App.tsx            State, URL sync, views
  config.ts          Config ⇄ URL query string (share links)
  styles.css         All styles; design tokens are CSS variables on :root
data/                Generated + curated JSON (see data/README.md)
public/sprites/      rb/ (original Game Boy) and frlg/ (color) sprites, by dex number
scripts/             Data pipeline (fetch from PokeAPI, build JSON)
mockups/             Original design explorations (.dc.html); the app follows Console.dc.html
```

## Rules of the road

- **Gen 1 accuracy comes first.** This is Red/Blue, not Yellow and not later games. Things that trip up models trained on modern Pokémon:
  - There's one **Special** stat (`baseStats.spc`), not Sp. Atk / Sp. Def.
  - Physical vs special depends on the move's **type**: Fire, Water, Electric, Grass, Ice, Psychic and Dragon are special.
  - The type chart is the cartridge's: Ghost → Psychic is **0×** (a bug), Bug ↔ Poison is 2×, Ice → Fire is 1×. No Dark, Steel or Fairy types. Clefairy is Normal type and Magnemite is pure Electric.
  - The crit rate comes from base Speed. Slash, Razor Leaf, Crabhammer and Karate Chop are ×8.
  - **HM moves can't be forgotten in Gen 1.** Most TMs are **single-use**. The ones you can buy at the Celadon Dept. Store, and the Game Corner prize TMs, are unlimited.
  - Kadabra, Machoke, Graveler and Haunter only evolve by trading. Each version has 11 exclusives. One Eevee per save, one fossil, and one of Hitmonlee/Hitmonchan.
- **Don't hand-edit `data/pokemon.json`, `data/moves.json` or `data/types.json`.** They're generated. Change `scripts/build-data.mjs` and run `npm run data:fetch && npm run data:build`. The fetch step caches responses in `data/raw/`, which is gitignored.
- `data/progression.json` **is** curated by hand: stages, boss teams with real movesets, TM locations and mechanics notes. It was built from the pret/pokered disassembly and Bulbapedia. Cite a source in the PR when you change it.
- Keep the engine pure: no React, no DOM, no `window`. It must stay runnable in Vitest and Node.
- IDs are Showdown-style lowercase alphanumeric (`mrmime`, `nidoranf`, `thunderbolt`). Look things up with `SPECIES[id]` and `MOVES[id]`.
- Asset URLs must use `import.meta.env.BASE_URL`. The site is served from `/kanto-team-builder/` on Pages. See `sprite()` in `src/ui.tsx`.
- Every setting belongs in the URL (`src/config.ts`) so share links keep working. If you add a setting, add it to `readConfig` and `writeConfig`.
- UI conventions: real `<button>` and `<input>` elements with labels, touch targets of 44px or more, colors from the CSS variables. It needs to work at 375px wide. The version toggle recolors the accent (`[data-version='blue']`).

## How the optimizer thinks (short version)

1. `scopeBosses(cfg)` picks the fight: the next gym, or the Elite Four + Champion.
2. `availablePool` lists every species you could have by then, and `topForms` keeps only the most evolved form in each line.
3. Each candidate gets a moveset (`chooseMoveset`) tuned against those bosses. Then a matchup score is computed against every boss Pokémon (`matchup` in `optimize.ts`).
4. The team is built by a greedy fill, then improved by swaps. Locks (starter, must-haves) stay fixed. Exclusive groups and one-per-line are enforced.
5. Post-processing gives required HMs to whoever loses least by carrying them, then resolves single-use TM conflicts.
6. `readiness` is a weighted average of how comfortably the team wins each matchup. It's a relative score, not a real win rate.

Tuning knobs worth knowing: the weights in `teamScore` and `UTILITY` in `movesets.ts`, `PLAYER_LEAGUE_LEVEL`, `AREA_BADGES` and `METHOD_BADGES` in `availability.ts`, and the continuity bonus (`prefer`) used by the planner.

## Ideas backlog

- Yellow version support (different learnsets, Pikachu starter, different encounters).
- Show *why not*: for a Pokémon you wanted, explain what it lost to.
- Level-by-level move plan ("learn Thunderbolt before Misty, forget Tackle").
- Item plan: Rare Candy, vitamins, which stones to buy and when.
- An in-game-trade helper for Jynx, Mr. Mime, Farfetch'd and the other NPC trades.
- A "Nuzlocke" rule set (first encounter per route only).

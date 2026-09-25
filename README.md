# Team Lab/151 · Kanto Team Builder

A team optimizer for the original Game Boy **Pokémon Red & Blue**, covering the first 151 Pokémon only.

**Live:** https://alexbroderickforster.github.io/kanto-team-builder/

Pick your version, starter, badges and house rules (no trading, no legendaries, Game Corner, carry HMs). It builds the best six for the next gym or the Elite Four, using real Gen 1 mechanics.

- **Team view:** six picks, each with a moveset and where every move comes from. Tap a move for its stats and effect, lock or swap members, and read why each one made the cut.
- **Full run:** the best team for every gym in order, keeping the Pokémon you've already raised, with what to catch before each fight.
- **TMs & HMs:** where to find every TM in your version, whether you only get one copy, and who on your team uses it.
- **Share links:** every setting lives in the URL.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build
```

## How it works

`src/engine/` is plain TypeScript with no UI dependencies. It covers availability, Gen 1 damage math, moveset selection, team search, the TM/HM budget and the run planner. The whole search runs in the browser in about 10–80 ms per team, or about 150 ms for a full run. Details are in [AGENTS.md](AGENTS.md).

## Data

Sources: PokeAPI (Red/Blue learnsets, TMs, encounters), Pokémon Showdown's Gen 1 engine (stats, moves, type chart), and the pret/pokered disassembly plus Bulbapedia (boss teams, TM locations). See [data/README.md](data/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents should start with [AGENTS.md](AGENTS.md).

`mockups/` holds the original three starter-page design explorations. The app follows `Console.dc.html`.

Unofficial fan project. Code is MIT-licensed; Pokémon © Nintendo / Game Freak / Creatures.

# Gen 1 (Red/Blue) dataset

Rebuild with `npm run data:fetch && npm run data:build`. Raw API responses are cached in `raw/` (gitignored, about 66 MB; the fetch step recreates it). `progression.json` is curated by hand and is not regenerated.

| File | What | Source |
|---|---|---|
| `pokemon.json` | All 151: Gen 1 types, base stats (single **Special** stat as `spc`), catch rate, growth rate, evolutions (method/level/stone/trade, Gen 1 only), Red/Blue **level-up learnset** and **TM/HM learnset**, wild encounters per version (area, method, levels, rate), `catchableIn`, sprite paths | PokeAPI (`red-blue` version group) + Showdown `gen1` mod for stats/types |
| `moves.json` | All 165 moves with **Gen 1** type/power/accuracy/PP (e.g. Bite = Normal, Wing Attack = 35 BP), physical/special derived from type, TM/HM number, effect flags (recharge, OHKO, high-crit, recoil, fixed damage…) | Showdown `gen1` mod + PokeAPI machines |
| `types.json` | 15×15 Gen 1 type chart **as the cartridge implements it**: Ghost→Psychic 0×, Bug↔Poison 2×, Ice→Fire 1× | Showdown `gen1` mod |
| `progression.json` | Game stages, location→stage/HM requirements, gifts/statics/prizes/in-game trades, gym leader/E4/rival teams, TM locations and single-use flags, Gen 1 mechanics notes | Curated from Bulbapedia + PokeAPI |
| `../public/sprites/rb/` | Original Red/Blue sprites (transparent) | PokeAPI sprites repo |
| `../public/sprites/frlg/` | FireRed/LeafGreen color sprites | PokeAPI sprites repo |

Notes
- IDs are Showdown-style (`mrmime`, `nidoranf`, `farfetchd`, `visegrip`).
- `learnset.levelUp` entries at level 1 on evolved forms are moves the Pokémon knows on evolution/capture.
- `catchableIn` covers wild encounters only; gifts, Game Corner prizes, fossils and in-game trades live in `progression.json`.

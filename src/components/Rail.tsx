import { useId, useState } from 'react';
import { GYM_ORDER, POKEMON, SPECIES, type Config, type Rules, type Starter } from '../engine';
import { sprite } from '../ui';

const LEADERS = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni', 'Elite Four'];
const PLACES = ['Pewter · Rock', 'Cerulean · Water', 'Vermilion · Electric', 'Celadon · Grass', 'Fuchsia · Poison', 'Saffron · Psychic', 'Cinnabar · Fire', 'Viridian · Ground', 'Indigo Plateau'];
const STARTERS: { id: Starter; name: string }[] = [
  { id: 'bulbasaur', name: 'Bulbasaur' }, { id: 'charmander', name: 'Charmander' }, { id: 'squirtle', name: 'Squirtle' },
];

interface Props { cfg: Config; set: (fn: (c: Config) => Config) => void }

export function Rail({ cfg, set }: Props) {
  const other = cfg.version === 'red' ? 'Blue' : 'Red';
  const rules: { key: keyof Rules; label: string; hint: string; invert?: boolean }[] = [
    { key: 'trade', label: 'No trading', hint: `Drops 4 trade evolutions + 11 ${other}-only`, invert: true },
    { key: 'legendaries', label: 'No legendaries', hint: 'Birds and Mewtwo stay out', invert: true },
    { key: 'gameCorner', label: 'Game Corner allowed', hint: 'Prize Pokémon, TM15 Hyper Beam, TM50' },
    { key: 'hmCoverage', label: 'Carry HMs on the team', hint: 'Cut · Surf · Strength (Gen 1 HMs are permanent)' },
    { key: 'keepStarter', label: 'Keep my starter', hint: 'Starter always takes a slot' },
  ];

  return (
    <aside className="rail" aria-label="Team settings">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <div className="brand-name">TEAM LAB/151</div>
          <div className="brand-sub">Party optimizer · Red &amp; Blue</div>
        </div>
      </div>

      <div className="field">
        <span className="label" id="lbl-version">Version</span>
        <div className="version" role="group" aria-labelledby="lbl-version">
          {(['red', 'blue'] as const).map(v => (
            <button key={v} type="button" aria-pressed={cfg.version === v} onClick={() => set(c => ({ ...c, version: v }))}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label" id="lbl-starter">Starter</span>
        <div className="starters" role="group" aria-labelledby="lbl-starter">
          {STARTERS.map(s => (
            <button key={s.id} type="button" className="starter" aria-pressed={cfg.starter === s.id} onClick={() => set(c => ({ ...c, starter: s.id }))}>
              <img className="sprite" src={sprite(s.id)} alt="" />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <div className="label-row">
          <span className="label" id="lbl-badges">Badges won</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}>
            {cfg.badges}<span style={{ color: 'var(--muted)' }}> / 8</span>
          </span>
        </div>
        <div className="badges" role="group" aria-labelledby="lbl-badges">
          {Array.from({ length: 9 }, (_, i) => {
            const done = i < cfg.badges;
            const current = i === cfg.badges;
            const label = i < 8 ? `Beaten ${LEADERS[i]}` : 'At the Elite Four';
            return (
              <button
                key={i}
                type="button"
                className={`badge ${done ? 'done' : ''} ${current ? 'current' : ''}`}
                aria-label={label}
                aria-pressed={done}
                title={label}
                onClick={() => set(c => ({ ...c, badges: c.badges === i + 1 ? i : Math.min(i + 1, 8) }))}
              >
                {i < 8 ? i + 1 : 'E4'}
              </button>
            );
          })}
        </div>
        <span className="hint">Next: <strong>{LEADERS[Math.min(cfg.badges, 8)]}</strong> · {PLACES[Math.min(cfg.badges, 8)]}</span>
      </div>

      <div className="field">
        <span className="label" id="lbl-goal">Optimize for</span>
        <div className="segmented" role="radiogroup" aria-labelledby="lbl-goal">
          <button type="button" role="radio" aria-checked={cfg.goal === 'next'} onClick={() => set(c => ({ ...c, goal: 'next' }))}>
            {cfg.badges >= 8 ? 'Elite Four' : `Next gym · ${LEADERS[cfg.badges]}`}
          </button>
          <button type="button" role="radio" aria-checked={cfg.goal === 'league'} onClick={() => set(c => ({ ...c, goal: 'league' }))}>
            Endgame team
          </button>
        </div>
      </div>

      <div className="field" style={{ gap: 2 }}>
        <span className="label" style={{ marginBottom: 6 }}>Constraints</span>
        {rules.map(r => {
          const on = r.invert ? !cfg.rules[r.key] : cfg.rules[r.key];
          return (
            <button key={r.key} type="button" role="switch" aria-checked={on} className="switch-row"
              onClick={() => set(c => ({ ...c, rules: { ...c.rules, [r.key]: !c.rules[r.key] } }))}>
              <span className="t"><span>{r.label}</span><span>{r.hint}</span></span>
              <span className="track" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <MustHaves cfg={cfg} set={set} />
    </aside>
  );
}

function MustHaves({ cfg, set }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listId = useId();
  const add = () => {
    const q = text.trim().toLowerCase().replace(/[^a-z0-9♀♂]/g, '');
    const norm = (s: string) => s.toLowerCase().replace('♀', 'f').replace('♂', 'm').replace(/[^a-z0-9]/g, '');
    const hit = POKEMON.find(p => norm(p.name) === norm(q) || p.id === q);
    if (!hit) { setError(text ? `No Pokémon called “${text}” in the original 151.` : ''); return; }
    if (hit.id === 'mew') { setError('Mew was event-only in Red/Blue.'); return; }
    set(c => ({ ...c, mustHave: [...new Set([...c.mustHave, hit.id])], exclude: c.exclude.filter(x => x !== hit.id) }));
    setText(''); setError('');
  };
  return (
    <div className="field">
      <label className="label" htmlFor="must-have">Must-haves</label>
      <form className="picker" onSubmit={e => { e.preventDefault(); add(); }}>
        <input id="must-have" list={listId} value={text} onChange={e => setText(e.target.value)} placeholder="Add a Pokémon, e.g. Pikachu" autoComplete="off" />
        <button type="submit" className="btn">Add</button>
      </form>
      <datalist id={listId}>{POKEMON.filter(p => p.id !== 'mew').map(p => <option key={p.id} value={p.name} />)}</datalist>
      {error && <span className="warn" role="status">{error}</span>}
      {(cfg.mustHave.length > 0 || cfg.exclude.length > 0) && (
        <div className="chips">
          {cfg.mustHave.map(id => (
            <span key={id} className="chip">
              {SPECIES[id]?.name ?? id}
              <button type="button" aria-label={`Remove ${SPECIES[id]?.name}`} onClick={() => set(c => ({ ...c, mustHave: c.mustHave.filter(x => x !== id) }))}>×</button>
            </span>
          ))}
          {cfg.exclude.map(id => (
            <span key={id} className="chip skip">
              Skip {SPECIES[id]?.name ?? id}
              <button type="button" aria-label={`Allow ${SPECIES[id]?.name} again`} onClick={() => set(c => ({ ...c, exclude: c.exclude.filter(x => x !== id) }))}>×</button>
            </span>
          ))}
        </div>
      )}
      <span className="hint">Open slots are filled with the best fits. {GYM_ORDER.length} gyms, 4 Elite Four and the Champion are modeled with their real teams.</span>
    </div>
  );
}

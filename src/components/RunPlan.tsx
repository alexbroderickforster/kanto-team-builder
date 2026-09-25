import { SPECIES, type PlanStep } from '../engine';
import { sprite } from '../ui';

const PLACES = ['Pewter · Rock', 'Cerulean · Water', 'Vermilion · Electric', 'Celadon · Grass', 'Fuchsia · Poison', 'Saffron · Psychic', 'Cinnabar · Fire', 'Viridian · Ground', 'Indigo Plateau'];

interface Props { steps: PlanStep[]; current: number; onOpen: (badges: number) => void }

export function RunPlan({ steps, current, onOpen }: Props) {
  return (
    <ol className="run">
      {steps.map(s => {
        const r = s.result;
        const newOnes = new Set(s.added);
        return (
          <li key={s.badges} className={`run-step ${s.badges === current ? 'current' : ''}`}>
            <div className="run-when">
              <span className="run-n">{s.badges < 8 ? s.badges + 1 : 'E4'}</span>
              <div>
                <b>{s.label}</b>
                <span>{PLACES[s.badges]} · your team at L{r.levelCap}</span>
              </div>
            </div>
            <ul className="run-team" aria-label={`Team for ${s.label}`}>
              {r.team.map(m => (
                <li key={m.species} className={newOnes.has(m.species) && s.badges > 0 ? 'new' : ''} title={m.how}>
                  <img className="sprite" src={sprite(m.species)} alt="" />
                  <span>{m.name}</span>
                  {newOnes.has(m.species) && s.badges > 0 && <em>new</em>}
                </li>
              ))}
            </ul>
            <div className="run-side">
              <span className="run-score">{r.readiness}%</span>
              <button type="button" className="btn" onClick={() => onOpen(s.badges)}>Open</button>
            </div>
            {(s.badges > 0 && (s.added.length > 0 || s.dropped.length > 0)) && (
              <p className="run-notes">
                {s.added.length > 0 && <>Pick up {s.added.map(id => `${SPECIES[id].name} (${r.team.find(m => m.species === id)?.how.split(' → ')[0]})`).join(', ')}. </>}
                {s.dropped.length > 0 && <>Bench {s.dropped.map(id => SPECIES[id].name).join(', ')}.</>}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

import { useId, useState } from 'react';
import { MOVES, type Alternate, type TeamMember } from '../engine';
import { Dot, LockIcon, sprite, TypeTag } from '../ui';

interface Props {
  member: TeamMember;
  isStarter: boolean;
  alternates: Alternate[];
  onToggleLock: () => void;
  onSwap: (to: string) => void;
  onOpenTm: (tmId: string) => void;
}

export function TeamCard({ member: m, isStarter, alternates, onToggleLock, onSwap, onOpenTm }: Props) {
  const [showAlts, setShowAlts] = useState(false);
  const [openMove, setOpenMove] = useState<string | null>(null);
  const detailId = useId();
  const active = m.moves.find(mv => mv.move === openMove);

  return (
    <article className={`card ${m.locked ? 'locked' : ''}`} aria-label={m.name}>
      <div className="card-top">
        <div className="portrait"><img className="sprite" src={sprite(m.species)} alt="" /></div>
        <div className="card-id">
          <div className="card-name">{m.name} <small>No.{String(m.num).padStart(3, '0')}</small></div>
          <div className="types">{m.types.map(t => <TypeTag key={t} type={t} />)}</div>
          <div className="how">
            {m.how}
            {m.note && <span className="note">{m.note}</span>}
          </div>
        </div>
      </div>
      {!isStarter && (
        <button type="button" className="lock" aria-pressed={m.locked} aria-label={m.locked ? `Unlock ${m.name}` : `Lock ${m.name} in`} title={m.locked ? 'Locked in' : 'Lock in'} onClick={onToggleLock}>
          <LockIcon open={!m.locked} />
        </button>
      )}

      <div className="moves">
        {m.moves.map(mv => {
          const move = MOVES[mv.move];
          const open = openMove === mv.move;
          return (
            <button
              key={mv.move}
              type="button"
              className={`move ${open ? 'open' : ''}`}
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpenMove(open ? null : mv.move)}
            >
              <span className="n"><Dot type={move?.type ?? 'Normal'} /><span>{move?.name ?? mv.move}</span></span>
              <span className={`src ${mv.tm ? 'tm' : ''}`}>{mv.source.replace(/ as .*/, '')}</span>
            </button>
          );
        })}
      </div>

      <div id={detailId} aria-live="polite">
        {active && <MoveDetail moveId={active.move} source={active.source} tm={active.tm} onOpenTm={onOpenTm} />}
      </div>

      <ul className="reasons">{m.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      {m.warnings.map(w => <div key={w} className="warn">{w}</div>)}

      <div className="card-foot">
        <span className="how">{isStarter ? 'Your starter' : m.locked ? 'Locked in' : `Planned at L${m.level}`}</span>
        {alternates.length > 0 && (
          <button type="button" className="linkish" aria-expanded={showAlts} onClick={() => setShowAlts(s => !s)}>
            {showAlts ? 'Hide swaps' : 'Swap…'}
          </button>
        )}
      </div>
      {showAlts && (
        <div className="alts">
          {alternates.map(a => (
            <button key={a.species} type="button" className="alt" onClick={() => onSwap(a.species)}>
              <img className="sprite" src={sprite(a.species)} alt="" />
              {a.name}
              <span className="d">{a.delta >= 0 ? '+' : ''}{(a.delta * 100).toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function MoveDetail({ moveId, source, tm, onOpenTm }: { moveId: string; source: string; tm?: string; onOpenTm: (id: string) => void }) {
  const mv = MOVES[moveId];
  if (!mv) return null;
  const machine = tm;
  const learned = source.startsWith('L') ? `Learned at level ${source.slice(1)}` : `Taught with ${source}`;
  return (
    <div className="move-detail">
      <div className="md-head">
        <b>{mv.name}</b>
        <span className="md-tags">
          <span className="type"><Dot type={mv.type} />{mv.type}</span>
          <span>{mv.category}</span>
        </span>
      </div>
      <dl className="md-stats">
        <div><dt>Power</dt><dd>{mv.flags.fixedDamage === 'level' ? 'Lv' : mv.flags.fixedDamage ?? mv.power ?? '—'}</dd></div>
        <div><dt>Acc</dt><dd>{mv.accuracy ? `${mv.accuracy}%` : '—'}</dd></div>
        <div><dt>PP</dt><dd>{mv.pp}</dd></div>
      </dl>
      <p>{mv.effect}</p>
      <div className="md-src">
        <span>{learned}</span>
        {machine && (
          <button type="button" className="linkish" onClick={() => onOpenTm(machine)}>Where to get {machine} →</button>
        )}
      </div>
    </div>
  );
}

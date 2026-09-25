import { useState } from 'react';
import { MECHANICS_NOTES, MOVES, SPECIES, type OptimizeResult } from '../engine';
import { sprite, TYPE_ABBR } from '../ui';

export function Coverage({ result }: { result: OptimizeResult }) {
  const { off, weak, res } = result.coverage;
  const hits = off.filter(v => v > 1).length;
  const stacked = weak.map((w, i) => (w >= 3 ? TYPE_ABBR[i] : null)).filter(Boolean);
  return (
    <section className="panel" aria-labelledby="cov-title">
      <div className="panel-head">
        <span className="panel-title" id="cov-title">Type coverage · Gen I chart</span>
        <span className="panel-meta">
          Super-effective on {hits} of 15 types.{stacked.length ? ` Watch out: 3+ members weak to ${stacked.join(', ')}.` : ' No stacked weaknesses.'}
        </span>
      </div>
      <div className="matrix-wrap">
        <div className="matrix" role="table" aria-label="Type coverage">
          <span role="columnheader" />
          {TYPE_ABBR.map(h => <span key={h} className="h" role="columnheader">{h}</span>)}
          <span className="rl" role="rowheader">You hit 2×</span>
          {off.map((v, i) => (
            <span key={i} role="cell" className={`cell ${v > 1 ? 'hit' : v === 0 ? 'none' : 'miss'}`}>{v > 1 ? '2×' : v === 0 ? '0' : v < 1 ? '½' : '1×'}</span>
          ))}
          <span className="rl" role="rowheader">Weak (of 6)</span>
          {weak.map((v, i) => <span key={i} role="cell" className={`cell ${v >= 3 ? 'w3' : v === 2 ? 'w2' : ''}`}>{v || '·'}</span>)}
          <span className="rl" role="rowheader">Resist (of 6)</span>
          {res.map((v, i) => <span key={i} role="cell" className={`cell ${v >= 2 ? 'r2' : ''}`}>{v || '·'}</span>)}
        </div>
      </div>
    </section>
  );
}

export function BossPanel({ result }: { result: OptimizeResult }) {
  const [tab, setTab] = useState(0);
  const bosses = result.bosses;
  const boss = bosses[Math.min(tab, bosses.length - 1)];
  if (!boss) return null;
  const rows = result.answers.filter(a => a.boss === boss.name);
  const single = bosses.length === 1;
  return (
    <section className="panel" aria-labelledby="boss-title">
      <div className="panel-head">
        <span className="panel-title" id="boss-title">{single ? `Before ${boss.name}` : 'The gauntlet'}</span>
        <span className="panel-meta">{boss.location}{boss.specialty ? ` · ${boss.specialty[0].toUpperCase()}${boss.specialty.slice(1)}` : ''}</span>
      </div>
      {!single && (
        <div className="tabs" role="tablist" aria-label="Boss">
          {bosses.map((b, i) => (
            <button key={b.id} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)}>{b.name.replace(/ \(.*\)/, '')}</button>
          ))}
        </div>
      )}
      <div className="foes" role={single ? undefined : 'tabpanel'}>
        {rows.map((a, i) => {
          const ans = a.answer;
          const verdict = !ans ? 'no answer' : ans.wins ? (ans.turns === 1 ? 'OHKO' : `${ans.turns}HKO`) : 'risky';
          return (
            <div key={i} className="foe">
              <img className="sprite" src={sprite(a.enemy.species)} alt="" />
              <div className="who">
                <b>{SPECIES[a.enemy.species].name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>L{a.enemy.level}</span></b>
                <span>
                  {ans ? `${SPECIES[ans.species].name} · ${MOVES[ans.move]?.name ?? '—'}${ans.outspeeds ? ' · moves first' : ''}` : 'Nothing on the team damages it'}
                </span>
              </div>
              <span className={`verdict ${ans?.wins ? 'win' : 'lose'}`}>{verdict}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SidePanels({ result, onOpenTm }: { result: OptimizeResult; onOpenTm: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {result.insights.length > 0 && (
        <section className="panel" aria-labelledby="ins-title">
          <span className="panel-title" id="ins-title">Why it works</span>
          <ul className="insights">{result.insights.map(t => <li key={t}>{t}</li>)}</ul>
        </section>
      )}
      <section className="panel" aria-labelledby="tm-title">
        <div className="panel-head">
          <span className="panel-title" id="tm-title">TM ledger</span>
          <button type="button" className="linkish" onClick={() => onOpenTm('all')}>All TMs &amp; HMs →</button>
        </div>
        {result.ledger.length ? (
          <div className="ledger">
            {result.ledger.map(l => (
              <button key={l.tm} type="button" className="ledger-row" onClick={() => onOpenTm(l.tm)} title={`Where to get ${l.tm}`}>
                <span className="tm">{l.tm}</span><span>{l.move}</span><span className="who">→ {l.who}</span>
              </button>
            ))}
          </div>
        ) : <span className="empty">No single-use TMs needed yet.</span>}
        <span className="panel-meta">Most Gen I TMs are one copy per game; tap one to see where it is.</span>
        {result.hms.length > 0 && (
          <div className="ledger" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            {result.hms.map(h => (
              <button key={h.move} type="button" className="ledger-row" onClick={() => onOpenTm(h.id)} title={`Where to get ${h.id}`}>
                <span className="tm">{h.id}</span><span>{h.move}</span>
                <span className="who" style={h.who ? undefined : { color: 'var(--warn)' }}>{h.who ? `→ ${h.who}` : 'nobody can learn it'}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <details className="quirks">
          <summary>Gen I quirks this plan accounts for</summary>
          <ul>{MECHANICS_NOTES.map(n => <li key={n}>{n}</li>)}</ul>
        </details>
      </section>
    </div>
  );
}

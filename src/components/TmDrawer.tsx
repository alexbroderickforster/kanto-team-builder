import { useEffect, useMemo, useRef, useState } from 'react';
import { MOVES, SPECIES, tmCatalog, type Config, type OptimizeResult } from '../engine';
import { Dot } from '../ui';

interface Props {
  cfg: Config;
  result: OptimizeResult;
  /** null = closed, 'all' = open at the top, otherwise the TM/HM id to jump to. */
  focus: string | null;
  onClose: () => void;
}

export function TmDrawer({ cfg, result, focus, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const catalog = useMemo(() => tmCatalog(cfg), [cfg]);

  const usedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of result.team) for (const mv of m.moves) {
      const id = mv.tm ?? (mv.source.startsWith('HM') ? mv.source : undefined);
      if (id) map.set(id, [...(map.get(id) ?? []), m.name]);
    }
    return map;
  }, [result]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (focus && !d.open) d.showModal();
    if (!focus && d.open) d.close();
    if (focus && focus !== 'all') {
      setQuery('');
      setOpenIds(new Set([focus]));
      requestAnimationFrame(() => d.querySelector(`[data-tm="${focus}"]`)?.scrollIntoView({ block: 'center' }));
    }
  }, [focus]);

  const q = query.trim().toLowerCase();
  const rows = catalog.filter(t => !q || t.id.toLowerCase().includes(q) || MOVES[t.move]?.name.toLowerCase().includes(q));

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="tm-drawer-title" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="drawer-inner">
        <div className="drawer-head">
          <div>
            <div className="kicker">{cfg.version === 'red' ? 'POKéMON RED' : 'POKéMON BLUE'}</div>
            <h2 id="tm-drawer-title">TMs &amp; HMs: where to get them</h2>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <label className="sr-only" htmlFor="tm-search">Search TMs</label>
        <input id="tm-search" className="search" placeholder="Search: “Earthquake”, “TM24”…" value={query} onChange={e => setQuery(e.target.value)} />
        <ul className="tm-list">
          {rows.map(t => {
            const mv = MOVES[t.move];
            const open = openIds.has(t.id);
            const users = usedBy.get(t.id);
            const learners = result.team.filter(m => SPECIES[m.species].learnset.tm.includes(t.move)).map(m => m.name);
            return (
              <li key={t.id} data-tm={t.id} className={`tm-row ${users ? 'used' : ''}`}>
                <button type="button" className="tm-toggle" aria-expanded={open}
                  onClick={() => setOpenIds(s => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}>
                  <span className="tm-id">{t.id}</span>
                  <span className="tm-name"><Dot type={mv?.type ?? 'Normal'} />{mv?.name ?? t.move}</span>
                  <span className={`pill ${t.reusable ? '' : 'single'}`}>{t.id.startsWith('HM') ? 'Reusable' : t.reusable ? 'Unlimited' : 'One copy'}</span>
                </button>
                {users && <div className="tm-users">Your plan: {users.join(', ')}</div>}
                {open && (
                  <div className="tm-body">
                    <dl className="md-stats">
                      <div><dt>Type</dt><dd>{mv?.type}</dd></div>
                      <div><dt>Power</dt><dd>{mv?.flags.fixedDamage === 'level' ? 'Lv' : mv?.flags.fixedDamage ?? mv?.power ?? '—'}</dd></div>
                      <div><dt>Acc</dt><dd>{mv?.accuracy ? `${mv.accuracy}%` : '—'}</dd></div>
                      <div><dt>PP</dt><dd>{mv?.pp}</dd></div>
                    </dl>
                    {mv?.effect && <p className="tm-effect">{mv.effect}</p>}
                    {t.locations.length ? (
                      <ul className="tm-locs">
                        {t.locations.map((l, i) => (
                          <li key={i}>
                            <b>{l.where}</b>
                            <span>{l.how}{l.price ? ` · ${l.price}` : ''} · {l.badges === 0 ? 'from the start' : `after ${l.badges} badge${l.badges === 1 ? '' : 's'}`}</span>
                            {l.note && <span className="muted">{l.note}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">Not available in {cfg.version === 'red' ? 'Red' : 'Blue'} with these settings.</p>}
                    <p className="muted">{learners.length ? `On your team, ${learners.join(', ')} can learn it.` : 'Nobody on your current team can learn it.'}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}

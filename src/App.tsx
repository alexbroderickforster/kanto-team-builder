import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BossPanel, Coverage, SidePanels } from './components/Panels';
import { Rail } from './components/Rail';
import { RunPlan } from './components/RunPlan';
import { TeamCard } from './components/TeamCard';
import { TmDrawer } from './components/TmDrawer';
import { readConfig, writeConfig, DEFAULT_CONFIG } from './config';
import { optimize, planRun, SPECIES, type Config } from './engine';

const LEADERS = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni'];

export function App() {
  const [cfg, setCfg] = useState<Config>(() => readConfig(window.location.search));
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'team' | 'run'>(() => (new URLSearchParams(window.location.search).get('view') === 'run' ? 'run' : 'team'));
  const [tmFocus, setTmFocus] = useState<string | null>(null);
  const deferred = useDeferredValue(cfg);
  const result = useMemo(() => optimize(deferred), [deferred]);
  // The run planner ignores badges/goal: it plans every gym in order.
  const planKey = JSON.stringify({ ...deferred, badges: 0, goal: 'next' });
  const plan = useMemo(() => (view === 'run' ? planRun(JSON.parse(planKey) as Config) : []), [view, planKey]);

  useEffect(() => {
    window.history.replaceState(null, '', writeConfig(cfg) + (view === 'run' ? '&view=run' : ''));
    document.documentElement.dataset.version = cfg.version;
  }, [cfg, view]);

  const set = useCallback((fn: (c: Config) => Config) => setCfg(fn), []);

  const league = cfg.goal === 'league' || cfg.badges >= 8;
  const title = view === 'run' ? 'Your whole run, gym by gym' : league ? 'Your best six for the League' : `Your best six for ${LEADERS[cfg.badges]}`;
  const kicker = [
    cfg.version === 'red' ? 'POKéMON RED' : 'POKéMON BLUE',
    cfg.rules.trade ? 'TRADING OK' : 'NO TRADES',
    `${cfg.badges} BADGE${cfg.badges === 1 ? '' : 'S'}`,
  ].join(' · ');

  const starterLine = (id: string) => {
    let cur = SPECIES[id];
    while (cur.evolvesFrom) cur = SPECIES[cur.evolvesFrom.species];
    return cur.id === cfg.starter && cfg.rules.keepStarter;
  };

  const toggleLock = (species: string, locked: boolean) =>
    set(c => ({ ...c, mustHave: locked ? c.mustHave.filter(x => x !== species && !isSameLine(x, species)) : [...c.mustHave, species] }));
  const swap = (from: string, to: string) =>
    set(c => ({ ...c, exclude: [...new Set([...c.exclude, from])], mustHave: [...new Set([...c.mustHave.filter(x => !isSameLine(x, from)), to])] }));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked; the URL bar already has the link */ }
  };

  return (
    <div className="app">
      <Rail cfg={cfg} set={set} />
      <main className="main" aria-busy={deferred !== cfg}>
        <header className="head">
          <div>
            <div className="kicker">{kicker}</div>
            <h1>{title}</h1>
            <p className="subhead">
              {view === 'run'
                ? 'Each row is the best team you can have going into that fight, keeping Pokémon you\'ve already raised where it makes sense.'
                : `Planned at level ${result.levelCap}${league ? '' : ` (${LEADERS[cfg.badges]}'s ace)`} · ${result.poolSize} Pokémon reachable with these settings`}
            </p>
            <div className="tabs view-tabs" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === 'team'} onClick={() => setView('team')}>Team</button>
              <button type="button" role="tab" aria-selected={view === 'run'} onClick={() => setView('run')}>Full run</button>
            </div>
          </div>
          <div className="head-actions">
            {view === 'team' && (
              <div className="score" title="Average confidence of winning each boss Pokémon's one-on-one">
                <b>{result.readiness}%</b>
                <span>{result.wins}/{result.total} boss Pokémon answered</span>
              </div>
            )}
            <button type="button" className="btn" onClick={share} aria-live="polite">{copied ? 'Link copied' : 'Copy share link'}</button>
            <button type="button" className="btn" onClick={() => setCfg(structuredClone(DEFAULT_CONFIG))}>Reset</button>
          </div>
        </header>

        {view === 'run' ? (
          <RunPlan steps={plan} current={cfg.badges} onOpen={b => { setCfg(c => ({ ...c, badges: b, goal: b >= 8 ? 'league' : 'next' })); setView('team'); window.scrollTo(0, 0); }} />
        ) : (<>
        <div className="team">
          {result.team.map(m => (
            <TeamCard
              key={m.species}
              member={m}
              isStarter={starterLine(m.species)}
              alternates={result.alternates[m.species] ?? []}
              onToggleLock={() => toggleLock(m.species, m.locked)}
              onSwap={to => swap(m.species, to)}
              onOpenTm={setTmFocus}
            />
          ))}
        </div>

        <Coverage result={result} />

        <div className="lower">
          <BossPanel key={`${cfg.goal}-${cfg.badges}`} result={result} />
          <SidePanels result={result} onOpenTm={setTmFocus} />
        </div>
        </>)}

        <p className="footer">
          Unofficial fan tool for the original Game Boy games. Pokémon and all related names and sprites are © Nintendo, Game Freak and Creatures.
          Data: PokeAPI, Pokémon Showdown&apos;s Gen I engine, the pret/pokered disassembly and Bulbapedia.
        </p>
      </main>
      <TmDrawer cfg={deferred} result={result} focus={tmFocus} onClose={() => setTmFocus(null)} />
    </div>
  );
}

function isSameLine(a: string, b: string): boolean {
  const root = (id: string) => {
    let cur = SPECIES[id];
    while (cur?.evolvesFrom) cur = SPECIES[cur.evolvesFrom.species];
    return cur?.id;
  };
  return root(a) === root(b);
}

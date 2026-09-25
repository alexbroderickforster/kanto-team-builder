import { SPECIES, type TypeName } from './engine';

export const TYPE_COLORS: Record<TypeName, string> = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Electric: '#f7d02c', Grass: '#7ac74c',
  Ice: '#96d9d6', Fighting: '#d8443d', Poison: '#b85bb6', Ground: '#e2bf65', Flying: '#a98ff3',
  Psychic: '#f95587', Bug: '#a6b91a', Rock: '#b6a136', Ghost: '#8a70b0', Dragon: '#8a5cff',
};

export const TYPE_ABBR = ['NOR', 'FIR', 'WAT', 'ELE', 'GRA', 'ICE', 'FIG', 'POI', 'GRO', 'FLY', 'PSY', 'BUG', 'ROC', 'GHO', 'DRA'];

export function sprite(speciesId: string): string {
  return `${import.meta.env.BASE_URL}sprites/frlg/${SPECIES[speciesId]?.num ?? 0}.png`;
}

export function Dot({ type }: { type: string }) {
  return <span className="dot" style={{ background: TYPE_COLORS[type as TypeName] }} aria-hidden="true" />;
}

export function TypeTag({ type }: { type: string }) {
  return (
    <span className="type">
      <Dot type={type} />
      {type}
    </span>
  );
}

export function LockIcon({ open }: { open?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  );
}

'use client';

/**
 * Direction du dernier changement d'épreuve, retenue le temps de la navigation.
 * sessionStorage plutôt qu'un état React : la page qui écrit n'est pas celle qui lit.
 */
const CLE = 'mb-direction';

export function memoriserDirection(dir) {
  try { sessionStorage.setItem(CLE, String(dir)); } catch {}
}

export function lireDirection() {
  try {
    const v = sessionStorage.getItem(CLE);
    sessionStorage.removeItem(CLE);
    return v ? Number(v) : 0;
  } catch { return 0; }
}
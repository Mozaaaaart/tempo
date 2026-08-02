'use client';
import { createContext, useContext } from 'react';

/**
 * L'épreuve montée est-elle à l'écran ?
 *
 * Le défi du jour garde montée une épreuve déjà entamée, même quand on en
 * regarde une autre : c'est la seule façon de préserver la progression, donc
 * de tenir la règle de la tentative unique. Sans ce signal, l'épreuve masquée
 * continuerait de jouer son extrait par-dessus celle qu'on regarde.
 *
 * Passer une prop `visible` aurait demandé de modifier les dix jeux. Un
 * contexte se lit là où le besoin existe réellement — dans le lecteur audio —
 * et laisse les jeux inchangés.
 *
 * Valeur par défaut `true` : hors du défi il n'y a pas de fournisseur, et une
 * épreuve en accès libre est toujours à l'écran.
 */
export const ContexteEpreuveVisible = createContext(true);

export function useEpreuveVisible() {
  return useContext(ContexteEpreuveVisible);
}
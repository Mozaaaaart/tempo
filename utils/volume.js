'use client';
import { useEffect, useState } from 'react';

/**
 * Réglage sonore du site — DEUX notions, un seul contrat.
 *
 * · le NIVEAU (0–1), que chaque source applique elle-même : <audio> des
 *   extraits, synthés Tone.js, ambiance de l'accueil ;
 * · l'ACTIVITÉ de l'ambiance, qui dit si la musique de fond doit jouer.
 *
 * Les deux étaient jusqu'ici pilotées par des contrôles différents sur des
 * pages différentes : le bouton d'Ambiance ne touchait qu'à l'activité, le
 * curseur des épreuves qu'au niveau. Résultat, une coupure faite sur
 * l'accueil ne pouvait être levée que sur l'accueil — les pages d'épreuve
 * n'avaient aucune prise dessus.
 *
 * Ce module expose donc les deux, avec le même mécanisme de diffusion : une
 * écriture prévient toutes les instances montées via un CustomEvent.
 * 'storage', l'événement natif, ne suffirait pas : il ne se déclenche que
 * sur les AUTRES onglets, jamais dans celui qui a écrit.
 */

const CLE = 'mb:ambiance:volume';
const CLE_ACTIF = 'mb:ambiance:actif';
const DEFAUT = 0.5;
const ACTIF_DEFAUT = true;
const EVENEMENT = 'mb:volume-change';
const EVENEMENT_ACTIF = 'mb:actif-change';

/* ---------------- Niveau ---------------- */

export function lireVolume() {
  try {
    const v = localStorage.getItem(CLE);
    if (v !== null) {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return Math.min(1, Math.max(0, n));
    }
  } catch {
    // stockage indisponible (mode privé) : valeur par défaut
  }
  return DEFAUT;
}

export function ecrireVolume(v) {
  const borne = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(CLE, String(borne)); } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: borne }));
  }
  return borne;
}

/* ---------------- Activité de l'ambiance ----------------
   Le format stocké a changé entre deux versions du site : certains
   navigateurs portent encore 'true'/'false' là où l'on écrit '1'/'0'. Le
   lecteur accepte les deux plutôt que de traiter l'ancien format comme un
   faux — ce qui couperait l'ambiance sans raison chez les visiteurs de
   longue date. */

export function lireActifBrut(brut) {
  if (brut === null || brut === undefined) return ACTIF_DEFAUT;
  const v = String(brut).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'oui') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'non') return false;
  return ACTIF_DEFAUT;
}

export function lireActif() {
  try {
    return lireActifBrut(localStorage.getItem(CLE_ACTIF));
  } catch {
    return ACTIF_DEFAUT;
  }
}

export function ecrireActif(on) {
  const val = Boolean(on);
  try { localStorage.setItem(CLE_ACTIF, val ? '1' : '0'); } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENEMENT_ACTIF, { detail: val }));
  }
  return val;
}

/* ---------------- Hooks ---------------- */

/** Activité de l'ambiance, suivie en direct comme le volume. */
export function useActif() {
  const [actif, setActif] = useState(ACTIF_DEFAUT);

  useEffect(() => {
    setActif(lireActif());
    const gestionnaire = (e) => setActif(e.detail);
    window.addEventListener(EVENEMENT_ACTIF, gestionnaire);
    return () => window.removeEventListener(EVENEMENT_ACTIF, gestionnaire);
  }, []);

  return actif;
}

/**
 * NIVEAU brut du curseur, mis à jour en direct. C'est la position à afficher,
 * pas forcément ce qu'on entend : une coupure la laisse intacte, pour pouvoir
 * la retrouver au rétablissement.
 *
 * localStorage n'existant pas côté serveur, la vraie valeur n'est lue qu'après
 * montage — même disposition que `pret` dans Ambiance.jsx, pour la même raison.
 */
export function useNiveau() {
  const [volume, setVolume] = useState(DEFAUT);

  useEffect(() => {
    setVolume(lireVolume());
    const gestionnaire = (e) => setVolume(e.detail);
    window.addEventListener(EVENEMENT, gestionnaire);
    return () => window.removeEventListener(EVENEMENT, gestionnaire);
  }, []);

  return volume;
}

/**
 * Volume EFFECTIF, celui que les sources appliquent : zéro dès que le son est
 * coupé, quel que soit le niveau du curseur.
 *
 * C'est ce que consomment les jeux. Auparavant ils ne lisaient que le niveau,
 * si bien qu'une coupure faite depuis l'accueil affichait un haut-parleur
 * barré pendant que les extraits continuaient de jouer — le bouton annonçait
 * une coupure que personne n'appliquait.
 */
export function useVolume() {
  const niveau = useNiveau();
  const actif = useActif();
  return actif ? niveau : 0;
}
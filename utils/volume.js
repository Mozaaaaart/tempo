'use client';
import { useEffect, useState } from 'react';

/**
 * Volume maître du site — un seul réglage, deux points d'entrée.
 *
 * Le curseur d'ambiance de l'accueil (Ambiance.jsx) écrit déjà sous cette
 * clé exacte, sans aucune modification nécessaire de ce côté. <VolumeControl>
 * l'écrit depuis les pages d'épreuve, où il n'y a ni musique de fond ni
 * AudioContext à réveiller — seulement un niveau que chaque jeu applique à
 * ses propres sources (<audio>, Tone.js).
 *
 * Les deux curseurs ne coexistent jamais sur la même page (Ambiance est
 * réservée aux pages sans épreuve), donc aucune synchronisation en direct
 * entre les deux n'est nécessaire : chaque page relit simplement la valeur
 * au montage. L'événement custom sert en revanche À L'INTÉRIEUR d'une page
 * d'épreuve, pour que le jeu en cours réagisse immédiatement quand on bouge
 * le curseur — 'storage' ne suffirait pas, cet événement natif ne se
 * déclenche que sur les AUTRES onglets, jamais dans celui qui a écrit.
 */

const CLE = 'mb:ambiance:volume';
const DEFAUT = 0.5;
const EVENEMENT = 'mb:volume-change';

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

/**
 * Volume courant, mis à jour en direct sur toute la durée de vie du
 * composant. localStorage n'existant pas côté serveur, la vraie valeur
 * n'est lue qu'après montage — même disposition que `pret` dans
 * Ambiance.jsx, pour la même raison.
 */
export function useVolume() {
  const [volume, setVolume] = useState(DEFAUT);

  useEffect(() => {
    setVolume(lireVolume());
    const gestionnaire = (e) => setVolume(e.detail);
    window.addEventListener(EVENEMENT, gestionnaire);
    return () => window.removeEventListener(EVENEMENT, gestionnaire);
  }, []);

  return volume;
}
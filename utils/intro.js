'use client';
import { useState } from 'react';
import { useEpreuve } from '@/components/EpreuveContext';

/* ============================================================
   FAUT-IL JOUER L'INTRO ?

   Une intro se justifie à l'ARRIVÉE sur une épreuve : on découvre un jeu
   qu'on n'a peut-être jamais vu. Elle ne se justifie plus quand on relance
   une épreuve qu'on vient de jouer — on connaît la règle, la revoir est une
   attente pure.

   Le problème : JeuSlot remonte le composant dans les DEUX cas, via
   key={slug|cleRelance}. Un simple useState(true) au montage ne peut donc pas
   les distinguer.

   Mais les deux cas ne bougent pas les mêmes valeurs :

     relance     → même slug, cleRelance incrémenté
     navigation  → slug différent, cleRelance inchangé

   Il suffit donc de retenir le couple observé au montage précédent.

   Une première version comparait les chemins via usePathname. Elle échouait
   dès qu'on passait par une épreuve sans intro : celle-ci ne mettait pas le
   chemin mémorisé à jour, et le retour sur l'épreuve précédente passait pour
   une relance. cleRelance n'a pas ce défaut — il ne bouge que sur un clic de
   relance, quelle que soit l'épreuve traversée entre-temps.

   Volontairement en mémoire seulement : pas de localStorage. Un rechargement
   de page est une arrivée, l'intro doit s'y rejouer.
============================================================ */

let dernierSlug = null;
let dernierRelance = null;

export function useIntro(cle) {
  const { cleRelance } = useEpreuve();

  // Initialiseur de useState : évalué une seule fois par montage, donc une
  // fois par arrivée ou par relance — exactement la granularité voulue.
  const [jouer] = useState(() => {
    const estUneRelance = cle === dernierSlug && cleRelance !== dernierRelance;
    dernierSlug = cle;
    dernierRelance = cleRelance;
    return !estUneRelance;
  });

  return jouer;
}


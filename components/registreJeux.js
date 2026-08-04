'use client';
import {
  JeuArtiste,
  JeuPochette,
  JeuBPM,
  JeuSeconde,
  JeuInstrument,
  JeuRefrain,
} from '@/components/dailyGames';
import JeuAccordsGame from '@/components/JeuAccordsGame';
import JeuRythmeGame from '@/components/JeuRythmeGame';
import JeuIAGame from '@/components/JeuIAGame';
import JeuDuelGame from '@/components/JeuDuelGame';
import { EPREUVES } from '@/data/epreuves';

/**
 * Registre unique slug → composant.
 *
 * Il n'existait pas : la correspondance vivait en double, une fois dans
 * JeuSlot (accès libre) et une fois en dur dans app/quotidien/page.jsx sous
 * d'autres clés ('bpm', 'ia', 'seconde', 'paroles'). Les deux listes ont donc
 * dérivé — le quotidien proposait Paroles là où le catalogue proposait Duel,
 * sans que rien ne le signale.
 *
 * Désormais, data/epreuves.js reste la seule source de vérité pour l'ORDRE et
 * les intitulés ; ce fichier ne dit plus QUOI jouer, seulement AVEC QUEL
 * composant. Les clés sont les slugs publics, pas des diminutifs maison.
 */
export const JEUX = {
  'accords': JeuAccordsGame,
  'rythme': JeuRythmeGame,
  'artiste': JeuArtiste,
  'pochette': JeuPochette,
  'humain-ou-ia': JeuIAGame,
  'blind-test': JeuSeconde,   // composant historique, épreuve renommée « Blind test »
  'tempo': JeuBPM,
  'instrument': JeuInstrument,
  'duel': JeuDuelGame,
  'paroles': JeuRefrain,   // composant historique, épreuve renommée « Paroles »
};

/* ------------------------------------------------------------------
   Garde-fou : le registre et le catalogue doivent se recouvrir
   exactement. L'erreur est levée à l'évaluation du module, donc au
   build — la dérive ne peut plus atteindre la production.

   Même parti pris que le `throw` de la vitrine dans app/page.jsx :
   mieux vaut un build rouge qu'une épreuve fantôme en ligne.
------------------------------------------------------------------ */
{
  const slugsCatalogue = EPREUVES.map((e) => e.slug);
  const sansJeu = slugsCatalogue.filter((s) => !JEUX[s]);
  const orphelins = Object.keys(JEUX).filter((s) => !slugsCatalogue.includes(s));

  if (sansJeu.length || orphelins.length) {
    throw new Error(
      'Incohérence entre data/epreuves.js et components/registreJeux.js.\n'
      + (sansJeu.length ? `Épreuves sans composant : ${sansJeu.join(', ')}.\n` : '')
      + (orphelins.length ? `Composants sans épreuve : ${orphelins.join(', ')}.\n` : '')
      + 'Ajoute ou retire l\'entrée correspondante des deux côtés.'
    );
  }
}

/** Composant de l'épreuve, ou null si le slug est inconnu. */
export function jeuDuSlug(slug) {
  return JEUX[slug] ?? null;
}
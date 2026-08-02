'use client';

/**
 * TIRAGE BORNÉ DES VARIANTES — accès libre
 *
 * Le défi du jour utilise un salt vide : tout le monde reçoit le même tirage,
 * donc tout le monde demande les mêmes URL d'API, et le cache de bord absorbe
 * la totalité du trafic. Sa charge en amont ne dépend pas du nombre de
 * joueurs.
 *
 * L'accès libre tirait à l'inverse un salt aléatoire sur un espace infini
 * (`Math.random().toString(36)`). Chaque relance produisait donc des URL
 * inédites, qui manquaient le cache, invoquaient une fonction et frappaient
 * l'API en amont. La charge croissait linéairement avec le trafic — sur des
 * services communautaires sans engagement de service, et depuis le petit lot
 * d'adresses IP partagées par toutes les fonctions de l'hébergeur.
 *
 * Un espace BORNÉ règle cela sans rien coûter au joueur. Cinquante variantes
 * par jour et par épreuve : personne ne fera la différence avec un tirage
 * infini — il faudrait relancer des dizaines de fois pour croiser un doublon —
 * mais le nombre d'URL distinctes cesse de dépendre du nombre de visiteurs.
 * La charge en amont passe de proportionnelle au trafic à plafonnée.
 *
 * Le nombre est un compromis. Trop bas, les relances se répètent visiblement ;
 * trop haut, l'effet de cache s'effondre. Cinquante donne un taux de succès
 * de cache qui monte avec le trafic — c'est exactement l'inverse du
 * comportement précédent, où il s'effondrait avec lui.
 */
const NB_VARIANTES = 50;

/* Dernière variante servie, pour ne pas la retirer deux fois de suite.
   Portée module : c'est d'une relance à l'autre qu'il faut se souvenir, et
   deux tirages identiques consécutifs sont le seul cas où le joueur
   remarquerait que l'espace est fini. */
let derniere = null;

/** Identifiant de variante à passer à setSeedSalt(). */
export function tirerVariante() {
  if (NB_VARIANTES <= 1) return 'v0';
  let v = Math.floor(Math.random() * NB_VARIANTES);
  // Décalage plutôt que nouveau tirage : borné, donc sans boucle possible.
  if (v === derniere) v = (v + 1) % NB_VARIANTES;
  derniere = v;
  return `v${v}`;
}
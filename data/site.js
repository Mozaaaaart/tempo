/**
 * Constantes du site utilisées par l'indexation.
 *
 * SITE_URL sert de `metadataBase` : sans elle, Next émet des URL canoniques
 * RELATIVES, que Google traite comme absentes. C'est la première pièce de tout
 * l'édifice — un canonique relatif ne protège d'aucun contenu dupliqué.
 *
 * DOMAINE SANS www ET SANS BARRE FINALE, délibérément.
 *
 *   Le canonique doit désigner UNE seule adresse. https://mozartbenchmark.com,
 *   https://www.mozartbenchmark.com et l'adresse .vercel.app servent le même
 *   contenu : pour un moteur, ce sont trois sites identiques tant qu'on ne
 *   tranche pas. Ici on tranche, et Vercel redirige le reste (voir la note en
 *   bas de fichier).
 *
 *   La barre finale est retirée parce qu'on la rajoute à la construction des
 *   URL. Sans ce nettoyage, une valeur d'environnement terminée par « / »
 *   produirait « //epreuves/accords ».
 *
 * La valeur reste lue dans l'environnement : les préproductions Vercel ont
 * chacune leur adresse, et déclarer le domaine de production comme canonique
 * depuis une préproduction revient à demander l'indexation d'une page qui
 * n'est pas celle servie.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  ?? 'https://mozartbenchmark.com';

export const SITE_NOM = 'Mozart Benchmark';

/** Phrase de référence du site. Sert de description par défaut et de baseline. */
export const SITE_ACCROCHE =
  'Dix jeux d\u2019oreille musicale gratuits, sans inscription. '
  + 'Accords, rythme, tempo, blind test : ton oreille not\u00e9e sur dix.';

/* ------------------------------------------------------------------ à faire
 *
 * Deux réglages qui ne se font pas dans le code et sans lesquels le canonique
 * ci-dessus reste un vœu :
 *
 * 1. REDIRECTION 301 des variantes vers https://mozartbenchmark.com —
 *    la variante www et l'adresse .vercel.app. Dans Vercel : Settings →
 *    Domains, le domaine principal en « Primary », les autres en « Redirect ».
 *    Tant que .vercel.app répond 200, il concurrence le domaine réel.
 *
 * 2. NEXT_PUBLIC_SITE_URL déclarée en Production uniquement, à la même valeur.
 *    Laissée vide sur les préproductions, la constante ci-dessus prend le
 *    relais — ce qui est le comportement voulu seulement en production. Le
 *    plus sûr est donc de la définir aussi en Preview, sur l'URL de la
 *    préproduction.
 */
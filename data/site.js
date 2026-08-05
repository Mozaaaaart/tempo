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

/**
 * Balise <title> de la page d'accueil — et infobulle de l'onglet.
 *
 * LA MARQUE D'ABORD, LES MOTS-CLÉS ENSUITE.
 *
 *   C'est un choix assumé, et il a ses raisons. Dans une barre d'onglets
 *   chargée, seuls les premiers signes restent lisibles : ouvrir sur « Mozart
 *   Benchmark » rend l'onglet reconnaissable d'un coup d'œil. Le titre sert
 *   aussi d'infobulle au survol, où la marque annonce immédiatement où l'on
 *   est. Et un nom répété se mémorise : c'est ainsi qu'une marque neuve se
 *   construit un volume de recherche qu'elle n'a pas encore.
 *
 *   LE COÛT À CONNAÎTRE. Google pondère davantage le début de la balise, et
 *   l'œil s'arrête sur les premiers mots dans une page de résultats. Placer
 *   seize signes de marque en tête retarde d'autant les termes réellement
 *   tapés — « test oreille musicale », « jeu oreille musicale ». Le compromis
 *   est tenable ici parce que ces termes restent DANS la balise, sous la
 *   limite d'affichage : ils sont vus, simplement pas en premier.
 *
 *   « Test » ET « jeux » cohabitent volontairement : deux racines de requête
 *   distinctes pour une même intention, et les deux tiennent sans forcer.
 *
 * SOIXANTE SIGNES, PAS PLUS. Au-delà, Google tronque et la promesse se perd en
 * chemin. Celui-ci en fait 60, soit environ 490 px — sous la limite
 * d'affichage (~580 px), qui compte davantage que le nombre de signes.
 *
 * VARIANTES prêtes à l'emploi — remplace la valeur, rien d'autre à toucher :
 *   'Mozart Benchmark \u2014 Teste ton oreille musicale, 10 jeux gratuits'
 *   'Mozart Benchmark : test d\u2019oreille musicale, 10 jeux gratuits'
 *   'Mozart Benchmark \u2014 Test d\u2019oreille musicale : 10 jeux gratuits'
 */
export const SITE_TITRE_ACCUEIL =
  'Mozart Benchmark \u2014 Test d\u2019oreille musicale, 10 jeux gratuits';

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
/**
 * Source unique des dix épreuves.
 *
 * Pas de directive 'use client' : ce fichier est importé aussi bien par le
 * layout client que par la page serveur (generateStaticParams, metadata).
 *
 * Le `slug` devient l'URL publique : /epreuves/pochette. Ne jamais le changer
 * une fois indexé — c'est lui qui porte le référencement et les emplacements
 * publicitaires. Le `num` reste l'étiquette affichée.
 *
 * ------------------------------------------------------------------ CHAMPS
 *
 * DEUX FAMILLES DE TEXTES, ET ELLES NE DOIVENT PAS SE CONFONDRE.
 *
 *   nom      intitulé affiché — titre H1 de la page d'épreuve
 *   court    version courte pour le carrousel des dix
 *   desc     phrase lue SUR la page, sous le H1. Écrite pour un humain qui
 *            est déjà arrivé : courte, concrète, sans mot-clé forcé.
 *
 *   titreSeo balise <title> de l'onglet et du résultat Google. Écrite pour
 *            quelqu'un qui N'EST PAS ENCORE arrivé : elle doit contenir les
 *            mots qu'il a tapés. Soixante signes maximum, marque comprise —
 *            au-delà, Google tronque et la promesse se perd.
 *   metaDesc extrait affiché sous le titre dans les résultats. Cent quarante
 *            à cent soixante signes. Elle ne classe pas directement, mais
 *            elle décide du taux de clic, qui lui compte.
 *
 * POURQUOI QUATRE TEXTES ET NON DEUX. Optimiser `desc` pour Google reviendrait
 * à écrire, sur la page, des phrases pensées pour une requête plutôt que pour
 * le joueur qui vient de cliquer. Le référencement se joue dans l'en-tête du
 * document ; la page, elle, reste écrite pour l'humain.
 *
 * MOTS-CLÉS VISÉS, par ordre d'intention : « jeu oreille musicale »,
 * « test oreille musicale », « blind test », « reconnaître un accord »,
 * « trouver le BPM », « musique IA ou humaine ». Ils apparaissent dans les
 * titres parce qu'ils y sont vrais, jamais empilés.
 */
export const EPREUVES = [
  {
    slug: 'accords',
    num: '01',
    nom: 'Accords',
    court: 'Accords',
    desc: 'Écoute un accord de trois ou quatre notes, repose-le sur la portée.',
    titreSeo: 'Reconnaître un accord à l\'oreille',
    metaDesc: 'Écoute un accord de trois ou quatre notes et repose-le sur la portée, note à note. Exercice d\'oreille harmonique gratuit, sans inscription, noté sur 10.',
  },
  {
    slug: 'rythme',
    num: '02',
    nom: 'Rythme',
    court: 'Rythme',
    desc: 'Reproduis un pattern de batterie de mémoire, à cinquante millisecondes près.',
    titreSeo: 'Reproduire un rythme à l\'oreille',
    metaDesc: 'Écoute une mesure de batterie et rejoue-la de mémoire, au doigt ou à la barre d\'espace. Test de précision rythmique gratuit, à cinquante millisecondes près.',
  },
  {
    slug: 'artiste',
    num: '03',
    nom: 'Artiste',
    court: 'Artiste',
    desc: 'Propose un nom, on le compare à l\'artiste mystère : genre, pays, époque. Sept essais pour le trouver.',
    titreSeo: 'Deviner l\'artiste mystère',
    metaDesc: 'Propose un nom : genre, pays, époque et streams le comparent à l\'artiste mystère. Sept essais pour le trouver. Jeu de déduction musicale gratuit.',
  },
  {
    slug: 'pochette',
    num: '04',
    nom: 'Pochette',
    court: 'Pochette',
    desc: 'Une pochette d\'album, floutée à l\'extrême. Nomme l\'artiste : à chaque erreur, le flou se lève un peu.',
    titreSeo: 'Reconnaître une pochette d\'album floutée',
    metaDesc: 'Une pochette d\'album floutée à l\'extrême : nomme l\'artiste. À chaque erreur le flou se lève un peu. Blind test visuel gratuit, sept essais, sans inscription.',
  },
  {
    slug: 'humain-ou-ia',
    num: '05',
    nom: 'Humain ou IA',
    court: 'Humain / IA',
    desc: 'Les machines composent, et ça s\'entend de moins en moins. Un extrait, un verdict, et une seule erreur permise.',
    titreSeo: 'Musique humaine ou IA : le test d\'écoute',
    metaDesc: 'Les machines composent, et ça s\'entend de moins en moins. Écoute un extrait et décide : musicien ou intelligence artificielle. Une seule erreur permise.',
  },
  {
    slug: 'une-seconde',
    num: '06',
    nom: 'Une seconde de plus',
    court: 'Une seconde',
    desc: 'Une seconde d\'extrait, et il faut nommer le morceau. Chaque erreur t\'en offre un peu plus, mais coûte des points.',
    titreSeo: 'Reconnaître un morceau en une seconde',
    metaDesc: 'Une seconde d\'extrait pour nommer le morceau. Chaque erreur t\'en offre un peu plus, mais coûte des points. Blind test express gratuit, sans inscription.',
  },
  {
    slug: 'tempo',
    num: '07',
    nom: 'Tempo',
    court: 'Tempo',
    desc: 'Sept secondes d\'écoute, un curseur, un métronome pour comparer.',
    titreSeo: 'Trouver le BPM d\'un morceau à l\'oreille',
    metaDesc: 'Sept secondes d\'écoute, un curseur et un métronome pour comparer : retrouve le tempo exact du morceau en BPM. Exercice d\'oreille rythmique gratuit.',
  },
  {
    slug: 'instrument',
    num: '08',
    nom: 'Instrument',
    court: 'Instrument',
    desc: 'Un timbre acoustique isolé sur un air connu. Vingt-et-un instruments possibles.',
    titreSeo: 'Reconnaître un instrument à l\'oreille',
    metaDesc: 'Un timbre acoustique isolé sur un air connu, vingt-et-un instruments possibles. Entraîne ton oreille à distinguer les timbres, gratuitement et sans inscription.',
  },
  {
    slug: 'duel',
    num: '09',
    nom: 'Duel',
    court: 'Duel',
    desc: 'Deux morceaux, un seul a plus de streams. Cinq duels pour trancher.',
    titreSeo: 'Quel morceau a le plus de streams ?',
    metaDesc: 'Deux morceaux face à face, un seul est le plus écouté au monde. Cinq duels pour trancher. Jeu de culture musicale gratuit, sans inscription.',
},
  {
    slug: 'refrain',
    num: '10',
    nom: 'Refrain',
    court: 'Refrain',
    desc: 'Trois lignes te sont données. Tape celle qui suit.',
    titreSeo: 'Compléter les paroles d\'une chanson',
    metaDesc: 'Trois lignes de paroles te sont données, tape celle qui suit. Jeu de mémoire des refrains, gratuit et sans inscription, noté sur dix.',
  },
];

/** Index de l'épreuve, ou -1 si le slug est inconnu. */
export function indexDuSlug(slug) {
  return EPREUVES.findIndex((e) => e.slug === slug);
}

/** Épreuve correspondante, ou undefined. */
export function epreuveDuSlug(slug) {
  return EPREUVES.find((e) => e.slug === slug);
}

/** Chemin public d'une épreuve. */
export function lienEpreuve(slug) {
  return `/epreuves/${slug}`;
}
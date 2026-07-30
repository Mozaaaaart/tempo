/**
 * Source unique des dix épreuves.
 *
 * Pas de directive 'use client' : ce fichier est importé aussi bien par le
 * layout client que par la page serveur (generateStaticParams, metadata).
 *
 * Le `slug` devient l'URL publique : /epreuves/pochette. Ne jamais le changer
 * une fois indexé — c'est lui qui porte le référencement et les emplacements
 * publicitaires. Le `num` reste l'étiquette affichée.
 */
export const EPREUVES = [
  {
    slug: 'accords',
    num: '01',
    nom: 'Accords',
    court: 'Accords',
    desc: 'Place trois ou quatre notes sur la portée, écoute l\'écart avec la cible.',
  },
  {
    slug: 'rythme',
    num: '02',
    nom: 'Rythme',
    court: 'Rythme',
    desc: 'Reproduis un pattern de batterie de mémoire, à cinquante millisecondes près.',
  },
  {
    slug: 'artiste',
    num: '03',
    nom: 'Artiste',
    court: 'Artiste',
    desc: 'Devine l\'artiste. Genre, pays, décennie : les indices tombent à chaque erreur.',
  },
  {
    slug: 'pochette',
    num: '04',
    nom: 'Pochette',
    court: 'Pochette',
    desc: 'Une pochette d\'album, floutée à l\'extrême. Le flou se lève à chaque tentative.',
  },
  {
    slug: 'humain-ou-ia',
    num: '05',
    nom: 'Humain ou IA',
    court: 'Humain / IA',
    desc: 'Un extrait, deux origines possibles : un musicien ou une machine.',
  },
  {
    slug: 'une-seconde',
    num: '06',
    nom: 'Une seconde de plus',
    court: 'Une seconde',
    desc: 'Une seconde d\'extrait pour commencer. Chaque erreur en dévoile un peu plus.',
  },
  {
    slug: 'tempo',
    num: '07',
    nom: 'Tempo',
    court: 'Tempo',
    desc: 'Sept secondes d\'écoute, un curseur, un métronome pour comparer.',
  },
  {
    slug: 'instrument',
    num: '08',
    nom: 'Instrument',
    court: 'Instrument',
    desc: 'Un timbre acoustique isolé sur un air connu. Vingt-et-un instruments possibles.',
  },
  {
    slug: 'duel',
    num: '09',
    nom: 'Duel',
    court: 'Duel',
    desc: 'Deux morceaux, un seul a plus de streams. Dix duels pour trancher.',
},
  {
    slug: 'refrain',
    num: '10',
    nom: 'Refrain',
    court: 'Refrain',
    desc: 'Trois lignes te sont données. Tape celle qui suit.',
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
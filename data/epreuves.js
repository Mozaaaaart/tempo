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
    /* Renommée « Blind test » en août 2026, ancien slug `une-seconde`.
       Une redirection permanente le rattrape dans next.config.ts.

       C'est la seule épreuve du site où l'on nomme un morceau à partir du
       son : Pochette est visuelle, Instrument porte sur le timbre, Duel sur
       des chiffres. Le terme ne décrit donc qu'elle, malgré son apparente
       généralité — et c'est de loin le plus recherché des dix.

       « Une seconde de plus » avait deux défauts. Il ne tenait pas dans le
       carrousel, d'où un `court` qui disait déjà autre chose. Et il était
       faux : les paliers montent de 1, 2, 3, 4 puis 5 secondes, jamais d'une
       seule. La `desc` garde le différenciateur — un titre pose une énigme,
       il n'explique pas la mécanique. */
    slug: 'blind-test',
    num: '06',
    nom: 'Blind test',
    court: 'Blind test',
    desc: 'Une seconde d\'extrait, et il faut nommer le morceau. Chaque erreur t\'en offre un peu plus, mais coûte des points.',
    titreSeo: 'Blind test musical en une seconde',
    metaDesc: 'Blind test en ligne gratuit : une seconde d\'extrait pour nommer le morceau. Chaque erreur t\'en offre un peu plus, mais coûte des points. Sans inscription.',
  },
  {
    slug: 'tempo',
    num: '07',
    nom: 'Tempo',
    court: 'Tempo',
    desc: 'Quinze secondes d\'écoute, un curseur, un métronome : retrouve le nombre de battements par minute.',
    titreSeo: 'Trouver le BPM d\'un morceau à l\'oreille',
    metaDesc: 'Quinze secondes d\'écoute, un curseur et un métronome : retrouve le tempo du morceau en battements par minute. Exercice d\'oreille rythmique gratuit.',
  },
  {
    slug: 'instrument',
    num: '08',
    nom: 'Instrument',
    court: 'Instrument',
    desc: 'Un seul instrument joue un air connu. Six groupes, vingt-et-un instruments : lequel entends-tu ?',
    titreSeo: 'Reconnaître un instrument à l\'oreille',
    metaDesc: 'Un seul instrument joue un air connu : piano, violon, flûte ou trompette ? Six groupes, vingt-et-un instruments. Reconnais le timbre, gratuitement.',
  },
  {
    slug: 'duel',
    num: '09',
    nom: 'Duel',
    court: 'Duel',
    desc: 'Deux morceaux face à face, un seul a plus de streams.\nJusqu\'où iras-tu sans te tromper ?',
    titreSeo: 'Quel morceau a le plus de streams ?',
    metaDesc: 'Deux morceaux face à face : lequel a le plus de streams Spotify ? Enchaîne les duels sans te tromper. Jeu de culture musicale gratuit, sans inscription.',
},
  {
    /* Renommée « Paroles » en août 2026. L'ancien slug `refrain` a été servi
       et soumis à Google : une redirection permanente le rattrape dans
       next.config.ts. Ne pas la retirer — une URL indexée ne meurt jamais
       vraiment, elle reste dans des favoris et des liens. */
    slug: 'paroles',
    num: '10',
    nom: 'Paroles',
    court: 'Paroles',
    desc: 'Trois lignes de paroles s\u2019affichent.\nÀ toi d\u2019écrire celle qui suit.',
    titreSeo: 'Compléter les paroles d\'une chanson',
    metaDesc: 'Trois lignes de paroles s\u2019affichent, à toi d\u2019écrire la suivante. Teste ta mémoire des refrains de chansons, gratuitement et sans inscription.',
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

/** Chemin public d'un jeu.
 *
 *  `/jeux/` et non `/epreuves/` depuis août 2026. Les anciennes adresses sont
 *  rattrapées par deux redirections permanentes dans next.config.ts, qui
 *  couvrent la page catalogue et les dix jeux d'un seul motif. */
export function lienEpreuve(slug) {
  return `/jeux/${slug}`;
}
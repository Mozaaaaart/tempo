'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Onde from '@/components/Onde';
import VolumeControl from '@/components/VolumeControl';
import EnTete from '@/components/EnTete';
import PiedDePage from '@/components/PiedDePage';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';
import { jeuDuSlug } from '@/components/registreJeux';
import { ContexteEpreuveVisible } from '@/components/ContexteEpreuveVisible';
import { TODAY, jourLocal, setSeedSalt } from '@/components/dailyGames';

/**
 * DÉFI DU JOUR
 *
 * La page parcourt EPREUVES et rien d'autre : data/epreuves.js reste la seule
 * source de vérité pour l'ordre et les intitulés, components/registreJeux.js
 * fournit le composant. Aucune liste en dur ici.
 *
 * POURQUOI CETTE PAGE NE RESSEMBLE PAS À /epreuves/[slug]
 *
 * Une première version se contentait d'ajouter un bandeau or en haut. Ça ne
 * suffisait pas : passé les trois premiers centimètres, tout le reste — le
 * carrousel, le bandeau d'action, la zone de jeu — était l'accès libre à
 * l'identique. Un marqueur ne fait pas un mode.
 *
 * Trois STRUCTURES diffèrent donc, pas seulement des couleurs :
 *
 *   1. Une barre unique pleine largeur, qui absorbe l'en-tête du site.
 *      Surface or pleine — l'or n'est jamais une surface ailleurs — et un
 *      seul objet en haut de page au lieu de deux qui se superposaient.
 *   2. Un PARCOURS et non un menu : pastilles numérotées sur un rail, la
 *      portion franchie en or. L'accès libre a des onglets à filet
 *      supérieur ; ici on lit une séquence qu'on traverse.
 *   3. Un EN-TÊTE D'ÉPREUVE juste au-dessus du jeu, à filet or gauche et
 *      rayon 0. Il occupe la zone qu'on regarde vraiment, et rien de tel
 *      n'existe ailleurs sur le site.
 *
 * Palette, typographie, mouvement : le document de design à la lettre. Une
 * seule couleur d'accent.
 */

const CLE_STOCKAGE = 'mb-quotidien';

/* Archive du dernier défi terminé : scores ET réponses.

   POURQUOI ARCHIVER

   Les corrections sont masquées pendant la journée en cours — un joueur d'un
   fuseau en avance ne doit pas pouvoir renseigner les autres. Elles sont
   rendues le lendemain, quand plus personne ne joue ce tirage.

   Mais le lendemain, la graine a changé : les épreuves ne peuvent plus
   régénérer le contenu de la veille sans refaire toutes leurs requêtes. La
   réponse doit donc être CONSERVÉE au moment où elle est connue, c'est-à-dire
   à la fin de chaque épreuve.

   CONTRAT AVEC LES ÉPREUVES

   Chaque jeu appelle onDone(score, correction), où `correction` est une
   chaîne courte et lisible — « The Weeknd — Starboy », « 128 BPM ». Le second
   argument est FACULTATIF : une épreuve qui ne le fournit pas fonctionne comme
   avant, elle n'apparaîtra simplement pas dans les réponses de la veille.
   C'est ce qui permet de les migrer une par une sans jamais casser la page.

   Les jeux reçoivent en retour `revelation={false}` en mode quotidien : à eux
   de taire leur réponse. La page ne peut pas le faire à leur place, chacun la
   dévoile à sa manière — un flou qui tombe, un nom qui s'inscrit, une portée
   qui se complète. */
const CLE_ARCHIVE = 'mb-quotidien-veille';

/* ---- Slugs d'hier ----
 *
 * L'archive est indexée par SLUG, et deux épreuves ont été renommées en
 * août 2026 : `une-seconde` est devenue `blind-test`, `refrain` est devenue
 * `paroles`. Les réponses écrites la veille portent donc l'ancienne clé, que
 * la page cherche désormais sous la nouvelle : les deux corrections
 * disparaissaient du tableau, sans erreur ni trace.
 *
 * Le défaut se serait résorbé tout seul en vingt-quatre heures, ce qui est
 * précisément ce qui le rend pernicieux : on le constate une fois, on ne
 * parvient plus à le reproduire, et il reviendra au prochain renommage.
 *
 * La table est donc permanente. Elle ne coûte rien et couvre aussi le cas
 * d'un joueur revenu après plusieurs jours d'absence, dont l'archive dort
 * dans le navigateur depuis avant les renommages. */
const ANCIENS_SLUGS = {
  'blind-test': 'une-seconde',
  'paroles': 'refrain',
};

/* Correction archivée d'une épreuve, sous son slug actuel ou l'ancien. */
function correctionDe(archive, epreuve) {
  const table = archive?.corrections;
  if (!table) return null;
  return table[epreuve.slug] ?? table[ANCIENS_SLUGS[epreuve.slug]] ?? null;
}

/* Adresse publique du défi, telle qu'elle apparaît dans le partage.

   Écrite en dur plutôt que déduite de window.location.origin : un partage
   émis depuis localhost ou depuis une préproduction Vercel enverrait sinon
   une adresse injoignable pour le destinataire. Le lien doit toujours mener
   au site en ligne, quel que soit l'endroit d'où l'on joue.

   Contrepartie : elle est à changer ici le jour d'un domaine propre. */
const LIEN_PUBLIC = 'https://mozartbenchmark.vercel.app/quotidien';

/* Temps laissé à la dernière épreuve pour présenter SON résultat avant que le
   relevé final ne prenne la place. Les voiles de fin des épreuves durent près
   de trois secondes ; basculer plus tôt couperait la note qu'on vient
   d'obtenir au moment précis où elle s'affiche. */
const DELAI_RELEVE_FINAL = 3200;

/* ------------------------------------------------------------------
   Stockage local du run du jour. Clé datée : le défi de la veille ne
   peut pas ressusciter et il n'y a rien à purger. Lecture tolérante —
   un format hérité doit être ignoré, jamais faire tomber la page.
------------------------------------------------------------------ */
function lireRun(jour) {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return { scores: {}, corrections: {}, commence: false };
    const donnees = JSON.parse(brut);

    /* Le run stocké date d'un autre jour : il devient l'archive, et c'est de
       lui que viendront les réponses affichées aujourd'hui. Le déplacement se
       fait ici plutôt qu'à minuit — rien ne garantit que l'onglet soit ouvert
       à ce moment-là, alors que ce chemin est traversé à chaque arrivée. */
    if (!donnees || donnees.jour !== jour) {
      if (donnees?.jour && Object.keys(donnees.scores ?? {}).length) {
        localStorage.setItem(CLE_ARCHIVE, JSON.stringify(donnees));
      }
      return { scores: {}, corrections: {}, commence: false };
    }

    const scores = {};
    for (const e of EPREUVES) {
      const v = donnees.scores?.[e.slug];
      if (typeof v === 'number' && Number.isFinite(v)) scores[e.slug] = v;
    }
    return {
      scores,
      corrections: donnees.corrections ?? {},
      commence: donnees.commence === true || Object.keys(scores).length > 0,
    };
  } catch {
    return { scores: {}, corrections: {}, commence: false };
  }
}

/** Réponses du dernier défi terminé, ou null. Jamais celles du jour en cours :
    lireRun n'archive que ce qui porte une AUTRE date. */
function lireArchive() {
  try {
    const brut = localStorage.getItem(CLE_ARCHIVE);
    if (!brut) return null;
    const a = JSON.parse(brut);
    if (!a?.jour || !a?.corrections || !Object.keys(a.corrections).length) return null;
    return a;
  } catch {
    return null;
  }
}

function ecrireRun(jour, scores, corrections, commence) {
  try {
    const utiles = {};
    for (const [k, v] of Object.entries(scores)) if (v !== null) utiles[k] = v;
    localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({ jour, commence, scores: utiles, corrections })
    );
  } catch {
    /* Mode privé, quota plein : le défi reste jouable, il ne survit pas au
       rechargement. Ce n'est pas une raison pour faire tomber la page. */
  }
}

/* Échelle des carrés du partage.

   L'ancienne palette reprenait les ors du site — jaune, orange, marron, noir.
   Elle est jolie et illisible : hors de son contexte, personne ne sait si le
   marron vaut mieux que le noir, ni où se situe l'orange. Une rampe vert →
   jaune → orange → noir se classe en revanche sans explication, et reste
   lisible pour un daltonien, qui lira la LUMINOSITÉ décroissante à défaut de
   la teinte.

   La légende accompagne quand même la ligne : un partage doit se comprendre
   par quelqu'un qui n'a jamais vu le site. */
const PALIERS = [
  { min: 9, carre: '🟩' },
  { min: 7, carre: '🟨' },
  { min: 4, carre: '🟧' },
  { min: -Infinity, carre: '⬛' },
];

function carre(s) {
  if (s === null || s === undefined) return '⬛';
  return PALIERS.find((p) => s >= p.min).carre;
}


/* « 2026-08-02 » → « 2 août 2026 ».
   Formatage à la main plutôt qu'Intl : le rendu serveur et le rendu client
   doivent produire exactement la même chaîne, sans dépendre de la locale
   installée sur la machine. Format inattendu → valeur brute. */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/* Date sans millésime, pour les intitulés courts.
   « 3 août 2026 » et « 3 août » disent la même chose quand il s'agit de la
   veille : l'année n'apporte rien et coûte cinq caractères sur un bouton qui
   n'en a pas à perdre. La forme complète reste dans l'attribut title, pour
   qui survole ou lit à la synthèse vocale. */
function dateCourte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return iso;
  const jour = Number(m[3]);
  return `${jour === 1 ? '1er' : jour} ${MOIS[Number(m[2]) - 1]}`;
}

function dateLisible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return iso;
  const jour = Number(m[3]);
  return `${jour === 1 ? '1er' : jour} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/* ---- LA MÊME DATE, PRÉCÉDÉE DE SON JOUR DE SEMAINE ----
 *
 * « 4 août 2026 » est une référence d'archive : c'est ainsi qu'on désigne une
 * édition passée. « mardi 4 août 2026 » est un RENDEZ-VOUS — la forme qu'on
 * emploie pour ce qui revient. Le défi du jour est précisément cela, et
 * l'étiquette est le premier mot lu de la page.
 *
 * Réservé à cet endroit. La forme sans jour reste partout ailleurs : dans le
 * texte de partage, où quatre signes de plus coûtent une ligne, et sur les
 * boutons de la veille, où l'on parle bien d'une archive.
 *
 * LE CALCUL PASSE PAR UTC, et ce n'est pas un détail. `new Date('2026-08-04')`
 * est interprété en temps universel, mais `new Date('2026-08-04T00:00:00')`
 * l'est en heure locale : à l'ouest de Greenwich, la première forme recule
 * d'un jour. Date.UTC met les deux à l'abri, et surtout donne au serveur et au
 * navigateur la même réponse — une divergence d'un jour entre les deux rendus
 * casserait l'hydratation.
 */
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi',
  'vendredi', 'samedi'];

function dateAvecJour(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return iso;
  const n = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${JOURS[n]} ${dateLisible(iso)}`;
}

/* Temps restant avant minuit LOCAL. Jamais appelé au rendu serveur : la
   valeur dépend de l'heure du client, elle ne peut pas être hydratée. */
function msAvantMinuit() {
  const maintenant = new Date();
  const minuit = new Date(maintenant);
  minuit.setHours(24, 0, 0, 0);
  return minuit.getTime() - maintenant.getTime();
}

/* Heures et minutes, pas de secondes : un chiffre qui tourne en permanence
   attirerait l'œil autant que l'onde, ce que la direction de design lui
   réserve. */
function resteLisible(ms) {
  if (ms === null || ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

/* Le geste tombe-t-il sur une surcouche ?

   Les présentations et les voiles de résultat portent tous un attribut de la
   forme data-xx-surcouche — data-acc-surcouche, data-rq-surcouche, et ainsi
   de suite pour les douze existants. On teste le MOTIF plutôt que la liste :
   une nouvelle épreuve suivra la même convention sans qu'il faille penser à
   compléter une énumération ici, et un oubli se paierait par un contournement
   silencieux de la tentative unique.

   Sert à ne pas compter comme un début de partie le clic qui passe une
   présentation. Il arrive de le faire sans le vouloir, et il ne doit pas
   coûter la présentation au retour. */
const MOTIF_SURCOUCHE = /^data-[a-z]+-surcouche$/;

function surUneSurcouche(cible) {
  for (let el = cible; el instanceof Element; el = el.parentElement) {
    for (const attribut of el.attributes) {
      if (MOTIF_SURCOUCHE.test(attribut.name)) return true;
    }
  }
  return false;
}

const SVG_GAUCHE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 8H3M7 4L3 8l4 4" />
  </svg>
);
const SVG_DROITE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

export default function PageQuotidien() {
  /* Graine pure : le tirage doit être identique pour tout le monde. Appelé
     pendant le rendu, avant qu'un jeu ne s'initialise — et à chaque rendu,
     car une visite préalable à /epreuves/… laisse un salt aléatoire dans le
     module. */
  setSeedSalt('');

  const [pret, setPret] = useState(false);
  const [commence, setCommence] = useState(false);
  const [scores, setScores] = useState(() =>
    Object.fromEntries(EPREUVES.map((e) => [e.slug, null])));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [tick, setTick] = useState(0);
  const [copie, setCopie] = useState(false);
  const [reste, setReste] = useState(null);   // ms avant minuit, null avant montage
  /* Vraie une fois la dernière épreuve terminée ET son voile retiré : c'est
     elle qui remplace le plateau par le relevé. */
  const [releveFinal, setReleveFinal] = useState(false);

  /* Même règle que sur la page des épreuves : l'onde ne s'allume qu'une fois
     déroulée. Son tracé se découvre de 120 à 1020 ms ; éclairer la section
     active pendant ce temps donnait une onde déjà allumée à mesure qu'elle
     apparaissait, ce qui annulait le dévoilement. */
  const [ondeAllumee, setOndeAllumee] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOndeAllumee(true), 1120);
    return () => clearTimeout(t);
  }, []);

  /* Nombre de fois qu'on est arrivé sur chaque épreuve. Zéro veut dire
     jamais montée : on ne monte PAS les dix d'un coup, chacune déclenchant
     ses requêtes Deezer et ses échantillons Tone.js dès le montage.

     Ce compteur sert aussi de clé de remontage. Sur le défi, l'intro doit se
     rejouer à chaque arrivée sur un jeu — un joueur quotidien ne se souvient
     pas forcément de la règle d'une épreuve croisée la veille. Or l'intro
     est décidée au montage (`useState(useIntro(...))` dans chaque jeu), donc
     la seule façon de la relancer depuis l'extérieur est de remonter le
     composant. Incrémenter ce compteur suffit.

     En accès libre, rien ne change : JeuSlot garde sa propre clé, et
     useIntro y distingue toujours une arrivée d'un clic sur « Relancer ». */
  const [visites, setVisites] = useState(() => ({}));

  /* Scores relus du stockage : ces épreuves-là ne sont jamais remontées, leur
     tentative est consommée. Distinct de `scores`, car une épreuve terminée
     DANS la session doit garder son composant à l'écran — sinon son propre
     voile de résultat disparaîtrait à l'instant où il se pose. */
  const restaureesRef = useRef(new Set());

  /* Miroir des scores, tenu à jour pendant le rendu. L'effet ci-dessous doit
     savoir si une épreuve est déjà notée, mais le mettre en dépendance le
     ferait tourner à l'instant même où un score tombe — et donc remonter le
     jeu au moment où il affiche son résultat. */
  const scoresRef = useRef(scores);
  scoresRef.current = scores;

  /* Hauteur de la scène, mesurée en continu sur son contenu.

     Les épreuves n'ont pas la même taille, et Duel change même de taille en
     cours de route : il va chercher un pool de morceaux avant de pouvoir
     dessiner quoi que ce soit, si bien que son panneau fait quelques
     dizaines de pixels puis passe d'un coup à sa taille pleine.

     Une première version figeait la hauteur quittée pendant 1,6 seconde. Le
     remède était pire : quand l'épreuve suivante était plus courte, le cadre
     doré gardait une bande vide sous elle, puis se relâchait d'un coup. Un
     à-coup remplacé par une attente.

     Ici la hauteur SUIT le contenu, et c'est CSS qui interpole. Le cadre ne
     ment jamais sur ce qu'il contient ; il met seulement 320 ms à s'y
     conformer. */
  const contenuRef = useRef(null);
  const [hauteur, setHauteur] = useState(null);

  /* Épreuves dont la tentative est CONSOMMÉE et qui n'affichent plus le jeu,
     mais le relevé.

     Le verrou ne se pose pas à la validation : à cet instant le jeu joue sa
     propre séquence de résultat — voile, note, détail des manches — et la
     remplacer effacerait l'animation qu'on vient de déclencher. Il se pose
     quand on QUITTE l'épreuve. On voit donc son bilan complet sur le coup, et
     tout retour ultérieur montre le relevé.

     Les épreuves reprises du stockage sont verrouillées d'entrée : leur
     tentative appartient à une visite précédente. */
  const [verrous, setVerrous] = useState(() => new Set());

  /* Épreuves ENTAMÉES : le joueur y a fait au moins un geste.

     La distinction est ce qui réconcilie deux exigences opposées. L'intro doit
     se rejouer à chaque arrivée, ce qui suppose de remonter le composant. Mais
     remonter une épreuve commencée remet sa progression à zéro — et dans un
     défi à tentative unique, cela revient à offrir des essais illimités : il
     suffit de faire apparaître des indices, de partir avant de valider, et de
     revenir sur une épreuve neuve en les ayant déjà vus.

     D'où la règle : tant qu'on n'a rien touché, l'épreuve est démontée en
     partant et l'intro se rejoue au retour. Dès le premier geste, elle reste
     montée et n'est plus jamais remontée.

     La détection se fait sur l'interaction plutôt que sur un signal fourni par
     les jeux : elle est générique, et n'aurait sinon demandé de modifier les
     dix composants. Les gestes qui tombent sur une surcouche — passer la
     présentation, notamment — sont exclus : ils ne commencent rien, et un clic
     malencontreux ne doit pas coûter l'intro au retour. */
  const [entamees, setEntamees] = useState(() => new Set());
  const entameesRef = useRef(entamees);
  entameesRef.current = entamees;

  function marquerEntamee(ev) {
    /* Un clic sur la présentation ne commence pas la partie : il la passe, et
       on peut le faire sans le vouloir. L'épreuve reste donc « découverte »,
       et son intro se rejouera au retour. */
    if (surUneSurcouche(ev.target)) return;
    const slug = EPREUVES[index].slug;
    setEntamees((prev) => (prev.has(slug) ? prev : new Set(prev).add(slug)));
  }

  const epreuve = EPREUVES[index];
  const faits = EPREUVES.filter((e) => scores[e.slug] !== null);
  const total = Math.round(faits.reduce((a, e) => a + scores[e.slug], 0) * 10) / 10;
  const max = EPREUVES.length * 10;
  const termine = faits.length === EPREUVES.length;
  /* Le jour n'est FIXÉ QU'APRÈS LE MONTAGE.

     Il dépend du fuseau du navigateur, que le serveur ne connaît pas : le
     rendu serveur, en UTC, donnerait une autre date que le client pour tout
     joueur situé à l'est de Greenwich après 22 h. React signalerait une
     discordance d'hydratation, et la date afficherait brièvement la veille.

     Il reste vide au premier rendu, comme le décompte, pour la même raison. */
  const [jour, setJour] = useState(null);
  /* Passage de minuit détecté pendant la partie : la graine du module est
     figée au chargement, elle ne peut pas suivre. On le dit au joueur plutôt
     que de le laisser jouer le tirage de la veille. */
  const [jourPerime, setJourPerime] = useState(false);
  /* Réponses du jour, transmises par les épreuves à leur fin. Elles ne sont
     JAMAIS affichées aujourd'hui : elles sont conservées pour demain. */
  const [corrections, setCorrections] = useState({});
  /* Miroir des corrections, DÉCLARÉ APRÈS l'état qu'il recopie.

     Il vivait plus haut, à côté du miroir des scores : il lisait donc
     `corrections` avant sa déclaration, ce que la zone morte temporelle du
     `const` interdit — d'où un ReferenceError au rendu. Le voisinage logique
     avec scoresRef ne valait pas cette dette ; un miroir doit suivre sa
     source. */
  const correctionsRef = useRef(corrections);
  correctionsRef.current = corrections;
  /* Réponses du dernier défi terminé. Relue au montage, jamais réécrite. */
  const [archive, setArchive] = useState(null);
  /* Tiroir des réponses de la veille. Fermé par défaut : elles appartiennent
     au défi d'hier et ne doivent pas disputer la vedette à celui du jour. */
  const [veilleEpinglee, setVeilleEpinglee] = useState(false);
  const [veilleSurvolee, setVeilleSurvolee] = useState(false);
  /* DEUX états, et non un seul. Le clic ÉPINGLE le tiroir, le survol ne fait
     que l'entrouvrir.

     Avec un booléen unique, sortir du bouton refermait ce qu'on venait
     d'ouvrir volontairement : le clic ne servait à rien, et le panneau était
     impossible à parcourir à la souris, puisque le curseur doit bien quitter
     le bouton pour descendre dedans. */
  const veilleOuverte = veilleEpinglee || veilleSurvolee;
  const dateDuJour = jour ? dateLisible(jour) : '';
  const dateRendezVous = jour ? dateAvecJour(jour) : '';
  const restant = resteLisible(reste);
  /* Périmé dès que la date locale a changé. Le décompte seul ne suffisait
     pas : il touche zéro un instant avant la bascule, et surtout il repart
     à vingt-quatre heures sans que la graine, elle, ait bougé. */
  const expire = jourPerime || (reste !== null && reste <= 0);

  /* ---------- Reprise ---------- */
  useEffect(() => {
    const aujourdhui = jourLocal();
    setJour(aujourdhui);
    const { scores: repris, corrections: repriseCorr, commence: dejaCommence } = lireRun(aujourdhui);
    setCorrections(repriseCorr ?? {});
    /* Après lireRun : c'est lui qui bascule un run périmé vers l'archive. */
    setArchive(lireArchive());
    restaureesRef.current = new Set(Object.keys(repris));
    if (Object.keys(repris).length) setScores((prev) => ({ ...prev, ...repris }));

    /* Défi déjà bouclé lors d'une visite précédente : le relevé s'affiche
       immédiatement. Le délai de DELAI_RELEVE_FINAL n'existe que pour laisser
       la DERNIÈRE épreuve présenter sa note ; en arrivant sur un défi terminé
       il n'y a aucun voile à attendre, et patienter trois secondes devant le
       plateau d'une épreuve consommée n'aurait aucun sens. */
    if (Object.keys(repris).length === EPREUVES.length) setReleveFinal(true);
    setCommence(dejaCommence);
    setPret(true);
  }, []);

  /* Bascule vers le relevé final, une fois la dernière épreuve close et son
     propre voile retiré. */
  useEffect(() => {
    if (!termine) return undefined;
    const t = setTimeout(() => setReleveFinal(true), DELAI_RELEVE_FINAL);
    return () => clearTimeout(t);
  }, [termine]);

  /* ---------- Compte à rebours et bascule de minuit ----------
     Quinze secondes suffisent : l'affichage est à la minute.

     La même horloge surveille le changement de date. La graine vit dans une
     constante de module, figée au chargement : elle ne peut pas suivre le
     passage de minuit. Un onglet resté ouvert continuerait donc de servir le
     tirage de la veille — c'est précisément ce qui s'est produit à 00 h 16.
     Faute de pouvoir la rafraîchir sur place, on le signale. */
  useEffect(() => {
    const battement = () => {
      setReste(msAvantMinuit());
      if (jourLocal() !== TODAY) setJourPerime(true);
    };
    battement();
    const t = setInterval(battement, 15000);
    return () => clearInterval(t);
  }, []);

  /* Compte une visite sur l'épreuve affichée, jamais avant le seuil.
     La première monte le jeu, les suivantes le remontent — donc rejouent
     l'intro.

     Une exception : une épreuve dont la tentative est consommée n'est jamais
     remontée. Elle affiche son relevé, pas le jeu — compter une visite de
     plus n'aurait aucun effet, et masquerait l'intention en relecture. */
  useEffect(() => {
    if (!pret || !commence) return;
    const slug = EPREUVES[index].slug;
    if (restaureesRef.current.has(slug)) return;
    if (scoresRef.current[slug] !== null) return;
    /* Entamée : la clé de montage ne doit plus bouger, sinon le composant
       serait recréé et la progression perdue. */
    if (entameesRef.current.has(slug)) return;
    setVisites((prev) => ({ ...prev, [slug]: (prev[slug] ?? 0) + 1 }));
  }, [pret, commence, index]);

  function demarrer() {
    setCommence(true);
    ecrireRun(jour ?? jourLocal(), scores, correctionsRef.current, true);
  }

  /* onDone(score, correction).

     Le second argument est facultatif : une épreuve qui ne le fournit pas
     n'apparaîtra simplement pas dans les réponses de la veille. C'est ce qui
     permet de migrer les jeux un par un sans casser la page. */
  function report(slug) {
    return (s, correction) => {
      setScores((prev) => {
        // Une tentative : le premier score fait foi. Certains jeux appellent
        // onDone plusieurs fois en fin de séquence.
        if (prev[slug] !== null) return prev;

        const suiteCorr = typeof correction === 'string' && correction.trim()
          ? { ...correctionsRef.current, [slug]: correction.trim() }
          : correctionsRef.current;
        correctionsRef.current = suiteCorr;
        setCorrections(suiteCorr);

        const suite = { ...prev, [slug]: s };
        ecrireRun(jour ?? jourLocal(), suite, suiteCorr, true);
        return suite;
      });
    };
  }

  function aller(n) {
    const cible = Math.min(Math.max(n, 0), EPREUVES.length - 1);
    if (cible === index) return;

    /* On quitte une épreuve déjà notée : sa tentative est consommée, elle
       n'affichera plus le jeu. Lu depuis la ref pour être sûr d'avoir le
       score le plus récent, y compris celui qui vient de tomber. */
    const partante = EPREUVES[index].slug;
    if (scoresRef.current[partante] !== null) {
      setVerrous((prev) => (prev.has(partante) ? prev : new Set(prev).add(partante)));
    }

    setDir(cible > index ? 1 : -1);
    setTick((t) => t + 1);
    setIndex(cible);
  }

  /* Observation de la hauteur du contenu.

     ResizeObserver plutôt qu'une mesure au changement d'index : la hauteur
     bouge aussi SANS changement d'épreuve — pool de Duel qui arrive, paroles
     qui remplacent leur squelette, liste déroulante qui s'ouvre. Une mesure
     ponctuelle raterait tous ces cas.

     Aucune boucle de rétroaction possible : la hauteur est posée sur le
     PARENT, le contenu observé garde la sienne, qui est automatique.

     Navigateur sans ResizeObserver : la hauteur reste nulle, donc `auto`, et
     l'on retombe exactement sur le comportement d'avant. */
  useEffect(() => {
    const el = contenuRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const mesurer = () => {
      const h = el.offsetHeight;
      if (h > 0) setHauteur(h);
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [pret, commence]);

  /* Flèches ← → du clavier, sauf pendant une saisie et avant le seuil. */
  useEffect(() => {
    function onKey(ev) {
      if (!commence) return;
      const cible = ev.target;
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === 'ArrowLeft') aller(index - 1);
      if (ev.key === 'ArrowRight') aller(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, commence]);

  /* Texte du partage.

     Le texte brut n'a ni gras, ni couleur, ni taille : sa mise en forme tient
     au rythme des lignes et aux blancs.

     UNE LIGNE PAR ÉPREUVE, et non une grille de carrés.

     La grille venait de Wordle, où elle raconte une partie : on voit le
     tâtonnement des premières lignes, puis la rangée pleine. Ici les dix
     épreuves sont indépendantes — il n'y a pas de parcours à lire, et le
     motif ne dit rien tant qu'on ignore à quoi chaque case correspond. La
     légende n'y répondait pas : elle expliquait les couleurs, pas les
     positions.

     Nommer coûte des lignes mais rend le message lisible sans clé, et
     surtout COMPARABLE : deux joueurs peuvent confronter la même épreuve.
     C'est ce qui fait revenir, plus qu'un total.

     Le carré reste devant chaque ligne : il ne porte plus l'information — la
     note est écrite — mais il donne une couleur à parcourir des yeux, et
     c'est ce qui distingue un relevé d'une liste. La légende disparaît, elle
     n'a plus rien à expliquer.

     Volontairement pas de colonnes alignées à l'espace ni de cadre en
     caractères de dessin : les messageries rendent le texte en fonte
     proportionnelle, et tout alignement se désaligne d'une ligne à l'autre. */
  function texteDePartage() {
    const lignes = EPREUVES.map((e) => {
      const note = scores[e.slug] ?? 0;
      return `${carre(note)} ${e.num} ${e.court} — ${note.toFixed(1).replace('.', ',')}`;
    });

    return [
      '♪ MOZART BENCHMARK',
      `Défi du ${dateDuJour}`,
      '',
      `${total.toFixed(1).replace('.', ',')} / ${max}`,
      '',
      ...lignes,
      '',
      'Une tentative par jeu, le même défi pour tout le monde',
      'jusqu\'à minuit.',
      '',
      `→ ${LIEN_PUBLIC}`,
    ].join('\n');
  }

  async function partager() {
    const txt = texteDePartage();

    /* Partage natif sur TACTILE seulement.

       Sur téléphone, la feuille du système est le bon geste : on choisit la
       conversation et le message part, là où le presse-papiers imposerait
       d'ouvrir soi-même une application et de coller.

       Sur ordinateur, c'est l'inverse. navigator.share y existe pourtant —
       Chrome sous Windows l'implémente — mais il ouvre un panneau système
       encombrant, avec des cibles qu'on n'a pas demandées, alors que la
       copie est le geste attendu. Un bouton qui ouvre une fenêtre au lieu de
       copier passe pour un dysfonctionnement.

       Le test porte sur le type de POINTEUR et non sur l'agent utilisateur :
       une chaîne d'agent se falsifie et change tous les six mois, un pointeur
       grossier décrit ce qu'on veut vraiment savoir — un doigt sur un écran.

       L'abandon par l'utilisateur lève une AbortError : ce n'est pas une
       panne, on ne bascule donc pas sur le presse-papiers derrière son dos. */
    const tactile = typeof window !== 'undefined'
      && window.matchMedia?.('(pointer: coarse)').matches;

    if (tactile && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: txt });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
        // Partage indisponible malgré tout : on retombe sur la copie.
      }
    }

    try {
      await navigator.clipboard?.writeText(txt);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      /* Contexte non sécurisé ou permission refusée : le bouton ne confirme
         rien plutôt que d'annoncer une copie qui n'a pas eu lieu. */
    }
  }

  /* Flèche en contour, s'inverse au survol.

     Elle porte le même halo que la scène et la carte du score, mais à 16 px
     au lieu de 26 : le rayon d'une lueur doit rester proportionné à l'objet
     qui l'émet. Sur un disque de 34 px, un halo de 26 px déborde plus large
     que la flèche elle-même et se lit comme une tache, pas comme un contour
     éclairé.

     La flèche désactivée n'en a pas : elle est en cendre sur filet, la
     faire briller contredirait ce que son état annonce. */
  /* La taille et les états vivent dans la feuille, sous .q-fleche : une
     requête média doit pouvoir agrandir le rond sur mobile, et un style en
     ligne l'en empêcherait. Le survol y est aussi, sous @media (hover: hover) —
     posé en JavaScript, il restait allumé après un tap, faute de mouseleave
     sur un écran tactile. */
  const fleche = (dispo) => (dispo ? 'q-fleche' : 'q-fleche q-fleche-eteinte');

  // Keyframes alternées : l'animation se rejoue même deux fois dans le même sens
  const nomAnim = dir > 0
    ? (tick % 2 ? 'glisseDroiteA' : 'glisseDroiteB')
    : (tick % 2 ? 'glisseGaucheA' : 'glisseGaucheB');

  const peutPrecedent = index > 0;
  const peutSuivant = index < EPREUVES.length - 1;
  const scoreActif = scores[epreuve.slug];
  const auSeuil = pret && !commence;

  /* Écart entre deux segments, en pixels. Repris dans le calcul du curseur :
     une seule valeur, les deux ne peuvent pas se désynchroniser. */
  const ECART_SEGMENT = 4;

  return (
    <>
      {/* ================================================================
          LA BARRE DU MODE

          Hors de .contenu, donc réellement pleine largeur — et surtout
          UNIQUE : elle remplace l'en-tête du site au lieu de se poser
          par-dessus, ce qui masquait le monogramme et le nom du site.
          Seule surface or pleine de tout le projet.
      ================================================================ */}
      {/* L'en-tête commun, dans sa variante accentuée.

          La barre était écrite ici, ce qui la rendait propre au défi : passer
          d'une page à l'autre faisait muter le repère d'identité du site. Elle
          vit maintenant dans components/EnTete.jsx et sert partout ; le défi
          n'en est plus une exception mais une variante, qui ajoute son filet
          or, sa pastille de mode, la date et le décompte. */}
      <EnTete
        accent
        liens={[{ href: lienEpreuve(EPREUVES[0].slug), libelle: 'entraînement' }]}
        droite={
          /* L'échéance est le seul élément de la barre qui CHANGE. Elle va
             donc à droite, avec la sortie, et non au milieu du bloc
             d'identité : ce qui bouge se range à part de ce qui ne bouge pas.

             Rendue seulement après montage — l'heure locale ne s'hydrate pas.
             Elle reste visible sur mobile, contrairement aux liens : c'est
             elle qui porte l'urgence. */
          /* UN seul enfant, rendu même vide.

             L'échéance n'existe qu'après le montage — l'heure locale ne
             s'hydrate pas. Si elle apparaissait comme un enfant de plus, elle
             décalerait la position de ses voisins dans la barre, donc leurs
             délais d'entrée, et leur animation se rejouerait sous les yeux du
             joueur. Un emplacement réservé dès le premier rendu évite ça. */
          <span className="q-jeton">
            {expire ? (
              /* Un bouton, pas une consigne : le rechargement est la seule
                 façon de reprendre une graine à jour, autant l'offrir d'un
                 clic. Le style reprend celui des jetons voisins pour ne pas
                 déséquilibrer la barre. */
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="q-jeton q-jeton-fort"
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--or)',
                  borderRadius: 'var(--rayon-controle)',
                  padding: '3px 8px',
                  color: 'var(--or)',
                  cursor: 'pointer',
                }}
              >
                nouveau défi — recharger
              </button>
            ) : restant ? (
              /* « il reste » se replie, le chiffre reste. L'échéance est le
                 seul élément mouvant de la barre et elle porte l'urgence :
                 elle ne se replie donc pas, contrairement à la date et à la
                 pastille de mode. Mais deux mots sur quinze ne font que
                 situer ce que le chiffre dit tout seul — soixante pixels
                 rendus au nom du site sans rien perdre. */
              <><span className="entete-repli">il reste </span><span className="q-jeton-fort">{restant}</span></>
            ) : null}
          </span>
        }
      >
        <span className="entete-sep entete-repli" aria-hidden="true" />

        {/* Seul élément en or plein de la page.

            REPLIÉE SUR MOBILE. Elle nomme l'endroit où l'on se trouve, ce que
            disent déjà le filet or, son halo — que cette page est seule à
            porter — et le titre deux centimètres plus bas. Trois fois la même
            information, pour cent pixels qui manquaient au nom du site. */}
        <span className="q-puce entete-repli">défi du jour</span>

        <span className="q-jeton entete-repli">{dateDuJour}</span>
      </EnTete>

      <main className="contenu" style={{ paddingTop: 'var(--e6)' }}>
        <style>{`
          @keyframes glisseDroiteA { from { transform: translateX(42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          @keyframes glisseDroiteB { from { transform: translateX(42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          @keyframes glisseGaucheA { from { transform: translateX(-42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          @keyframes glisseGaucheB { from { transform: translateX(-42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }

          /* ---- Ce que la page injecte dans l'en-tête ----
             La barre elle-même vit dans components/EnTete.jsx : structure,
             fond, filet or et repli mobile y sont définis une fois pour tout
             le site. Ne restent ici que les deux objets propres au défi. */
          .q-jeton {
            font-family: var(--mono);
            font-size: 10.5px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            white-space: nowrap;
            color: var(--lin);
          }
          /* Dans « il reste 3 h 47 », seul le chiffre porte l'information ;
             les deux mots qui l'introduisent la situent. Les distinguer évite
             d'avoir à hausser tout le jeton pour rendre l'échéance lisible —
             ce qui l'aurait mis au même niveau que la pastille de mode. */
          .q-jeton-fort { color: var(--ivoire); }
          /* Pastille du mode.

             Elle était en or plein, texte noir. C'était l'objet le plus
             lumineux de la page alors qu'il ne fait que nommer l'endroit où
             l'on se trouve — un aplat saturé pour une étiquette. Elle passe
             donc au vocabulaire habituel du site : filet or, texte or, fond
             de surface surélevée. Elle se distingue toujours des jetons
             voisins, qui n'ont ni cadre ni couleur, mais elle cesse de rivaliser
             avec le bouton d'action et le halo du filet supérieur.

             Filet à 0,5 px et non 1 px : le document de design réserve le
             pixel plein à l'élément actif, ce qu'une étiquette n'est pas. */
          .q-puce {
            font-family: var(--mono);
            font-size: 10px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            font-weight: 500;
            white-space: nowrap;
            background: var(--onyx-haut);
            color: var(--or);
            border: 0.5px solid var(--or);
            padding: 4px 9px;
            border-radius: var(--rayon-controle);
            flex-shrink: 0;
          }

          /* ---- La barre de progression ----
             Un segment par épreuve, colorié INDÉPENDAMMENT selon qu'elle est
             faite ou non. C'est ce qui la rend supérieure à un rail qui se
             remplirait jusqu'à l'étape courante : sauter la 02 pour aller à
             la 05 laisse la 02 éteinte, donc visible comme manquante. Le
             curseur clair, lui, dit seulement où l'on se trouve. */
          /* ---- Entrée de la page ----
             Repérage par CLASSE et non par nth-child, contrairement à
             l'accueil et aux épreuves : cette page rend des blocs
             conditionnels — le seuil, le relevé final — et le rang d'un
             élément y change selon l'état. Une numérotation se serait
             décalée toute seule.

             L'onde se DÉROULE de gauche à droite : un rognage animé, pas une
             mise à l'échelle, qui aurait comprimé le tracé et donc déformé la
             silhouette pendant l'apparition. Sa boucle interne continue de
             tourner dessous — ce qu'on découvre est vivant.

             900 ms, comme sur les épreuves : on vient jouer, tout ce qui
             retarde le premier clic se paie. */
          /* Le bandeau de titre porte une animation à remplissage both, qui
             laisse un transform appliqué en permanence. Un transform non nul
             crée un CONTEXTE D'EMPILEMENT : le z-index du tiroir des
             corrections ne vaut plus qu'à l'intérieur de ce contexte, et c'est
             le contexte entier qui se compare à l'onde — laquelle vient après
             dans le document, donc passait au-dessus du panneau.

             On situe donc le contexte lui-même, une fois pour toutes. */
          .q-tete {
            position: relative;
            z-index: 30;
            animation: qEntree 360ms 50ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .q-onde {
            animation: qOnde 900ms 120ms cubic-bezier(0.35, 0, 0.35, 1) both;
          }
          .q-nav {
            animation: qEntree 360ms 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .q-scene {
            animation: qEntree 360ms 980ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          @keyframes qOnde {
            from { clip-path: inset(0 100% 0 0); }
            to   { clip-path: inset(0 0 0 0); }
          }
          @keyframes qEntree {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* ---- Les dix segments, calés sur le passage de l'onde ----
             Chaque segment s'allume à l'instant où le bord du rognage franchit
             son centre — 5, 15, 25 % et ainsi de suite. Les délais viennent de
             l'inversion de la courbe du déroulé : celle-ci n'étant pas
             linéaire, un pas constant aurait fait dériver les segments par
             rapport à l'onde qui les survole.

             Fondu seul, sans translation : un trait de 3 px qui monte de huit
             pixels se lit comme un défaut d'affichage, pas comme une entrée.

             Le curseur attend la fin du déroulé. Il désigne l'épreuve en
             cours ; le poser avant que la barre existe reviendrait à montrer
             une position sur une échelle absente. */
          .q-segments-grille > * {
            animation: qSegment 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .q-segments-grille > *:nth-child(1)  { animation-delay: 173ms; }
          .q-segments-grille > *:nth-child(2)  { animation-delay: 248ms; }
          .q-segments-grille > *:nth-child(3)  { animation-delay: 299ms; }
          .q-segments-grille > *:nth-child(4)  { animation-delay: 344ms; }
          .q-segments-grille > *:nth-child(5)  { animation-delay: 387ms; }
          .q-segments-grille > *:nth-child(6)  { animation-delay: 432ms; }
          .q-segments-grille > *:nth-child(7)  { animation-delay: 482ms; }
          .q-segments-grille > *:nth-child(8)  { animation-delay: 543ms; }
          .q-segments-grille > *:nth-child(9)  { animation-delay: 623ms; }
          .q-segments-grille > *:nth-child(10) { animation-delay: 752ms; }

          @keyframes qSegment {
            from { opacity: 0; }
            to   { opacity: 1; }
          }

          /* ---- Réponses de la veille ----
             Repliées derrière un bouton. Le survol ouvre sur les appareils à
             pointeur fin, le clic bascule partout — un tiroir qui ne
             s'ouvrirait qu'au survol n'existerait pas sur mobile. */
          .q-veille-bouton {
            display: inline-flex;
            align-items: center;
            gap: var(--e2);
            font-family: var(--mono);
            font-size: 11px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            color: var(--or);
            background: transparent;
            border: 0.5px solid var(--or);
            border-radius: var(--rayon-controle);
            padding: 9px 14px;
            cursor: pointer;
            transition: background var(--transition-courte), color var(--transition-courte);
            /* Un inline-flex se dimensionne sur son contenu et ne recule
               devant rien : sur un intitulé daté, il sortait de sa colonne.
               Ces trois lignes le bornent sans lui imposer de largeur. */
            max-width: 100%;
            text-align: left;
          }
          .q-veille-bouton > span { min-width: 0; }
          /* Le chevron ne se comprime jamais : c'est lui qui dit que le bloc
             s'ouvre, et un chevron écrasé ne veut plus rien dire. */
          .q-veille-bouton > svg { flex: 0 0 auto; }
          .q-veille-bloc:hover .q-veille-bouton,
          .q-veille-bouton:focus-visible {
            background: var(--or);
            color: var(--noir);
          }

          /* Le tiroir s'ouvre EN SURIMPRESSION, ancré sous le bouton.

             Il vit maintenant dans la colonne de droite, large de deux cents
             pixels : un panneau dans le flux y serait comprimé, et pousserait
             l'onde vers le bas à chaque ouverture. En absolu, il déborde sur
             la page sans rien déplacer, et retrouve la largeur qu'il faut à
             un tableau de dix lignes.

             De 0fr à 1fr : la seule façon d'animer une hauteur AUTOMATIQUE.
             Une max-height chiffrée obligerait à deviner la taille du
             contenu, et se verrait dès qu'on ajoute une ligne. */
          /* Le bouton entre EN DERNIER, une fois la page installée.

             Sa colonne appartient au bandeau de titre, qui apparaît dès 50 ms :
             sans règle propre, le bouton serait donc là avant tout le reste,
             alors qu'il renvoie au défi d'HIER. Il doit se présenter comme un
             appoint, pas comme un point de départ.

             1 400 ms : le bouton entre pendant que les dernières lignes du
             seuil finissent de se poser, plutôt qu'après elles. Attendre la
             toute dernière — 1 680 ms — faisait un temps mort avant son
             apparition, et le geste se lisait comme un retard plutôt que comme
             une suite. Il reste derrière la scène du jeu, la navigation et
             l'onde, qui sont l'essentiel.

             Le remplissage both le tient invisible jusque-là.

             Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
             backtick isolé y refermerait la chaîne CSS en plein milieu. */
          .q-veille-bloc {
            position: relative;
            animation: qEntree 520ms 1400ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .q-veille-tiroir {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            /* Au-dessus de l'onde, qui traverse la page à cette hauteur et
               dont le tracé passerait sinon sur le panneau. */
            z-index: 40;
            width: min(90vw, 620px);
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 460ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          /* Fermé, il ne doit intercepter aucun clic : il couvre sinon une
             bande invisible au-dessus du contenu. */
          .q-veille-tiroir { pointer-events: none; }
          .q-veille-tiroir[data-ouvert='true'] { pointer-events: auto; }
          .q-veille-tiroir[data-ouvert='true'] { grid-template-rows: 1fr; }
          .q-veille-tiroir > div { overflow: hidden; }
          /* Panneau opaque : en surimpression, il passe au-dessus de l'onde
             et du seuil, qu'il doit masquer pour rester lisible. */
          .q-veille-corps {
            /* Surface surélevée plutôt que le noir du fond : sur une page
               noire, un panneau noir n'a pas de bord visible, et seule
               l'ombre portée le distinguait. */
            background: var(--onyx-haut);
            border: 0.5px solid var(--filet-fort);
            border-radius: var(--rayon-carte);
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
            padding: var(--e4) var(--e4) var(--e3);
            text-align: left;
            opacity: 0;
            transition: opacity 260ms ease;
          }
          .q-veille-tiroir[data-ouvert='true'] .q-veille-corps {
            opacity: 1;
            transition-delay: 140ms;
          }

          /* Trois colonnes : rang, épreuve, réponse. La réponse est la seule
             en pleine lumière — c'est elle qu'on vient lire, le reste situe. */
          .q-veille { display: grid; max-width: 620px; }
          .q-veille-item {
            display: grid;
            grid-template-columns: auto 104px 1fr;
            align-items: baseline;
            gap: var(--e3);
            padding: var(--e3) 0;
            border-top: 0.5px solid var(--filet);
          }
          .q-veille-num {
            font-family: var(--mono); font-size: 10px;
            letter-spacing: 0.09em; color: var(--or);
          }
          /* Le nom de l'épreuve était en cendre : 2,6 pour 1 sur le fond du
             panneau, très en dessous du seuil de lisibilité. Le lin le porte à
             5,4 pour 1. C'est lui qui relie la réponse à ce qu'on a joué — sans
             lui, la colonne du milieu ne sert plus à rien.

             Un demi-point de plus et un interlettrage un peu resserré : en
             capitales monospace, 10 px et 0,09 em faisaient un mot étiré et
             pâle, difficile à lire d'un coup d'œil. */
          .q-veille-nom {
            font-family: var(--mono); font-size: 10.5px;
            letter-spacing: 0.06em; text-transform: uppercase; color: var(--lin);
          }
          .q-veille-rep { font-size: 14px; color: var(--ivoire); line-height: 1.35; }

          @media (max-width: 620px) {
            /* La réponse passe sur sa propre ligne : la comprimer entre deux
               colonnes fixes la couperait en trois mots par ligne. */
            .q-veille-item { grid-template-columns: auto 1fr; }
            .q-veille-rep { grid-column: 1 / -1; }
          }

          .q-segments { position: relative; }
          .q-segments-grille {
            display: grid;
            grid-template-columns: repeat(${EPREUVES.length}, 1fr);
            gap: ${4}px;
          }
          .q-segment {
            height: 3px;
            border: none;
            padding: 0;
            cursor: pointer;
            transition: background var(--transition-courte);
          }
          /* Cible tactile confortable sans épaissir le trait : le segment
             reste à 3 px, la zone cliquable descend à 18 px. */
          .q-segment::after {
            content: '';
            display: block;
            height: 18px;
            margin-top: -3px;
          }
          .q-curseur {
            animation: qSegment 320ms 1020ms cubic-bezier(0.22, 1, 0.36, 1) both;
            position: absolute;
            top: 0; left: 0;
            height: 3px;
            background: var(--or-clair);
            pointer-events: none;
            transition: transform var(--transition-onde);
          }

          /* ---- Barre de navigation de l'épreuve ----
             Flèches aux extrémités, intitulé au centre. Les deux flancs ont
             la même largeur (flex-basis 0), le centre est donc réellement
             centré quoi qu'on mette à gauche ou à droite. */
          .q-nav {
            display: flex;
            align-items: center;
            gap: var(--e4);
            border-bottom: 0.5px solid var(--filet);
            padding: var(--e4) 0;
          }
          .q-nav-flanc { flex: 1 1 0; display: flex; align-items: center; gap: var(--e3); min-width: 0; }

          /* ---- La scène du jeu ----
             Exactement le traitement de la carte du défi sur l'accueil, au
             survol : filet or et halo de 26 px à 60 %. Permanent ici, parce
             que le jeu EST le contenu de la page — il n'y a rien d'autre à
             mettre en avant.

             Le filet passe par un box-shadow à étalement (0 0 0 1px) plutôt
             que par la propriété border : la boîte n'est pas décalée d'un
             pixel, le halo reste donc collé au panneau du jeu au lieu de
             flotter autour d'un cadre plus grand que lui.

             Aucun accent grave dans ce bloc : il est écrit dans un template
             literal, et un backtick isolé y refermerait la chaîne CSS en
             plein milieu.

             box-shadow et non filter: drop-shadow, pour la même raison que
             sur l'onde : le filtre force une rastérisation à chaque repaint
             et fait tomber le défilement sur mobile.

             L'ombre est portée par le conteneur QUI ROGNE (overflowX: clip).
             Posée sur un enfant, elle serait coupée sur les côtés : un
             élément ne rogne jamais sa propre ombre, seulement son contenu.

             Le rayon reprend celui des cartes — sans lui, le halo dessine des
             coins carrés autour d'un panneau arrondi. */
          /* Halo doré seul, sans filet : pour les blocs qui portent déjà
             leur propre bordure or. Même valeur que .q-scene — les deux se
             règlent donc ensemble, et rien ne peut se désaccorder. */
          .q-lueur { box-shadow: var(--halo-or); }

          /* ---- Le relevé du score se pose, il n'apparaît pas ----
             Il n'existe qu'une fois le défi entamé : au seuil, il n'y a rien
             à relever. Il ne peut donc pas profiter de la cascade d'entrée de
             la page, qui s'est jouée bien avant qu'il existe — il surgissait
             d'un coup au franchissement du seuil, seul élément de la page à
             le faire.

             L'animation est portée par la CARTE et non par le bandeau qui la
             contient : celui-ci a la sienne, au chargement, et superposer les
             deux multiplierait les opacités l'une par l'autre. Le retard de
             120 ms le fait suivre le titre quand les deux arrivent ensemble,
             au rechargement d'un défi déjà commencé.

             Même durée et même courbe que le reste de la page : ce qui se
             pose ici doit se poser comme ailleurs. */
          .q-releve {
            animation: qEntree 360ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }

          .q-scene {
            border-radius: var(--rayon-carte);
            box-shadow:
              0 0 0 1px var(--or),
              var(--halo-or);
            /* La première mesure ne s'anime pas : une hauteur automatique
               n'est pas interpolable, le passage à une valeur en pixels est
               donc instantané. Les suivantes, de pixels à pixels, glissent.
               Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
               backtick isolé y refermerait la chaîne CSS en plein milieu. */
            transition: height 320ms cubic-bezier(0.4, 0, 0.2, 1);
          }

          /* ---- Relevé final ----
             Il prend la place du plateau, dans le même cadre lumineux : c'est
             le contenu de la page à ce moment-là, il n'a pas à s'ajouter en
             dessous. */
          .q-final { padding: var(--e7) var(--e5); text-align: center; }
          .q-detail {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: var(--e2) var(--e3);
            max-width: 420px;
            margin: 0 auto;
            text-align: left;
          }
          .q-jauge { height: 3px; background: var(--filet); }
          .q-jauge > span {
            display: block;
            height: 100%;
            background: var(--or);
            transform-origin: left;
          }
          @keyframes qFinalEntree {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes qFinalNote {
            0%   { opacity: 0; transform: scale(0.72); }
            62%  { opacity: 1; transform: scale(1.06); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes qJaugeRemplit {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
          }

          /* Sommaire du seuil */
          /* ---- Le programme du seuil ----
             Même forme que les colonnes de l'accueil et les onglets du
             carrousel : un filet supérieur, le numéro, l'intitulé. C'est déjà
             la manière dont le site nomme ses épreuves ; la reprendre les rend
             reconnaissables au lieu d'en faire une liste de plus.

             Le filet passe à l'or au survol, comme partout ailleurs — le bloc
             cesse d'être une énumération inerte et devient un aperçu qu'on
             parcourt. */
          .q-sommaire {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: var(--e4) var(--e3);
            text-align: left;
          }
          /* ---- Le filet se TRACE de gauche a droite au survol ----
             Repris tel quel de la grille de l'accueil : meme procede, meme
             duree, meme courbe. Le filet passait a l'or d'un bloc, en 220 ms
             et sur toute sa longueur a la fois ; ici il se DESSINE, et les
             deux gestes ne racontent pas la meme chose — le premier allume
             une case, le second parcourt une liste. C'est le meme sommaire
             d'un ecran a l'autre, il devait avoir le meme comportement.

             Deux pseudo-elements superposes plutot qu'une couleur animee :
             le gris reste en place et l'or se deploie par-dessus depuis son
             bord gauche. scaleX et non une largeur animee — la mise a
             l'echelle est composee par le processeur graphique, une largeur
             declencherait un recalcul de mise en page a chaque image.

             560 ms en cubic-bezier(0.22, 1, 0.36, 1) : la valeur exacte de
             l'accueil. Ecrite en clair et non via --transition-courte, qui
             vaut 220 ms — le trace est un mouvement, pas un changement de
             couleur, et les deux n'ont pas la meme duree dans le systeme.

             Epaisseurs du document de design : 0,5 px au repos, 1 px sur
             l'element actif.

             La bordure d'origine cede la place au pseudo-element : conservee,
             elle aurait ajoute un demi-pixel gris SOUS le trait dore, visible
             en fin de course. */
          .q-sommaire-item {
            position: relative;
            padding-top: var(--e2);
          }
          .q-sommaire-item::before,
          .q-sommaire-item::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
          }
          .q-sommaire-item::before {
            height: 0.5px;
            background: var(--filet);
          }
          .q-sommaire-item::after {
            height: 1px;
            background: var(--or);
            transform: scaleX(0);
            transform-origin: left center;
            transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          .q-sommaire-item:hover::after { transform: scaleX(1); }

          /* Sans mouvement demande, le trait apparait d'un coup plutot que de
             ne rien faire : l'information de survol reste, le deplacement
             part. La regle vaut aussi pour l'accueil, ou globals.css coupe
             deja toutes les transitions. */
          @media (prefers-reduced-motion: reduce) {
            .q-sommaire-item::after { transition: none; }
          }

          /* ---- Entrée du seuil ----
             Les blocs se posent du haut vers le bas, à la cadence des autres
             pages. Les dix épreuves entrent ensuite une par une, de gauche à
             droite : elles se lisent comme une série, et une série qui arrive
             d'un bloc ne se compte pas.

             Le pas des épreuves est resserré à 55 ms — dix éléments, contre
             cinq sur l'accueil : au pas de l'accueil, la seule liste
             occuperait une seconde entière. */
          .q-seuil > *:nth-child(1) { animation: qSeuilEntree 460ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .q-seuil > *:nth-child(2) { animation: qSeuilEntree 460ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .q-seuil > *:nth-child(3) { animation: qSeuilEntree 460ms 300ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .q-seuil > *:nth-child(4) { animation: qSeuilEntree 460ms 400ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .q-seuil > *:nth-child(6) { animation: qSeuilEntree 460ms 1120ms cubic-bezier(0.22, 1, 0.36, 1) both; }
          .q-seuil > *:nth-child(7) { animation: qSeuilEntree 460ms 1220ms cubic-bezier(0.22, 1, 0.36, 1) both; }

          .q-sommaire-item {
            animation: qSeuilEntree 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .q-sommaire-item:nth-child(1)  { animation-delay: 520ms; }
          .q-sommaire-item:nth-child(2)  { animation-delay: 575ms; }
          .q-sommaire-item:nth-child(3)  { animation-delay: 630ms; }
          .q-sommaire-item:nth-child(4)  { animation-delay: 685ms; }
          .q-sommaire-item:nth-child(5)  { animation-delay: 740ms; }
          .q-sommaire-item:nth-child(6)  { animation-delay: 795ms; }
          .q-sommaire-item:nth-child(7)  { animation-delay: 850ms; }
          .q-sommaire-item:nth-child(8)  { animation-delay: 905ms; }
          .q-sommaire-item:nth-child(9)  { animation-delay: 960ms; }
          .q-sommaire-item:nth-child(10) { animation-delay: 1015ms; }

          @keyframes qSeuilEntree {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* ---- Les flèches de navigation ----
             Taille et états en CSS, pour deux raisons.

             Le survol était posé en JavaScript. Sur un écran tactile, le
             navigateur émet mouseenter au tap puis plus jamais mouseleave :
             la flèche restait allumée en or après le clic, et rien ne pouvait
             l'éteindre. La requête média ne s'applique qu'aux appareils qui
             ont un vrai pointeur.

             Et une taille en style en ligne aurait empêché de l'agrandir sous
             640 px. */
          .q-fleche {
            width: 34px; height: 34px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            padding: 0; flex-shrink: 0;
            background: transparent;
            color: var(--or);
            border: 1px solid var(--or);
            box-shadow: 0 0 16px rgba(239, 159, 39, 0.6);
            cursor: pointer;
            transition:
              color var(--transition-courte),
              border-color var(--transition-courte),
              background var(--transition-courte),
              box-shadow var(--transition-courte);
          }
          .q-fleche-eteinte {
            color: var(--cendre);
            border-color: var(--filet);
            box-shadow: none;
            cursor: not-allowed;
          }
          @media (hover: hover) and (pointer: fine) {
            .q-fleche:not(.q-fleche-eteinte):hover {
              background: var(--or);
              color: var(--noir);
            }
          }

          @media (max-width: 640px) {
            .q-sommaire { grid-template-columns: repeat(2, 1fr); }

            /* ---- Le bandeau de titre passe en pile ----
               La colonne de droite était alignée à droite et poussée en bas
               par marginTop auto : deux réglages qui n'ont de sens que dans
               une rangée. Une fois repliée sous le titre, elle donnait un
               relevé collé au bord droit, seul élément de la page à l'être.

               Elle reprend donc toute la largeur, et le relevé du score avec
               elle : c'est le chiffre que le joueur vient voir. */
            .q-tete { flex-direction: column; }

            /* ---- Deux réglages à neutraliser, pour la même raison ----
               Le bloc de titre portait flex: 1 1 320px et une hauteur
               minimale de 118. Les deux visaient la RANGÉE : 320 était une
               largeur de base, et 118 réservait de quoi ne pas voir la page
               sauter quand la description change d'une épreuve à l'autre.

               En colonne, l'axe principal devient la verticale. Ce 320 cesse
               d'être une largeur pour devenir une HAUTEUR DE BASE : le bloc
               s'étirait à 320 px quel que soit son texte, d'où les deux cents
               pixels de vide entre la présentation et le relevé. La hauteur
               minimale, elle, n'a plus d'objet — en une seule colonne, rien
               ne saute puisque rien n'est côte à côte.

               !important sur les deux : elles viennent de styles en ligne, qui
               l'emporteraient sur la requête média. */
            .q-tete-texte {
              flex: 0 0 auto !important;
              min-height: 0 !important;
            }
            .q-tete-cote {
              width: 100%;
              align-items: stretch !important;
            }
            .q-releve { min-width: 0 !important; }

            /* ---- La barre de navigation passe sur deux rangs ----
               Elle en demandait 330 : deux flancs de 34, le réglage de volume
               à 100, et un intitulé de trois lignes au centre. Sur 296, le
               centre était écrasé et le nom de l'épreuve passait à la ligne.

               L'intitulé prend donc le premier rang, sur toute la largeur —
               c'est lui qui dit où l'on est. Les commandes suivent en dessous,
               écartées aux deux bords : les deux flèches tombent alors sous
               les pouces, et le volume reste entre elles.

               Le réordonnancement se fait en CSS : la version bureau garde son
               ordre de lecture, flèche gauche puis titre puis flèche droite,
               qui est aussi celui du DOM et donc celui d'un lecteur d'écran. */
            .q-nav {
              flex-wrap: wrap;
              gap: var(--e3);
              justify-content: space-between;
            }
            .q-nav-titre {
              order: -1;
              flex: 1 1 100%;
            }
            .q-nav-flanc { flex: 0 0 auto; }

            /* Quarante-deux pixels : une cible qu'on atteint sans viser. */
            .q-fleche { width: 42px; height: 42px; }

            /* ---- Le bouton des corrections prend toute la largeur ----
               Il tenait sur une rangée de deux cents pixels sur ordinateur.
               Sur 296, son intitulé daté en capitales espacées en demandait
               plus de trois cents : il sortait de la carte du score, seul
               élément de la page à déborder.

               Il devient donc une LIGNE, comme la carte du score au-dessus de
               lui et comme les épreuves plus bas : intitulé calé à gauche,
               chevron poussé à droite, toute la largeur entre les deux. C'est
               la grammaire du reste de la page en petit format, et la cible
               tactile passe au passage de deux cents pixels à la largeur
               entière.

               L'interlettrage retombe de 0,09 à 0,06 em. Les capitales
               espacées sont faites pour de courtes étiquettes ; sur une ligne
               de vingt-cinq signes, chaque centième d'em coûte deux pixels
               qu'on n'a pas. */
            .q-veille-bouton {
              display: flex;
              width: 100%;
              justify-content: space-between;
              letter-spacing: 0.06em;
            }
          }
        `}</style>

        {/* ---------- Titre, et relevé encadré à droite ---------- */}
        <div className="q-tete" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--e5)', flexWrap: 'wrap' }}>
          <div className="q-tete-texte" style={{ flex: '1 1 320px', minHeight: 118 }}>
            <div className="etiquette-mono">{dateRendezVous}</div>

            {/* ---- LE TITRE NOMME LA PAGE ----
                Un titre-slogan avait été essayé — « Aujourd'hui, ça compte
                pour de bon » — pour prolonger le fil de l'accueil. Il tenait
                sur le fond, mais il faisait deux lignes de trente pixels au-
                dessus d'un bloc déjà dense, et surtout il obligeait le lecteur
                à deviner où il venait d'arriver. Sur une page qu'on rejoint
                souvent par un lien direct, ce n'est pas le moment de faire
                deviner.

                L'expression exacte est celle du title du document et de
                l'openGraph : ce qu'on a lu dans l'onglet ou dans un partage se
                retrouve mot pour mot en haut de la page. « Musical » n'est pas
                un ornement — des défis du jour, il y en a pour les mots
                croisés, la géographie et le code.

                Le récit n'est pas perdu pour autant : il est passé dans la
                phrase juste en dessous, qui dit l'irréversible. Un titre
                situe, une phrase raconte. */}
            <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>
              Le défi musical du jour
            </h1>

            {/* ---- TROIS REGISTRES, COMME SUR L'ACCUEIL ----
                Le sous-titre de la page d'accueil descend en trois marches :
                une phrase en corps de texte, les faits en étiquette mono
                séparés par des points médians, puis le conseil un point plus
                bas. Trois formes parce que ce sont trois fonctions.

                Ici les mêmes trois éléments existaient, mais tous gris, tous
                de même corps : deux paragraphes qu'on lit d'un bloc ou qu'on
                saute d'un bloc. Le visiteur qui vient de l'accueil retrouve
                maintenant la forme qu'il vient de quitter.

                LA PREMIÈRE PHRASE PORTE L'ENJEU, ET RIEN D'AUTRE. Le nombre de
                jeux, la tentative unique, puis la conséquence. « Ce que tu
                joues aujourd'hui ne se rejoue pas » est la ligne la plus dure
                du site, et c'est justement ce qu'on est venu chercher : sans
                elle, le défi n'est qu'un entraînement daté.

                Les faits qui SITUENT — même tirage, échéance, barème —
                descendent en mono. On les balaye au lieu de les lire, ce qui
                est exactement leur usage, et ils cessent de diluer la phrase
                au-dessus d'eux. */}
            <p className="lin" style={{ marginTop: 'var(--e3)', maxWidth: 620, textWrap: 'balance' }}>
              {EPREUVES.length}{' '}jeux, une seule tentative chacun.
              Ce que tu joues aujourd&apos;hui ne se rejoue pas.
            </p>

            {/* ---- POURQUOI CETTE LIGNE N'EST PAS EN MONO CAPITALES ----
                Le mono en capitales est bien la grammaire du site, mais il y
                sert toujours à ÉTIQUETER : nom de section, date d'édition,
                mention de statut. Ce sont des repères, pas des phrases, et on
                les lit d'un coup d'œil sans les parcourir.

                Ces trois faits, eux, sont du CONTENU — le lecteur les lit. Et
                l'étiquette de date, quinze pixels plus haut, emploie déjà
                cette forme : deux lignes mono capitales dans le même bloc,
                dont une seule est vraiment une étiquette. La seconde volait
                donc son autorité à la première.

                Elle reprend la police du texte, un point en dessous du
                paragraphe qui la précède. Ce qui fait le pas de lecture n'est
                pas la police mais les POINTS MÉDIANS : trois membres séparés
                se balayent, une phrase se lit. La descente en trois marches
                est intacte, la troisième a simplement cessé de crier.

                Interligne fixé quand même : c'est ce qui rend la marge écrite
                égale à la marge vue, sans quoi le blanc parasite de la boîte
                s'y ajoute en douce.

                ---- LES ÉCARTS DISENT LES GROUPES, PAS LES LIGNES ----

                Trois blancs égaux donnaient trois paragraphes gris de corps
                voisins, sans rien pour dire lesquels vont ensemble : un mur.
                L'égalité était le défaut, pas le remède.

                Or ces lignes ne sont pas de même rang. La phrase et ces trois
                faits décrivent tous deux le défi du jour — c'est UN groupe,
                et --e2 les tient serrés l'un contre l'autre. Le conseil,
                lui, s'adresse à quelqu'un d'autre et propose d'aller
                ailleurs : --e6 l'en détache franchement.

                Le blanc devient ainsi porteur de sens au lieu d'être une
                simple respiration. C'est la règle de proximité, et elle vaut
                mieux qu'une grille régulière : l'œil regroupe ce qui est
                proche avant de lire quoi que ce soit.

                ---- 620 ET NON 470 ----

                Les 470 étaient calibrés sur l'ancienne rédaction, plus
                courte. Avec le texte actuel ils donnaient cinq lignes dont
                trois cassées à mi-parcours. La colonne peut prendre bien
                davantage : le relevé fait 190 px au minimum plus une
                gouttière, il reste plus de sept cents pixels sur un écran
                courant. À 620, la phrase d'enjeu tient sur un rang, les faits
                aussi, et le conseil sur deux — quatre lignes pleines.

                textWrap balance PLUTÔT QUE pretty sur les deux paragraphes de
                prose. Les deux servent la même cause mais pas de la même
                façon : pretty se contente d'éviter le mot esseulé en dernière
                ligne, balance répartit la matière également sur tous les
                rangs. Sur un bloc de deux lignes, c'est exactement ce qu'on
                veut — et sur une seule, la propriété ne fait rien, donc elle
                ne coûte rien à la phrase qui tient d'un trait.

                Elle sert aussi de filet : si la police rendue est un peu plus
                large que prévu et que la phrase d'enjeu déborde sur un second
                rang, elle se coupera en deux moitiés égales au lieu de laisser
                deux mots tout seuls. */}
            <p style={{
              marginTop: 'var(--e2)', maxWidth: 620,
              fontSize: 13, lineHeight: 1.4,
              color: 'var(--lin)',
            }}>
              Les mêmes jeux pour tous&nbsp;· Jusqu&apos;à minuit&nbsp;· Une note sur {max}
            </p>

            {/* ---- L'ÉCHAPPATOIRE, ET POURQUOI ELLE VIENT EN DERNIER ----
                Elle protège l'expérience : une seule tentative par jeu, et qui
                arrive ici sans rien connaître brûle son essai avant d'avoir
                compris la règle. Mais proposer la sortie avant d'avoir donné
                envie d'entrer, c'est inviter à partir — d'où sa place, sa
                taille et sa pâleur.

                LA LEVÉE DE FREIN EST DEVENUE EXPLICITE. « Où tu peux les
                rejouer sans limite » décrivait l'entraînement ; « ça ne
                consomme aucune tentative » répond à la question que le titre
                vient de poser. C'est la seule inquiétude que le mot
                « irréversible » fait naître, et elle se lève en six mots. */}
            <p style={{
              marginTop: 'var(--e6)', maxWidth: 620, fontSize: 13,
              color: 'var(--lin)', textWrap: 'balance',
            }}>
              Première fois&nbsp;? Passe d&apos;abord
              {' '}<Link href={lienEpreuve(EPREUVES[0].slug)}>à l&apos;entraînement</Link>&nbsp;:
              tout y est illimité, et ça ne consomme aucune tentative.
            </p>
          </div>

          {/* Colonne de droite : le relevé du jour, et sous lui l'accès aux
              corrections de la veille. Les deux appartiennent au même registre
              — ce qu'on a fait, ce qu'on aurait dû faire — et se rangent donc
              ensemble plutôt qu'aux deux extrémités de la page. */}
          <div className="q-tete-cote" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 'var(--e3)', flexShrink: 0,
            /* La colonne prend toute la hauteur du bandeau de titre : c'est
               ce qui permet au bouton d'aller se caler en bas. */
            alignSelf: 'stretch',
          }}>
          {/* Le relevé n'apparaît qu'une fois le défi entamé : au seuil, il
              n'y a rien à relever et un 0,0 encadré serait un faux départ. */}
          {commence && (
            <div className="q-lueur q-releve" style={{
              padding: 'var(--e3) var(--e4)',
              border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
              minWidth: 190, flexShrink: 0,
            }}>
              <div className="etiquette-mono">score cumulé</div>
              <div className="score-affiche" style={{ marginTop: 'var(--e1)', fontSize: 30 }}>
                {total.toFixed(1).replace('.', ',')}{' '}
                <span style={{ color: 'var(--cendre)' }}>/ {max}</span>
              </div>
              <div style={{ height: 3, background: 'var(--filet)', marginTop: 'var(--e3)' }}>
                <div style={{
                  height: '100%', background: 'var(--or)',
                  width: `${(faits.length / EPREUVES.length) * 100}%`,
                  transition: 'width var(--transition-onde)',
                }} />
              </div>
              <div className="description" style={{ marginTop: 'var(--e2)' }}>
                {faits.length} sur {EPREUVES.length} terminées
              </div>
            </div>
          )}

          {/* ================= LES RÉPONSES DE LA VEILLE =================
              Le contrepoids du masquage : la correction n'est pas supprimée,
              elle est différée. Plus personne ne joue ce tirage, il n'y a donc
              plus rien à protéger — et le joueur apprend enfin ce qu'il a raté.

              Affichée après la scène et non à l'ouverture : elle appartient au
              défi d'hier, elle ne doit pas disputer la vedette à celui du jour.

              Rendue seulement si l'archive contient des réponses, ce qui n'est
              le cas qu'après un défi joué un jour précédent. Une épreuve non
              encore migrée n'y figure pas : elle ne transmet pas sa réponse. */}
          {/* ================= LES RÉPONSES DE LA VEILLE =================
              Le contrepoids du masquage : la correction n'est pas supprimée,
              elle est différée. Plus personne ne joue ce tirage, il n'y a donc
              plus rien à protéger — et le joueur apprend enfin ce qu'il a raté.

              Repliée derrière un bouton : elle appartient au défi d'hier et ne
              doit pas disputer la vedette à celui du jour, mais elle reste à
              portée d'un geste plutôt qu'enfouie en bas de page.

              Le survol OUVRE, le clic BASCULE. Le survol seul aurait rendu le
              bloc inaccessible au tactile, où il n'existe pas ; le clic seul
              aurait ignoré le geste naturel à la souris. La règle
              @media (hover: hover) réserve l'ouverture au survol aux appareils
              qui en ont un. */}
          {archive && (
            <section
              className="q-veille-bloc"
              /* Poussé en bas de la colonne plutôt que collé sous le titre.
                 `marginTop: auto` laisse la carte du score en haut si elle
                 existe, et pose le bouton au niveau de la dernière ligne du
                 texte de présentation — là où l'œil arrive en fin de lecture,
                 et non là où il commence. */
              style={{ marginTop: 'auto' }}
            /* Le survol porte sur le BLOC entier, bouton et panneau compris :
               posé sur le seul bouton, le tiroir se refermerait dès qu'on
               tente d'aller lire dedans. */
            onMouseEnter={() => setVeilleSurvolee(true)}
            onMouseLeave={() => setVeilleSurvolee(false)}
            >
              <button
                type="button"
                className="q-veille-bouton"
                aria-expanded={veilleOuverte}
                title={`Corrections du défi du ${dateLisible(archive.jour)}`}
                onClick={() => {
                  /* Bascule franche : on referme aussi l'état de survol, sinon
                     le curseur encore posé sur le bouton rouvrirait aussitôt
                     ce qu'on vient de fermer. */
                  setVeilleEpinglee((v) => !v);
                  setVeilleSurvolee(false);
                }}
              >
                <span>Corrections du {dateCourte(archive.jour)}</span>
                <svg
                  width="12" height="12" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true"
                  style={{
                    transform: veilleOuverte ? 'rotate(180deg)' : 'none',
                    transition: 'transform var(--transition-courte)',
                  }}
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </button>

              {/* grid-template-rows de 0fr à 1fr : la seule façon d'animer une
                  hauteur AUTOMATIQUE. Une max-height chiffrée obligerait à
                  deviner la taille du contenu, et se verrait dès qu'on ajoute
                  une ligne. */}
              <div className="q-veille-tiroir" data-ouvert={veilleOuverte}>
                <div>
                  <div className="q-veille-corps">
                    {/* Une règle se pose, elle ne se plaide pas.

                        L'ancienne phrase parlait de réponses qui circulent et de
                        scores faussés : elle plaçait le lecteur du côté du
                        suspect, et donnait au report l'air d'une précaution
                        défensive plutôt que d'une mécanique du jeu.

                        Celle-ci énonce le principe, puis ce qu'il apporte. */}
                    {/* ---- Deux phrases, deux lignes ----
                        Les deux tenaient dans un même paragraphe et la coupure
                        tombait où la largeur le décidait : « échappé. » restait
                        seul sur un second rang. Un bloc de texte se juge à sa
                        dernière ligne, et deux mots orphelins la font paraître
                        ratée.

                        `balance` n'aurait rien réglé : il égalise des LONGUEURS
                        et aurait coupé au milieu de la seconde phrase, ce qui
                        est un défaut de lecture plus grave qu'un défaut de
                        forme. La seule coupure juste est celle du sens, elle se
                        pose donc à la main.

                        Deux paragraphes plutôt qu'un <br /> : sur un écran
                        étroit, chacun se replie pour son propre compte au lieu
                        de traîner une coupure forcée qui n'a plus lieu d'être.
                        43 signes puis 52 : la seconde ligne est la plus longue,
                        ce qui pose le bloc au lieu de le laisser en suspens. */}
                    <p className="description" style={{ maxWidth: 520, textWrap: 'pretty' }}>
                      Chaque défi livre ses réponses le lendemain.
                    </p>
                    <p className="description" style={{ maxWidth: 520, marginBottom: 'var(--e4)', textWrap: 'pretty' }}>
                      Voici celles d&apos;hier, de quoi voir ce qui t&apos;a échappé.
                    </p>

                    <div className="q-veille">
                      {/* La CORRECTION seule, sans le score obtenu.

                          Le score est personnel : il n'existe que dans ce
                          navigateur, et un joueur en navigation privée, sur un
                          autre appareil ou après un nettoyage de cache ne le
                          retrouverait pas. Afficher un tiret à sa place aurait
                          fait passer une limite d'architecture pour une panne.
                          La réponse, elle, est la même pour tout le monde. */}
                      {EPREUVES.filter((e) => correctionDe(archive, e)).map((e) => (
                        <div key={e.slug} className="q-veille-item">
                          <span className="q-veille-num">{e.num}</span>
                          <span className="q-veille-nom">{e.court}</span>
                          <span className="q-veille-rep">{correctionDe(archive, e)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          </div>
        </div>

        {/* ---------- L'onde ---------- */}
        <div className="q-onde" style={{ marginTop: 'var(--e5)' }}>
          {/* `complete` étale la lumière sur toute la longueur : pendant le
              défi elle désigne l'épreuve en cours, au relevé il n'y a plus
              d'épreuve courante — c'est l'ensemble qui est achevé. */}
          <Onde
            variante="bandeau"
            sections={EPREUVES.length}
            active={commence && ondeAllumee ? index : null}
            complete={releveFinal}
          />
        </div>

        {/* ================= LE SEUIL =================
            Affiché tant qu'aucune épreuve n'a été entamée. Un clic pour
            entrer : c'est peu, et ça lève toute ambiguïté sur ce qui suit. */}
        {auSeuil && (
          /* `q-lueur` : le même halo que la scène du jeu et la carte du score.
             Le seuil est le seul bloc encadré d'or de la page à ne pas
             l'avoir, alors qu'il en est le point d'entrée. */
          <div className="q-seuil q-lueur" style={{
            marginTop: 'var(--e6)', padding: 'var(--e7) var(--e5)',
            border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
            textAlign: 'center',
          }}>
            <div className="etiquette-mono">défi du jour</div>

            {/* La date EST le titre de l'édition, et elle porte donc la
                typographie des titres de page : Geist Sans, 500, interlettrage
                serré.

                Elle était en Instrument Serif. Le document de design réserve
                cette police au monogramme, aux chiffres romains et aux
                citations — trois emplois brefs et ornementaux. Une date
                française complète y devenait un corps étranger : aucune autre
                page du site ne fait parler le serif aussi longuement.

                Taille fluide malgré tout : « 12 septembre 2026 » fait le
                double de « 2 mai 2026 » et ne doit pas se casser en deux
                lignes sur un petit écran. */}
            <div style={{
              fontFamily: 'var(--sans)',
              fontSize: 'clamp(26px, 5vw, 38px)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginTop: 'var(--e2)',
              color: 'var(--ivoire)',
            }}>
              {dateDuJour}
            </div>

            {/* Emplacement RÉSERVÉ, rendu même vide.

                L'échéance n'existe qu'après le montage — l'heure locale ne
                s'hydrate pas. Rendue conditionnellement, elle apparaîtrait
                comme un enfant de plus et décalerait la position de tous ses
                voisins, donc leurs délais d'entrée : la cascade se rejouerait
                sous les yeux du joueur. La hauteur minimale évite en prime que
                le bloc saute quand la valeur arrive. */}
            <div className="description" style={{ marginTop: 'var(--e2)', minHeight: '1.4em' }}>
              {restant ? `il reste ${restant}` : ''}
            </div>

            {/* « Joueurs » et non « candidats ». Le second appartient au
                registre de l'examen, celui que le site a méthodiquement quitté
                — la baseline est passée d'« évaluation auditive » à « dix jeux
                d'oreille », et le titre de l'accueil ne mesure plus, il fait
                découvrir. Un mot d'examen à l'entrée du défi rouvre seul le
                frein que tout le reste de la page lève. */}
            <p style={{ fontSize: 14, marginTop: 'var(--e5)', maxWidth: 460, marginInline: 'auto' }}>
              {EPREUVES.length}{' '}jeux à la suite, une tentative chacun. Le tirage est le
              même pour tous les joueurs du jour, et il change à minuit.
            </p>

            {/* ---------- Le programme ----------
                On annonce d'avance ce qu'on signe.

                Chaque épreuve reprend la forme des colonnes de l'accueil et
                des onglets du carrousel : filet supérieur, numéro en mono
                cendre, intitulé au-dessous. Cette forme est déjà celle par
                laquelle le site nomme ses épreuves — la reprendre ici les rend
                reconnaissables au lieu d'en faire une liste de plus.

                Les intitulés passent en ivoire et gagnent un demi-point : ils
                étaient en lin sur 12 px, ce qui les faisait lire comme une
                mention accessoire alors qu'ils sont le contenu du bloc. */}
            <div className="q-sommaire" style={{
              marginTop: 'var(--e6)', paddingTop: 'var(--e5)',
              borderTop: '0.5px solid var(--filet)',
            }}>
              {EPREUVES.map((x) => (
                <div key={x.slug} className="q-sommaire-item">
                  {/* Numéros en or : ils balisent le parcours, et le cendre
                      les rendait presque illisibles — 2,6 pour 1 sur noir,
                      un contraste que la direction de design réserve aux
                      mentions dont on peut se passer. L'or reste la seule
                      couleur d'accent du site, on ne fait qu'y recourir. */}
                  <div className="mono" style={{
                    fontSize: 10, letterSpacing: '0.09em', color: 'var(--or)',
                  }}>
                    {x.num}
                  </div>
                  <div style={{
                    fontSize: 12.5, marginTop: 3, lineHeight: 1.3, color: 'var(--ivoire)',
                  }}>
                    {x.court}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={demarrer}
              style={{
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                padding: '11px 22px', borderRadius: 'var(--rayon-controle)',
                marginTop: 'var(--e7)', cursor: 'pointer',
                background: 'var(--or)', color: 'var(--noir)', border: '1px solid var(--or)',
                transition: 'background var(--transition-courte)',
              }}
            >
              Commencer le défi
            </button>

            <p className="description" style={{ marginTop: 'var(--e4)' }}>
              Pas encore prêt ?{' '}
              <Link href={lienEpreuve(EPREUVES[0].slug)}>Passe à l&apos;entraînement</Link>,
              sans limite de tentatives.
            </p>
          </div>
        )}

        {!pret && (
          <p className="lin" style={{ fontSize: 13, marginTop: 'var(--e6)' }}>Chargement du défi…</p>
        )}

        {/* ================= LE DÉFI ================= */}
        {pret && commence && (
          <>
            {/* Progression et navigation disparaissent avec le plateau : une
                fois le relevé posé, il n'y a plus rien à parcourir, et laisser
                des commandes inertes à l'écran donne l'impression d'un état
                inachevé. */}
            {!releveFinal && (<>
            {/* ---------- La progression ----------
                Un segment par épreuve, colorié INDÉPENDAMMENT selon qu'elle
                est faite ou non : sauter la 02 pour aller à la 05 laisse la
                02 éteinte, donc visible comme manquante. Le curseur clair
                dit seulement où l'on se trouve, il ne prétend pas que le
                trajet derrière lui est accompli. */}
            <nav
              className="q-segments"
              aria-label={`Progression dans les ${EPREUVES.length} jeux du défi`}
              style={{ marginTop: 'var(--e6)' }}
            >
              <div className="q-segments-grille">
                {EPREUVES.map((x, k) => {
                  const fait = scores[x.slug] !== null;
                  return (
                    <button
                      key={x.slug}
                      onClick={() => aller(k)}
                      className="q-segment"
                      aria-current={k === index ? 'step' : undefined}
                      aria-label={`Épreuve ${x.num}, ${x.nom}${fait ? `, terminée` : ', à faire'}`}
                      title={`${x.num} · ${x.nom}${fait
                        ? ` — ${scores[x.slug].toFixed(1).replace('.', ',')} / 10`
                        : ' — pas encore faite'}`}
                      style={{ background: fait ? 'var(--or)' : 'var(--filet)' }}
                    />
                  );
                })}
              </div>

              {/* Curseur de l'épreuve affichée : glisse d'un segment à
                  l'autre. Largeur et pas calculés à partir du même écart que
                  la grille, ils ne peuvent donc pas se désaligner. */}
              <div
                aria-hidden="true"
                className="q-curseur"
                style={{
                  width: `calc((100% - ${(EPREUVES.length - 1) * ECART_SEGMENT}px) / ${EPREUVES.length})`,
                  transform: `translateX(calc(${index} * (100% + ${ECART_SEGMENT}px)))`,
                }}
              />
            </nav>

            {/* ---------- Navigation entre épreuves ----------
                Flèches aux extrémités, intitulé au centre. C'est ici que le
                mode se rappelle : « tentative unique » sous le nom de
                l'épreuve, là où l'accès libre propose « Relancer l'épreuve ».
                Un même emplacement, deux messages opposés. */}
            <div className="q-nav" style={{ marginBottom: 'var(--e5)' }}>
              <div className="q-nav-flanc">
                <button
                  onClick={() => aller(index - 1)}
                  disabled={!peutPrecedent}
                  className={fleche(peutPrecedent)}
                  aria-label="Épreuve précédente"
                >
                  {SVG_GAUCHE}
                </button>
                <VolumeControl compact />
              </div>

              <div className="q-nav-titre" style={{ textAlign: 'center', flexShrink: 0 }}>
                <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
                  jeu {epreuve.num} / {EPREUVES.length}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{epreuve.nom}</div>
                <div className="etiquette-mono" style={{ marginTop: 4 }}>
                  {scoreActif !== null ? 'tentative utilisée' : 'tentative unique'}
                </div>
              </div>

              <div className="q-nav-flanc" style={{ justifyContent: 'flex-end' }}>
                <button
                  onClick={() => aller(index + 1)}
                  disabled={!peutSuivant}
                  className={fleche(peutSuivant)}
                  aria-label="Épreuve suivante"
                >
                  {SVG_DROITE}
                </button>
              </div>
            </div>
            </>)}

            {/* ---------- L'épreuve ----------
                overflowX clip et non hidden : les listes déroulantes des jeux
                débordent vers le bas et doivent rester visibles. */}
            <div
              className="q-scene"
              /* En capture : certains jeux arrêtent la propagation de leurs
                 propres gestes, un écouteur en phase de bouillonnement les
                 raterait. */
              onPointerDownCapture={marquerEntamee}
              onKeyDownCapture={marquerEntamee}
              style={{
                /* clip et non hidden : les listes déroulantes des jeux
                   débordent vers le bas et doivent rester visibles. C'est la
                   seule combinaison qui laisse l'axe vertical en `visible`
                   tout en bornant l'horizontal pendant le glissement. */
                overflowX: 'clip',
                overflowY: 'visible',
                height: hauteur ?? undefined,
                /* Pendant le défi, la barre de navigation sépare l'onde du
                   plateau. Une fois le relevé posé elle disparaît, et les deux
                   se retrouvaient collés.

                   34 px : c'est le premier jeton de l'échelle qui dépasse le
                   rayon du halo — 26 px — donc le plus court qui empêche la
                   lumière du cadre de venir toucher l'onde. En dessous, les
                   deux se remettraient à se chevaucher. */
                marginTop: releveFinal ? 'var(--e7)' : undefined,
              }}
            >
              <div ref={contenuRef} style={{ animation: `${nomAnim} 300ms cubic-bezier(0.4, 0, 0.2, 1) both` }}>

                {/* ---------- Relevé final ----------
                    Il REMPLACE le plateau au lieu de s'ajouter dessous : à ce
                    stade il est le contenu de la page. Le cadre garde son
                    filet et son halo, et la hauteur glisse d'elle-même —
                    l'observateur de taille s'en charge. */}
                {releveFinal && (
                  <div className="q-final">
                    <div className="etiquette-mono">
                      défi du {dateDuJour} · terminé
                    </div>

                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 56, fontWeight: 500,
                      lineHeight: 1.05, marginTop: 'var(--e3)', color: 'var(--or)',
                      animation: 'qFinalNote 520ms 200ms cubic-bezier(0.34, 1.4, 0.64, 1) both',
                    }}>
                      {total.toFixed(1).replace('.', ',')}{' '}
                      <span style={{ color: 'var(--cendre)' }}>/ {max}</span>
                    </div>

                    <div className="description" style={{
                      marginTop: 'var(--e2)',
                      animation: 'qFinalEntree 380ms 520ms ease-out both',
                    }}>
                      soit {(total / EPREUVES.length).toFixed(1).replace('.', ',')} sur 10 en moyenne
                    </div>

                    {/* Le détail, épreuve par épreuve.

                        La ligne de carrés colorés que le partage produit ne
                        dit rien à l'écran : on ne sait ni quelle case
                        correspond à quelle épreuve, ni ce que vaut un marron.
                        Elle reste dans le texte copié, où elle a un sens —
                        ici on nomme, on chiffre, on mesure.

                        Couleurs : la convention du site, celle de ScoreBox —
                        jade au-dessus de 9,5, carmin en dessous de 4, ivoire
                        entre les deux. Le carmin et le jade annoncent un
                        résultat, ils ne décorent rien. */}
                    <div className="q-detail" style={{
                      marginTop: 'var(--e6)', paddingTop: 'var(--e5)',
                      borderTop: '0.5px solid var(--filet)',
                    }}>
                      {EPREUVES.map((e, i) => {
                        const note = scores[e.slug] ?? 0;
                        const couleur = note >= 9.5 ? 'var(--jade)'
                          : note < 4 ? 'var(--carmin)'
                          : 'var(--ivoire)';
                        // Les lignes se posent l'une après l'autre : on suit
                        // le relevé au lieu de recevoir un pavé.
                        const retard = 700 + i * 90;
                        return (
                          <Fragment key={e.slug}>
                            <span className="mono" style={{
                              fontSize: 10, letterSpacing: '0.06em', color: 'var(--cendre)',
                              animation: `qFinalEntree 320ms ${retard}ms ease-out both`,
                            }}>
                              {e.num}
                            </span>

                            <span style={{
                              fontSize: 13, color: 'var(--lin)', minWidth: 0,
                              animation: `qFinalEntree 320ms ${retard}ms ease-out both`,
                            }}>
                              {e.court}
                              <span className="q-jauge" style={{ marginTop: 5 }}>
                                <span style={{
                                  width: `${Math.max(0, Math.min(10, note)) * 10}%`,
                                  animation: `qJaugeRemplit 560ms ${retard + 120}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                }} />
                              </span>
                            </span>

                            <span style={{
                              fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 500,
                              color: couleur, whiteSpace: 'nowrap',
                              animation: `qFinalEntree 320ms ${retard}ms ease-out both`,
                            }}>
                              {/* Largeur fixe de quatre caractères, calée à
                                  droite : « 10,0 » en occupe quatre, « 1,3 »
                                  seulement trois, et le « / 10 » se décalait
                                  d'une colonne d'une ligne à l'autre. L'unité
                                  ch vaut la chasse du zéro, donc exactement
                                  celle de tous les glyphes en fonte mono. */}
                              <span style={{
                                display: 'inline-block',
                                width: '4ch',
                                textAlign: 'right',
                              }}>
                                {note.toFixed(1).replace('.', ',')}
                              </span>
                              <span style={{ color: 'var(--cendre)' }}> / 10</span>
                            </span>
                          </Fragment>
                        );
                      })}
                    </div>

                    <button
                      onClick={partager}
                      style={{
                        fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                        padding: '11px 22px', borderRadius: 'var(--rayon-controle)',
                        marginTop: 'var(--e7)', cursor: 'pointer',
                        background: 'var(--or)', color: 'var(--noir)',
                        border: '1px solid var(--or)',
                        transition: 'background var(--transition-courte)',
                        animation: `qFinalEntree 380ms ${700 + EPREUVES.length * 90 + 200}ms ease-out both`,
                      }}
                    >
                      {copie ? 'Copié dans le presse-papiers' : 'Copier mon relevé'}
                    </button>

                    {restant && (
                      <div className="description" style={{
                        marginTop: 'var(--e4)',
                        animation: `qFinalEntree 380ms ${700 + EPREUVES.length * 90 + 320}ms ease-out both`,
                      }}>
                        Prochain défi dans {restant}.
                      </div>
                    )}
                  </div>
                )}

                {!releveFinal && EPREUVES.map((x, k) => {
                  const visible = k === index;
                  /* Deux origines, un seul état : reprise du stockage, ou
                     jouée puis quittée dans cette session. */
                  const verrouillee = restaureesRef.current.has(x.slug) || verrous.has(x.slug);

                  /* Tentative consommée : le composant n'est pas remonté, on
                     affiche le relevé à sa place. */
                  if (verrouillee) {
                    if (!visible) return null;
                    return (
                      <div key={x.slug} style={{
                        padding: 'var(--e7) var(--e5)', textAlign: 'center',
                        border: '0.5px solid var(--filet)', borderRadius: 'var(--rayon-carte)',
                        background: 'var(--onyx)',
                      }}>
                        <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
                          jeu terminé
                        </div>
                        <div className="score-affiche" style={{ marginTop: 'var(--e3)', fontSize: 32 }}>
                          {scores[x.slug].toFixed(1).replace('.', ',')}{' '}
                          <span style={{ color: 'var(--cendre)' }}>/ 10</span>
                        </div>
                        <p className="description" style={{ marginTop: 'var(--e3)' }}>
                          Le défi du jour n&apos;accorde qu&apos;une tentative.
                        </p>
                        {/* La correction est différée, pas supprimée. Le dire ici
                            autant qu'à la fin de l'épreuve : c'est ce panneau qu'on
                            revoit en revenant dessus, et un joueur qui n'aurait lu
                            le message qu'une fois croirait la réponse perdue. */}
                        <p className="description" style={{ marginTop: 'var(--e2)' }}>
                          La correction sera donnée demain, avec le prochain défi.
                        </p>
                        <p className="description" style={{ marginTop: 'var(--e2)' }}>
                          Sans attendre, tu peux rejouer {x.nom.toLowerCase()}{' '}
                          <Link href={lienEpreuve(x.slug)}>à l&apos;entraînement</Link>.
                        </p>
                      </div>
                    );
                  }

                  const nbVisites = visites[x.slug] ?? 0;
                  if (nbVisites === 0) return null;

                  /* Une épreuve masquée est démontée TANT QU'ELLE N'EST PAS
                     ENTAMÉE.

                     Démontée : rien ne tourne derrière — ni minuteur, ni
                     requête, ni audio. C'est ce qui faisait jouer les notes de
                     l'intro d'Accords par-dessus l'épreuve suivante.

                     Entamée : on la garde, sinon la progression serait perdue
                     et la tentative unique contournable. Son extrait, lui, est
                     coupé par le contexte de visibilité ci-dessous. */
                  const entamee = entamees.has(x.slug);
                  if (!visible && !entamee) return null;

                  const Jeu = jeuDuSlug(x.slug);
                  if (!Jeu) return null;

                  /* La clé porte le numéro de visite : tant que l'épreuve
                     n'est pas entamée, y revenir la remonte, ce qui rejoue son
                     intro. Le compteur cesse d'avancer au premier geste, la
                     clé se fige, et le composant survit aux allers-retours.
                     L'enveloppe garde une clé stable pour que React ne recrée
                     pas le nœud à chaque fois. */
                  return (
                    <div key={x.slug} style={{ display: visible ? 'block' : 'none' }}>
                      <ContexteEpreuveVisible.Provider value={visible}>
                        {/* revelation={false} : l'épreuve tait sa réponse. La
                          page ne peut pas le faire à sa place — chacune la
                          dévoile à sa manière, un flou qui tombe, un nom qui
                          s'inscrit, une portée qui se complète. Les jeux non
                          encore migrés ignorent la prop et se comportent comme
                          avant. */}
                      <Jeu
                        key={`${x.slug}|${nbVisites}`}
                        daily
                        revelation={false}
                        onDone={report(x.slug)}
                      />
                      </ContexteEpreuveVisible.Provider>
                    </div>
                  );
                })}
              </div>
            </div>

            </>
        )}

        <PiedDePage />
      </main>
    </>
  );
}
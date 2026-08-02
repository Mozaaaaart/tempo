'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Onde from '@/components/Onde';
import VolumeControl from '@/components/VolumeControl';
import EnTete from '@/components/EnTete';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';
import { jeuDuSlug } from '@/components/registreJeux';
import { ContexteEpreuveVisible } from '@/components/ContexteEpreuveVisible';
import { TODAY, setSeedSalt } from '@/components/dailyGames';

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
function lireRun() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return { scores: {}, commence: false };
    const donnees = JSON.parse(brut);
    if (!donnees || donnees.jour !== TODAY) return { scores: {}, commence: false };
    const scores = {};
    for (const e of EPREUVES) {
      const v = donnees.scores?.[e.slug];
      if (typeof v === 'number' && Number.isFinite(v)) scores[e.slug] = v;
    }
    return { scores, commence: donnees.commence === true || Object.keys(scores).length > 0 };
  } catch {
    return { scores: {}, commence: false };
  }
}

function ecrireRun(scores, commence) {
  try {
    const utiles = {};
    for (const [k, v] of Object.entries(scores)) if (v !== null) utiles[k] = v;
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ jour: TODAY, commence, scores: utiles }));
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

function dateLisible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return iso;
  const jour = Number(m[3]);
  return `${jour === 1 ? '1er' : jour} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
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

export default function Quotidien() {
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
  const dateDuJour = dateLisible(TODAY);
  const restant = resteLisible(reste);
  const expire = reste !== null && reste <= 0;

  /* ---------- Reprise ---------- */
  useEffect(() => {
    const { scores: repris, commence: dejaCommence } = lireRun();
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

  /* ---------- Compte à rebours ----------
     Quinze secondes suffisent : l'affichage est à la minute. */
  useEffect(() => {
    setReste(msAvantMinuit());
    const t = setInterval(() => setReste(msAvantMinuit()), 15000);
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
    ecrireRun(scores, true);
  }

  function report(slug) {
    return (s) => {
      setScores((prev) => {
        // Une tentative : le premier score fait foi. Certains jeux appellent
        // onDone plusieurs fois en fin de séquence.
        if (prev[slug] !== null) return prev;
        const suite = { ...prev, [slug]: s };
        ecrireRun(suite, true);
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
    const moyenne = (total / EPREUVES.length).toFixed(1).replace('.', ',');

    const lignes = EPREUVES.map((e) => {
      const note = scores[e.slug] ?? 0;
      return `${carre(note)} ${e.num} ${e.court} — ${note.toFixed(1).replace('.', ',')}`;
    });

    return [
      '♪ MOZART BENCHMARK',
      `Défi du ${dateDuJour}`,
      '',
      `${total.toFixed(1).replace('.', ',')} / ${max}  ·  moyenne ${moyenne} / 10`,
      '',
      ...lignes,
      '',
      'Une tentative par épreuve, le même défi pour tout le monde',
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
  const fleche = (dispo) => ({
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, background: 'transparent',
    color: dispo ? 'var(--or)' : 'var(--cendre)',
    border: `1px solid ${dispo ? 'var(--or)' : 'var(--filet)'}`,
    boxShadow: dispo ? '0 0 16px rgba(239, 159, 39, 0.6)' : 'none',
    cursor: dispo ? 'pointer' : 'not-allowed', flexShrink: 0,
    transition: 'color var(--transition-courte), border-color var(--transition-courte), background var(--transition-courte), box-shadow var(--transition-courte)',
  });

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
        liens={[{ href: lienEpreuve(EPREUVES[0].slug), libelle: 'accès libre' }]}
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
              <span className="q-jeton-fort" style={{ color: 'var(--or)' }}>
                nouveau défi — recharge la page
              </span>
            ) : restant ? (
              <>il reste <span className="q-jeton-fort">{restant}</span></>
            ) : null}
          </span>
        }
      >
        <span className="entete-sep entete-repli" aria-hidden="true" />

        {/* Seul élément en or plein de la page. */}
        <span className="q-puce">défi du jour</span>

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
          /* La seule surface or de la page, et elle tient en trois mots. */
          .q-puce {
            font-family: var(--mono);
            font-size: 10px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            font-weight: 500;
            white-space: nowrap;
            background: var(--or);
            color: var(--noir);
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
          .q-lueur { box-shadow: 0 0 26px rgba(239, 159, 39, 0.6); }

          .q-scene {
            border-radius: var(--rayon-carte);
            box-shadow:
              0 0 0 1px var(--or),
              0 0 26px rgba(239, 159, 39, 0.6);
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
          .q-sommaire-item {
            padding-top: var(--e2);
            border-top: 0.5px solid var(--filet);
            transition: border-color var(--transition-courte);
          }
          .q-sommaire-item:hover { border-top-color: var(--or); }

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

          @media (max-width: 640px) {
            .q-sommaire { grid-template-columns: repeat(2, 1fr); }
          }
        `}</style>

        {/* ---------- Titre, et relevé encadré à droite ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--e5)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minHeight: 118 }}>
            <div className="etiquette-mono">{dateDuJour}</div>
            <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>
              Le défi du jour
            </h1>
            <p className="lin" style={{ marginTop: 'var(--e2)', maxWidth: 470 }}>
              {EPREUVES.length}{' '}épreuves, une seule tentative chacune, les mêmes pour tout le
              monde jusqu&apos;à minuit. Pour t&apos;entraîner sans limite, elles sont aussi
              jouables{' '}<Link href={lienEpreuve(EPREUVES[0].slug)}>en accès libre</Link>.
            </p>
          </div>

          {/* Le relevé n'apparaît qu'une fois le défi entamé : au seuil, il
              n'y a rien à relever et un 0,0 encadré serait un faux départ. */}
          {commence && (
            <div className="q-lueur" style={{
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
        </div>

        {/* ---------- L'onde ---------- */}
        <div style={{ marginTop: 'var(--e5)' }}>
          {/* `complete` étale la lumière sur toute la longueur : pendant le
              défi elle désigne l'épreuve en cours, au relevé il n'y a plus
              d'épreuve courante — c'est l'ensemble qui est achevé. */}
          <Onde
            variante="bandeau"
            sections={EPREUVES.length}
            active={commence ? index : null}
            complete={releveFinal}
          />
        </div>

        {/* ================= LE SEUIL =================
            Affiché tant qu'aucune épreuve n'a été entamée. Un clic pour
            entrer : c'est peu, et ça lève toute ambiguïté sur ce qui suit. */}
        {auSeuil && (
          <div className="q-seuil" style={{
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

            <p style={{ fontSize: 14, marginTop: 'var(--e5)', maxWidth: 460, marginInline: 'auto' }}>
              {EPREUVES.length}{' '}épreuves à la suite, une tentative chacune. Le tirage est le
              même pour tous les candidats du jour, et il change à minuit.
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
                  <div className="mono" style={{
                    fontSize: 10, letterSpacing: '0.09em', color: 'var(--cendre)',
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
              <Link href={lienEpreuve(EPREUVES[0].slug)}>Entraîne-toi en accès libre</Link>,
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
              aria-label={`Progression dans les ${EPREUVES.length} épreuves du défi`}
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
                  style={fleche(peutPrecedent)}
                  aria-label="Épreuve précédente"
                  onMouseEnter={(ev) => { if (peutPrecedent) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = peutPrecedent ? 'var(--or)' : 'var(--cendre)'; }}
                >
                  {SVG_GAUCHE}
                </button>
                <VolumeControl compact />
              </div>

              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
                  épreuve {epreuve.num} / {EPREUVES.length}
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
                  style={fleche(peutSuivant)}
                  aria-label="Épreuve suivante"
                  onMouseEnter={(ev) => { if (peutSuivant) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = peutSuivant ? 'var(--or)' : 'var(--cendre)'; }}
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
                          épreuve terminée
                        </div>
                        <div className="score-affiche" style={{ marginTop: 'var(--e3)', fontSize: 32 }}>
                          {scores[x.slug].toFixed(1).replace('.', ',')}{' '}
                          <span style={{ color: 'var(--cendre)' }}>/ 10</span>
                        </div>
                        <p className="description" style={{ marginTop: 'var(--e3)' }}>
                          Le défi du jour n&apos;accorde qu&apos;une tentative. Reviens demain, ou
                          rejoue {x.nom.toLowerCase()}{' '}
                          <Link href={lienEpreuve(x.slug)}>en accès libre</Link>.
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
                        <Jeu key={`${x.slug}|${nbVisites}`} daily onDone={report(x.slug)} />
                      </ContexteEpreuveVisible.Provider>
                    </div>
                  );
                })}
              </div>
            </div>

            </>
        )}

        <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
          Nouveau défi chaque jour à minuit. ·{' '}
          <Link href="/" style={{ color: 'var(--cendre)' }}>accueil</Link>
        </footer>
      </main>
    </>
  );
}
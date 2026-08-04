'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Onde from '@/components/Onde';
import { EPREUVES } from '@/data/epreuves';
import { EpreuveContext } from '@/components/EpreuveContext';
import VolumeControl from '@/components/VolumeControl';
import EnTete from '@/components/EnTete';

/**
 * Enveloppe des dix épreuves.
 *
 * Tout l'intérêt de ce fichier tient en une propriété de l'App Router : Next
 * conserve l'INSTANCE du layout quand on navigue entre deux routes sœurs
 * (/epreuves/pochette → /epreuves/tempo). L'<Onde> n'est donc jamais
 * démontée : sa boucle requestAnimationFrame continue de tourner et sa
 * lumière glisse d'une section à l'autre, exactement comme quand tout tenait
 * dans une seule page. Seul le contenu de {children} est remplacé.
 *
 * Corollaire : toute navigation interne DOIT passer par <Link> ou
 * router.push(). Un simple <a href> déclencherait un rechargement complet,
 * remonterait l'onde et casserait l'animation.
 */

/**
 * La carte du défi, rendue DEUX FOIS dans la page : une fois à droite du
 * titre, une fois en bas. Une seule des deux est visible à la fois, la
 * requête média décide laquelle.
 *
 * Pourquoi deux exemplaires plutôt qu'un déplacé par `order` : sur
 * ordinateur la carte est le VOISIN du titre, à l'intérieur d'une rangée ;
 * sur mobile elle est le dernier bloc de la page, hors de cette rangée. Les
 * deux ne sont pas au même niveau de l'arbre, et `order` ne déplace un
 * élément qu'entre frères. Un composant local évite de recopier le balisage.
 *
 * Sa position en bas de page n'est pas un repli faute de place : c'est le
 * même parcours que sur l'accueil — on s'entraîne d'abord, on se mesure
 * ensuite. Une carte dorée posée avant le jeu propose de partir ailleurs à
 * quelqu'un qui vient d'arriver.
 */
function CarteDefi({ variante }) {
  const bureau = variante === 'bureau';
  return (
    <Link
      href="/quotidien"
      className={bureau ? 'carte-defi carte-defi-bureau' : 'carte-defi carte-defi-mobile'}
    >
      {/* Le corps est une rangée sous 640 px : le texte d'un côté, la flèche
          de l'autre, calée à droite et centrée en hauteur.

          Avant, la flèche terminait la phrase. Sur une carte pleine largeur
          le texte tenait sur deux lignes et la flèche se retrouvait seule sur
          la seconde, sous un mot, pointant vers le vide. Une flèche isolée ne
          se lit plus comme la fin d'une phrase mais comme un élément oublié.

          Sortie du flux, elle redevient ce qu'elle est : le repère d'un lien
          qui mène ailleurs. Et le texte peut alors passer à la ligne sans que
          ce soit un défaut. */}
      <div className="carte-defi-corps">
        <div>
          <div className="etiquette-mono">défi du jour</div>
          <p style={{ fontSize: 13, marginTop: 'var(--e1)' }}>
            <span className="carte-defi-long">
              Dix épreuves, une tentative chacune, les mêmes pour tous →
            </span>
            <span className="carte-defi-court">
              Dix épreuves, une tentative chacune.
            </span>
          </p>
        </div>
        <span className="carte-defi-fleche" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

/* Temps mort après une relance, en ms. Voir le commentaire dans le composant :
   c'est l'ordre de grandeur d'un chargement de manche, pas une valeur de
   confort. */
const DELAI_RELANCE = 2500;

export default function EpreuvesLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  // /epreuves/pochette → 'pochette'
  const slug = pathname.split('/')[2] ?? '';
  const trouve = EPREUVES.findIndex((x) => x.slug === slug);
  const index = trouve < 0 ? 0 : trouve;
  const e = EPREUVES[index];

  // Direction du glissement, calculée PENDANT le rendu et non dans un effet :
  // un useEffect s'exécuterait après la première image du nouveau contenu,
  // qui partirait donc du mauvais côté le temps d'une frame.
  const precRef = useRef(index);
  const dirRef = useRef(1);
  if (precRef.current !== index) {
    dirRef.current = index > precRef.current ? 1 : -1;
    precRef.current = index;
  }

  // Position de la lumière sur l'onde.
  // Premier chargement (arrivée directe par URL, pub, moteur de recherche) :
  // la lumière part de la première section et glisse jusqu'à la bonne, comme
  // le faisait l'ancien ?e=N. Ensuite, elle suit la navigation immédiatement,
  // l'inertie de l'onde se chargeant du reste.
  const [ondeIndex, setOndeIndex] = useState(0);
  const premierRef = useRef(true);

  /* L'onde ne s'ALLUME qu'une fois DÉROULÉE.

     Le tracé se découvre de gauche à droite entre 120 et 1020 ms, pendant que
     la lumière de la section active montait de son côté dès la première
     image. Les deux mouvements se superposaient : on voyait apparaître une
     onde déjà allumée, ce qui annulait l'effet de dévoilement.

     `active={null}` maintient l'opacité de la lumière à zéro. On la libère à
     la fin du déroulé, et la relaxation interne de l'onde fait le reste — la
     lumière monte d'elle-même, sans transition à écrire.

     Ne joue qu'au premier montage : le layout n'étant jamais démonté, changer
     d'épreuve ne rejoue ni le déroulé ni l'allumage. */
  const [ondeAllumee, setOndeAllumee] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOndeAllumee(true), 1120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (premierRef.current) {
      premierRef.current = false;
      if (index === 0) return;
      const t = setTimeout(() => setOndeIndex(index), 450);
      return () => clearTimeout(t);
    }
    setOndeIndex(index);
  }, [index]);

  /* ---- Recentrage du carrousel ----
   *
   * Sous 640 px, les dix onglets ne tiennent plus côte à côte : la grille
   * devient une bande qui défile horizontalement. Il faut alors amener
   * l'onglet courant sous les yeux, sinon on arrive sur « Refrain » avec la
   * bande calée sur « Accords », et rien ne dit qu'on est au bout.
   *
   * scrollTo sur le CONTENEUR, et non scrollIntoView sur l'onglet :
   * scrollIntoView remonte toute la chaîne des ancêtres défilables et fait
   * bouger la page verticalement au passage — exactement ce que scroll:false
   * sur les <Link> cherche à éviter.
   *
   * Premier rendu sans animation : on ne fait pas glisser une bande vers une
   * position que le visiteur n'a jamais vue bouger.
   */
  const railRef = useRef(null);
  const railPremierRef = useRef(true);

  /* ---- Où la lumière doit-elle tomber ----
   *
   * L'onde découpe sa largeur en dix sections et allume la n-ième. Tant que
   * les dix onglets occupaient dix colonnes égales sous elle, l'onglet actif
   * et la section allumée étaient au même endroit par construction.
   *
   * La bande qui défile rompt cette correspondance : elle CENTRE l'épreuve
   * courante, pendant que l'onde continue d'éclairer le quatrième dixième de
   * sa largeur. Les deux ne parlent plus du même repère, et la lumière tombe
   * visiblement à côté de l'onglet qu'elle est censée désigner.
   *
   * On mesure donc la position réelle de l'onglet à l'écran, et on la traduit
   * en indice de section. La section k étant centrée à (k + 0,5) / sections
   * de la largeur, une lumière en fraction f demande k = f × sections − 0,5.
   * Les valeurs fractionnaires sont admises : l'onde interpole entre deux
   * centres de section.
   *
   * Mesurer plutôt que forcer le centre a un avantage qu'on ne voit qu'aux
   * extrémités : sur la première et la dernière épreuve, la bande bute et
   * l'onglet n'est PAS au milieu. Une lumière figée au centre serait alors
   * fausse à son tour.
   *
   * Effet de bord bienvenu : la mesure suit aussi le défilement au doigt. La
   * lumière glisse sous les onglets pendant qu'on fait défiler la bande, avec
   * l'inertie propre à l'onde — la graduation et l'onde deviennent un seul
   * instrument.
   *
   * null hors mobile : la bande n'y défile pas, et l'indice d'épreuve suffit.
   */
  const [mesure, setMesure] = useState(null);

  const mesurer = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    // Bande non défilable (ordinateur) : rien à mesurer.
    if (rail.scrollWidth <= rail.clientWidth + 1) {
      setMesure(null);
      return;
    }
    const onglet = rail.children[index];
    if (!onglet) return;

    const centre = onglet.offsetLeft - rail.scrollLeft + onglet.offsetWidth / 2;
    const fraction = centre / rail.clientWidth;
    const k = fraction * EPREUVES.length - 0.5;

    /* LARGEUR de la lumière, mesurée elle aussi.

       L'ampleur par défaut vaut 1 / sections, ce qui suppose dix colonnes
       égales sous l'onde. Un onglet de 88 px sur une bande visible de 328
       en occupe en réalité plus du quart : à un dixième, la lumière est
       deux fois et demie trop étroite pour ce qu'elle désigne, et le
       décalage se voit d'autant mieux que la position, elle, est juste.

       Approximation assumée : l'ampleur se compte en longueur d'ARC et la
       mesure en largeur d'écran. Un tracé qui ondule a plus d'arc que de
       largeur là où il monte, la lumière est donc un peu plus courte dans
       les lobes hauts. Les centres de section se calculent déjà en arc et
       souffrent du même écart ; à l'œil, il ne se voit pas. */
    const largeur = onglet.offsetWidth / rail.clientWidth;

    setMesure({
      k: Math.max(0, Math.min(EPREUVES.length - 1, k)),
      ampleur: Math.max(0.06, Math.min(0.6, largeur)),
    });
  }, [index]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    /* Le défilement émet bien plus d'événements qu'il n'y a d'images à
       l'écran. Une seule mesure par image suffit, et elle tombe alors au
       même rythme que le rendu de l'onde. */
    let raf = 0;
    const auProchainRendu = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; mesurer(); });
    };

    rail.addEventListener('scroll', auProchainRendu, { passive: true });
    window.addEventListener('resize', auProchainRendu);
    mesurer();

    return () => {
      rail.removeEventListener('scroll', auProchainRendu);
      window.removeEventListener('resize', auProchainRendu);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mesurer]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onglet = rail.children[index];
    if (!onglet) return;

    // Bande non défilable (ordinateur) : rien à recentrer.
    if (rail.scrollWidth <= rail.clientWidth) return;

    const cible = onglet.offsetLeft - (rail.clientWidth - onglet.offsetWidth) / 2;
    rail.scrollTo({
      left: cible,
      behavior: railPremierRef.current ? 'auto' : 'smooth',
    });
    railPremierRef.current = false;
  }, [index]);

  /* ---- Relance, avec un temps mort ----
   *
   * Le bouton est ici, le jeu est dans {children} : relancer incrémente une
   * clé, ce qui remonte le composant du jeu — et donc relance TOUT ce qu'il
   * fait au montage, à commencer par ses requêtes. Rien n'empêchait d'appuyer
   * dix fois en deux secondes, et chaque appui partait chercher une nouvelle
   * cible, un nouvel extrait, de nouvelles pochettes. Les requêtes des runs
   * abandonnés continuent d'ailleurs jusqu'au bout : elles ne servent plus à
   * rien mais elles ont déjà été émises.
   *
   * Le bouton se ferme donc pendant deux secondes et demie. La durée n'est pas
   * une valeur de confort : c'est l'ordre de grandeur d'un chargement de
   * manche complet, requête et audio compris. En dessous, on rouvrirait le
   * bouton avant que le jeu précédent ait fini d'arriver.
   *
   * Le verrou vit dans le CONTEXTE et non dans le bouton : c'est `relancer`
   * qui refuse, pas l'élément qui se grise. Un jeu qui appellerait relancer
   * par un autre chemin serait soumis à la même règle, et le bouton ne peut
   * pas être contourné au clavier ni par un double événement tactile.
   */
  const [cleRelance, setCleRelance] = useState(0);
  const [relanceFermee, setRelanceFermee] = useState(false);
  const minuteurRelance = useRef(null);

  useEffect(() => () => clearTimeout(minuteurRelance.current), []);

  const ctx = useMemo(() => ({
    cleRelance,
    relancer: () => {
      setRelanceFermee((ferme) => {
        if (ferme) return true;          // déjà en temps mort : on ignore
        setCleRelance((k) => k + 1);
        clearTimeout(minuteurRelance.current);
        minuteurRelance.current = setTimeout(() => setRelanceFermee(false), DELAI_RELANCE);
        return true;
      });
    },
  }), [cleRelance]);

  // Flèches du clavier. scroll: false → on reste à la même hauteur de page,
  // le décor étant identique d'une épreuve à l'autre.
  useEffect(() => {
    function onKey(ev) {
      const c = ev.target;
      if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA')) return;
      if (ev.key === 'ArrowLeft' && index > 0) {
        router.push(`/epreuves/${EPREUVES[index - 1].slug}`, { scroll: false });
      }
      if (ev.key === 'ArrowRight' && index < EPREUVES.length - 1) {
        router.push(`/epreuves/${EPREUVES[index + 1].slug}`, { scroll: false });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, router]);

  const precedente = index > 0 ? EPREUVES[index - 1] : null;
  const suivante = index < EPREUVES.length - 1 ? EPREUVES[index + 1] : null;

  const SVG_GAUCHE = (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
  const SVG_DROITE = (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );

  return (
    <EpreuveContext.Provider value={ctx}>
      {/* En-tête commun. La barre est collante — sur une page de jeu haute de
          deux écrans, le repère d'identité et le retour à l'accueil ne doivent
          pas disparaître au défilement. */}
      <EnTete liens={[{ href: '/quotidien', libelle: 'défi du jour' }]} />

      <main className="contenu epreuve-page" style={{ paddingTop: 'var(--e6)' }}>
        {/* UN SEUL bloc de style, et il est le PREMIER enfant : les délais
            d'entrée sont écrits en nth-child, donc tout élément inséré au
            milieu décalerait la numérotation de tous ses suivants.

            POSITIONS :
              2  titre + carte du défi (bureau)
              3  onde
              4  carrousel des dix épreuves
              5  bandeau d'action
              6  le jeu
              7  carte du défi (mobile)
              8  pied de page */}
        <style>{`
          @keyframes glisseDroite {
            from { transform: translateX(42px); opacity: 0 }
            to   { transform: translateX(0);    opacity: 1 }
          }
          @keyframes glisseGauche {
            from { transform: translateX(-42px); opacity: 0 }
            to   { transform: translateX(0);     opacity: 1 }
          }
          @media (prefers-reduced-motion: reduce) {
            .glissiere { animation: none !important }
          }

          /* ---- Entrée de la page ----
             Les blocs se posent du haut vers le bas, mais PLUS VITE que sur
             l'accueil : l'accueil est une page qu'on regarde, ici on vient
             jouer, et tout ce qui retarde le premier clic se paie.

             Le layout n'est JAMAIS démonté quand on passe d'une épreuve à
             l'autre — c'est tout son intérêt, l'onde y garde sa boucle. La
             cascade ne se joue donc qu'à la première arrivée, et le carrousel
             ne clignote pas à chaque changement d'épreuve.

             Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
             backtick isolé y refermerait la chaîne CSS en plein milieu. */
          .epreuve-page > *:nth-child(n+2) {
            animation: epreuveEntree 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .epreuve-page > *:nth-child(2) { animation-delay: 50ms; }
          .epreuve-page > *:nth-child(4) { animation: none; }
          .epreuve-page > *:nth-child(5) { animation-delay: 900ms; }
          .epreuve-page > *:nth-child(6) { animation-delay: 980ms; }
          .epreuve-page > *:nth-child(7) { animation-delay: 1060ms; }
          .epreuve-page > *:nth-child(8) { animation-delay: 1060ms; }

          /* ---- L'onde se déroule de gauche à droite ----
             Un rognage animé, et non une mise à l'échelle : scaleX aurait
             comprimé le tracé, donc changé la forme de l'onde pendant qu'elle
             apparaît. Le clip-path découvre ce qui est déjà dessiné, et la
             silhouette reste juste à chaque image. */
          .epreuve-page > *:nth-child(3) {
            animation: epreuveOnde 900ms 120ms cubic-bezier(0.35, 0, 0.35, 1) both;
          }

          @keyframes epreuveOnde {
            from { clip-path: inset(0 100% 0 0); }
            to   { clip-path: inset(0 0 0 0); }
          }

          /* ---- Les dix onglets, calés sur le passage de l'onde ----
             Chaque onglet entre à l'instant où le bord du rognage franchit son
             centre. Les valeurs viennent de l'inversion de la courbe du
             déroulé : celle-ci n'étant pas linéaire, un pas constant aurait
             fait dériver les onglets par rapport à l'onde qui les survole. */
          .epreuve-carrousel > * {
            animation: epreuveEntree 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          .epreuve-carrousel > *:nth-child(1)  { animation-delay: 173ms; }
          .epreuve-carrousel > *:nth-child(2)  { animation-delay: 248ms; }
          .epreuve-carrousel > *:nth-child(3)  { animation-delay: 299ms; }
          .epreuve-carrousel > *:nth-child(4)  { animation-delay: 344ms; }
          .epreuve-carrousel > *:nth-child(5)  { animation-delay: 387ms; }
          .epreuve-carrousel > *:nth-child(6)  { animation-delay: 432ms; }
          .epreuve-carrousel > *:nth-child(7)  { animation-delay: 482ms; }
          .epreuve-carrousel > *:nth-child(8)  { animation-delay: 543ms; }
          .epreuve-carrousel > *:nth-child(9)  { animation-delay: 623ms; }
          .epreuve-carrousel > *:nth-child(10) { animation-delay: 752ms; }

          @keyframes epreuveEntree {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* ---- Rangée du titre ---- */
          .epreuve-tete {
            display: flex;
            align-items: flex-start;
            gap: var(--e5);
            flex-wrap: wrap;
          }
          .epreuve-tete-texte { flex: 1 1 320px; min-height: 118px; }

          /* ---- Carte du défi ---- */
          .carte-defi {
            display: block;
            border: 1px solid var(--or);
            border-radius: var(--rayon-carte);
            color: inherit;
            background: transparent;
            box-shadow: 0 0 0 rgba(239, 159, 39, 0);
            transition:
              box-shadow var(--transition-courte),
              background var(--transition-courte),
              border-color var(--transition-courte);
          }
          .carte-defi-bureau { max-width: 260px; padding: var(--e3) var(--e4); }
          .carte-defi-mobile { display: none; padding: var(--e5); }
          .carte-defi-corps { display: block; }
          .carte-defi-court { display: none; }
          .carte-defi-fleche { display: none; }

          /* ---- Bouton de relance ---- */
          /* Fermé : le bouton perd sa surface et son or, comme partout
             ailleurs sur le site. Il garde sa place et son intitulé — c'est
             ce qui dit qu'il revient. */
          .epreuve-relance:disabled {
            color: var(--cendre);
            border-color: var(--filet);
            cursor: not-allowed;
          }
          .epreuve-relance {
            font-family: var(--sans);
            font-size: 14px;
            font-weight: 500;
            padding: 9px 16px;
            border-radius: var(--rayon-controle);
            cursor: pointer;
            background: transparent;
            color: var(--or);
            border: 1px solid var(--or);
            transition:
              background var(--transition-courte),
              color var(--transition-courte);
          }

          /* ============================================================
             LES SURVOLS SONT EN CSS, ET SOUS CONDITION DE POINTEUR

             Ils étaient posés en JavaScript, par onMouseEnter et
             onMouseLeave. Sur un écran tactile, le navigateur émet quand
             même mouseenter au moment du tap — pour les sites qui n'écoutent
             que la souris — puis la navigation part et mouseleave n'arrive
             JAMAIS. La flèche restait donc allumée en or après le clic, et
             rien ne pouvait plus l'éteindre.

             On peut garder le JavaScript et le protéger par un test de
             pointeur, mais la cause reste : un état visuel confié à des
             événements dont l'un des deux peut ne pas venir. Ici l'état
             appartient au navigateur, qui le retire toujours.

             La requête média est ce qui compte : hover: hover et
             pointer: fine ne sont vrais que sur un appareil qui a un vrai
             pointeur. Ailleurs, ces règles n'existent pas — et c'est le
             :active de globals.css qui donne le retour au doigt.
          ============================================================ */
          @media (hover: hover) and (pointer: fine) {
            .carte-defi:hover {
              box-shadow: 0 0 22px rgba(239, 159, 39, 0.6);
              background: var(--onyx-haut);
              border-color: var(--or-clair);
            }
            .epreuve-relance:hover {
              background: var(--or);
              color: var(--noir);
            }
            .epreuve-fleche-rond:not(.eteinte):hover {
              background: var(--or);
              color: var(--noir);
            }
            /* Un bouton fermé ne réagit pas au survol : sinon il s'allume
               sous la souris en annonçant une action qu'il refuse. */
            .epreuve-relance:disabled:hover {
              background: transparent;
              color: var(--cendre);
            }
          }

          /* ---- Bandeau d'action ---- */
          .epreuve-actions {
            display: flex;
            align-items: center;
            gap: var(--e4);
            border-top: 0.5px solid var(--filet);
            padding-top: var(--e3);
            margin-bottom: var(--e4);
          }
          .epreuve-nav-fleches {
            display: flex;
            align-items: center;
            gap: var(--e2);
            margin-left: auto;
          }
          .epreuve-fleche-rond {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            background: transparent;
            color: var(--or);
            border: 1px solid var(--or);
            text-decoration: none;
            transition:
              color var(--transition-courte),
              border-color var(--transition-courte),
              background var(--transition-courte);
          }
          /* Bout de la série : la flèche existe encore, elle ne mène nulle
             part. Un rond absent ferait sauter son voisin d'un cran. */
          .epreuve-fleche-rond.eteinte {
            color: var(--cendre);
            border-color: var(--filet);
            cursor: not-allowed;
          }

          /* ============================================================
             SOUS 640 PX
          ============================================================ */
          @media (max-width: 640px) {

            /* ---- La carte du défi descend en bas de page ---- */
            .carte-defi-bureau { display: none; }
            .carte-defi-mobile { display: block; margin-top: var(--e7); }
            .carte-defi-corps {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: var(--e4);
            }
            .carte-defi-long { display: none; }
            .carte-defi-court { display: inline; }
            .carte-defi-fleche {
              display: block;
              color: var(--or);
              font-size: 17px;
              flex-shrink: 0;
            }

            /* Le bloc de titre n'a plus de hauteur imposée. Celle-ci existe
               pour que la page ne saute pas d'une épreuve à l'autre quand la
               description change de longueur ; en une seule colonne, la
               réserve de 118 px devient une bande vide sous les descriptions
               courtes, et le saut qu'elle évite ne coûte de toute façon
               qu'une ligne. */
            .epreuve-tete-texte { flex: 1 1 100%; min-height: 0; }

            /* ============================================================
               LE CARROUSEL DEVIENT UNE GRADUATION QUI DÉFILE

               Dix colonnes de largeur égale sur un écran de 360 px donnent
               30 px par onglet : deux caractères et un numéro. C'était
               l'écran le plus abîmé du site.

               La grille devient donc une bande horizontale. Mais une bande
               d'onglets à largeur naturelle, espacés, donne dix filets de
               longueurs différentes séparés par des trous : une rangée de
               tirets au hasard, alors que le filet supérieur est justement ce
               qui porte l'état actif.

               D'où trois partis pris qui vont ensemble :

               1. LARGEUR FIXE, gouttière NULLE. Les filets se touchent et
                  forment une seule ligne continue, comme sur une règle
                  graduée — et l'épreuve courante est le segment ALLUMÉ de
                  cette ligne, ce qui est exactement le langage de l'onde. La
                  respiration entre les intitulés vient d'un rembourrage
                  interne, qui lui reste sous le filet.

               2. BORDS FONDUS. Une cellule tranchée net en plein mot se lit
                  comme un défaut d'affichage ; la même cellule qui s'efface
                  se lit comme la suite d'une bande. Vingt pixels de fondu de
                  chaque côté suffisent, et c'est aussi ce qui dit qu'on peut
                  faire glisser.

               3. La bande DÉBORDE jusqu'aux bords de l'écran. Les marges
                  négatives annulent le rembourrage du conteneur, que le
                  rembourrage interne rétablit : le premier onglet reste
                  aligné sur le titre, mais la graduation court d'un bord à
                  l'autre au lieu de s'arrêter dans le vide.

               Le calage magnétique est en proximity et non mandatory : il
               aide sans confisquer les défilements longs. La barre de
               défilement est masquée — elle n'apprend rien que le fondu ne
               dise déjà, et certains navigateurs la réservent en permanence,
               ce qui ajouterait une bande grise sous la graduation.

               display, gap et rembourrage portent un !important : ils
               viennent de styles en ligne, que seule cette marque renverse.
            ============================================================ */
            .epreuve-carrousel {
              display: flex !important;
              flex-wrap: nowrap;
              gap: 0 !important;
              overflow-x: auto;
              overscroll-behavior-x: contain;
              scroll-snap-type: x proximity;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
              margin-left: calc(-1 * (var(--e4) + var(--marge-gauche)));
              margin-right: calc(-1 * (var(--e4) + var(--marge-droite)));
              padding-left: calc(var(--e4) + var(--marge-gauche));
              padding-right: calc(var(--e4) + var(--marge-droite));
              -webkit-mask-image: linear-gradient(to right,
                transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);
              mask-image: linear-gradient(to right,
                transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);
            }
            .epreuve-carrousel::-webkit-scrollbar { display: none; }
            .epreuve-carrousel > * {
              flex: 0 0 88px;
              scroll-snap-align: center;
              white-space: nowrap;
              overflow: hidden;
              padding: var(--e2) var(--e3) var(--e3) 0 !important;
            }

            /* ---- Bandeau d'action sur un seul rang ----
               Le compte, sur 360 px : 328 utiles, moins 100 pour le réglage
               de volume, 96 pour les deux flèches et trois gouttières de 8.
               Il reste une centaine de pixels pour le bouton, d'où son
               intitulé raccourci — « Relancer » suffit, le nom de l'épreuve
               est écrit en 28 px juste au-dessus.

               La mention « rejouable à volonté » se replie : elle est du
               commentaire, et le commentaire est ce qui part en premier
               quand la place manque. */
            .epreuve-actions { gap: var(--e2); }
            .epreuve-actions-contexte { display: none; }
            .epreuve-relance {
              flex: 0 1 auto;
              min-width: 0;
              padding: 10px 12px !important;
            }
            .relance-suite { display: none; }

            /* Quarante-deux pixels : une cible qu'on atteint sans viser. */
            .epreuve-fleche-rond { width: 42px; height: 42px; }
            .epreuve-nav-fleches { gap: var(--e1); }

            /* ---- Cascade comprimée ----
               Un bloc à plus d'une seconde de retard est invisible pendant
               tout ce temps : sur mobile on fait défiler tout de suite, et
               l'œil arrive sur du vide. */
            .epreuve-page > *:nth-child(2) { animation-delay: 40ms; }
            .epreuve-page > *:nth-child(3) {
              animation: epreuveOnde 700ms 90ms cubic-bezier(0.35, 0, 0.35, 1) both;
            }
            .epreuve-page > *:nth-child(5) { animation-delay: 700ms; }
            .epreuve-page > *:nth-child(6) { animation-delay: 770ms; }
            .epreuve-page > *:nth-child(7) { animation-delay: 840ms; }
            .epreuve-page > *:nth-child(8) { animation-delay: 900ms; }

            .epreuve-carrousel > *:nth-child(1)  { animation-delay: 130ms; }
            .epreuve-carrousel > *:nth-child(2)  { animation-delay: 188ms; }
            .epreuve-carrousel > *:nth-child(3)  { animation-delay: 228ms; }
            .epreuve-carrousel > *:nth-child(4)  { animation-delay: 263ms; }
            .epreuve-carrousel > *:nth-child(5)  { animation-delay: 296ms; }
            .epreuve-carrousel > *:nth-child(6)  { animation-delay: 331ms; }
            .epreuve-carrousel > *:nth-child(7)  { animation-delay: 370ms; }
            .epreuve-carrousel > *:nth-child(8)  { animation-delay: 417ms; }
            .epreuve-carrousel > *:nth-child(9)  { animation-delay: 479ms; }
            .epreuve-carrousel > *:nth-child(10) { animation-delay: 579ms; }
          }
        `}</style>

        {/* 2 — Titre de l'épreuve · carte du défi.
            Le titre change avec l'URL mais n'est pas remonté : pas de saut. */}
        <div className="epreuve-tete">
          <div className="epreuve-tete-texte">
            <div className="etiquette-mono">épreuve {e.num} · accès libre</div>
            <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>{e.nom}</h1>
            <p className="lin" style={{ marginTop: 'var(--e2)', maxWidth: 470 }}>{e.desc}</p>
          </div>

          <CarteDefi variante="bureau" />
        </div>

        {/* 3 — L'onde. Jamais démontée : c'est elle qui porte la continuité. */}
        <div style={{ marginTop: 'var(--e5)' }}>
          <Onde
            variante="bandeau"
            sections={EPREUVES.length}
            active={ondeAllumee ? (mesure ? mesure.k : ondeIndex) : null}
            ampleur={mesure ? mesure.ampleur : null}
          />
        </div>

        {/* 4 — Le carrousel : dix liens réels, une URL chacun.
            prefetch charge la route voisine avant même le clic → transition
            instantanée, sans écran blanc.

            Sous 640 px, cette grille devient une bande qui défile au pouce
            et se recentre toute seule sur l'épreuve courante. */}
        <nav
          ref={railRef}
          aria-label="Les dix épreuves"
          className="epreuve-carrousel"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`,
            gap: 6,
            marginTop: 'var(--e4)',
            marginBottom: 'var(--e5)',
          }}
        >
          {EPREUVES.map((x, k) => (
            <Link
              key={x.slug}
              href={`/epreuves/${x.slug}`}
              scroll={false}
              prefetch
              aria-current={k === index ? 'page' : undefined}
              style={{
                paddingTop: 'var(--e2)', paddingBottom: 'var(--e2)',
                display: 'block', textAlign: 'left', textDecoration: 'none',
                borderTop: `${k === index ? '1px' : '0.5px'} solid ${k === index ? 'var(--or)' : 'var(--filet)'}`,
                transition: 'border-color var(--transition-courte)',
              }}
            >
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                color: k === index ? 'var(--or)' : 'var(--cendre)',
                transition: 'color var(--transition-courte)',
              }}>
                {x.num}
              </div>
              <div style={{
                fontSize: 11.5, marginTop: 2, lineHeight: 1.25,
                color: k === index ? 'var(--ivoire)' : 'var(--lin)',
                transition: 'color var(--transition-courte)',
              }}>
                {x.court}
              </div>
            </Link>
          ))}
        </nav>

        {/* 5 — Bandeau d'action : contexte, relance, navigation */}
        <div className="epreuve-actions">
          <span className="etiquette-mono epreuve-actions-contexte" style={{ color: 'var(--cendre)' }}>
            {e.nom} · rejouable à volonté
          </span>

          <button
            onClick={ctx.relancer}
            className="epreuve-relance"
            disabled={relanceFermee}
            aria-live="polite"
          >
            Relancer<span className="relance-suite"> l&apos;épreuve</span>
          </button>

          <VolumeControl compact />

          <div className="epreuve-nav-fleches">
            {precedente ? (
              <Link href={`/epreuves/${precedente.slug}`} scroll={false} prefetch
                className="epreuve-fleche-rond"
                aria-label={`Épreuve précédente : ${precedente.nom}`}>
                {SVG_GAUCHE}
              </Link>
            ) : (
              <span className="epreuve-fleche-rond eteinte" aria-hidden="true">{SVG_GAUCHE}</span>
            )}

            {suivante ? (
              <Link href={`/epreuves/${suivante.slug}`} scroll={false} prefetch
                className="epreuve-fleche-rond"
                aria-label={`Épreuve suivante : ${suivante.nom}`}>
                {SVG_DROITE}
              </Link>
            ) : (
              <span className="epreuve-fleche-rond eteinte" aria-hidden="true">{SVG_DROITE}</span>
            )}
          </div>
        </div>

        {/* 6 — Le jeu glisse depuis le côté d'où l'on vient.
            key={slug} : le changement de clé remonte le bloc, donc l'animation
            se rejoue à chaque épreuve — y compris deux fois dans le même sens.
            overflowX clip (et non hidden) : les listes déroulantes des jeux
            peuvent dépasser vers le bas. */}
        {/* position relative + z-index : sans eux, la liste de suggestions
            d'une épreuve passe DERRIÈRE la carte du défi et le pied de page.

            La cause n'est pas le z-index de la liste, qui vaut 100, mais le
            fait qu'il ne compte pas hors de sa boîte. Le bloc du jeu porte
            une animation de glissement, donc une transformation, et toute
            transformation crée un CONTEXTE D'EMPILEMENT : les z-index de ses
            descendants sont classés entre eux, puis le bloc entier est posé
            à sa propre place dans la pile. Ce bloc n'ayant pas de z-index, il
            se range à l'ordre du document — donc sous ses frères suivants,
            quels que soient les cent points de la liste.

            Un z-index de 1 suffit à le faire passer devant eux. Il reste très
            en dessous de la barre d'en-tête, qui est à 40 et doit continuer
            de tout recouvrir au défilement. */}
        <div style={{ overflowX: 'clip', overflowY: 'visible', position: 'relative', zIndex: 1 }}>
          <div
            key={slug}
            className="glissiere"
            style={{
              animation: `${dirRef.current > 0 ? 'glisseDroite' : 'glisseGauche'} 300ms cubic-bezier(0.4, 0, 0.2, 1) both`,
            }}
          >
            {children}
          </div>
        </div>

        {/* 7 — La carte du défi, version mobile : après le jeu, pas avant. */}
        <CarteDefi variante="mobile" />

        {/* 8 — Pied de page */}
        <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
          Mozart Benchmark — extraits fournis par Deezer, sons de synthèse et échantillons libres.
        </footer>
      </main>
    </EpreuveContext.Provider>
  );
}
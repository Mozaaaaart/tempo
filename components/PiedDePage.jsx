import Link from 'next/link';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';
import { SITE_NOM } from '@/data/site';

/**
 * PIED DE PAGE COMMUN
 *
 * ------------------------------------------------------------------ le fond
 *
 * Trois fonctions, dans cet ordre d'importance :
 *
 *   1. UNE SORTIE. Le bas de page est l'endroit où l'on arrive quand on a fini
 *      de lire et qu'on ne sait pas quoi faire. Les dix jeux y sont listés en
 *      toutes lettres — c'est aussi le seul endroit du site où ils sont TOUS
 *      liés depuis un rendu serveur.
 *
 *   2. UN ÉDITEUR. Un site sans identité visible ne se distingue pas d'une
 *      page jetable. C'est le rôle de la colonne d'identité — et du
 *      monogramme, voir plus bas.
 *
 *   3. LES MENTIONS OBLIGATOIRES. Rubrique « informations », séparée de la
 *      navigation : on ne cherche pas les mentions légales comme on cherche
 *      le défi du jour, les mélanger obligeait à lire toute la liste pour
 *      trouver l'une ou l'autre.
 *
 * ------------------------------------------------------------------ la forme
 *
 * QUATRE RUBRIQUES EN LARGEUR DE CONTENU, PAS EN TIERS ÉGAUX. La première
 * version posait trois colonnes en `1fr` : sur un écran de 1600 px, chacune
 * faisait 500 px pour un contenu qui en occupe 200, et le pied devenait trois
 * îlots perdus dans le noir. Ici chaque rubrique épouse son contenu
 * (`max-content`) et `justify-content: space-between` répartit l'espace ENTRE
 * elles : l'identité ancre le bord gauche, les informations le bord droit, et
 * le vide devient du rythme au lieu d'être du flottement.
 *
 * L'IDENTITÉ EST CENTRÉE EN HAUTEUR, LES RUBRIQUES NON. La colonne des dix
 * jeux fait cinq rangées, celle du site en fait deux : la rangée est haute, et
 * une signature de trois lignes calée en haut à gauche laissait sous elle un
 * vide vertical que rien ne venait occuper. `align-self: center` la pose sur
 * l'axe médian du pied — elle regarde alors la liste des jeux en face, au lieu
 * de la surplomber.
 *
 * Les trois rubriques, elles, restent calées EN HAUT et c'est délibéré : leurs
 * étiquettes mono partagent une seule ligne de base, et c'est cette ligne qui
 * fait lire les trois listes comme un même système. Les centrer chacune sur sa
 * propre hauteur ferait flotter trois étiquettes à trois niveaux différents —
 * on ne saurait plus qu'elles sont de même rang. L'identité peut se permettre
 * l'exception parce qu'elle n'appartient pas à ce système : c'est un bloc, pas
 * une rubrique.
 *
 * LE PORTRAIT AU CASQUE reprend celui de l'en-tête : la barre du haut ouvre
 * la page avec lui, le pied la ferme avec lui. Même fichier, même cercle au
 * filet or — l'identité n'a pas besoin d'un logo de plus.
 *
 * LES NUMÉROS D'ÉPREUVE (01–10) reprennent la grammaire par laquelle le site
 * nomme ses jeux partout ailleurs — colonnes de l'accueil, sommaire du défi :
 * numéro mono + intitulé. En cendre, comme sur l'accueil : le numéro étiquette,
 * le nom informe, et dix numéros or auraient fait crier la colonne (l'or reste
 * l'accent, pas la peinture). La liste se lit DE HAUT EN BAS (01–05 puis
 * 06–10, `grid-auto-flow: column`) : l'ancien remplissage en ligne faisait
 * zigzaguer une suite numérotée, ce qui contredisait sa propre numérotation.
 *
 * Le reste est la grammaire du site : filet 0,5 px, étiquettes mono capitales
 * pour NOMMER les rubriques, aucune surface, aucun aplat, l'or au survol
 * seulement. Composant SERVEUR : aucun état, liens dans le HTML servi.
 */

/* ---- Les mentions légales ----
 *
 * Ce tableau ne référence que des pages qui EXISTENT : un lien vers une page
 * absente promet une information et rend un 404 — le pire des deux mondes
 * pour la confiance comme pour l'exploration.
 *
 * Casse de phrase, comme partout sur le site : « Mentions légales », pas
 * « mentions légales » — la minuscule initiale les faisait lire comme des
 * items d'un autre système que « Accueil » juste au-dessus.
 *
 * Soutenir vit dans « le site » et non ici : c'est une page du projet, pas
 * une obligation légale — la ranger avec les mentions l'aurait fait lire
 * comme une formalité, ce qui est le contraire d'une invitation.
 */
const LEGAL = [
  { href: '/mentions-legales', libelle: 'Mentions légales' },
  { href: '/confidentialite', libelle: 'Confidentialité' },
  { href: '/contact', libelle: 'Contact' },
];

/**
 * @param classe  classes supplémentaires. L'accueil y passe `bloc-pied`, qui
 *                porte son `order` sous 640 px : la page range ses blocs à la
 *                main, et un pied de page sans rang tomberait sur le garde-fou
 *                plutôt que sur une place choisie.
 */
export default function PiedDePage({ classe = '', avecJeux = false }) {
  const annee = new Date().getFullYear();

  return (
    <footer className={['pied', avecJeux ? '' : 'pied-sans-jeux', classe].filter(Boolean).join(' ')}>
      <style>{`
        /* Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
           accent grave isole y refermerait la chaine CSS en plein milieu. */

        .pied {
          margin-top: var(--e8);
          padding-top: var(--e7);
          border-top: 0.5px solid var(--filet);
        }

        /* Le pied sans les dix jeux tient sur trois lignes de liens au lieu de
           cinq : il n a plus besoin d autant d air au-dessus ni en dessous.
           Le rapport entre le blanc et la matiere est ce qui fait qu un bloc
           parait compose ou simplement vide — a matiere reduite, blanc reduit. */
        .pied-sans-jeux { margin-top: var(--e7); padding-top: var(--e6); }

        /* ============================================================
           ENTREE EN DIAGONALE

           Les elements arrivent de haut en bas ET de gauche a droite : le
           retard de chacun vaut (colonne + rangee) x un pas. Une vague
           traverse donc le pied depuis son coin haut-gauche, au lieu des
           deux cascades separees qu on obtiendrait en retardant les colonnes
           puis les lignes. Le mouvement suit la lecture — on lit un pied de
           page en diagonale, pas colonne par colonne.

           La colonne visuelle n est PAS l ordre du DOM pour les dix jeux :
           la liste est remplie en colonne (trois rangees), donc l element i
           occupe la colonne floor(i/3) et la rangee i%3. Les retards
           ci-dessous appliquent ce calcul a la main, sinon la vague
           traverserait la grille de travers.

           Grammaire du site : 560 ms, cubic-bezier(0.22, 1, 0.36, 1). Le
           deplacement gagne une composante horizontale de 6 px, plus discrete
           que la verticale de 8 px : la diagonale doit se sentir sans que les
           mots aient l air de glisser de cote.

           DEUX DECLENCHEURS, ET C EST VOULU. Le pied vit en bas de page :
           anime au chargement, il aurait joue hors de l ecran et personne ne
           l aurait vu. animation-timeline le lie donc a l entree du bloc dans
           la fenetre. Les navigateurs qui ignorent les animations liees au
           defilement retombent sur animation-delay, ecrit juste a cote — la
           vague joue alors au chargement. Aucun des deux cas ne laisse un
           element invisible, ce qui est la seule chose a ne pas rater.

           prefers-reduced-motion est neutralise globalement dans
           globals.css, qui ramene toutes les durees a 0,01 ms. */
        @keyframes piedEntree {
          from { opacity: 0; transform: translate(-6px, 8px); }
          to   { opacity: 1; transform: translate(0, 0); }
        }

        .pied { view-timeline-name: --pied-vue; }

        .pied-marque,
        .pied-phrase,
        .pied-soutenir,
        .pied-titre,
        .pied-liste li,
        .pied-bas > * {
          animation: piedEntree 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: --pied-vue;
          animation-range: entry 12% entry 72%;
        }

        /* Colonne 0 — la signature */
        .pied-marque   { animation-delay: 0ms;   animation-range: entry 12% entry 60%; }
        .pied-phrase   { animation-delay: 45ms;  animation-range: entry 15% entry 63%; }
        .pied-soutenir { animation-delay: 90ms;  animation-range: entry 18% entry 66%; }

        /* Colonnes 1 a 4 — les dix jeux. Retard = (1 + floor(i/3)) + (1 + i%3). */
        .pied-liste-jeux li:nth-child(1)  { animation-delay: 90ms;  animation-range: entry 18% entry 66%; }
        .pied-liste-jeux li:nth-child(2)  { animation-delay: 135ms; animation-range: entry 21% entry 69%; }
        .pied-liste-jeux li:nth-child(3)  { animation-delay: 180ms; animation-range: entry 24% entry 72%; }
        .pied-liste-jeux li:nth-child(4)  { animation-delay: 135ms; animation-range: entry 21% entry 69%; }
        .pied-liste-jeux li:nth-child(5)  { animation-delay: 180ms; animation-range: entry 24% entry 72%; }
        .pied-liste-jeux li:nth-child(6)  { animation-delay: 225ms; animation-range: entry 27% entry 75%; }
        .pied-liste-jeux li:nth-child(7)  { animation-delay: 180ms; animation-range: entry 24% entry 72%; }
        .pied-liste-jeux li:nth-child(8)  { animation-delay: 225ms; animation-range: entry 27% entry 75%; }
        .pied-liste-jeux li:nth-child(9)  { animation-delay: 270ms; animation-range: entry 30% entry 78%; }
        .pied-liste-jeux li:nth-child(10) { animation-delay: 225ms; animation-range: entry 27% entry 75%; }

        /* Les etiquettes de rubrique, sur la rangee du haut : leur retard ne
           depend que de leur colonne.

           UNE CLASSE PAR RUBRIQUE, ET NON nth-of-type. Les retards etaient
           accroches au RANG des nav, ce qui supposait leur ordre stable. Il ne
           l est plus : la rubrique des jeux ne parait que sur le defi du jour,
           donc « le site » est tantot le premier nav, tantot le second. Avec
           nth-of-type, les retards se decalaient d une colonne ailleurs, et
           les liens d informations perdaient meme le leur — aucun troisieme
           nav a cibler. Une classe dit ce qu elle designe et ne bouge pas. */
        .pied-nav-jeux  .pied-titre { animation-delay: 45ms;  animation-range: entry 15% entry 63%; }
        .pied-nav-site  .pied-titre { animation-delay: 225ms; animation-range: entry 27% entry 75%; }
        .pied-nav-infos .pied-titre { animation-delay: 270ms; animation-range: entry 30% entry 78%; }

        /* Colonne 5 — le site */
        .pied-nav-site .pied-liste li:nth-child(1) { animation-delay: 270ms; animation-range: entry 30% entry 78%; }
        .pied-nav-site .pied-liste li:nth-child(2) { animation-delay: 315ms; animation-range: entry 33% entry 81%; }
        /* Troisieme ligne — Soutenir. Un pas de 45 ms de plus, comme partout :
           sans cette regle elle entrerait sans retard, donc AVANT les deux
           lignes du dessus, et la vague se briserait au dernier element. */
        .pied-nav-site .pied-liste li:nth-child(3) { animation-delay: 360ms; animation-range: entry 36% entry 84%; }

        /* Colonne 6 — informations */
        .pied-nav-infos .pied-liste li:nth-child(1) { animation-delay: 315ms; animation-range: entry 33% entry 81%; }
        .pied-nav-infos .pied-liste li:nth-child(2) { animation-delay: 360ms; animation-range: entry 36% entry 84%; }
        .pied-nav-infos .pied-liste li:nth-child(3) { animation-delay: 405ms; animation-range: entry 39% entry 87%; }

        /* La barre du bas ferme la vague, dans son propre sens de lecture. */
        .pied-bas > *:nth-child(1) { animation-delay: 405ms; animation-range: entry 39% entry 87%; }
        .pied-bas > *:nth-child(2) { animation-delay: 450ms; animation-range: entry 42% entry 90%; }

        /* Chaque rubrique a la largeur de son contenu, l espace vit ENTRE
           elles. La borne haute de l identite (300 px) est celle de sa
           phrase : au-dela, la ligne depasse 60 signes et cesse de se lire
           comme une signature.

           align-items: start pose les trois rubriques sur une seule ligne de
           base — c est ce qui les fait lire comme un meme systeme. Seule
           l identite y echappe, plus bas. */
        .pied-cols {
          display: grid;
          grid-template-columns: minmax(220px, 300px) repeat(3, max-content);
          justify-content: space-between;
          align-items: start;
          gap: var(--e6) var(--e7);
        }

        /* ---- Variante sans la rubrique des jeux ----

           DECLAREE APRES .pied-cols, et c est essentiel : les deux selecteurs
           ont la meme specificite (une classe), donc c est l ORDRE qui tranche.
           Posee avant, elle etait ecrasee par repeat(3) et une quatrieme piste
           vide restait ouverte a droite — les rubriques flottaient au milieu.

           QUATRE PISTES POUR TROIS BLOCS. La piste 2 est un 1fr vide qui
           absorbe tout l espace disponible : l identite reste calee a gauche,
           les deux rubriques se rejoignent a droite, separees par une seule
           gouttiere. Avec space-between sur trois pistes, l espace se serait
           reparti a parts egales et « le site » aurait derive vers le centre,
           sans rien pour le justifier — c est exactement ce qui donnait cette
           impression de vide mal reparti.

           Deux blocs cote a cote se lisent comme un groupe ; trois blocs
           egalement espaces se lisent comme trois isoles. */
        .pied-cols-sans-jeux {
          grid-template-columns: minmax(220px, 300px) 1fr max-content max-content;
          justify-content: initial;
          column-gap: var(--e7);
        }
        .pied-cols-sans-jeux .pied-identite  { grid-column: 1; }
        .pied-cols-sans-jeux .pied-nav-site  { grid-column: 3; }
        .pied-cols-sans-jeux .pied-nav-infos { grid-column: 4; }

        /* Sans les dix jeux, la rangee ne fait plus que trois lignes de liens :
           le pied peut respirer moins large sans paraitre serre. Les valeurs
           d origine tenaient a une colonne haute de cinq rangees, disparue. */
        .pied-cols-sans-jeux { row-gap: var(--e5); }

        /* ---- Identite ----
           Le seul bloc centre en hauteur : voir la note de tete. La rangee
           est haute de cinq rangees de liens ; une signature de trois lignes
           calee en haut y laissait un vide vertical sous elle. */
        .pied-identite { align-self: center; }

        .pied-marque {
          display: flex;
          align-items: center;
          gap: var(--e2);
        }
        /* Le meme portrait que la barre du haut : l en-tete ouvre la page
           avec lui, le pied la ferme avec lui. Cercle au filet or, comme
           la-haut — c est le filet qui en fait un logo. baseline cede la
           place a center : une image n a pas de ligne de base typographique,
           et alignee dessus elle flottait au-dessus du nom. */
        .pied-monogramme {
          /* display explicite : ce span n est block que parce qu il est
             enfant flex de pied-marque — un changement de conteneur le
             rendrait inline et lui ferait ignorer width, height et overflow
             (le bug qu a connu l en-tete). Autant ne pas dependre du
             contexte. */
          display: block;
          width: 24px; height: 24px;
          border-radius: 50%;
          overflow: hidden;
          border: 1px solid var(--or);
          flex-shrink: 0;
        }
        .pied-monogramme img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .pied-nom {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ivoire);
        }
        .pied-phrase {
          margin-top: var(--e3);
          max-width: 280px;
          font-size: 12.5px;
          line-height: 1.6;
          color: var(--lin);
        }

        /* ---- Le lien de soutien ----
           Promu de la liste de navigation vers la signature, et pas duplique :
           range parmi Accueil et Defi du jour, il se lisait comme une page de
           plus ; pose sous la phrase, il en devient la suite logique — le
           lecteur vient de lire  gratuits, sans inscription , l invitation a
           soutenir arrive avec son contexte.

           Un lien or, rien de plus. L or est la couleur canonique du lien
           (doc de design, table de palette), donc aucun element nouveau n est
           invente : ni bouton, ni encadre — le seul bloc encadre de l accueil
           doit rester la carte du defi. La fleche donne la direction sans
           crier ; elle glisse d un cran au survol, seul mouvement concede,
           dans la duree courte du site. */
        .pied-soutenir {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          margin-top: var(--e4);
          font-size: 12.5px;
          font-weight: 500;
          color: var(--or);
          text-decoration: none;
          transition: color var(--transition-courte);
        }
        .pied-soutenir:hover,
        .pied-soutenir:focus-visible { color: var(--or-clair); }
        .pied-soutenir-fleche {
          transition: transform var(--transition-courte);
        }
        .pied-soutenir:hover .pied-soutenir-fleche,
        .pied-soutenir:focus-visible .pied-soutenir-fleche {
          transform: translateX(3px);
        }
        @media (prefers-reduced-motion: reduce) {
          .pied-soutenir-fleche { transition: none; }
        }

        /* ---- Rubriques ---- */
        /* Etiquette de rubrique : l emploi legitime du mono capitales, celui
           que le document de design lui assigne. On NOMME une section. */
        .pied-titre {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--or);
          margin-bottom: var(--e4);
        }

        .pied-liste {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }

        /* Les dix jeux SUR TROIS LIGNES, remplies en colonne : 01-03, 04-06,
           07-09, et 10 qui ouvre seul la derniere colonne — dix ne tient pas
           dans neuf cases, le debordement est arithmetique, pas un accident.
           En tete de colonne et non en queue de ligne, l orphelin s aligne
           sur la rangee des premiers de colonne : il se lit comme une
           colonne courte, pas comme un item tombe de la grille.
           grid-auto-flow: column laisse la grille creer les colonnes
           necessaires : un onzieme jeu completerait la quatrieme sans
           retoucher une ligne de CSS. */
        .pied-liste-jeux {
          grid-auto-flow: column;
          grid-template-rows: repeat(3, auto);
          gap: 8px var(--e6);
        }

        .pied-lien {
          display: inline-flex;
          align-items: baseline;
          gap: var(--e2);
          font-size: 12.5px;
          color: var(--lin);
          text-decoration: none;
          transition: color var(--transition-courte);
        }
        .pied-lien:hover,
        .pied-lien:focus-visible { color: var(--or); }

        /* Le numero etiquette, le nom informe : cendre, comme les colonnes de
           l accueil. Il passe a l or AVEC son lien — un seul geste au survol,
           pas deux vitesses. */
        .pied-num {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--cendre);
          transition: color var(--transition-courte);
        }
        .pied-lien:hover .pied-num,
        .pied-lien:focus-visible .pied-num { color: var(--or); }

        /* ---- La barre du bas ----
           Ce qui n est ni navigation ni identite : la propriete, l origine
           des sons. On le lit une fois dans sa vie, d ou le cendre et les
           onze pixels. */
        .pied-bas {
          margin-top: var(--e7);
          padding-top: var(--e4);
          border-top: 0.5px solid var(--filet);
          display: flex;
          flex-wrap: wrap;
          gap: var(--e2) var(--e4);
          justify-content: space-between;
          font-size: 11px;
          color: var(--cendre);
        }

        /* ---- Ecrans moyens : deux rubriques par rangee ----
           Entre 640 et 1100 px, quatre colonnes en max-content se compriment
           jusqu a coller les listes ; deux par rangee gardent l air entre
           elles, et l identite prend sa rangee entiere en tete.

           Elle y reprend son calage HAUT : centree en hauteur, elle n a plus
           rien a cote d elle pour justifier le decalage — le centrage vertical
           ne vaut que face a une colonne plus haute. */
        @media (max-width: 1100px) {
          .pied-cols {
            grid-template-columns: repeat(2, max-content);
            row-gap: var(--e7);
          }
          .pied-identite {
            grid-column: 1 / -1;
            align-self: start;
          }
          /* La variante large posait chaque bloc sur une piste nommee. En
             dessous de 1100 la grille n a plus ces pistes : sans ce retour a
             auto, les rubriques viseraient des colonnes 3 et 4 inexistantes et
             se retrouveraient rejetees hors de la rangee. */
          .pied-cols-sans-jeux {
            grid-template-columns: repeat(2, max-content);
            justify-content: space-between;
          }
          .pied-cols-sans-jeux .pied-nav-site,
          .pied-cols-sans-jeux .pied-nav-infos { grid-column: auto; }
        }

        @media (max-width: 640px) {
          .pied { margin-top: var(--e7); padding-top: var(--e5); }
          .pied-cols {
            grid-template-columns: 1fr;
            row-gap: var(--e6);
          }
          .pied-titre { margin-bottom: var(--e2); }
          /* Cibles tactiles : sept pixels de gouttiere entre deux liens de
             douze, au doigt, c est une cible qu on rate. */
          .pied-liste { gap: 0; }
          /* Retour a DEUX colonnes de cinq au telephone : trois colonnes de
             liens a 13,5 px sur 380 px de large, c est  Humain ou IA  coupe
             en deux. Cinq rangees remplies en colonne, l ordre reste lisible
             de haut en bas. */
          .pied-liste-jeux {
            grid-template-rows: repeat(5, auto);
            grid-template-columns: repeat(2, 1fr);
            gap: 0 var(--e5);
          }
          .pied-lien {
            display: flex;
            padding: 9px 0;
            font-size: 13.5px;
          }
          .pied-bas {
            margin-top: var(--e6);
            justify-content: flex-start;
            gap: var(--e1);
          }
          .pied-bas > * { flex: 1 1 100%; }
        }
      `}</style>

      <div className={`pied-cols${avecJeux ? '' : ' pied-cols-sans-jeux'}`}>
        <div className="pied-identite">
          <div className="pied-marque">
            {/* Meme fichier que l'en-tete : un seul aller-retour reseau pour
                les deux, le cache fait le reste. alt vide, le nom est ecrit
                juste a cote. */}
            <span className="pied-monogramme" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- choix documenté ci-dessus : 2 Ko, pas d'optimiseur */}
          <img src="/portrait-mozart-96.webp" alt="" width={24} height={24} />
            </span>
            <span className="pied-nom">{SITE_NOM}</span>
          </div>
          {/* Une phrase, pas un slogan. Elle dit ce que le site EST à
              quelqu'un qui arrive par un moteur sur une page de jeu et n'a
              jamais vu l'accueil — le cas le plus fréquent, et le pied est
              souvent le seul endroit où il peut l'apprendre.

              Le compte vient de EPREUVES : la phrase ne peut pas mentir sur
              le nombre de jeux le jour où un onzième arrive. */}
          <p className="pied-phrase">
            {EPREUVES.length} jeux musicaux. Gratuits, sans inscription et
            sans connaissances en solfège.
          </p>
          {/* La suite naturelle de la phrase : gratuit, donc soutenable.
              Le verbe d'abord, comme tous les libellés d'action du site. */}
          <Link href="/soutenir" className="pied-soutenir">
            Soutenir le projet
            <span className="pied-soutenir-fleche" aria-hidden="true">→</span>
          </Link>
        </div>

        {/* La liste des dix jeux ne parait que sur le defi du jour.

            Ailleurs elle faisait doublon : la page d accueil les liste deja
            dans son bloc de presentation, et les pages de jeu ont leur propre
            navigation d une epreuve a l autre. Le pied repetait donc un
            maillage existant, au prix d une rangee de dix liens sous chaque
            page.

            A GARDER EN TETE POUR LE REFERENCEMENT : ces liens etaient aussi
            du maillage interne, presents sur toutes les pages. Les pages
            legales et « soutenir » n ont plus de lien direct vers les jeux.
            Ce n est pas un probleme tant que l accueil et le plan du site les
            lient — c est le cas — mais si un jeu peine a etre explore, c est
            la premiere piste a revisiter. */}
        {avecJeux && (
        <nav className="pied-nav-jeux" aria-label={`Les ${EPREUVES.length} jeux`}>
          <div className="pied-titre">les {EPREUVES.length} jeux</div>
          <ul className="pied-liste pied-liste-jeux">
            {EPREUVES.map((e) => (
              <li key={e.slug}>
                <Link href={lienEpreuve(e.slug)} className="pied-lien">
                  <span className="pied-num">{e.num}</span>
                  {e.nom}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        )}

        <nav className="pied-nav-site" aria-label="Navigation du site">
          <div className="pied-titre">le site</div>
          {/* SOUTENIR FIGURE DEUX FOIS DANS CE PIED, ET C'EST VOULU.

              L'occurrence de la signature, à gauche, tire sa force de son
              contexte : elle suit « gratuits, sans inscription », et
              l'invitation y arrive comme la suite de la phrase. Celle-ci
              répond à un autre besoin — quelqu'un qui parcourt les rubriques
              de navigation cherche une liste de pages, et « Soutenir » en est
              une. Deux lecteurs, deux chemins.

              Aucun enjeu d'indexation : deux liens vers une même URL sur une
              même page sont consolidés par les moteurs, qui retiennent l'ancre
              du premier et ignorent le second. Pas de pénalité, pas de
              dilution — la question est uniquement de composition.

              EN DERNIER dans la liste : Accueil et Défi du jour sont les
              destinations courantes, Soutenir est l'invitation. L'ordre va du
              plus attendu au plus engageant, jamais l'inverse. */}
          <ul className="pied-liste">
            <li><Link href="/" className="pied-lien">Accueil</Link></li>
            <li><Link href="/quotidien" className="pied-lien">Défi du jour</Link></li>
            <li><Link href="/soutenir" className="pied-lien">Soutenir</Link></li>
          </ul>
        </nav>

        <nav className="pied-nav-infos" aria-label="Informations légales">
          <div className="pied-titre">informations</div>
          <ul className="pied-liste">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="pied-lien">{l.libelle}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="pied-bas">
        <span>© {annee} {SITE_NOM}</span>
        {/* La provenance n'est pas une politesse : elle dit que le site ne
            rehéberge aucun fichier, ce qui est exactement ce qui le rend
            légal. Elle mérite de rester visible.

            LES POCHETTES Y FIGURENT DESORMAIS. Elles manquaient, et c'était
            une omission de fond : ce sont des œuvres protégées au même titre
            que les extraits, chargées depuis les mêmes serveurs Deezer, et
            la ligne ne couvrait que le son. Nommer les deux fait coïncider
            cette mention avec ce que décrivent les mentions légales et la
            politique de confidentialité — trois pages qui parlent du même
            transfert doivent le décrire pareil.

            LES CHIFFRES DE STREAMS AUSSI. Ils viennent de kworb.net, figés
            dans public/data/duels.json (champ « source »), et alimentent le
            jeu Duel. Une donnée reprise d'un tiers se cite : c'est la règle
            de base, et le jeu l'appliquait déjà dans son écran de partie —
            le pied de page était le seul endroit à ne pas le faire, alors
            que c'est lui qui parle de provenance pour tout le site.

            « Extraits et pochettes » plutôt que « contenus musicaux », qui
            aurait été plus court mais aurait cessé de nommer ce dont il
            s'agit. Une mention de provenance qui reste vague ne protège
            personne. */}
        <span>
          Extraits et pochettes fournis par Deezer, chiffres de streams par
          kworb.net, sons de synthèse et échantillons libres.
        </span>
      </div>
    </footer>
  );
}
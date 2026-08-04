'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';

/**
 * Bloc « à propos » de la page d'accueil, posé sous la carte du défi.
 *
 * ------------------------------------------------------------------ le fond
 *
 * Il existe pour deux raisons. La première est le maillage interne : la
 * vitrine ne montre que cinq jeux sur dix, et les cinq autres n'étaient liés
 * depuis nulle part sur la page qui a le plus d'autorité à transmettre. La
 * liste ci-dessous les lie tous, avec leur intitulé en texte de lien.
 *
 * La seconde est la matière : l'accueil disait une soixantaine de mots de ce
 * qu'est le site. Aucune balise ne compense une page qui ne dit rien.
 *
 * ------------------------------------------------------------- le mouvement
 *
 * TROIS RÈGLES, ET ELLES SE TIENNENT.
 *
 * 1. RIEN NE BOUGE AVANT D'ÊTRE VU. L'apparition se déclenche à l'entrée dans
 *    le champ, pas au chargement. Une animation jouée pendant qu'on regarde
 *    ailleurs est du travail perdu, et elle interdit de revenir dessus.
 *
 * 2. L'ÉTAT MASQUÉ EST POSÉ DÈS LE PREMIER RENDU. Une version précédente ne
 *    le posait qu'après montage, pour ne jamais rien cacher à un lecteur sans
 *    script. C'était trop fragile : au rechargement, le navigateur restaure la
 *    position de défilement, l'observateur trouvait le bloc déjà visible, et
 *    React regroupait les deux changements d'état dans un même rendu. Le bloc
 *    passait de visible à visible, sans jamais peindre l'état masqué, donc
 *    sans rien à interpoler.
 *
 *    Il est donc masqué d'emblée, et trois portes de sortie le révèlent quoi
 *    qu'il arrive : le réglage système, l'absence d'IntersectionObserver, et
 *    un minuteur de quatre secondes. Le `<noscript>` couvre le dernier cas.
 *
 * 3. UNE SEULE FOIS. L'observateur se débranche après le premier passage. Un
 *    bloc qui rejoue son entrée à chaque défilement devient une nuisance dès
 *    le deuxième aller-retour.
 *
 * La courbe et la durée sont celles de l'onde, la seule animation longue du
 * site : le bloc entre comme elle se déplace, ce qui le rattache au reste
 * plutôt que d'introduire un second langage de mouvement.
 */
/* Depart de la grille des dix, en millisecondes apres le declenchement.
 *
 * L'en-tete part a zero, la grille a 500. Les deux mouvements se CHEVAUCHENT
 * donc largement : la grille demarre pendant que le titre finit sa course.
 *
 * C'est un choix, pas un oubli. A 1 800, les deux temps etaient distincts mais
 * le bloc mettait pres de trois secondes a se poser entierement, et l'attente
 * se remarquait plus que la sequence. A 500, l'ensemble se lit comme UN SEUL
 * mouvement qui se propage du titre vers la grille, et tout est en place en
 * un peu plus d'une seconde.
 *
 * Ecrit ici plutot qu'en dur dans le style : le retard de chaque carte s'en
 * deduit, et changer la valeur les decale toutes ensemble. */
const DEPART_GRILLE = 500;

export default function BlocAccueil() {
  const cadre = useRef(null);
  const [vu, setVu] = useState(false);

  /* ---- LE REPLI DES DEUX DERNIERS PARAGRAPHES ----
   *
   * Il n'existe QUE sous 640 px, et c'est la requête média qui le décide, pas
   * ce booléen. Sur ordinateur, la prose vit dans une colonne de 620 px face
   * au titre : quatre paragraphes s'y lisent sans effort, et les replier
   * ajouterait un geste à une lecture qui n'en demande pas.
   *
   * L'état est donc posé ici mais reste sans effet visible tant que l'écran
   * est large — aucune règle ne le lit. C'est voulu : une seule source de
   * vérité, et rien à synchroniser avec la largeur de la fenêtre.
   *
   * FERMÉ AU PREMIER RENDU, y compris côté serveur. Le HTML servi contient
   * les quatre paragraphes ; seul leur affichage est borné en CSS. Un contenu
   * replié reste indexé, un contenu conditionné à un état React ne l'est pas —
   * et ces deux paragraphes portent le vocabulaire de la page.
   */
  const [deplie, setDeplie] = useState(false);

  useEffect(() => {
    const cible = cadre.current;
    if (!cible) return;

    /* Trois portes de sortie, et chacune AFFICHE le bloc plutot que de le
       laisser masque. Le principe est constant : en cas de doute, on montre.

       La premiere est le respect du reglage systeme. La seconde couvre un
       navigateur sans IntersectionObserver. La troisieme est un simple
       minuteur : si rien ne s'est declenche au bout de quatre secondes, on
       renonce a l'animation et on affiche. Sans lui, une erreur de mesure
       laisserait un pan entier de la page invisible, ce qui serait un defaut
       autrement plus grave qu'une entree ratee. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || typeof IntersectionObserver === 'undefined') {
      setVu(true);
      return;
    }

    /* ---- ON N'OBSERVE PAS CE BLOC, MAIS CELUI D'AVANT ----
     *
     * L'entree doit partir APRES que la carte du defi du jour se soit posee,
     * et non des que le bloc affleure. Observer le bloc lui-meme ne pouvait
     * pas donner cet enchainement : sa position ne dit rien de ce qui le
     * precede, et selon la hauteur de l'ecran il pouvait entrer alors que la
     * carte etait encore a moitie sortie du champ.
     *
     * La cible est donc `.bloc-quotidien`, avec un seuil de 0,9 : elle doit
     * etre presque entierement visible. On tient alors la sequence voulue,
     * la carte se pose, puis le bloc arrive.
     *
     * Repli sur le bloc lui-meme si la carte est absente. Elle ne l'est
     * jamais aujourd'hui, mais une entree qui depend d'un element voisin doit
     * survivre a sa disparition. */
    const carte = document.querySelector('.bloc-quotidien');
    const declencheur = carte ?? cible;

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          /* DEUX SECONDES avant de partir, et c'est volontairement long.
             La carte du defi porte elle-meme une entree qui se termine autour
             de deux mille millisecondes apres l'arrivee sur la page ; un
             demarrage a trois cent cinquante ne laissait donc pas la carte
             se poser, il se superposait a la fin de son propre mouvement.

             Ce delai fait aussi office de garde-fou contre le defilement
             rapide : quelqu'un qui devale la page a vu la carte passer avant
             que le bloc ne bouge, et il le decouvre pose. C'est le
             comportement voulu, l'animation s'adresse a qui s'arrete. */
          setTimeout(() => setVu(true), 2000);
          observateur.disconnect();
        }
      },
      carte
        /* La carte doit etre presque entierement dans le champ. */
        ? { threshold: 0.9 }
        /* Repli : l'ancien declenchement, au quart inferieur de l'ecran. */
        : { threshold: 0, rootMargin: '0px 0px -25% 0px' }
    );
    observateur.observe(declencheur);

    /* Filet de secours, repousse a six secondes : il doit rester bien au dela
       du declenchement normal, qui peut desormais tarder de deux secondes
       apres l'apparition de la carte. A quatre, il aurait pu couper l'attente
       et afficher le bloc sans animation alors que tout fonctionnait. */
    /* Filet de secours. Il doit rester au dela de la fin du deroule complet :
       deux secondes d'attente, puis 500 avant la grille, puis un peu plus
       d'une seconde pour que la derniere carte se pose, soit environ trois
       secondes et demie. Six secondes laissent la marge necessaire sans jamais
       couper une sequence en cours. */
    const secours = setTimeout(() => setVu(true), 6000);
    return () => { observateur.disconnect(); clearTimeout(secours); };
  }, []);

  return (
    <section
      ref={cadre}
      data-etat={vu ? 'vu' : 'attente'}
      data-deplie={deplie ? '1' : '0'}
      className="ba"
    >
      <style>{`
        /* Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
           accent grave isole y refermerait la chaine CSS en plein milieu. */

        /* ============================================================
           CE QUI ETAIT EN STYLE EN LIGNE

           Toutes les valeurs ci-dessous CHANGENT sous 640 px. Un style en
           ligne l emporte sur une requete media : il aurait fallu un
           !important par propriete, et la version mobile serait devenue
           illisible a maintenir. Meme arbitrage que la page d accueil, qui a
           sorti ses marges verticales pour la meme raison.

           Rien n est modifie sur ordinateur : ce sont les memes valeurs,
           deplacees.
        ============================================================ */
        .ba {
          margin-top: calc(var(--e8) * 2);
          padding-top: var(--e6);
          border-top: 0.5px solid var(--filet);
        }
        .ba-titre {
          margin-top: var(--e3);
          font-size: 30px;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }
        .ba-p {
          margin-bottom: var(--e3);
          font-size: 13.5px;
          line-height: 1.75;
          text-wrap: pretty;

          /* ---- JUSTIFIE, ET DONC CESURE ----
             Les deux proprietes ne se separent pas. Justifier seul reporte
             toute la correction sur les espaces entre les mots : sur une
             colonne etroite, une ligne qui contient « connaissance » finit
             avec des blancs de trois fois la normale, et ces blancs s alignent
             d une ligne a l autre en rivieres verticales. C est le defaut que
             l oeil repere avant meme de lire.

             La cesure rend au moteur son second levier : il coupe les mots
             longs plutot que d ecarteler la ligne. Le francais en a besoin
             plus que l anglais — « connaissance », « necessaire »,
             « entrainement » — et c est justement le vocabulaire de ce bloc.

             La cesure exige une LANGUE DECLAREE : sans elle le navigateur n a
             pas de dictionnaire et ne coupe rien, ce qui ramenerait au premier
             cas. Le lang est pose sur le conteneur de prose plus bas, donc
             independamment de ce que porte la balise html.

             Le prefixe webkit reste necessaire pour Safari, qui n a jamais
             adopte la propriete standard. */
          text-align: justify;
          -webkit-hyphens: auto;
          hyphens: auto;
        }
        /* Le dernier paragraphe de chaque groupe ne pousse rien : sur
           ordinateur c est la fin du bloc, sur mobile c est le bord du tiroir
           replie, et une marge basse y ouvrirait un blanc sans cause. */
        .ba-p:last-child { margin-bottom: 0; }
        .ba-num {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.09em;
          color: var(--cendre);
        }

        /* ---- UNE SEULE apparition, pour tout le bloc ----
           L echelonnement element par element paraissait saccade : dix
           rangees qui montent l une apres l autre donnent dix petits
           mouvements au lieu d un seul, et l oeil suit chacun. Le bloc entre
           donc d un tenant, comme un panneau qui se pose.

           700 ms et la courbe de l onde : c est la seule animation longue du
           site, le bloc parle donc sa langue. */
        .ba-anim {
          opacity: 1;
          transform: none;
          transition:
            opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
          transition-delay: var(--retard, 0ms);
        }
        .ba[data-etat="attente"] .ba-anim {
          opacity: 0;
          transform: translateY(16px);
        }

        /* ---- L en tete entre PAR LA GAUCHE ----
           Le reste du bloc monte, l en tete glisse. Ce n est pas une fantaisie :
           un texte se lit de gauche a droite, et une entree qui suit ce sens
           accompagne le regard au lieu de le contrarier. Le glissement vertical
           convient a une liste, qu on parcourt de haut en bas ; l horizontal
           convient a une phrase.

           Neuf cent cinquante millisecondes, contre sept cents pour le reste.
           Un deplacement horizontal parcourt plus de distance qu un
           soulevement de seize pixels : a duree egale il paraitrait precipite.

           La courbe est celle de l onde, tres freinee en fin de course. Le
           bloc arrive vite puis se pose, ce qui est exactement la sensation
           d une chose qui glisse et s arrete.

           Les deux colonnes sont decalees de 160 ms. Sur deux elements le
           decalage ne hache rien, il DONNE LE SENS : le titre part, la prose
           suit, et l oeil lit le mouvement de gauche a droite. */
        .ba-tete > * {
          opacity: 1;
          transform: none;
          transition:
            opacity 950ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 950ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ba-tete > *:nth-child(2) { transition-delay: 160ms; }
        .ba[data-etat="attente"] .ba-tete > * {
          opacity: 0;
          transform: translateX(-44px);
        }

        /* ---- La rangee entiere est cliquable ----
           Le nom seul faisait un lien de quatre-vingts pixels de large sous
           une description qui, elle, ne repondait pas au clic. La cible tactile
           passe a la rangee complete, et le retrait horizontal negatif fait
           deborder la surface de survol au dela de la colonne de texte : elle
           se lit alors comme une ligne de liste, pas comme un rectangle pose
           par dessus. */
        /* ---- L en tete se lit sur DEUX colonnes ----
           Le titre occupait toute la largeur d une colonne de 620 px, puis la
           prose s empilait dessous : les deux tiers droits de la page
           restaient vides sur toute la hauteur du bloc. Un texte etroit dans
           un grand vide ne se lit pas comme une intention, mais comme une
           mise en page inachevee.

           Le titre part donc a gauche, la prose a droite. C est la
           composition d une ouverture de chapitre : on voit d abord de quoi
           on parle, on lit ensuite. Chaque colonne garde une longueur de
           ligne confortable, et la largeur est occupee.

           minmax borne les deux : le titre ne s etale jamais au dela de 340,
           la prose jamais au dela de 620. Sur un ecran de 1600, l ensemble
           reste un bloc de lecture, pas une banderole. */
        .ba-tete {
          display: grid;
          grid-template-columns: minmax(260px, 340px) minmax(0, 620px);
          gap: var(--e5) var(--e8);
          margin-bottom: var(--e8);
          /* Le titre se cale au MILIEU de la hauteur de la prose, pas en haut.

             Aligne sur le haut, il laissait sous lui un vide egal a la
             difference de hauteur des deux colonnes, soit pres de deux cents
             pixels : le regard lisait un titre accroche au plafond au dessus
             d un trou. Centre, il fait face au paragraphe du milieu et les
             deux colonnes se repondent.

             C est la regle des compositions a deux colonnes de longueurs
             inegales : la courte se centre sur la longue, jamais l inverse. */
          align-items: center;
          /* Les deux colonnes sont CENTREES dans la page, pas collees au bord
             gauche. Ensemble elles font au plus mille pixels ; posees a gauche
             d un ecran de 1600, elles laissaient six cents pixels de vide sur
             toute leur hauteur, et le bloc paraissait tomber du mauvais cote.

             justify-content agit sur les pistes de la grille, pas sur le texte
             qu elles contiennent : les deux colonnes se rapprochent du milieu,
             chaque paragraphe reste aligne a gauche et donc lisible.

             L en tete devient ainsi une introduction resserree au dessus d une
             grille pleine largeur. C est un contraste voulu : on se recentre
             pour lire, on s etale pour choisir. */
          justify-content: center;
        }
        @media (max-width: 940px) {
          /* Empilees, les deux colonnes n ont plus de hauteur a partager :
             le centrage vertical n a plus d objet et le titre reprend sa
             place au dessus de la prose. */
          .ba-tete {
            grid-template-columns: 1fr;
            gap: var(--e4);
            align-items: start;
          }
        }

        /* ---- Les dix cartes entrent UNE PAR UNE ----
           La grille entrait d un bloc, ce qui donnait dix colonnes posees
           d un coup : beaucoup de matiere qui apparait sans que rien ne guide
           le regard. Chaque carte a desormais son propre retard, et l oeil
           parcourt la grille dans l ordre ou il la lirait de toute facon,
           de gauche a droite puis a la ligne.

           HUIT PIXELS ET NON QUARANTE-QUATRE. Le deplacement est vertical et
           court, exactement celui de la grille d accueil du site : c est la
           meme forme, elle doit avoir le meme geste. L en tete garde son long
           glissement horizontal, parce qu il porte une phrase et non une
           liste.

           520 ms par carte, 55 ms entre deux. Le decalage est court a dessein :
           en dessous de cinquante, les dix se confondent en une seule entree ;
           au dela de quatre-vingts, la derniere carte se fait attendre une
           demi-seconde apres la premiere, et le retard devient perceptible
           comme un defaut plutot que comme un rythme. */
        .ba-carte {
          opacity: 1;
          transform: none;
          transition:
            opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
          transition-delay: var(--retard, 0ms);
        }
        .ba[data-etat="attente"] .ba-carte {
          opacity: 0;
          transform: translateY(8px);
        }

        /* Trois lignes au plus par description : les hauteurs de colonne se
           calent, et la seconde rangee demarre sur un alignement franc plutot
           que sur un bord dechiquete. Le texte entier reste dans le document,
           seul son affichage est borne. */
        .ba-desc {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-top: var(--e2);
          font-size: 12.5px;
          line-height: 1.6;
        }

        /* ---- Dix colonnes, pas dix lignes ----
           En liste verticale de 620 px, les dix jeux formaient une enumeration
           qu on parcourt du regard sans la lire : une liste de courses. La
           landing, elle, range ses epreuves en grille pleine largeur, avec un
           filet au dessus de chaque colonne. Le bloc reprend cette grammaire,
           qui est celle de la page.

           auto-fit et une largeur plancher de 250 px : cinq colonnes sur un
           grand ecran, trois sur un portable, deux sur une tablette, une sur
           un telephone. Aucun point de rupture a maintenir. */
        .ba-grille {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--e5) var(--e4);
          list-style: none;
          margin: 0;
          padding: 0;
        }
        /* ---- Le filet se TRACE de gauche a droite au survol ----
           Une bordure ne se trace pas : on ne peut que la faire changer de
           couleur d un coup. Le trait est donc dessine par deux
           pseudo-elements superposes, et c est le second qu on met a
           l echelle depuis son bord gauche.

           C est exactement le procede du filet or de l en tete du site et de
           celui des cellules de l epreuve Artiste : la meme forme doit avoir
           le meme geste. Rien de nouveau n est invente ici.

           scaleX plutot qu une largeur animee : la mise a l echelle est
           composee par le processeur graphique, une largeur declencherait un
           recalcul de mise en page a chaque image.

           Les epaisseurs suivent le document de design : 0,5 px au repos,
           1 px sur l element actif. Le trait dore recouvre donc le gris, il
           ne s ajoute pas a lui. */
        .ba-jeu {
          display: block;
          position: relative;
          color: inherit;
          padding: var(--e3) var(--e2) var(--e3) 0;
          transition: color var(--transition-courte);
        }
        .ba-jeu::before,
        .ba-jeu::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
        }
        .ba-jeu::before {
          height: 0.5px;
          background: var(--filet);
        }
        .ba-jeu::after {
          height: 1px;
          background: var(--or);
          transform: scaleX(0);
          transform-origin: left center;
          /* 560 ms : un trait de trois cents pixels parcouru en deux cent
             vingt paraitrait sec. La courbe est celle de l onde, tres freinee
             en fin de course, pour que le trait arrive et se pose au lieu de
             buter sur le bord droit.

             Le trait est le SEUL element ralenti. Le nom et la fleche gardent
             leurs deux cent vingt millisecondes : ils sont a gauche, donc au
             depart du trace, et les ralentir les ferait trainer derriere lui
             au lieu de l accompagner. Un survol se juge a sa reactivite dans
             les cent premieres millisecondes, pas a sa duree totale. */
          transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ba-nom {
          display: block;
          margin-top: var(--e1);
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 500;
        }
        .ba-jeu .ba-nom {
          color: var(--ivoire);
          transition: color var(--transition-courte);
        }
        .ba-fleche {
          display: inline-block;
          margin-left: var(--e2);
          color: var(--or);
          opacity: 0;
          transform: translateX(-6px);
          transition:
            opacity var(--transition-courte),
            transform var(--transition-courte);
        }

        /* Le survol allume le FILET, pas un fond. C est le geste de la grille
           de la landing et du carrousel des dix : un trait qui passe a l or.
           Un rectangle de fond aurait introduit une surface la ou la page n en
           a pas. */
        @media (hover: hover) and (pointer: fine) {
          .ba-jeu:hover::after { transform: scaleX(1); }
          .ba-jeu:hover .ba-nom { color: var(--or); }
          .ba-jeu:hover .ba-fleche { opacity: 1; transform: translateX(0); }
        }
        /* Le clavier a droit au meme retour que la souris. */
        .ba-jeu:focus-visible::after { transform: scaleX(1); }
        .ba-jeu:focus-visible .ba-nom { color: var(--or); }
        .ba-jeu:focus-visible .ba-fleche { opacity: 1; transform: translateX(0); }

        /* ============================================================
           LE TIROIR DES DEUX DERNIERS PARAGRAPHES

           Par defaut il n existe pas : aucune regle ici ne le replie, et sur
           ordinateur le groupe se lit comme les deux premiers. Tout le
           mecanisme vit dans la requete media plus bas.

           Le bouton, lui, est declare masque ici et revele la-bas. L inverse
           aurait laisse une commande orpheline sur grand ecran le jour ou la
           requete media bougerait d un pixel. */
        .ba-deplier { display: none; }

        .ba-chevron {
          display: inline-block;
          transition: transform var(--transition-courte);
        }
        .ba[data-deplie="1"] .ba-chevron { transform: rotate(180deg); }

        /* ============================================================
           SOUS 640 PX

           Trois problemes, et ils tiennent tous a la meme cause : ce bloc a
           ete compose pour une page large, et rien n y a ete rejoue pour un
           telephone.

           1. Quatre paragraphes de prose en tete de bloc font un mur de
              trente lignes. Sur ordinateur ils occupent une colonne face au
              titre, et le regard voit d un coup ou ils s arretent. Empiles
              sur 328 px, on ne voit plus la fin, et ce qui suit — la liste
              des dix jeux, qui est la seule chose actionnable du bloc —
              disparait sous l horizon.

           2. La grille tombe a une colonne, mais chaque entree garde sa forme
              de carte : numero sur une ligne, nom sur la suivante, trois
              lignes de description. Quatre-vingt-dix pixels par jeu, neuf
              cents pour les dix. Une liste qu on ne parcourt pas, on la subit.

           3. Les marges sont calibrees pour un grand ecran. Deux fois --e8 en
              tete du bloc, soit pres de cent cinquante pixels de vide apres
              une carte du defi qu on vient deja de depasser.
        ============================================================ */
        @media (max-width: 640px) {

          /* ---- Le bloc se resserre ---- */
          .ba { margin-top: var(--e7); padding-top: var(--e5); }
          .ba-tete { gap: var(--e3); margin-bottom: var(--e6); }

          /* Le titre etait fixe a 30 px, calibre sur une colonne de 340. En
             pleine largeur de telephone il tenait sur trois lignes molles.
             clamp le ramene a deux sans jamais depasser sa valeur d origine. */
          .ba-titre { font-size: clamp(23px, 6.6vw, 30px); }

          /* Un cran de corps en plus, et un interligne un peu resserre. C est
             le seul texte de lecture suivie du site : 13,5 px convient a une
             colonne bornee vue a soixante centimetres, pas a un telephone
             tenu a trente. */
          .ba-p { font-size: 14.5px; line-height: 1.68; }

          /* ---- LE TIROIR ----
             max-height et non height : la hauteur reelle depend du corps de
             texte et de la largeur de l ecran, on ne peut pas l ecrire. La
             borne haute est genereuse — les deux paragraphes en font environ
             deux cent quarante — et la courbe tres freinee masque le fait que
             la transition finit avant d avoir atteint sa valeur cible.

             visibility, et pas seulement overflow. Un contenu de hauteur nulle
             mais visible reste annonce par un lecteur d ecran : la commande
             dirait « replie » pendant que le texte serait lu quand meme. Le
             retard de transition la fait basculer APRES la fermeture et DES
             l ouverture, pour ne jamais tronquer le mouvement. */
          .ba-suite {
            overflow: hidden;
            max-height: 0;
            visibility: hidden;
            transition:
              max-height 400ms cubic-bezier(0.22, 1, 0.36, 1),
              visibility 0s linear 400ms;
          }
          .ba[data-deplie="1"] .ba-suite {
            max-height: 720px;
            visibility: visible;
            transition:
              max-height 400ms cubic-bezier(0.22, 1, 0.36, 1),
              visibility 0s;
          }

          /* Le paragraphe qui precede le tiroir garde sa marge basse : elle
             separe la prose de la commande. Sans elle, le bouton se collait
             au texte et se lisait comme une cinquieme ligne. */
          .ba-deplier {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--e3);
            width: 100%;
            min-height: 44px;
            padding: 12px 0;
            margin-top: var(--e3);
            background: none;
            border: none;
            border-top: 0.5px solid var(--filet);
            color: var(--or);
            font-family: var(--mono);
            font-size: 10.5px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            text-align: left;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }

          /* ---- Les dix jeux deviennent un sommaire ----
             Meme geste que la vitrine des cinq sur cette page : pas de
             gouttiere, les filets separent. Dix cartes espacees se lisent
             comme dix objets sans rapport ; dix rangees contigues se lisent
             comme une liste qu on parcourt.

             La rangee est une grille de deux colonnes : le numero tient la
             premiere, le nom et la description partagent la seconde. La
             description reste donc alignee sous l intitule et non sous le
             chiffre — l oeil descend le long d un seul axe.

             La cible tactile fait 48 px, minimum recommande. */
          .ba-grille { gap: 0; }
          .ba-jeu {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            column-gap: var(--e3);
            align-items: baseline;
            padding: 13px 0;
            min-height: 48px;
            box-sizing: border-box;
          }
          .ba-num { grid-column: 1; }

          /* Le nom et la fleche aux deux bouts de la rangee. Le texte du nom
             devient une boite anonyme, la fleche reste un element : deux
             elements flex, donc space-between suffit. */
          .ba-nom {
            grid-column: 2;
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: var(--e3);
            margin-top: 0;
            font-size: 14.5px;
          }

          /* La fleche est acquise, pas conquise : il n y a pas de survol sur
             un telephone, et une fleche invisible qui n apparait jamais est
             une fleche absente. En cendre et non en or — elle dit qu on peut
             appuyer, elle ne reclame pas l attention dix fois de suite. */
          .ba-fleche {
            opacity: 1;
            transform: none;
            margin-left: 0;
            color: var(--cendre);
            font-size: 14px;
          }

          /* Deux lignes au lieu de trois, et un corps plus petit. La
             description reste presente — c est elle qui fait choisir un jeu
             plutot qu un autre — mais elle cesse de doubler la hauteur de
             chaque rangee. */
          .ba-desc {
            grid-column: 2;
            -webkit-line-clamp: 2;
            margin-top: 3px;
            font-size: 12px;
            line-height: 1.45;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ba-anim, .ba-tete > *, .ba-carte, .ba-jeu, .ba-nom, .ba-fleche,
          .ba-jeu::after, .ba-suite, .ba-chevron {
            transition: none !important;
          }
          .ba[data-etat="attente"] .ba-anim,
          .ba[data-etat="attente"] .ba-tete > *,
          .ba[data-etat="attente"] .ba-carte {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* Le bloc etant masque des le premier rendu, un navigateur sans script
          ne le reverrait jamais : cette regle est desormais indispensable, et
          non plus une precaution. Elle ne s'applique que si le script est
          desactive, le navigateur ignorant le contenu du noscript sinon.

          Le tiroir relevait du meme piege, en pire : son etat n'est change que
          par un gestionnaire de clic. Sans script, le bouton ne repond pas et
          les deux derniers paragraphes restaient inaccessibles pour de bon.
          Ils sont donc deplies, et la commande devenue inerte disparait. */}
      <noscript>
        <style>{'.ba .ba-anim, .ba .ba-tete > *, .ba .ba-carte { opacity: 1 !important; transform: none !important; } .ba .ba-suite { max-height: none !important; visibility: visible !important; overflow: visible !important; } .ba .ba-deplier { display: none !important; }'}</style>
      </noscript>

      {/* UN SEUL element porte l'animation : tout ce qui suit entre ensemble.
          Les retards par element ont ete retires, ils rendaient l'entree
          saccadee. */}
      <div>
        {/* La colonne de lecture reste bornee et ALIGNEE A GAUCHE, comme le
            titre et le sous-titre de la page. Un texte centre au milieu de
            1600 px n'appartenait a aucun axe ; ici il partage celui du reste
            de la landing. Soixante-dix signes par ligne restent la limite
            au-dela de laquelle l'oeil perd le rang suivant. */}
        <div className="ba-tete">
          <div>
            {/* Or et non cendre. C est l usage que le document de design
                assigne a cette couleur : bordure active, lien, ETIQUETTE DE
                SECTION. Les deux labels de ce bloc sont exactement cela.

                Le risque etait de faire briller deux choses dans la meme
                zone, ce que la premiere regle interdit. Il n existe pas ici :
                dix virgules et demie de mono espace ne pesent rien face au
                titre de trente pixels, et elles ne font que signaler ou
                commence une section. Les numeros des dix cartes, eux, restent
                en cendre : dix chiffres dores auraient, cette fois, vraiment
                dilue l accent. */}
            <div className="etiquette-mono" style={{ color: 'var(--or)' }}>
              à propos
            </div>

            {/* ---- Le titre dit A QUOI SERT le site ----
                « D'ou vient ton oreille musicale ? » posait une question
                d'origine. C'etait juste, mais ca expliquait un phenomene la ou
                il fallait annoncer un usage : personne ne cherche a savoir
                d'ou vient son oreille, on cherche a quoi elle peut servir.

                « CA COMPTE » PORTE DEUX SENS EN MEME TEMPS, et c'est tout
                l'interet. Ca compte au sens de : ce n'est pas du temps perdu.
                Et ca compte au sens de : c'est comptabilise, note, additionne
                sur dix. Le double sens est exactement le pont entre l'habitude
                d'ecouter et le score du site.

                « ENFIN » porte le recit a lui seul. Il sous-entend des annees
                d'accumulation sans usage, sans avoir a les raconter — le
                premier paragraphe s'en charge juste a cote.

                Aucun point d'interrogation : c'est une affirmation, et elle
                repond a la question posee par le titre de page.

                CONTREPARTIE ASSUMEE : l'expression exacte « oreille musicale »
                quitte ce <h2>. Elle reste dans le <h1> et dans le dernier
                paragraphe de ce bloc — « l'oreille musicale ne se recoit pas a
                la naissance » — donc le corps de la page la porte toujours
                deux fois. C'est ce qui rendait ce titre-ci finalement
                remplacable. */}

            <h2 className="titre-section ba-titre">
              Écouter de la musique, ça compte enfin
            </h2>
          </div>

          {/* lang sur la colonne de prose, et non seulement sur la balise html.
              C'est ce que lit le moteur pour choisir son dictionnaire de
              cesure : sans langue declaree, hyphens:auto ne coupe rien et la
              justification retombe sur ses seuls blancs, ce qui est exactement
              ce qu'on cherche a eviter. Le poser ici rend le bloc autonome. */}
          <div lang="fr">
          {/* ---- QUATRE PARAGRAPHES, ET LE PREMIER EST NOUVEAU ----
              Les trois anciens decrivaient un produit : ce qu'on y fait,
              comment, selon quelles regles. Rien ne disait POURQUOI ce site
              existe.

              Le premier repare ca. Il part d'un constat que le lecteur peut
              verifier sur lui-meme, et il en tire la promesse : cette culture
              est deja la, elle n'a simplement jamais servi. C'est le meme
              propos que le titre de la page, developpe.

              Le dernier est une precaution autant qu'un ton. Le site note sur
              dix, affiche des barremes et se compare d'un jour a l'autre :
              tout cela ressemble a un test, et il vaut mieux dire soi-meme que
              ce n'en est pas un. L'aveu coute moins cher que le malentendu, et
              il rend le reste plus credible.

              IL NE S'OUVRE PLUS SUR UNE NEGATION. « Ce n'est pas un test
              officiel, et rien ici ne pretend mesurer quoi que ce soit de
              scientifique » commencait par se defendre, et deux negations
              d'affilee sonnent comme des mentions legales. Un paragraphe qui
              se justifie avant d'avoir rien affirme perd sa credibilite au lieu
              d'en gagner.

              La formulation est retournee : on dit A QUOI SERVENT les notes —
              se situer, revenir le lendemain — plutot que ce qu'elles ne sont
              pas. La reserve est aussi claire, mais elle est portee par une
              affirmation.

              LE PIVOT TIENT EN UN MOT. Une phrase entiere — « le jeu repose
              pourtant sur quelque chose de vrai » — servait a retourner la
              reserve. « Mais » fait le meme travail et libere douze mots.
              Le paragraphe passe de cinquante-deux mots a quarante, et sa
              derniere phrase, la plus belle du bloc, arrive plus vite.

              SA DERNIERE PHRASE A ETE REECRITE. Elle disait : « elle n'a jamais
              ete un don, seulement une habitude ». L'idee etait juste mais le
              raccourci ne passait pas a la premiere lecture — une oreille n'EST
              pas une habitude, elle VIENT d'une habitude, et le lecteur devait
              reconstruire ce chainon tout seul.

              La version suivante — « ne vient pas d'un don : elle vient de tout
              ce qu'on a ecoute » — etait claire mais plate. Elle constatait un
              mecanisme la ou il fallait rendre quelque chose au lecteur.

              CELLE-CI LUI REND SES ANNEES. « Chanson apres chanson » remplace
              une abstraction par un geste qu'il a fait des milliers de fois.
              Et « ou tu croyais seulement ecouter » retourne tout : ces heures
              passees dans le metro ou dans une cuisine n'etaient pas perdues,
              elles construisaient quelque chose. C'est la promesse du premier
              paragraphe, tenue a la derniere ligne.

              « Personne ne nait avec » est laisse en ellipse : le complement
              vient d'etre dit, le repeter aurait alourdi la seule phrase du
              bloc qui doit rester en tete apres la lecture. */}
          {/* ---- OU PASSE LA COUPURE ----
              Entre le deuxieme et le troisieme, et pas ailleurs. Les deux
              premiers forment un tout qui se suffit : le constat, puis ce que
              le site en fait. Quelqu'un qui s'arrete la a compris de quoi il
              s'agit et peut descendre vers les dix jeux.

              Les deux suivants repondent a des questions qu'on ne se pose
              qu'apres — comment on joue, et jusqu'ou il faut prendre les notes
              au serieux. Ce sont exactement les paragraphes qu'on va CHERCHER
              plutot que ceux qu'on lit en passant, et donc ceux qui gagnent a
              etre derriere un geste. */}
          <p className="description ba-p">
            Tu écoutes de la musique dans les transports, en cuisinant, en travaillant,
            après une rupture. Des milliers d’heures, sans jamais y penser. Cette écoute a
            laissé quelque chose derrière elle : une mémoire des timbres, des refrains et
            des tempos que tu n’as jamais eu l’occasion de mesurer.
          </p>

          <p className="description ba-p">
            Mozart Benchmark est fait pour ça. Dix jeux musicaux, deux minutes chacun,
            une note sur dix. On y reconnaît des accords, on reproduit des rythmes, on
            cherche le tempo d’un morceau, on démasque une musique générée par une
            machine. Aucune connaissance en solfège n’est nécessaire : les notes se posent
            au clic, les rythmes se tapent à la barre d’espace, et chaque jeu explique sa
            méthode sous la scène.
          </p>

          {/* La commande PRECEDE son tiroir dans le document comme a l'ecran :
              on annonce qu'il y a une suite avant de la donner. L'inverse
              aurait fait lire le bouton apres un texte deja deploye.

              aria-expanded porte l'etat, aria-controls le lien vers la region.
              Le libelle change avec l'etat plutot que de rester fixe : « lire
              la suite » sur un tiroir ouvert serait un mensonge, et c'est la
              seule chose qu'un lecteur d'ecran entend.

              type="button" est indispensable : sans lui, un bouton place dans
              un formulaire vaudrait « envoyer ». Il n'y en a pas ici, mais la
              valeur par defaut du HTML est un piege qu'on ne veut pas laisser
              trainer. */}
          <button
            type="button"
            className="ba-deplier"
            aria-expanded={deplie}
            aria-controls="ba-suite"
            onClick={() => setDeplie((v) => !v)}
          >
            <span>{deplie ? 'replier' : 'lire la suite'}</span>
            <span className="ba-chevron" aria-hidden="true">↓</span>
          </button>

          <div className="ba-suite" id="ba-suite" role="region" aria-label="Suite de la présentation">
            <p className="description ba-p">
              Deux façons de jouer. À l’entraînement, tu enchaînes autant de parties que tu
              veux. Au <Link href="/quotidien">défi du jour</Link>, les dix jeux sont les
              mêmes pour tout le monde jusqu’à minuit, avec une seule tentative chacun et un
              score sur 100 à partager. Le mieux est de s’entraîner avant de tenter le défi.
            </p>

            <p className="description ba-p">
              Rien ici n’est un test officiel : les notes servent à se situer, pas à juger.
              Mais l’oreille musicale ne se reçoit pas qu’à la naissance : elle se fabrique
              chanson après chanson, dans toutes ces heures où tu croyais seulement écouter.
            </p>
          </div>
          </div>
        </div>

        {/* L'etiquette part 120 ms avant la premiere carte : elle annonce la
            grille, elle ne l'accompagne pas. */}
        <div
          className="etiquette-mono ba-anim"
          style={{
            color: 'var(--or)', marginBottom: 'var(--e3)',
            '--retard': `${DEPART_GRILLE - 120}ms`,
          }}
        >
          les {EPREUVES.length} jeux
        </div>

        {/* La grille prend TOUTE la largeur, comme la vitrine plus haut. Chaque
            colonne porte son filet, son numero en mono, son intitule et sa
            phrase : c'est exactement l'anatomie d'une entree de la vitrine,
            description comprise. */}
        <ul className="ba-grille">
          {EPREUVES.map((e, i) => (
            <li
              key={e.slug}
              className="ba-carte"
              style={{ '--retard': `${DEPART_GRILLE + i * 55}ms` }}
            >
              <Link href={lienEpreuve(e.slug)} className="ba-jeu">
                <span className="ba-num">{e.num}</span>
                <span className="ba-nom">
                  {e.nom}
                  <span className="ba-fleche" aria-hidden="true">→</span>
                </span>
                {/* PAS DE `pre-line` ICI, contrairement au titre de la page
                    d'epreuve. Deux descriptions portent un saut de ligne
                    ecrit dans data/epreuves.js, pose pour que la phrase coupe
                    entre ses deux propositions sur une colonne de 470 px. Dans
                    une carte de trois cents, ce saut arrivait EN PLUS du
                    repliement naturel : le Duel occupait trois lignes dont une
                    de deux mots.

                    Le meme texte, deux contextes, deux traitements. La carte
                    laisse le texte se replier selon sa largeur ; la page
                    d'epreuve, elle, garde la coupure d'auteur. */}
                <span className="description ba-desc">{e.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
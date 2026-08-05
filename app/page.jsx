'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Onde from '@/components/Onde';
import BlocAccueil from '@/components/BlocAccueil';
import Ambiance from '@/components/Ambiance';
import PiedDePage from '@/components/PiedDePage';
import { EPREUVES as CATALOGUE, lienEpreuve } from '@/data/epreuves';

/**
 * Les cinq épreuves mises en avant sur l'accueil, dans l'ordre d'affichage.
 * Seuls les slugs sont listés ici : titres et URLs viennent de la source
 * unique. Renommer un slug dans data/epreuves.js ne peut donc pas laisser un
 * lien mort derrière lui — la page lèverait une erreur au build.
 */
const VITRINE = ['accords', 'rythme', 'artiste', 'pochette', 'humain-ou-ia'];

/**
 * Accroches propres à l'accueil, plus courtes et plus racoleuses que les
 * descriptions du catalogue, qui servent aux métadonnées et aux pages
 * d'épreuve. C'est le seul texte volontairement dupliqué.
 */
/* VIDÉ VOLONTAIREMENT — et le mécanisme reste, voir plus bas.
 *
 * Ces cinq phrases doublaient les descriptions de data/epreuves.js, et elles
 * avaient vieilli sans que personne s'en aperçoive : l'accueil annonçait
 * encore « l'artiste du jour » alors que le tirage est libre hors défi, et
 * « le flou se lève à chaque tentative » alors qu'il ne se lève qu'à chaque
 * ERREUR. Deux textes pour une même épreuve finissent toujours par se
 * contredire, et c'est le plus visité des deux qui ment.
 *
 * Le repli `ACCROCHES[slug] ?? e.desc` fait donc désormais tomber la vitrine
 * sur la source unique. L'objet est conservé pour le jour où une épreuve
 * mériterait une accroche propre à l'accueil : il suffira d'y ajouter une
 * ligne, en sachant qu'on crée un texte de plus à tenir à jour. */
const ACCROCHES = {};

/**
 * ACCROCHES COURTES — mobile uniquement.
 *
 * Sur ordinateur, la description longue vit sous la grille et ne s'affiche
 * qu'au survol. Sur mobile il n'y a pas de survol, et la même phrase répétée
 * cinq fois d'affilée donne un pavé gris de quinze lignes qu'on saute des
 * yeux : l'information est là, elle n'est simplement pas lue.
 *
 * Trois mots tiennent sur la même ligne que l'intitulé. La ligne entière fait
 * alors 48 px au lieu de 90, la liste 240 au lieu de 450, et le bloc du défi
 * remonte de deux cent cinquante pixels sans qu'on ait touché à l'ordre.
 *
 * Un verbe à l'impératif, comme le reste du site.
 */
const ACCROCHES_COURTES = {
  'accords': 'place les notes',
  'rythme': 'reproduis le pattern',
  'artiste': 'devine qui chante',
  'pochette': 'lève le flou',
  'humain-ou-ia': 'tranche entre les deux',
};

const EPREUVES = VITRINE.map((slug) => {
  const e = CATALOGUE.find((x) => x.slug === slug);
  if (!e) throw new Error(`Slug inconnu dans la vitrine de l'accueil : ${slug}`);
  return {
    num: e.num,
    titre: e.nom,
    href: lienEpreuve(e.slug),
    desc: ACCROCHES[slug] ?? e.desc,
    court: ACCROCHES_COURTES[slug] ?? '',
  };
});

export default function Accueil() {
  /* Le survol, et lui seul.

     Il colore l'intitulé, remplit la ligne de description et illumine l'onde
     — mais il n'existe que sur les appareils qui ont un pointeur. Sur mobile
     il vaut donc null en permanence, et c'est le mode `defilement` de l'onde
     qui prend le relais : la lumière traverse le tracé en boucle au lieu de
     désigner une section.

     Une première version faisait avancer `survol` tout seul, d'une épreuve à
     la suivante. Mauvaise idée pour deux raisons : la lumière décélérait à
     chaque étape, ce qui est le geste d'un pointeur et n'a plus de cause
     visible sans pointeur ; et les intitulés changeaient de couleur sans
     qu'on les ait touchés, ce qui se lit comme un défaut. Le mouvement
     appartient désormais entièrement à l'onde. */
  const [survol, setSurvol] = useState(null);

  /* Vrai sur les appareils sans pointeur.

     Utile parce que les navigateurs tactiles émettent QUAND MÊME mouseenter
     au moment du tap, pour les sites qui n'écoutent que la souris. Sans ce
     garde-fou, un doigt posé sur le bloc du défi allume son halo, part en
     navigation, et le halo est toujours là au retour arrière : il n'y a
     jamais de mouseleave pour l'éteindre. */
  const tactileRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const maj = () => { tactileRef.current = mq.matches; };
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  /* Le filet n'est plus une bordure : il est dessine par deux
     pseudo-elements, dans le bloc de style plus bas. Une bordure ne peut que
     changer de couleur d'un coup, alors qu'un element superpose se met a
     l'echelle depuis son bord gauche — c'est ce qui permet de le TRACER.

     Il ne reste donc ici que ce qui ne depend pas de l'etat. */
  const styleColonne = () => ({
    paddingTop: 'var(--e3)',
    color: 'inherit',
    display: 'block',
  });

  // Halo doré au survol : box-shadow plutôt que filter, bien moins coûteux
  function allumer(ev) {
    if (tactileRef.current) return;
    ev.currentTarget.style.boxShadow = 'var(--halo-or)';
    ev.currentTarget.style.background = 'var(--onyx-haut)';
    ev.currentTarget.style.borderColor = 'var(--or-clair)';
  }
  function eteindre(ev) {
    ev.currentTarget.style.boxShadow = '0 0 0 rgba(239, 159, 39, 0)';
    ev.currentTarget.style.background = 'transparent';
    ev.currentTarget.style.borderColor = 'var(--or)';
  }

  function entrerEpreuve(k) {
    if (tactileRef.current) return;
    setSurvol(k);
  }

  return (
    <main className="contenu accueil">
      {/* ---- Entrée de la page ----
          Les blocs se posent l'un après l'autre, du haut vers le bas. Même
          grammaire que la barre d'en-tête : même courbe, même décalage d'une
          centaine de millisecondes. Arriver ici depuis une épreuve ne doit pas
          ressembler à un rechargement.

          UN SEUL bloc de style dans toute la page, et il est le PREMIER
          enfant. Ce n'est pas un détail de rangement : les délais sont écrits
          en nth-child, donc tout élément inséré au milieu décalerait la
          numérotation de tous ses suivants. Un second style au milieu du JSX
          suffirait à faire entrer le pied de page à la place du défi.

          POSITIONS, une fois pour toutes :
            2  en-tête         7  grille des épreuves
            3  titre           8  ligne de description (survol)
            4  sous-titre      9  lien vers les dix jeux (mobile seul)
            5  ligne du son   10  bloc du défi du jour
            6  onde           11  bloc « à propos » (hors chorégraphie)
                             12  pied de page

          Le sous-titre est un CONTENEUR de deux paragraphes, précisément pour
          ne compter que pour un. Le bloc « à propos » est neutralisé par sa
          classe plus bas : il a sa propre entrée au défilement.

          TOUT BLOC AJOUTÉ ICI DOIT ÊTRE INSCRIT DEUX FOIS : dans les délais
          nth-child ci-dessus, et dans la liste des `order` de la requête
          média. L'oubli du second est silencieux sur ordinateur et renvoie le
          bloc en tête de page sur mobile ; un garde-fou l'envoie désormais en
          fin de page à la place, mais il ne dispense pas de la ligne.

          Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
          backtick isolé y refermerait la chaîne CSS en plein milieu. */}
      <style>{`
        .accueil > *:nth-child(n+2) {
          animation: accueilEntree 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .accueil > *:nth-child(2) { animation-delay: 90ms; }
        .accueil > *:nth-child(3) { animation-delay: 230ms; }
        .accueil > *:nth-child(4) { animation-delay: 360ms; }
        .accueil > *:nth-child(5) { animation-delay: 490ms; }

        /* ---- L'onde se dévoile de gauche à droite ----
           Un rognage animé, et non une mise à l'échelle : scaleX aurait
           comprimé le tracé, donc changé la forme même de l'onde pendant
           qu'elle apparaît. Le clip-path se contente de découvrir ce qui est
           déjà dessiné — la silhouette reste juste à chaque image.

           Sa boucle interne continue de tourner sous le rognage : ce qu'on
           découvre est une onde vivante, pas une image figée qu'on révèle. */
        .accueil > *:nth-child(6) {
          /* Courbe presque linéaire, contrairement au reste de la page : une
             progression régulière donne au tracé une vitesse constante, et
             c'est ce qui fait qu'on suit l'onde au lieu de la voir arriver. */
          animation: accueilOnde 1800ms 520ms cubic-bezier(0.35, 0, 0.35, 1) both;
        }

        @keyframes accueilOnde {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0 0 0); }
        }

        .accueil > *:nth-child(7)  { animation: none; }
        .accueil > *:nth-child(8)  { animation-delay: 1800ms; }
        .accueil > *:nth-child(9)  { animation-delay: 1800ms; }
        .accueil > *:nth-child(10) { animation-delay: 1930ms; }
        .accueil > *:nth-child(11) { animation-delay: 2060ms; }

        /* ---- Le bloc « à propos » ne participe pas au déroulé d'arrivée ----
           Il vit tout en bas de la page, hors de l'écran au chargement, et il
           porte sa PROPRE entrée, déclenchée au défilement. Le laisser dans la
           chorégraphie l'aurait fait jouer son apparition pendant qu'on
           regarde le titre, deux mille millisecondes avant qu'on y arrive.

           Ciblé par sa classe et non par son rang : c'est ce qui évite de
           renuméroter le pied de page, et surtout ce qui rend la règle
           insensible au prochain élément inséré. */
        .accueil > .ba { animation: none !important; }

        /* Le pied de page a glissé du onzième au douzième rang. Les deux
           règles coexistent : la onzième ne s'applique plus qu'au bloc, qui
           l'annule aussitôt. */
        .accueil > *:nth-child(12) { animation-delay: 2060ms; }

        /* ---- Les cinq épreuves, une par une ----
           La grille elle-même n'est pas animée : ses COLONNES le sont. Animer
           les deux aurait multiplié les opacités l'une par l'autre et donné
           une entrée trouble.

           Délais CALÉS SUR L'ONDE, et non répartis régulièrement : chaque
           colonne entre à l'instant où le bord du rognage franchit son centre
           — 10, 30, 50, 70 puis 90 % de la largeur. Les valeurs viennent de
           l'inversion de la courbe du déroulé. D'où des écarts inégaux, qui
           sont justement ce qu'il faut pour paraître réguliers À L'ÉCRAN. */
        .grille-epreuves > * {
          animation: accueilEntree 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .grille-epreuves > *:nth-child(1) { animation-delay: 770ms; }
        .grille-epreuves > *:nth-child(2) { animation-delay: 985ms; }
        .grille-epreuves > *:nth-child(3) { animation-delay: 1160ms; }
        .grille-epreuves > *:nth-child(4) { animation-delay: 1360ms; }
        .grille-epreuves > *:nth-child(5) { animation-delay: 1695ms; }

        @keyframes accueilEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ============================================================
           MARGES VERTICALES
           Sorties des styles en ligne et placées ici : elles CHANGENT sous
           640 px, où l'ordre des blocs n'est plus le même. Un style en ligne
           l'emporterait sur la requête média et il faudrait un !important
           par propriété.
        ============================================================ */
        .bloc-onde       { margin-top: var(--e7); }
        .bloc-son        { margin-top: var(--e5); }
        .grille-epreuves { margin-top: var(--e5); }
        .desc-survol     { margin-top: var(--e4); min-height: 2.6em; }
        .bloc-quotidien  { margin-top: var(--e7); }
        .bloc-pied       { margin-top: var(--e8); }

        /* Le lien vers le catalogue complet n'existe que sur mobile : sur
           ordinateur, la barre d'en-tête le porte déjà. */
        .bloc-tout-voir { display: none; }

        /* ---- En-tête ---- */
        .accueil-entete {
          display: flex;
          align-items: center;
          gap: var(--e3);
          margin-bottom: var(--e8);
        }
        .accueil-identite {
          display: flex;
          align-items: center;
          gap: var(--e3);
          flex: 1 1 auto;
          min-width: 0;
        }
        .accueil-nav { display: flex; gap: var(--e4); font-size: 12px; }
        .accueil-nav a { color: var(--lin); }

        /* ---- Une entrée de la grille ----
           Sur ordinateur : numéro au-dessus, intitulé en dessous, rien
           d'autre. C'est la ligne de description commune qui parle. */
        .epreuve-ligne { display: block; }
        .epreuve-num {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.09em;
          color: var(--cendre);
        }
        .epreuve-nom {
          display: block;
          font-size: 14px;
          margin-top: var(--e1);
          transition: color var(--transition-courte);
        }
        .epreuve-accroche { display: none; }
        .epreuve-fleche { display: none; }

        /* ---- Le filet se TRACE de gauche a droite au survol ----
           Meme procede que les cartes du bloc du bas, et que le filet or de
           l'en-tete du site : deux pseudo-elements superposes, dont le second
           part d'une echelle nulle et se deploie depuis son bord gauche.

           scaleX plutot qu'une largeur animee : la mise a l'echelle est
           composee par le processeur graphique, une largeur declencherait un
           recalcul de mise en page a chaque image.

           Les epaisseurs suivent le document de design : 0,5 px au repos,
           1 px sur l'element actif. Le trait dore recouvre le gris.

           Le declencheur est data-actif et non :hover, parce que l'etat vit
           deja dans React — c'est lui qui allume aussi l'onde et la ligne de
           description sous la grille. Un second mecanisme de survol pourrait
           en diverger ; celui-ci ne le peut pas. Il couvre au passage le
           clavier, puisque onFocus alimente le meme etat. */
        .epreuve-lien { position: relative; }
        .epreuve-lien::before,
        .epreuve-lien::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
        }
        .epreuve-lien::before {
          height: 0.5px;
          background: var(--filet);
        }
        .epreuve-lien::after {
          height: 1px;
          background: var(--or);
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .epreuve-lien[data-actif="1"]::after { transform: scaleX(1); }

        /* La phrase du son garde l'or sur toutes les tailles d'écran : le
           bloc du défi est le seul autre élément doré et il vit tout en bas,
           les deux ne sont jamais dans l'œil en même temps.

           La taille vit ici et non en style en ligne : un style en ligne
           l'emporterait sur la requête média qui la ramène a 13 px. */
        .son-phrase { color: var(--or); font-size: 14px; }

        /* ============================================================
           SOUS 640 PX
        ============================================================ */
        @media (max-width: 640px) {

          /* ---- Réordonnancement ----
             Le DOM garde l'ordre du bureau : le son avant l'onde. Sur mobile
             la ligne du son passe SOUS l'onde, qu'elle commente — et l'onde
             remonte juste après le sous-titre, là où elle a le plus de force.

             Un ordre visuel obtenu en CSS plutôt qu'en JSX : l'arbre reste
             unique, la version ordinateur n'est pas touchée d'un pixel, et il
             n'y a pas deux rendus à maintenir en parallèle.

             Le bloc de style est lui aussi un enfant flex, mais il est en
             display none : son ordre n'a aucune conséquence.

             ---- LE PIÈGE, ET LE GARDE-FOU ----

             Un enfant flex sans « order » explicite vaut ZÉRO, et zéro passe
             AVANT un. Tout bloc ajouté à cette page sans être inscrit dans la
             liste ci-dessous remontait donc en tête de page — avant l'en-tête,
             avant le titre — et sur mobile uniquement, puisque « order » n'a
             aucun effet tant que le conteneur n'est pas flex. C'est ce qui est
             arrivé au bloc « à propos ».

             D'où la règle universelle posée EN PREMIER : elle rebascule la
             valeur par défaut de 0 à 999. Même spécificité que les règles
             nommées qui suivent, donc c'est l'ordre d'écriture qui tranche —
             elle doit rester en tête du bloc. Un futur oubli atterrira en fin
             de page : visible, corrigeable, mais sans casser la lecture.

             Et les rangs vont de dix en dix. Insérer un bloc entre deux ne
             demande plus de renuméroter toute la liste — c'est précisément la
             corvée qui fait qu'on oublie une ligne. */
          .accueil { display: flex; flex-direction: column; }

          .accueil > *     { order: 999; }

          .accueil-entete  { order: 10; margin-bottom: var(--e6); }
          .bloc-titre      { order: 20; }
          .bloc-soustitre  { order: 30; }
          .bloc-onde       { order: 40; margin-top: var(--e6); }
          .bloc-son        { order: 50; margin-top: var(--e2); }
          .grille-epreuves { order: 60; margin-top: var(--e6); }
          .desc-survol     { order: 70; display: none; }
          .bloc-tout-voir  { order: 80; }
          .bloc-quotidien  { order: 90; margin-top: var(--e6); }
          .ba              { order: 100; }
          .bloc-pied       { order: 110; margin-top: var(--e7); }

          /* ---- La navigation d'en-tête disparaît ----
             Ses deux liens pointent vers ce qui est déjà sur la page, deux
             blocs plus bas. Sur 360 px, deux liens repoussés aux extrémités
             de la barre se lisent comme un défaut de mise en page, et ils se
             ratent au doigt. Le catalogue complet est repris en bas de liste. */
          .accueil-nav { display: none; }

          /* ---- La ligne du son tient sur UN rang ----
             Le curseur reste déployé et la phrase perd sa seconde moitié.

             Ce qu'on voyait avant : phrase sur toute la largeur, bouton
             renvoyé à la ligne, et un tap qui dépliait 84 px de curseur en
             poussant tout le reste. Le problème n'était pas le curseur, mais
             le fait que la largeur CHANGE sous le doigt.

             La phrase vient en tête, les deux contrôles la suivent et se
             calent à droite : c'est l'ordre du DOM, donc celui que lit un
             lecteur d'écran, et l'ordre de lecture — on annonce d'abord qu'il
             y a du son, on donne ensuite de quoi le régler.

             Le compte est serré et vaut d'être posé : sur 320 px d'écran,
             288 restent après les marges, dont 34 pour le bouton, 84 pour le
             curseur et deux gouttières. Il reste environ 145 px de texte,
             soit une ligne de « Ce site s'écoute. » et pas un mot de plus —
             d'où la phrase coupée en deux morceaux dans le JSX, dont le
             second se replie ici. La suite est de toute façon dite par les
             deux contrôles posés juste à côté. */
          .bloc-son { flex-wrap: nowrap; gap: var(--e3); }
          .bloc-son > div { flex-shrink: 0; }
          .son-phrase { flex: 1; min-width: 0; font-size: 13px; }
          .son-suite { display: none; }

          /* ---- Les épreuves deviennent un sommaire ----
             Une ligne par épreuve : numéro, intitulé, accroche de trois mots,
             chevron. Pas de gouttière, les filets séparent — cinq cartes
             espacées se lisent comme cinq objets sans rapport, cinq lignes
             contiguës se lisent comme une liste qu'on parcourt.

             Quarante-huit pixels de haut, soit la cible tactile recommandée. */
          .grille-epreuves {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
          .epreuve-lien { padding: 14px 0 !important; }
          .epreuve-ligne {
            display: flex;
            align-items: baseline;
            gap: var(--e3);
          }
          .epreuve-nom { flex: 1; margin-top: 0; min-width: 0; }
          .epreuve-accroche {
            display: inline;
            color: var(--lin);
            font-size: 12.5px;
          }
          .epreuve-fleche {
            display: block;
            color: var(--cendre);
            font-size: 14px;
          }

          .bloc-tout-voir {
            display: block;
            border-top: 0.5px solid var(--filet);
          }
          .bloc-tout-voir a {
            display: block;
            padding: 14px 0;
            font-family: var(--mono);
            font-size: 10.5px;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }

          /* ---- La cascade est comprimée de moitié ----
             Sur ordinateur, la descente fait partie de la présentation : on
             regarde la page se poser. Sur mobile on fait défiler dans la
             seconde — et un bloc à 2060 ms de retard est INVISIBLE pendant
             deux secondes, donc absent au moment où l'œil arrive dessus. Le
             visiteur ne voit pas une animation, il voit une page vide.

             Tout tient en 1,3 s au lieu de 2,6. Les délais suivent l'ORDRE
             VISUEL et non celui du DOM : la ligne du son est le cinquième
             enfant mais s'affiche après l'onde, d'où un délai calé sur le
             début du déroulé plutôt que sur sa position dans l'arbre. */
          .accueil > *:nth-child(2)  { animation-delay: 60ms; }
          .accueil > *:nth-child(3)  { animation-delay: 130ms; }
          .accueil > *:nth-child(4)  { animation-delay: 200ms; }
          .accueil > *:nth-child(5)  { animation-delay: 360ms; }
          .accueil > *:nth-child(6)  {
            animation: accueilOnde 900ms 300ms cubic-bezier(0.35, 0, 0.35, 1) both;
          }
          .accueil > *:nth-child(9)  { animation-delay: 1120ms; }
          .accueil > *:nth-child(10) { animation-delay: 1190ms; }
          .accueil > *:nth-child(11) { animation-delay: 1260ms; }
          .accueil > *:nth-child(12) { animation-delay: 1260ms; }

          /* Mêmes proportions que sur ordinateur, pour un déroulé deux fois
             plus court : les entrées éclosent toujours sous le bord de l'onde. */
          .grille-epreuves > *:nth-child(1) { animation-delay: 430ms; }
          .grille-epreuves > *:nth-child(2) { animation-delay: 600ms; }
          .grille-epreuves > *:nth-child(3) { animation-delay: 710ms; }
          .grille-epreuves > *:nth-child(4) { animation-delay: 818ms; }
          .grille-epreuves > *:nth-child(5) { animation-delay: 990ms; }
        }
      `}</style>

      {/* 2 — En-tête.
          ATTENTION : ne monter qu'UN SEUL <Ambiance> par page. Deux instances
          créent deux AudioContext indépendants qui jouent simultanément —
          son doublé, décalage entre les deux, oscillateurs en double. Celui
          de la page vit au bloc 5. */}
      <header className="accueil-entete">
        <div className="accueil-identite">
          {/* Le même portrait que l'en-tête commun et le pied de page —
              c'était le troisième « MB » du site, resté en initiales quand
              les deux autres sont passés à l'image : un repère d'identité
              qui change de forme selon la page n'en est plus un.
              Même fichier (2 Ko, déjà en cache après toute navigation),
              même cercle au filet or, découpé par overflow. */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            border: '1px solid var(--or)', overflow: 'hidden', flexShrink: 0,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- même choix que l'en-tête : 2 Ko, pas d'optimiseur */}
            <img
              src="/portrait-mozart-96.webp"
              alt=""
              width={34}
              height={34}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Mozart Benchmark</div>
            {/* La baseline dit ce que le site EST, en trois mots lus sous le nom.
                « Évaluation auditive » annonçait un examen ; le site n'en est pas
                un, et tous les arbitrages de rédaction l'ont montré. « Dix jeux
                d'oreille » est vrai, se comprend sans effort, et contient les
                deux mots qu'on tape pour chercher ça. */}
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>dix jeux d&apos;oreille</div>
          </div>
        </div>
        <nav className="accueil-nav">
          {/* Vers la première épreuve directement : /epreuves ne fait que
              rediriger, autant s'épargner l'aller-retour serveur. */}
          <Link href="/jeux">tous les jeux</Link>
          <Link href="/quotidien">défi du jour</Link>
        </nav>
      </header>

      {/* 3 — Titre */}
      {/* ---- Le titre le plus important du site ----
             Il raconte le site : tout le monde ecoute de la musique tous les
             jours, dans les transports, en cuisinant, apres une rupture. Cette
             ecoute a laisse une culture musicale que personne n'a jamais eu
             l'occasion d'utiliser. Le site ne fait que donner de quoi s'en
             servir.

             UNE QUESTION, PUIS SA REPONSE. C'est la structure la plus simple
             qui soit, et la plus efficace : la premiere ligne ouvre un doute
             flatteur — et si j'avais une qualite que j'ignore ? — la seconde
             dit ou aller la verifier. Un titre qui interroge sans indiquer la
             suite laisse partir.

             « SANS LE SAVOIR » porte tout le propos. Il ne demande pas au
             lecteur d'etre bon, il suggere qu'il l'est peut-etre deja. On ne
             se defend pas contre une hypothese flatteuse, alors qu'on se
             defend toujours contre une evaluation.

             « MINI-JEUX » plutot que « jeux » : le mot dit la brievete avant
             meme que le sous-titre annonce les deux minutes. C'est le premier
             frein leve, et il l'est en trois lettres.

             L'expression exacte « oreille musicale » est ici, dans le seul
             <h1> du site. C'est la requete visee et la balise que Google lit
             juste apres le titre du document. */}
      <h1 className="titre-page bloc-titre">
        Et si tu avais l&apos;oreille musicale sans le savoir&nbsp;?<br />{CATALOGUE.length} mini-jeux pour le découvrir.
      </h1>

      {/* 4 — Sous-titre
             TROIS REGISTRES, ET NON TROIS PHRASES GRISES. Les trois lignes
             avaient le meme corps, la meme couleur et la meme longueur : elles
             se lisaient comme une liste de courses, et aucune ne ressortait.

             Chacune a maintenant sa forme, parce qu'elles n'ont pas la meme
             fonction. L'offre reste en corps de texte, c'est une phrase. Les
             trois objections passent en etiquette mono separee par des points
             medians : ce sont des faits, on les balaye au lieu de les lire, et
             c'est la grammaire que le site emploie partout pour ses donnees.
             Le conseil passe en dessous, un point plus petit, parce qu'il
             s'adresse au nouveau venu et pas a l'habitue.

             Le bloc descend ainsi en trois marches au lieu de former un pave.
             Il tient sur trois lignes comme avant, mais on sait ou regarder.

             LA PREMIERE LIGNE NE REPETE PAS LE TITRE. Celui-ci annonce deja le
             nombre de jeux et ce qu'on y decouvre ; elle donne donc les deux
             chiffres qu'il ne dit pas. « Deux minutes » leve le dernier frein,
             « une note sur 10 » promet un resultat. */}
      <div className="bloc-soustitre">
        <p className="lin" style={{
          marginTop: 'var(--e3)', maxWidth: 430, textWrap: 'balance',
        }}>
          Deux minutes par jeu, une note sur 10.
        </p>

        {/* ---- POURQUOI CETTE LIGNE N'EST PLUS EN MONO CAPITALES ----
            Le mono en capitales est bien la grammaire du site, mais il y sert
            toujours à ÉTIQUETER : nom de section, date d'édition, mention de
            statut. Ce sont des repères, qu'on saisit d'un coup d'œil sans les
            parcourir.

            Ces trois faits, eux, sont du CONTENU — ils lèvent trois freins,
            et on les LIT. Rien ne justifiait qu'ils crient plus fort que la
            phrase au-dessus d'eux, qui porte l'offre.

            Ce qui fait le pas de lecture n'est de toute façon pas la police,
            mais LES POINTS MÉDIANS : trois membres séparés se balayent, une
            phrase se lit. La descente en trois marches est intacte, la
            troisième a simplement cessé de hausser le ton.

            L'interlettrage de 0,09 em disparaît avec les capitales : il
            n'existe que pour les rendre respirables, et sur des bas-de-casse
            il ne fait qu'étirer le mot.

            ---- LES TROIS LIGNES FORMENT UN SEUL BLOC ----

            Une version précédente détachait le conseil par un --e6, au motif
            qu'il parle d'une autre page. L'argument tenait sur le fond, pas à
            l'écran : sous un titre de trente-huit pixels, ce blanc coupait le
            sous-titre en deux et le conseil se lisait comme un bloc orphelin,
            sans rien qui le rattache à ce qui précède.

            Les trois lignes gardent donc le même --e2. Elles répondent de
            toute façon à la même question — qu'est-ce que je trouve ici, et à
            quelles conditions — et elles sont assez courtes pour se lire d'un
            seul regard. Ce qui les distingue reste lisible sans blanc : le
            corps, la couleur et les points médians s'en chargent.

            Interligne fixé sur la ligne du milieu : une marge se mesure entre
            BOÎTES, l'œil mesure entre ENCRES. Sans lui, le blanc parasite de
            la boîte s'ajoute en douce aux marges déclarées, dans les deux
            sens — et deux valeurs identiques donnent alors deux écarts
            visiblement différents. */}
        <p style={{
          marginTop: 'var(--e2)', maxWidth: 430,
          fontSize: 13, lineHeight: 1.4,
          color: 'var(--lin)',
        }}>
          Gratuit&nbsp;· Sans inscription&nbsp;· Sans solfège
        </p>

        <p className="lin" style={{
          marginTop: 'var(--e2)', maxWidth: 430,
          fontSize: 13, textWrap: 'balance',
        }}>
          Au défi du jour, tu n&apos;as qu&apos;un essai. Entraîne-toi avant.
        </p>
      </div>

      {/* 5 — Invitation à activer le son, avec le réglage à côté.
          `deploye` garde le curseur visible en permanence : à cet endroit il
          fait partie du message, il ne doit pas se dérober quand la souris
          s'éloigne. */}
      <div className="bloc-son" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--e3)',
        flexWrap: 'wrap',
        rowGap: 'var(--e2)',
      }}>
        {/* Deux morceaux, dont le second se replie sous 640 px.

            L'accroche seule doit tenir en moins de vingt-deux signes : c'est
            ce qui reste de largeur sur un écran de 320 px une fois le bouton
            et le curseur posés. « Le son change tout. » en fait dix-neuf.

            Tutoiement, comme partout ailleurs sur le site. La version
            précédente vouvoyait — seule ligne du site à le faire, face à des
            épreuves qui disent « devine » et « reproduis ». */}
        <span className="son-phrase">
          Le son change tout.<span className="son-suite"> Active l&apos;ambiance.</span>
        </span>
        <Ambiance deploye />
      </div>

      {/* 6 — L'onde.
          `defilement` n'a d'effet que sous 640 px : la lumière traverse alors
          le tracé en continu, à vitesse constante, au lieu d'attendre un
          survol qui ne viendra jamais. Sur ordinateur le prop est inerte et
          `active` reprend la main. */}
      <div className="bloc-onde">
        <Onde sections={EPREUVES.length} active={survol} defilement />
      </div>

      {/* 7 — Grille des cinq épreuves */}
      <div
        className="grille-epreuves"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`, gap: 'var(--e3)' }}
        onMouseLeave={() => setSurvol(null)}
      >
        {EPREUVES.map((e, k) => (
          <Link
            key={e.href}
            href={e.href}
            className="epreuve-lien"
            data-actif={survol === k ? '1' : undefined}
            onMouseEnter={() => entrerEpreuve(k)}
            onFocus={() => setSurvol(k)}
            style={styleColonne()}
          >
            {/* Des span et non des div : le contenu d'un lien reste ainsi du
                contenu en ligne, quel que soit le display appliqué ensuite. */}
            <span className="epreuve-ligne">
              <span className="epreuve-num">{e.num}</span>
              <span
                className="epreuve-nom"
                style={{ color: survol === k ? 'var(--or)' : 'var(--ivoire)' }}
              >
                {e.titre}
                <span className="epreuve-accroche"> · {e.court}</span>
              </span>
              <span className="epreuve-fleche" aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>

      {/* 8 — Ligne de description (hauteur fixe : la page ne saute pas).
             Masquée sous 640 px, où chaque entrée porte son accroche. */}
      <p className="description desc-survol">
        {survol === null ? 'Survole un jeu pour voir ce qu\'il demande.' : EPREUVES[survol].desc}
      </p>

      {/* 9 — Sortie vers le catalogue complet, mobile uniquement.
             La vitrine ne montre que cinq des dix épreuves, et rien ne le
             disait une fois la barre de navigation repliée. */}
      <div className="bloc-tout-voir">
        <Link href="/jeux">les dix jeux →</Link>
      </div>

      {/* 10 — Bloc du défi quotidien : seul élément encadré de la page, et sa
              conclusion. Il vient APRÈS les épreuves, à dessein — on s'entraîne
              d'abord, on se mesure ensuite. */}
      <Link
        href="/quotidien"
        className="bloc-quotidien"
        onMouseEnter={allumer}
        onMouseLeave={eteindre}
        style={{
          display: 'block', padding: 'var(--e5)',
          border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
          color: 'inherit', background: 'transparent',
          boxShadow: '0 0 0 rgba(239, 159, 39, 0)',
          transition: 'box-shadow var(--transition-courte), background var(--transition-courte), border-color var(--transition-courte)',
        }}
      >
        <div className="etiquette-mono">défi du jour</div>
        <p style={{ fontSize: 14, marginTop: 'var(--e2)' }}>
          Dix jeux, les mêmes pour tous, jusqu&apos;à minuit. Ton résultat se partage en une ligne.
        </p>
      </Link>

      {/* 11 — Bloc « à propos ».

             Posé ICI, dans le composant, et non dans une enveloppe serveur.
             La directive 'use client' en tête de fichier ne veut pas dire
             « rendu uniquement par le navigateur » : Next rend aussi les
             composants clients sur le serveur, et le HTML servi contient donc
             ce bloc. Elle dit seulement qu'il sera hydraté ensuite.

             La règle qui compte est ailleurs : un contenu conditionné à un
             état posé dans un useEffect, lui, est absent du HTML. C'est le cas
             du catalogue, dont les dix jeux attendent un drapeau `monte`.
             Cette page n'a rien de tel, tout son texte est servi d'emblée. */}
      <BlocAccueil />

      {/* 12 — Mention de pied */}
      {/* Le pied de page est commun à tout le site : trois textes différents
          cohabitaient auparavant, un par page. Il garde la classe bloc-pied,
          qui porte son rang dans la chorégraphie d'entrée et son `order` sous
          640 px — la classe vit maintenant sur le composant lui-même. */}
      <PiedDePage classe="bloc-pied" />
    </main>
  );
}
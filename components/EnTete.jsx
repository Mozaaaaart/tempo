'use client';
import Link from 'next/link';

/**
 * EN-TÊTE COMMUN
 *
 * Une seule barre pour tout le site, déclinée plutôt que remplacée.
 *
 * Le défi du jour avait sa propre barre — collante, sur fond onyx, avec un
 * filet lumineux — pendant que les autres pages gardaient un en-tête statique
 * posé dans le flux. Passer de l'une à l'autre faisait donc muter le repère
 * d'identité : ce n'est pas la présence d'un bandeau qui accrochait l'œil,
 * c'est la métamorphose.
 *
 * Ici la barre est la même partout. Le défi en est une variante : il ajoute sa
 * pastille de mode, sa date, son décompte et son filet or, sans rien changer à
 * la structure. On passe d'une rupture à une déclinaison.
 *
 * Bénéfice de côté : l'en-tête cesse de disparaître au défilement. Sur une
 * page de jeu qui fait deux écrans de haut, il n'y avait plus aucun repère ni
 * aucun moyen de revenir sans remonter.
 *
 * Ce composant ne connaît RIEN du défi : il expose un emplacement libre au
 * centre et un booléen pour le filet. Les informations propres au quotidien —
 * édition, temps restant — restent dans la page qui les calcule.
 */

export default function EnTete({ liens = [], accent = false, children = null, droite = null }) {
  return (
    <header className={`entete${accent ? ' entete-accent' : ''}`}>
      <style>{`
        .entete {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: var(--e3);
          background: var(--onyx);
          color: var(--ivoire);
          padding: 9px var(--e5);
          border-bottom: 0.5px solid var(--filet);
        }

        /* Filet or, sur TOUTES les pages.

           Le repère d'identité doit être identique d'une page à l'autre :
           c'est ce qui empêche la barre de changer de nature quand on navigue.

           Un élément à part plutôt qu'une bordure : une bordure entrerait dans
           le flux, et la hauteur de la barre dépendrait alors de la variante
           alors qu'elle doit être la même partout. C'est aussi ce qui permet
           au trait de porter sa propre ombre plus bas.

           La barre est en position sticky, donc positionnée : elle sert de
           référence à cet enfant absolu sans qu'il faille rien ajouter.

           Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
           backtick isolé y refermerait la chaîne CSS en plein milieu. */
        .entete::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--or);
          pointer-events: none;
          /* Le trait se TRACE, de gauche à droite, dans le sens de la
             lecture. Un scaleX depuis l'origine gauche plutôt qu'une largeur
             animée : la mise à l'échelle est composée par le GPU et ne
             provoque aucun recalcul de mise en page, là où animer width
             relancerait la disposition à chaque image. */
          transform-origin: left center;
          animation: enteteTrait 820ms 60ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes enteteTrait {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        /* Le HALO reste propre au défi du jour.

           Le filet dit l'identité du site ; sa lueur dit qu'on est entré dans
           un état particulier. C'est la seule chose qui distingue les deux
           variantes, et elle suffit.

           Deux couches — une proche et vive, une large et faible. Une seule
           donnerait un bord net, qui se lit comme un second trait plutôt que
           comme une lumière. Une ombre posée sur la barre, elle, entourerait
           tout le rectangle au lieu de partir du trait. */
        .entete-accent::before {
          /* Les deux animations sont redéclarées ensemble : la propriété
             raccourcie remplace celle de la règle de base, et ne lister que
             le halo effacerait le tracé du trait.

             Le halo ne part qu'une fois le trait complet. Pendant le tracé,
             le scaleX comprime aussi l'ombre — une lueur écrasée puis
             détendue se lirait comme un défaut. */
          animation:
            enteteTrait 820ms 60ms cubic-bezier(0.22, 1, 0.36, 1) both,
            enteteHalo 700ms 920ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        /* L'allumage.

           Le halo part de rien et monte jusqu'à sa valeur : le filet est déjà
           là quand la page se pose, et c'est la lumière qui arrive ensuite.
           L'inverse — un halo présent dès la première image — donnerait un
           état, pas un passage, et rien ne dirait qu'on vient d'entrer.

           Les deux couches sont interpolées ensemble depuis un rayon nul en
           opacité zéro. Il en faut autant à l'arrivée qu'au départ : une
           ombre ne s'anime que vers une liste de MÊME longueur, sinon le
           navigateur bascule d'un coup au lieu de fondre.

           Le retard de 260 ms laisse la barre s'installer avant que la
           lumière ne monte. Sans lui, les deux se produisent ensemble et on
           ne voit que l'apparition de la barre.

           prefers-reduced-motion est déjà traité globalement dans
           globals.css, qui ramène toutes les durées à une milliseconde. */
        @keyframes enteteHalo {
          from {
            box-shadow:
              0 0 0 0 rgba(239, 159, 39, 0),
              0 0 0 0 rgba(239, 159, 39, 0);
          }
          to {
            box-shadow:
              0 0 10px 1px rgba(239, 159, 39, 0.75),
              0 0 28px 4px rgba(239, 159, 39, 0.35);
          }
        }

        /* Monogramme : cercle en filet, identique sur toutes les pages. Le
           repère d'identité ne doit pas changer d'une page à l'autre.

           Le cercle contenait les initiales MB ; il contient désormais le
           portrait — Mozart au casque, la seule blague du site (doc de
           design). Le filet or RESTE : c'est lui qui fait du portrait un
           logo et non une image posée là, et il maintient le cercle visible
           pendant le chargement de l'image. overflow: hidden découpe le
           carré en rond ; object-fit: cover absorbe tout écart d'échelle. */
        .entete-monogramme {
          /* display: block est INDISPENSABLE et facile a perdre : ce
             monogramme est un span, donc inline par defaut, et un element
             inline ignore width, height ET overflow — le cercle disparait et
             l image en width 100 pour cent se dimensionne sur l en-tete
             entier. L ancien display: flex (qui centrait les initiales)
             rendait ce service sans le dire ; le retirer avec les initiales
             a casse le cadre. */
          display: block;
          width: 28px; height: 28px; border-radius: 50%;
          overflow: hidden;
          border: 1px solid var(--or);
          flex-shrink: 0;
        }
        .entete-monogramme img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .entete-titre {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ivoire);
          text-decoration: none;
          white-space: nowrap;
        }
        .entete-lien {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          white-space: nowrap;
          color: var(--lin);
          text-decoration: none;
        }
        .entete-lien:hover { color: var(--or); }
        .entete-sep {
          width: 0.5px;
          align-self: stretch;
          background: var(--filet);
        }

        /* ---- Entrée du contenu ----
           Les éléments se posent l'un après l'autre, de gauche à droite : la
           barre se remplit dans le sens de la lecture au lieu d'apparaître
           d'un bloc.

           Le décalage se fait par nth-child, faute de compteur en CSS. Il
           couvre neuf positions, ce qui dépasse largement ce que la barre
           porte aujourd'hui — au-delà, les éléments entrent tous au dernier
           temps, ce qui reste correct.

           Corollaire à respecter côté page : le nombre d'enfants doit être
           STABLE. Un élément qui apparaît en cours de route décalerait les
           positions de ses voisins, donc leurs délais, et une animation dont
           le délai change se rejoue. */
        .entete > * {
          animation: enteteEntree 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .entete > *:nth-child(1) { animation-delay: 80ms; }
        .entete > *:nth-child(2) { animation-delay: 140ms; }
        .entete > *:nth-child(3) { animation-delay: 200ms; }
        .entete > *:nth-child(4) { animation-delay: 240ms; }
        .entete > *:nth-child(5) { animation-delay: 290ms; }
        .entete > *:nth-child(6) { animation-delay: 330ms; }
        .entete > *:nth-child(7) { animation-delay: 380ms; }
        .entete > *:nth-child(8) { animation-delay: 420ms; }
        .entete > *:nth-child(9) { animation-delay: 460ms; }

        @keyframes enteteEntree {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ============================================================
           SOUS 640 PX — CE QUI CÈDE, ET DANS QUEL ORDRE

           Le repli couvrait le nom du site et les liens. Sur le défi du jour,
           où la barre porte en plus une pastille de mode, une date et un
           décompte, c'était nécessaire. Mais il s'appliquait PARTOUT — y
           compris sur une page d'épreuve, où la barre ne porte rien d'autre
           et se retrouvait réduite au seul monogramme, avec deux cents pixels
           de vide à côté.

           La règle est donc devenue une hiérarchie de sacrifice, du plus
           dispensable au moins :

             1. les séparateurs — décoration pure ;
             2. la pastille de mode — le filet or et son halo disent déjà
                qu'on est dans le défi, et le titre de la page le répète ;
             3. la date — elle figure en tête du contenu, deux centimètres
                plus bas ;
             4. « il reste », dont seul le CHIFFRE porte l information ;
             5. la sortie — dernier recours, jamais atteint aujourd hui ;
             6. le nom du site — jamais. C est la seule chose qui dit où l on
                est, et la seule à ne devoir changer sur aucune page.

           Les quatre premiers portent entete-repli, posé par les PAGES sur ce
           qu elles injectent. Le composant, lui, ne replie plus rien de ce qui
           lui appartient.

           Le compte tient sur 320 px, la largeur la plus étroite qu on
           rencontre encore : 288 restent après les marges, dont 28 pour le
           monogramme, environ 109 pour le nom du site, 45 pour le décompte
           réduit à son chiffre et 79 pour la sortie. Les gouttières font le
           reste, à trois pixels près.
        ============================================================ */
        @media (max-width: 640px) {
          .entete { padding-left: var(--e4); padding-right: var(--e4); gap: var(--e2); }
          .entete .entete-repli { display: none; }

          /* Le nom du site RÉTRÉCIT au lieu de disparaître. min-width est
             indispensable : un élément flex refuse par défaut de descendre
             sous la largeur de son contenu, et sans lui l ellipse ne se
             déclencherait jamais — la barre déborderait à la place.

             Ce n est qu un filet de sécurité. Aucune page n atteint ce cas
             aujourd hui ; il couvre celle qui injecterait un jour un élément
             de plus. */
          .entete-titre {
            font-size: 13px;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* La sortie ne se comprime JAMAIS : un lien tronqué ne se clique
             pas, et il ne se lit pas non plus.

             L interlettrage retombe de 0,09 à 0,06 em. Les capitales espacées
             sont faites pour de courtes étiquettes ; sur onze signes, chaque
             centième d em coûte un pixel qu on n a pas. */
          .entete-lien {
            flex-shrink: 0;
            letter-spacing: 0.06em;
          }
        }
      `}</style>

      <Link href="/" aria-label="Accueil">
        {/* Image simple et non next/image : le fichier fait deux kilo-octets,
            l'optimiseur d'images de Vercel n'aurait rien à optimiser et
            chaque passage y consomme le quota de transformations du plan
            Hobby. width/height posés pour réserver la place avant le
            chargement — un logo qui fait sauter la barre est pire qu'un logo
            lent. alt vide : le lien porte déjà « Accueil », le lecteur
            d'écran n'a pas besoin d'entendre deux étiquettes. */}
        <span className="entete-monogramme">
          {/* eslint-disable-next-line @next/next/no-img-element -- choix documenté ci-dessus : 2 Ko, pas d'optimiseur */}
          <img src="/portrait-mozart-96.webp" alt="" width={28} height={28} />
        </span>
      </Link>

      {/* Le nom du site, sur TOUTES les tailles d'écran. Il ne porte plus
          entete-repli : un en-tête réduit au seul monogramme ne dit pas où
          l'on est, il pose une devinette. Sa largeur cède avant lui, par
          l'ellipse déclarée dans la requête média. */}
      <Link href="/" className="entete-titre">Mozart Benchmark</Link>

      {/* Bloc de GAUCHE : identité, puis ce que la page a de permanent à
          dire sur elle-même — mode, édition. */}
      {children}

      {/* Un seul ressort dans toute la barre. Deux — un ici, un autre dans le
          contenu injecté — se partageaient l'espace à parts égales et
          laissaient l'échéance flotter au milieu, sans rien à quoi se
          rattacher. */}
      <span style={{ marginLeft: 'auto' }} />

      {/* Bloc de DROITE : l'état qui change, puis la sortie. */}
      {droite}

      {droite && liens.length > 0 && (
        <span className="entete-sep entete-repli" aria-hidden="true" />
      )}

      {/* La sortie reste elle aussi visible partout. C'est le seul lien de la
          barre, et sur mobile la navigation d'accueil est repliée : sans lui,
          passer du défi à l'entraînement demande de revenir à l'accueil puis
          de redescendre toute la page. */}
      {liens.map((l) => (
        <Link key={l.href} href={l.href} className="entete-lien">
          {l.libelle}
        </Link>
      ))}
    </header>
  );
}
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
           repère d'identité ne doit pas changer d'une page à l'autre. */
        .entete-monogramme {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--or); color: var(--or);
          font-family: var(--serif); font-size: 13px;
          flex-shrink: 0;
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

        /* Sous 640 px, seuls l'identité et le contenu central subsistent :
           les liens et les séparateurs se replient plutôt que de comprimer
           ce qui porte l'information. */
        @media (max-width: 640px) {
          .entete { padding-left: var(--e4); padding-right: var(--e4); gap: var(--e2); }
          .entete .entete-repli { display: none; }
        }
      `}</style>

      <Link href="/" aria-label="Accueil">
        <span className="entete-monogramme">MB</span>
      </Link>

      <Link href="/" className="entete-titre entete-repli">Mozart Benchmark</Link>

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

      {liens.map((l) => (
        <Link key={l.href} href={l.href} className="entete-lien entete-repli">
          {l.libelle}
        </Link>
      ))}
    </header>
  );
}
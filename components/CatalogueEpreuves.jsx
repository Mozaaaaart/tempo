import Link from 'next/link';
import Onde from '@/components/Onde';
import EnTete from '@/components/EnTete';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';

/**
 * CATALOGUE DES DIX JEUX — /jeux
 *
 * ------------------------------------------------------------------ le bug
 *
 * Ce fichier montait AUTRE CHOSE : l'ancienne page monolithique d'avant la
 * migration vers les URL par slug. Elle rendait son propre <main>, son propre
 * en-tête, son titre d'épreuve, son onde, son carrousel, son bandeau d'action,
 * son pied de page — et les dix jeux, dont un seul visible.
 *
 * Or app/jeux/layout.jsx rend déjà tout cet habillage autour de {children}.
 * La page recevait donc le décor du layout, puis reposait le sien à
 * l'intérieur : deux en-têtes, deux titres, deux ondes, deux carrousels. On
 * pouvait dater les deux copies à l'œil — l'une disait « Rejouer ce jeu »,
 * l'autre « Relancer l'épreuve », vocabulaire d'avant le renommage.
 *
 * Le layout est par ailleurs bâti pour afficher UN jeu : il lit le slug dans
 * l'URL et retombe sur le premier quand il n'y en a pas. D'où l'arrivée sur
 * « Accords » alors qu'on demandait la liste.
 *
 * ------------------------------------------------------------- le correctif
 *
 * Deux gestes qui vont ensemble :
 *
 *   1. app/jeux/layout.jsx descend dans app/jeux/[slug]/layout.jsx. Il
 *      n'enveloppe plus que les dix routes de jeu, et /jeux échappe au décor
 *      d'un jeu qu'elle n'affiche pas. La continuité de l'onde entre deux
 *      slugs est préservée : le layout reste commun aux routes sœurs, donc
 *      son instance n'est pas remontée d'un jeu à l'autre.
 *
 *   2. Ce fichier devient ce que le site annonce depuis toujours : une LISTE.
 *      Le plan du site déclare /jeux en priorité 0,9, le fil d'Ariane des
 *      pages de jeu la nomme « Jeux », et l'accueil y envoie deux fois. Ce
 *      contrat existait ; seule la page manquait.
 *
 * -------------------------------------------------------- composant serveur
 *
 * Pas de 'use client', et c'est le point le plus important pour cette page.
 * L'ancienne version était cliente de bout en bout : ses dix liens naissaient
 * après l'hydratation, donc invisibles à toute exploration qui n'exécute pas
 * le JavaScript. Le plan du site existait précisément pour compenser ce trou.
 * Ici les dix liens sont dans le HTML servi, avec leur intitulé en texte de
 * lien — c'est le maillage interne que la page est censée porter.
 *
 * Onde et EnTete restent des composants clients ; un composant serveur peut
 * les monter sans rien changer.
 */

export default function CatalogueEpreuves() {
  return (
    <>
      {/* La barre commune, dans sa variante ordinaire. L'ancienne page
          dessinait son propre en-tête à la main — monogramme de 34 px,
          baseline, lien « accueil » — c'est-à-dire une TROISIÈME déclinaison
          du repère d'identité, en plus de celle du site et de celle du défi.
          C'est exactement ce que components/EnTete.jsx existe pour empêcher. */}
      <EnTete liens={[{ href: '/quotidien', libelle: 'défi du jour' }]} />

      <main className="contenu" style={{ paddingTop: 'var(--e6)' }}>
        <style>{`
          /* Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
             accent grave isole y refermerait la chaine CSS en plein milieu. */

          /* ---- La liste reprend la grammaire du site ----
             Filet superieur, numero en mono, intitule, description. C est la
             forme des colonnes de l accueil, des onglets du carrousel et du
             sommaire du defi : la meme chose doit se presenter de la meme
             maniere, sinon chaque page reapprend au visiteur a lire.

             auto-fit et une largeur plancher de 250 px : cinq colonnes sur un
             grand ecran, trois sur un portable, deux sur une tablette. Aucun
             point de rupture a maintenir de ce cote. */
          .cat-grille {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: var(--e5) var(--e4);
            list-style: none;
            margin: var(--e6) 0 0;
            padding: 0;
          }

          /* ---- Le filet se TRACE de gauche a droite au survol ----
             Une bordure ne se trace pas : on ne peut que la faire changer de
             couleur d un coup. Deux pseudo-elements superposes, dont le second
             part d une echelle nulle et se deploie depuis son bord gauche.

             scaleX plutot qu une largeur animee : la mise a l echelle est
             composee par le processeur graphique, une largeur declencherait un
             recalcul de mise en page a chaque image.

             Epaisseurs du document de design : 0,5 px au repos, 1 px sur
             l element actif. Le trait dore recouvre le gris, il ne s y ajoute
             pas. */
          .cat-jeu {
            display: block;
            position: relative;
            color: inherit;
            padding: var(--e3) var(--e2) var(--e3) 0;
          }
          .cat-jeu::before,
          .cat-jeu::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
          }
          .cat-jeu::before { height: 0.5px; background: var(--filet); }
          .cat-jeu::after {
            height: 1px;
            background: var(--or);
            transform: scaleX(0);
            transform-origin: left center;
            transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .cat-num {
            font-family: var(--mono);
            font-size: 10.5px;
            letter-spacing: 0.09em;
            color: var(--cendre);
          }
          .cat-nom {
            display: block;
            margin-top: var(--e1);
            font-size: 14px;
            font-weight: 500;
            color: var(--ivoire);
            transition: color var(--transition-courte);
          }
          .cat-fleche {
            display: inline-block;
            margin-left: var(--e2);
            color: var(--or);
            opacity: 0;
            transform: translateX(-6px);
            transition:
              opacity var(--transition-courte),
              transform var(--transition-courte);
          }
          /* Trois lignes au plus : les hauteurs de colonne se calent, et la
             seconde rangee demarre sur un alignement franc plutot que sur un
             bord dechiquete. Le texte entier reste dans le document, seul son
             affichage est borne. */
          .cat-desc {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-top: var(--e2);
            font-size: 12.5px;
            line-height: 1.6;
          }

          /* Le survol allume le FILET, pas un fond : c est le geste de la
             grille de l accueil et du carrousel. Un rectangle de fond
             introduirait une surface la ou la page n en a pas. */
          @media (hover: hover) and (pointer: fine) {
            .cat-jeu:hover::after { transform: scaleX(1); }
            .cat-jeu:hover .cat-nom { color: var(--or); }
            .cat-jeu:hover .cat-fleche { opacity: 1; transform: translateX(0); }
          }
          /* Le clavier a droit au meme retour que la souris. */
          .cat-jeu:focus-visible::after { transform: scaleX(1); }
          .cat-jeu:focus-visible .cat-nom { color: var(--or); }
          .cat-jeu:focus-visible .cat-fleche { opacity: 1; transform: translateX(0); }

          /* ---- Sous 640 px, la grille devient un sommaire ----
             Pas de gouttiere, les filets separent. Dix cartes espacees se
             lisent comme dix objets sans rapport ; dix rangees contigues se
             lisent comme une liste qu on parcourt. Quarante-huit pixels de
             haut, soit la cible tactile recommandee. */
          @media (max-width: 640px) {
            .cat-grille { gap: 0; margin-top: var(--e5); }
            .cat-jeu {
              display: grid;
              grid-template-columns: auto minmax(0, 1fr);
              column-gap: var(--e3);
              align-items: baseline;
              padding: 13px 0;
              min-height: 48px;
              box-sizing: border-box;
            }
            .cat-num { grid-column: 1; }
            .cat-nom {
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
               une fleche absente. */
            .cat-fleche {
              opacity: 1;
              transform: none;
              margin-left: 0;
              color: var(--cendre);
              font-size: 14px;
            }
            .cat-desc {
              grid-column: 2;
              -webkit-line-clamp: 2;
              margin-top: 3px;
              font-size: 12px;
              line-height: 1.45;
            }
          }
        `}</style>

        <div className="etiquette-mono" style={{ color: 'var(--or)' }}>
          les {EPREUVES.length}{' '}jeux
        </div>

        {/* Le <h1> de la page reprend le titre du document, a un mot pres :
            ce qu on a lu dans l onglet se retrouve en haut de la page. */}
        <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>
          Les {EPREUVES.length}{' '}jeux d&apos;oreille
        </h1>

        <p className="lin" style={{
          marginTop: 'var(--e3)', maxWidth: 620, textWrap: 'balance',
        }}>
          Deux minutes par jeu, une note sur 10. Aucune connaissance en solfège
          n&apos;est nécessaire, et chaque jeu se rejoue autant de fois que tu veux.
        </p>

        {/* L onde, sans section allumee : ici aucun jeu n est en cours, elle
            ne designe donc rien. Elle est le fil visuel de la page, pas un
            indicateur d etat — le mode defilement lui rend son mouvement. */}
        <div style={{ marginTop: 'var(--e7)' }}>
          <Onde variante="bandeau" sections={EPREUVES.length} defilement />
        </div>

        <ul className="cat-grille">
          {EPREUVES.map((e) => (
            <li key={e.slug}>
              <Link href={lienEpreuve(e.slug)} className="cat-jeu">
                <span className="cat-num">{e.num}</span>
                <span className="cat-nom">
                  {e.nom}
                  <span className="cat-fleche" aria-hidden="true">→</span>
                </span>
                {/* PAS DE pre-line ici, contrairement au titre de la page de
                    jeu. Deux descriptions portent un saut de ligne ecrit dans
                    data/epreuves.js, pose pour une colonne de 470 px. Dans une
                    carte de trois cents, ce saut arriverait EN PLUS du
                    repliement naturel. */}
                <span className="description cat-desc">{e.desc}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Sortie vers le defi : la page liste ce qu on peut s entrainer a
            faire, elle doit dire ou ca se joue pour de bon. */}
        <Link
          href="/quotidien"
          style={{
            display: 'block', marginTop: 'var(--e8)', padding: 'var(--e5)',
            border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
            color: 'inherit',
          }}
        >
          <div className="etiquette-mono">défi du jour</div>
          <p style={{ fontSize: 14, marginTop: 'var(--e2)' }}>
            Les {EPREUVES.length}{' '}jeux à la suite, les mêmes pour tous jusqu&apos;à minuit,
            une seule tentative chacun. Ton résultat se partage en une ligne.
          </p>
        </Link>

        <footer style={{
          marginTop: 'var(--e8)', textAlign: 'center',
          fontSize: 11, color: 'var(--cendre)',
        }}>
          Mozart Benchmark, jeux d&apos;oreille musicale gratuits.
          Extraits fournis par Deezer, sons de synthèse et échantillons libres.
        </footer>
      </main>
    </>
  );
}
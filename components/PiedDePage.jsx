import Link from 'next/link';
import { EPREUVES, lienEpreuve } from '@/data/epreuves';
import { SITE_NOM } from '@/data/site';

/**
 * PIED DE PAGE COMMUN
 *
 * ------------------------------------------------------------------ le fond
 *
 * Le site avait bien un <footer> sur chacune de ses pages, mais c'était une
 * LIGNE DE CRÉDITS, pas un pied de page : onze pixels, gris cendre, centrés,
 * et trois textes différents selon la page. Un visiteur qui arrive au bas du
 * document n'y trouvait ni où aller ensuite, ni qui édite le site, ni comment
 * le joindre.
 *
 * Trois fonctions manquaient, dans cet ordre d'importance :
 *
 *   1. UNE SORTIE. Le bas de page est l'endroit où l'on arrive quand on a fini
 *      de lire et qu'on ne sait pas quoi faire. Ne rien y proposer, c'est
 *      laisser partir. Les dix jeux y sont donc listés en toutes lettres —
 *      c'est aussi le seul endroit du site où ils sont TOUS liés depuis un
 *      rendu serveur, ce qui vaut pour l'exploration autant que pour le
 *      visiteur.
 *
 *   2. UN ÉDITEUR. Un site sans identité visible ne se distingue pas d'une
 *      page jetable. C'est ce que mesure la ligne d'identité, et c'est aussi
 *      ce que cherche un moteur quand il évalue à qui il a affaire.
 *
 *   3. LES MENTIONS OBLIGATOIRES. Voir la note LEGAL plus bas : elles ne sont
 *      pas encore là, et c'est le seul point réellement bloquant.
 *
 * ------------------------------------------------------------------ la forme
 *
 * Sobre au sens du document de design, pas au sens de vide : filet de 0,5 px,
 * étiquettes en mono capitales — c'est leur emploi légitime, ce sont des noms
 * de rubrique — intitulés en lin, aucune surface, aucun aplat, une seule
 * couleur d'accent qui ne sert qu'au survol. Rien de neuf n'est inventé : la
 * grammaire est celle de la grille de l'accueil.
 *
 * Composant SERVEUR : aucun état, aucun gestionnaire. Ses liens sont dans le
 * HTML servi.
 */

/* ---- Les mentions légales, à activer quand les pages existeront ----
 *
 * Laissé VIDE volontairement, et c'est un choix, pas un oubli : un lien vers
 * une page absente vaut moins que pas de lien du tout — il promet une
 * information et rend un 404, ce qui est le pire des deux mondes pour la
 * confiance comme pour l'exploration.
 *
 * Dès que app/mentions-legales/page.jsx et app/confidentialite/page.jsx
 * existent, il suffit de remplir ce tableau : la rubrique apparaît d'elle-même
 * et disparaît de nouveau si on le vide.
 *
 *   { href: '/mentions-legales', libelle: 'mentions légales' },
 *   { href: '/confidentialite',  libelle: 'confidentialité' },
 *   { href: '/contact',          libelle: 'contact' },
 */
const LEGAL = [];

/**
 * @param classe  classes supplémentaires. L'accueil y passe `bloc-pied`, qui
 *                porte son `order` sous 640 px : la page range ses blocs à la
 *                main, et un pied de page sans rang tomberait sur le garde-fou
 *                plutôt que sur une place choisie.
 */
export default function PiedDePage({ classe = '' }) {
  const annee = new Date().getFullYear();

  return (
    <footer className={`pied ${classe}`.trim()}>
      <style>{`
        /* Aucun accent grave dans ce bloc : il vit dans un gabarit, et un
           accent grave isole y refermerait la chaine CSS en plein milieu. */

        .pied {
          margin-top: var(--e8);
          padding-top: var(--e6);
          border-top: 0.5px solid var(--filet);
        }

        /* Trois colonnes de largeur INEGALE. L identite tient une phrase et
           merite d etre lue, les deux listes se balayent : leur donner la
           meme place aurait etire les intitules sur toute la largeur pour
           rien.

           auto-fit et un plancher de 220 px : trois colonnes sur un ecran
           large, deux sur une tablette, une sur un telephone. Aucun point de
           rupture a maintenir. */
        .pied-cols {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--e6) var(--e7);
        }
        .pied-identite { grid-column: span 1; }

        /* Etiquette de rubrique : c est l emploi legitime du mono capitales,
           celui que le document de design lui assigne. On NOMME une section,
           on ne redige pas. */
        .pied-titre {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--or);
          margin-bottom: var(--e3);
        }

        .pied-liste {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 7px;
        }
        /* Les dix jeux sur DEUX colonnes : dix lignes d affilee font une
           colonne plus haute que le reste du pied, et le desequilibrent. */
        .pied-liste-jeux { grid-template-columns: 1fr 1fr; gap: 7px var(--e4); }

        .pied-lien {
          font-size: 12.5px;
          color: var(--lin);
          text-decoration: none;
          transition: color var(--transition-courte);
        }
        .pied-lien:hover,
        .pied-lien:focus-visible { color: var(--or); }

        /* ---- La barre du bas ----
           Ce qui n est ni navigation ni identite : la propriete, l origine des
           sons. On le lit une fois dans sa vie, d ou le cendre et les onze
           pixels — c est la seule mention du site dont on puisse se passer. */
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

        @media (max-width: 640px) {
          .pied { margin-top: var(--e7); padding-top: var(--e5); }
          .pied-cols { gap: var(--e5); }
          /* Les intitules passent a 48 px de haut : au doigt, sept pixels de
             gouttiere entre deux liens de douze, c est une cible qu on rate. */
          .pied-liste { gap: 0; }
          .pied-lien {
            display: block;
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

      <div className="pied-cols">
        <div className="pied-identite">
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ivoire)' }}>
            {SITE_NOM}
          </div>
          {/* Une phrase, pas un slogan. Elle dit ce que le site EST à quelqu'un
              qui arrive par un moteur sur une page de jeu et n'a jamais vu
              l'accueil — c'est le cas le plus fréquent, et le pied de page est
              souvent le seul endroit où il peut l'apprendre. */}
          <p style={{
            marginTop: 'var(--e2)', maxWidth: 280,
            fontSize: 12.5, lineHeight: 1.55, color: 'var(--lin)',
          }}>
            Dix jeux pour mesurer ton oreille musicale. Gratuits, sans
            inscription, et sans une note de solfège.
          </p>
        </div>

        <div>
          <div className="pied-titre">les {EPREUVES.length} jeux</div>
          <ul className="pied-liste pied-liste-jeux">
            {EPREUVES.map((e) => (
              <li key={e.slug}>
                <Link href={lienEpreuve(e.slug)} className="pied-lien">{e.nom}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="pied-titre">le site</div>
          <ul className="pied-liste">
            <li><Link href="/" className="pied-lien">Accueil</Link></li>
            <li><Link href="/quotidien" className="pied-lien">Défi du jour</Link></li>
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="pied-lien">{l.libelle}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pied-bas">
        <span>© {annee} {SITE_NOM}</span>
        {/* La provenance des extraits n'est pas une politesse : elle dit que
            le site ne rehéberge aucun fichier, ce qui est exactement ce qui le
            rend légal. Elle mérite de rester visible. */}
        <span>
          Extraits fournis par Deezer, sons de synthèse et échantillons libres.
        </span>
      </div>
    </footer>
  );
}
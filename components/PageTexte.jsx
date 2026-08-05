import EnTete from '@/components/EnTete';
import PiedDePage from '@/components/PiedDePage';

/**
 * GABARIT DES PAGES DE PROSE
 *
 * Mentions légales, confidentialité, contact, soutenir : quatre pages qui ne
 * contiennent que du texte, et qui doivent se ressembler sans que chacune
 * recopie sa mise en page. Le gabarit fixe ce qui est commun — la barre, la
 * colonne, le pied — et les pages n'apportent que leur contenu.
 *
 * Composant SERVEUR, délibérément. Ces pages sont la carte d'identité du
 * site : leur texte doit être dans le HTML servi, lisible par un moteur, un
 * régulateur ou un ayant droit SANS exécuter de JavaScript. Aucun état n'est
 * requis, donc aucune raison de payer l'hydratation. (EnTete est un composant
 * client, mais un composant serveur a le droit d'en monter un : seule la
 * barre s'hydrate, pas la prose.)
 *
 * ------------------------------------------------------------------ la forme
 *
 * COLONNE À 680 px. Le site affiche du 14 px : au-delà d'environ 75 signes
 * par ligne, l'œil perd le rang au retour à la ligne. 680 px donne 70-75
 * signes — la largeur d'un livre, pas celle d'un écran. C'est la seule mesure
 * de ce gabarit qui ne vient pas des jetons : elle vient de la lecture.
 *
 * H2 À FILET SUPÉRIEUR : c'est la grammaire du site (le pied de page et les
 * cartes séparent déjà leurs zones au filet 0,5 px, jamais à l'aplat). Un
 * filet AU-DESSUS du titre et non en dessous : il ferme la section qui
 * précède, ce qui est son vrai rôle — un filet sous le titre le détacherait
 * de son propre contenu.
 *
 * LISTES À TIRET CADRATIN plutôt qu'à disque : le disque est un artefact de
 * traitement de texte, le tiret est un signe typographique. Il se pose via
 * un pseudo-élément pour que le retrait suspendu tienne sur deux lignes.
 *
 * ÉTIQUETTE MONO-CAPITALES au-dessus du h1 : même emploi que dans le pied de
 * page — on NOMME une rubrique, on ne rédige pas. C'est le seul mono de la
 * page avec la date de mise à jour.
 */

/**
 * @param etiquette  rubrique en mono-capitales au-dessus du titre
 *                   (ex. « informations légales »)
 * @param titre      le h1 de la page
 * @param maj        date de dernière mise à jour, déjà formatée en français
 *                   (ex. « 5 août 2026 ») — affichée sous le titre, elle
 *                   engage la page : c'est la date que citera quiconque
 *                   conteste une mention. OPTIONNELLE : les pages dont le
 *                   contenu fait foi (mentions, confidentialité) la portent,
 *                   une page de coordonnées comme contact n'a rien à dater
 * @param children   la prose : h2, p, ul, .texte-encadre
 */
export default function PageTexte({ etiquette, titre, maj = null, children }) {
  return (
    <div className="ptexte-racine">
      <style>{`
        /* Aucun accent grave dans ce bloc : il vit dans un gabarit JSX, et un
           accent grave isole y refermerait la chaine CSS en plein milieu. */

        .ptexte-racine {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--noir);
        }

        /* La colonne de lecture. flex: 1 pour que le pied de page reste au
           bas de l ecran meme quand la prose est courte (page contact). */
        .ptexte {
          flex: 1;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          padding: var(--e8) var(--e5) 0;
          padding-left: calc(var(--e5) + var(--marge-gauche));
          padding-right: calc(var(--e5) + var(--marge-droite));
        }

        /* ============================================================
           ENTREE EN CASCADE, DU HAUT VERS LE BAS

           Meme grammaire que l'accueil et le defi du jour : 8 px de montee,
           560 ms, cubic-bezier(0.22, 1, 0.36, 1). Valeurs recopiees et non
           reinventees — une page de prose qui entrerait a une autre vitesse
           que le reste du site se remarquerait, et c'est exactement ce qu'une
           animation d'entree ne doit pas faire.

           La cascade porte sur les ENFANTS DIRECTS de la colonne : etiquette,
           titre, date, puis chaque h2, paragraphe et liste. Aucun balisage a
           ajouter dans les quatre pages — elles ecrivent leur prose, le
           gabarit s'occupe du reste. C'est aussi ce qui garantit qu'elles
           entrent toutes pareil.

           Le mot-cle both fige l'etat initial AVANT le declenchement : sans
           lui, le contenu s'affiche en clair pendant son delai puis saute a
           l'opacite nulle pour commencer — un clignotement a chaque element.

           PAS DE DELAI AU-DELA DU DIXIEME ENFANT. Les mentions legales en
           comptent une vingtaine ; a 55 ms de pas, le dernier partirait a
           plus d'une seconde, apres etre reste invisible sous la ligne de
           flottaison — une attente pure, que personne ne voit. Les suivants
           partagent donc le delai du dixieme : la cascade se lit en haut de
           page, la ou l'oeil est, et le bas de page est deja pret quand on
           l'atteint.

           Le pas de 55 ms est celui du sommaire du defi, qui aligne dix
           elements comme ici. Celui de l'accueil est plus large parce qu'il
           n'en range que cinq.

           prefers-reduced-motion est neutralise globalement dans
           globals.css, qui ramene toutes les durees a 0,01 ms : rien a
           ajouter ici, et surtout rien a contredire. */
        @keyframes ptexteEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ptexte > * {
          animation: ptexteEntree 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ptexte > *:nth-child(1)  { animation-delay: 0ms; }
        .ptexte > *:nth-child(2)  { animation-delay: 55ms; }
        .ptexte > *:nth-child(3)  { animation-delay: 110ms; }
        .ptexte > *:nth-child(4)  { animation-delay: 165ms; }
        .ptexte > *:nth-child(5)  { animation-delay: 220ms; }
        .ptexte > *:nth-child(6)  { animation-delay: 275ms; }
        .ptexte > *:nth-child(7)  { animation-delay: 330ms; }
        .ptexte > *:nth-child(8)  { animation-delay: 385ms; }
        .ptexte > *:nth-child(9)  { animation-delay: 440ms; }
        .ptexte > *:nth-child(n+10) { animation-delay: 495ms; }

        /* Le pied entre en dernier, apres le dixieme enfant de la colonne.
           Il n'est pas dans la cascade parce qu'il n'est pas dans la colonne,
           et son delai est ecrit a la main pour rester le dernier quoi qu'il
           arrive au contenu au-dessus. */
        .ptexte-pied {
          animation: ptexteEntree 560ms cubic-bezier(0.22, 1, 0.36, 1) 550ms both;
        }

        .ptexte-etiquette {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--or);
          margin-bottom: var(--e3);
        }

        .ptexte h1 {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 400;
          line-height: 1.15;
          color: var(--ivoire);
        }

        /* La date engage la page : en mono comme une donnee, en cendre comme
           une note — on la trouve quand on la cherche, elle ne crie pas. */
        .ptexte-maj {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--cendre);
          margin-top: var(--e3);
        }

        .ptexte h2 {
          margin-top: var(--e7);
          padding-top: var(--e5);
          border-top: 0.5px solid var(--filet);
          font-size: 16px;
          font-weight: 500;
          color: var(--ivoire);
        }

        .ptexte p {
          margin-top: var(--e3);
          font-size: 14px;
          line-height: 1.65;
          color: var(--lin);
        }

        /* Ce qui doit ressortir de la prose grise : ivoire, pas gras. Le gras
           en pleine ligne fait un texte qui clignote ; le changement de
           couleur suffit a accrocher l oeil sans hacher la lecture. */
        .ptexte strong {
          font-weight: 500;
          color: var(--ivoire);
        }

        .ptexte a {
          color: var(--or);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color var(--transition-courte);
        }
        .ptexte a:hover,
        .ptexte a:focus-visible { color: var(--or-clair); }

        /* Tiret cadratin en retrait suspendu : le texte d un item qui passe
           a la ligne s aligne sous son propre debut, pas sous le tiret. */
        .ptexte ul {
          list-style: none;
          margin-top: var(--e3);
          padding: 0;
          display: grid;
          gap: var(--e2);
        }
        .ptexte li {
          position: relative;
          padding-left: var(--e5);
          font-size: 14px;
          line-height: 1.65;
          color: var(--lin);
        }
        .ptexte li::before {
          content: '\\2014';
          position: absolute;
          left: 0;
          color: var(--cendre);
        }

        /* L encadre des coordonnees : la seule surface de la page. Ce qu on
           vient chercher — une adresse, un e-mail — merite d etre trouvable
           d un coup d oeil au defilement, sans relire la prose. */
        .texte-encadre {
          margin-top: var(--e4);
          padding: var(--e4) var(--e5);
          border: 0.5px solid var(--filet-fort);
          border-radius: var(--rayon-carte);
          font-size: 14px;
          line-height: 1.7;
          color: var(--ivoire);
        }
        .texte-encadre a { color: var(--or); }

        /* ---- Le cadre du pied de page ----
           PLEINE LARGEUR DE CONTENU, pas la colonne de lecture. La premiere
           version bornait le pied aux 680 px de la prose — defendable quand
           il tenait en une colonne, intenable depuis qu il porte quatre
           rubriques : comprime, il debordait de son cadre a droite. Le pied
           est un element du SITE, pas de la page ; il reprend donc le cadre
           que .contenu donne partout ailleurs (1600 px centres, memes
           marges), et il est identique d une famille de pages a l autre —
           c est sa raison d etre. Seule la prose reste a 680 px : c est une
           mesure de LECTURE, elle ne concerne que le texte. */
        .ptexte-pied {
          width: 100%;
          max-width: var(--largeur-contenu);
          margin: 0 auto;
          padding: 0 var(--e5) var(--e6);
          padding-left: calc(var(--e5) + var(--marge-gauche));
          padding-right: calc(var(--e5) + var(--marge-droite));
        }

        @media (max-width: 640px) {
          .ptexte { padding-top: var(--e6); }
          .ptexte h1 { font-size: 26px; }
          .ptexte h2 { margin-top: var(--e6); padding-top: var(--e4); }
        }
      `}</style>

      <EnTete liens={[{ href: '/quotidien', libelle: 'défi du jour' }]} />

      <main className="ptexte">
        <div className="ptexte-etiquette">{etiquette}</div>
        <h1>{titre}</h1>
        {maj && <p className="ptexte-maj">Dernière mise à jour : {maj}</p>}
        {children}
      </main>

      <div className="ptexte-pied">
        <PiedDePage />
      </div>
    </div>
  );
}
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { seeded, survolOr, sortieOr } from '@/components/dailyGames';
import { useVolume } from '@/utils/volume';
import { useIntro } from '@/utils/intro';

const POSITIONS = [
  { name: 'C4', midi: 60, y: 170, ledger: true },
  { name: 'D4', midi: 62, y: 160 },
  { name: 'E4', midi: 64, y: 150 },
  { name: 'F4', midi: 65, y: 140 },
  { name: 'G4', midi: 67, y: 130 },
  { name: 'A4', midi: 69, y: 120 },
  { name: 'B4', midi: 71, y: 110 },
  { name: 'C5', midi: 72, y: 100 },
  { name: 'D5', midi: 74, y: 90 },
  { name: 'E5', midi: 76, y: 80 },
  { name: 'F5', midi: 77, y: 70 },
  { name: 'G5', midi: 79, y: 60 },
];
const LINES_Y = [70, 90, 110, 130, 150];
const NOTE_GAP = 0.42;
const PREROLL = 0.15;

// Note creuse dont le contour se trace en un tour, puis reste complet
const RX = 12, RY = 9;
// Périmètre de l'ellipse (approximation de Ramanujan)
const PERIMETRE = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));
const DUREE_TRACE = 520; // ms — durée du tour complet

/* ============================================================
   NOTE CREUSE STABLE — pour la correction

   Même dessin que le NoteCreuse défini plus bas dans le composant, mais
   déclarée AU NIVEAU DU MODULE, et c'est toute la différence.

   Un composant défini dans le corps d'un autre est recréé à chaque rendu du
   parent : React voit un TYPE différent d'un rendu à l'autre, démonte donc
   l'ancien sous-arbre et en monte un neuf. Les nœuds sont neufs, leurs
   animations CSS repartent de zéro — et comme la révélation enchaîne les
   rendus, le contour se retraçait en boucle.

   Pour l'aperçu au survol, ce remontage est justement l'effet voulu : le
   contour se retrace à chaque changement de hauteur, en phase avec le son.
   Pour la correction, il n'y a rien à rejouer. Un type stable suffit : React
   reconnaît le même nœud, ne le remonte pas, et l'animation se joue une fois.
============================================================ */
function NoteContour({ cx, cy, couleur }) {
  const trace = {
    animation: `traceContour ${DUREE_TRACE}ms cubic-bezier(0.4, 0, 0.2, 1) both`,
  };
  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Halo : passe large très faible, comme sur l'onde */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none"
        stroke={couleur} strokeWidth={5} opacity={0.1} strokeLinecap="round"
        strokeDasharray={PERIMETRE} style={trace} />
      {/* Contour net */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none"
        stroke={couleur} strokeWidth={1.6} strokeLinecap="round"
        strokeDasharray={PERIMETRE} style={trace} />
    </g>
  );
}

/* ============================================================
   SURCOUCHE D'INTRODUCTION
   Le concept de cette épreuve ne se lit pas d'un coup d'œil : rien n'indique
   qu'on pose des notes en cliquant sur la portée. Plutôt qu'un paragraphe
   d'explication, on le MONTRE — un curseur vient cliquer trois fois, trois
   notes apparaissent. Trois secondes, une seule idée.

   Les noms d'animation sont préfixés `acc` : les dix épreuves étant montées
   simultanément dans le carrousel, leurs blocs <style> coexistent dans le
   DOM et des @keyframes homonymes s'écraseraient silencieusement.
============================================================ */

/* Portée miniature de l'intro, dans son propre repère. */
const INTRO_LIGNES = [30, 45, 60, 75, 90];
const INTRO_DEPART = { x: 62, y: 104 };
/* Un accord parfait de do majeur : les hauteurs montent comme les ordonnées
   descendent, l'oreille et l'œil racontent donc la même chose. */
const INTRO_NOTES = [
  { x: 120, y: 82, hauteur: 'C4' },
  { x: 176, y: 67, hauteur: 'E4' },
  { x: 232, y: 52, hauteur: 'G4' },
];

/* Chronologie, en ms depuis l'ouverture du voile. Les instants d'arrivée du
   curseur servent aussi à dater l'apparition des notes : un seul jeu de
   valeurs, donc pas de dérive possible entre le geste et son effet. */
const INTRO_TITRE = 260;
const INTRO_PORTEE = 1000;   // le titre a fini de se poser
const INTRO_CURSEUR = 1380;
const INTRO_CURSEUR_DUREE = 1700;
const INTRO_ARRIVEES = [360, 870, 1380]; // relatives au départ du curseur
const INTRO_SORTIE = 3320;
const INTRO_TOTAL = 3800;

/* Le trajet du curseur est généré à partir des positions de notes : déplacer
   une note dans INTRO_NOTES suffit, le curseur suit. */
function keyframesCurseur() {
  const etapes = INTRO_ARRIVEES.map((t) => (t / INTRO_CURSEUR_DUREE) * 100);
  const pause = (100 / INTRO_CURSEUR_DUREE) * 130; // 130 ms d'arrêt sur chaque note
  const pos = (p) => `translate(${p.x}px, ${p.y}px)`;

  return `
    0%   { transform: ${pos(INTRO_DEPART)}; opacity: 0; }
    6%   { transform: ${pos(INTRO_DEPART)}; opacity: 1; }
    ${etapes[0].toFixed(1)}%  { transform: ${pos(INTRO_NOTES[0])}; }
    ${(etapes[0] + pause).toFixed(1)}%  { transform: ${pos(INTRO_NOTES[0])}; }
    ${etapes[1].toFixed(1)}%  { transform: ${pos(INTRO_NOTES[1])}; }
    ${(etapes[1] + pause).toFixed(1)}%  { transform: ${pos(INTRO_NOTES[1])}; }
    ${etapes[2].toFixed(1)}%  { transform: ${pos(INTRO_NOTES[2])}; }
    94%  { opacity: 1; }
    100% { transform: ${pos(INTRO_NOTES[2])}; opacity: 0; }
  `;
}

function SurcoucheIntro({ onNote, onPasser }) {
  // Les sons sont programmés ici, sur les délais qui datent déjà les notes à
  // l'écran : une seule source de vérité, donc aucune dérive possible entre
  // ce qu'on voit et ce qu'on entend.
  useEffect(() => {
    const minuteurs = INTRO_NOTES.map((n, i) =>
      setTimeout(() => onNote(n.hauteur), INTRO_CURSEUR + INTRO_ARRIVEES[i] + 30)
    );
    return () => minuteurs.forEach(clearTimeout);
  }, [onNote]);

  return (
    <div
      data-acc-surcouche
      onClick={onPasser}
      role="button"
      tabIndex={0}
      aria-label="Passer la présentation"
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPasser?.();
        }
      }}
      style={{
        cursor: 'pointer',
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--e4)',
        textAlign: 'center',
        padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: `accVoile ${INTRO_TOTAL}ms ease-out both`,
      }}
    >
      {/* Tout l'acte s'efface d'un bloc : un seul wrapper animé plutôt que
          cinq sorties à synchroniser. */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--e4)',
        animation: `accSortie 320ms ${INTRO_SORTIE}ms ease-in both`,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--or)',
          animation: `accEntree 340ms ${INTRO_TITRE}ms ease-out both`,
        }}>
          Retrouve l&apos;accord
        </div>

        <svg
          viewBox="0 0 320 120"
          width="100%"
          style={{ maxWidth: 340, display: 'block' }}
          aria-hidden="true"
        >
          {/* Portée et clé */}
          <g style={{ animation: `accEntree 340ms ${INTRO_PORTEE}ms ease-out both` }}>
            {INTRO_LIGNES.map((y) => (
              <line key={y} x1={14} y1={y} x2={306} y2={y} stroke="var(--filet-fort)" strokeWidth={1} />
            ))}
            <text x={22} y={92} fontSize={62} fill="var(--lin)">𝄞</text>
          </g>

          {/* Les trois notes, chacune datée sur l'arrivée du curseur */}
          {INTRO_NOTES.map((n, i) => {
            const t = INTRO_CURSEUR + INTRO_ARRIVEES[i] + 30;
            return (
              <g key={i}>
                {/* Onde de clic */}
                <circle
                  cx={n.x} cy={n.y} r={7}
                  fill="none" stroke="var(--or-clair)" strokeWidth={1.2}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    animation: `accClic 420ms ${t - 40}ms ease-out both`,
                  }}
                />
                {/* Note posée */}
                <ellipse
                  cx={n.x} cy={n.y} rx={9} ry={6.5}
                  fill="var(--or)"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    animation: `accNote 380ms ${t}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
                  }}
                />
              </g>
            );
          })}

          {/* Curseur : dessiné à l'origine, déplacé par l'animation */}
          <g style={{ animation: `accCurseur ${INTRO_CURSEUR_DUREE}ms ${INTRO_CURSEUR}ms cubic-bezier(0.5, 0, 0.2, 1) both` }}>
            <path
              d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
              fill="var(--ivoire)"
              stroke="var(--noir)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <div style={{
          // Mêmes réglages que la légende « 3 vies » des épreuves de survie :
          // mono, ivoire. Seul le corps est réduit, la phrase étant longue.
          fontFamily: 'var(--mono)',
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.35,
          letterSpacing: '0.02em',
          color: 'var(--ivoire)',
          animation: `accEntree 320ms ${INTRO_PORTEE + 120}ms ease-out both`,
        }}>
          Clique sur la portée pour poser tes notes
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SURCOUCHE DE RÉSULTAT
   La note apparaissait discrètement sous la portée, au milieu des boutons.
   Le voile en fait un moment : le chiffre occupe l'écran, sa couleur dit le
   verdict avant même qu'on l'ait lu, et une jauge le situe sur dix.
============================================================ */

/* Quatre paliers. Le jade reste réservé au sans-faute — c'est la couleur du
   « juste » partout ailleurs dans l'épreuve, elle perdrait son sens à
   récompenser un à-peu-près. */
/* ---- Les trois états d'une note corrigée ----
 *
 * Deux couleurs ne suffisaient pas. En arpège, une note dont la HAUTEUR est
 * dans la cible mais qui tombe au mauvais rang n'est ni juste ni fausse :
 * l'oreille a travaillé, la main s'est trompée de place. La peindre en rouge
 * dit à ce joueur qu'il n'a rien entendu, ce qui est faux et décourageant.
 *
 * La troisième teinte est l'OR, et ce n'est pas une seconde couleur d'accent :
 * c'est déjà l'intermédiaire de la palette de score du site — jade au-dessus
 * de 9,5, or au-dessus de 7. La graduation jade → or → carmin est donc celle
 * que le joueur voit ailleurs sur la page, elle n'a rien à apprendre.
 *
 * L'or sert aussi à la note NON ENCORE JUGÉE. Les deux ne se croisent jamais :
 * avant la validation toutes les notes sont or, après elle il y a du jade et
 * du carmin à côté pour que l'or se lise comme un état parmi trois.
 *
 * Réserve : la distinction reste portée par la seule couleur, et la phrase
 * d'état est ce qui la rattrape pour qui ne la voit pas.
 */
const COULEUR_VERDICT = {
  juste:    'var(--jade)',
  ailleurs: 'var(--or)',
  faux:     'rgba(226, 75, 74, 0.65)',
};

/* ---- Ce que coûte une note fausse ----
 *
 * L'ancienne formule repliait TOUT à l'octave : `min(d % 12, 12 - d % 12)`.
 * Fa4 contre Mi5, soit onze demi-tons, y devenait « un demi-ton d'écart » et
 * ne coûtait qu'un point — une manche à onze demi-tons de la cible sortait
 * à 9,2 sur 10. Pire, la surtaxe d'octave ne se déclenchait qu'à partir de
 * douze : une note PRESQUE à l'octave coûtait moins cher qu'une note
 * exactement à l'octave.
 *
 * La règle est maintenant en deux temps, et elle se dit en une phrase :
 *
 *   — l'écart se compte en demi-tons réels, plafonné à 6. Au-delà du triton,
 *     se tromper davantage ne veut plus dire grand-chose ;
 *   — l'octave juste reste l'exception, à 1,5 par octave. Jouer la bonne
 *     note au mauvais registre n'est pas la même faute que jouer une autre
 *     note, et c'est la seule erreur que l'oreille reconnaît comme « juste
 *     mais ailleurs ».
 *
 *   d  :  1   3   6   7  11  12  13  24
 *   →  : 1,0 3,0 6,0 6,0 6,0 1,5 2,5 3,0
 */
/* Ce qu'une seule note peut coûter au maximum.
 *
 * Le score divisait par un budget de 4 par note alors qu'`ecart` peut en
 * facturer 6. L'échelle saturait donc dès que l'erreur moyenne dépassait
 * quatre demi-tons : un arpège où le joueur avait retrouvé deux hauteurs sur
 * quatre, mais mal placées, sortait à 0,0 — le même chiffre que s'il n'avait
 * rien entendu du tout. Un score sur dix qui ne distingue plus rien en
 * dessous d'un certain seuil ne mesure plus : il constate un échec.
 *
 * Le budget vaut donc exactement le maximum facturable. Le zéro redevient ce
 * qu'il doit être — le plancher qu'on n'atteint qu'en se trompant PARTOUT et
 * d'au moins un triton. */
const PENALITE_MAX = 6;

function ecart(d) {
  if (d === 0) return 0;
  if (d % 12 === 0) return 1.5 * (d / 12);
  const octaves = Math.floor(d / 12);
  return Math.min(d - 12 * octaves, 6) + 1.5 * octaves;
}

function paletteScore(valeur) {
  const n = +valeur;
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'accord parfait' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bien joué' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'à retravailler' };
  return { couleur: 'var(--carmin)', mention: 'raté' };
}

/* Temps laissé sur la portée corrigée après la dernière note dévoilée. */
const RES_ATTENTE_CORRECTION = 800;

/* Instant de la DERNIÈRE note révélée, en secondes — pas la fin du son.
   playNotes rend une durée qui inclut la traîne de relâchement (1,2 s en
   accord, 0,4 s en arpège) : s'en servir pour enchaîner laissait un temps
   mort où la portée corrigée restait à l'écran sans que rien ne bouge.
   Calque exact du calendrier de playTargetWithReveal. */
function finRevelation(notes, m) {
  return m === 'arpège' ? PREROLL + (notes.length - 1) * NOTE_GAP : PREROLL;
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
const RES_TOTAL = 2900;

function SurcoucheResultat({ score }) {
  const { couleur, mention } = paletteScore(score);
  // La jauge se remplit par transition plutôt que par @keyframes : sa valeur
  // d'arrivée dépend du score, et une keyframe est une règle statique qu'on
  // ne peut pas paramétrer par instance.
  const [remplie, setRemplie] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRemplie(true), RES_BARRE);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      data-acc-surcouche
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--e3)',
        textAlign: 'center',
        padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: `accVoile ${RES_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--e3)',
        animation: `accSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div
          className="etiquette-mono"
          style={{
            color: 'var(--cendre)',
            animation: `accEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
          }}
        >
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 62,
          fontWeight: 500,
          lineHeight: 1,
          color: couleur,
          animation: `accNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
        }}>
          {(+score).toFixed(1).replace('.', ',')}
          <span style={{ color: 'var(--cendre)', fontSize: 30 }}> / 10</span>
        </div>

        {/* Jauge : situe la note sur dix d'un coup d'œil */}
        <div style={{
          width: 200,
          height: 3,
          borderRadius: 2,
          background: 'var(--filet-fort)',
          overflow: 'hidden',
          marginTop: 'var(--e2)',
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: couleur,
            transformOrigin: 'left center',
            transform: `scaleX(${remplie ? Math.max(0, Math.min(1, +score / 10)) : 0})`,
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: couleur,
          marginTop: 'var(--e2)',
          animation: `accEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>
      </div>
    </div>
  );
}

export default function JeuAccordsGame({ daily = false, revelation = true, onDone = () => {} }) {
  /* Score CONTINU : pas de notion de « trouvé ».

     Un accord approché à un demi-ton rapporte encore des points. Il n'existe
     donc aucun seuil au-delà duquel le joueur connaîtrait déjà la cible et
     pourrait la voir sans risque : la dévoiler, même à quelqu'un qui a bien
     joué, le met en mesure de la donner à un joueur d'un fuseau en retard.

     Pendant le défi, la cible reste donc muette — ni sur la portée, ni au
     bilan, ni dans le voile de résultat. */
  const devoile = revelation;
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('accord');
  const [userNotes, setUserNotes] = useState([]);
  const [locked, setLocked] = useState(false);
  const [pianoPret, setPianoPret] = useState(false);
  const [status, setStatus] = useState('Chargement du piano…');
  const [score, setScore] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  // « Poser directement » par défaut : le survol ne joue rien tant que le
  // joueur n'a pas demandé à chercher à l'oreille lui-même.
  const [hoverSound, setHoverSound] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  /* Colonne du joueur où poser chaque note de la cible à la correction.
     Identité tant qu'aucun appariement n'a été calculé. */
  const [paires, setPaires] = useState(null);
  const [pulse, setPulse] = useState(0);   // incrémenté à chaque note jouée → relance le tracé
  // L'intro se joue à l'ARRIVÉE sur l'épreuve — landing page, onglet sous
  // l'onde — mais pas sur « Relancer l'épreuve », qui remonte pourtant le
  // composant exactement pareil. useIntro tranche en comparant le chemin.
  const [intro, setIntro] = useState(useIntro('accords'));
  // Surcouche de résultat, posée à la validation puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan chiffré du bas reste caché tant que le voile n'a pas fini de
  // présenter la note : deux fois le même chiffre au même instant, l'un
  // par-dessus l'autre, se contrediraient visuellement.
  const [bilan, setBilan] = useState(false);
  // Vrai de la validation jusqu'à l'affichage du bilan. Gèle les boutons
  // pendant toute la séquence — c'est ce qui empêchait de générer une
  // nouvelle cible par-dessus le voile de score.
  const [enSequence, setEnSequence] = useState(false);
  const volume = useVolume();
  const toneRef = useRef(null);
  const synthRef = useRef(null);
  const hoverSynthRef = useRef(null);
  const svgRef = useRef(null);

  /* ---- Géométrie de la portée ----
   *
   * Le SVG occupe toute la largeur disponible, et son viewBox décide donc de
   * l'échelle : un cadre de 700 unités rendu sur 328 pixels divise TOUT par
   * 2,1 — l'interligne, les têtes de note, et surtout la zone qu'il faut
   * viser pour poser une note. Sur ordinateur l'interligne fait 20 pixels,
   * sur mobile il tombait à neuf. On ne place pas une note au doigt dans
   * neuf pixels.
   *
   * SEULE LA LARGEUR DU CADRE COMPTE. Le SVG n'a pas de hauteur déclarée :
   * elle se déduit du rapport du viewBox, si bien que l'échelle verticale est
   * toujours égale à l'horizontale. Écarter les lignes ne se règle donc pas
   * en changeant leurs ordonnées — elles sont d'ailleurs partagées avec la
   * table des positions de notes — mais en RESSERRANT le cadre : moins
   * d'unités sur la même largeur d'écran, donc plus de pixels par unité.
   *
   * À 260 unités, l'échelle vaut 1,26 sur un écran de 328 : l'interligne
   * passe de vingt unités à vingt-cinq pixels réels, contre neuf avant, et
   * les têtes de note à seize pixels de large. La portée occupe alors une
   * bonne moitié de l'écran, ce qui est le juste prix — c'est l'objet qu'on
   * manipule.
   *
   * Tout le reste en découle : la clé, les bornes des lignes, l'abscisse de
   * la première note et le pas entre deux. Quatre notes au pas de 50 tiennent
   * en 224 unités, lignes supplémentaires comprises, sur les 250 disponibles.
   */
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const maj = () => {
      setEtroit(mq.matches);
      /* « Chercher à l'oreille » fait sonner la note SOUS LE CURSEUR, avant
         de la poser : c'est ce qui permet de chercher une hauteur à
         l'oreille. Sans pointeur, il n'y a rien à survoler — le mode existe
         encore mais ne peut plus rien produire, et le proposer revient à
         offrir un réglage sans effet.

         On impose donc « Poser directement » sur écran tactile, et le
         sélecteur disparaît. Sur mobile, la note sonne au moment où on la
         pose et pendant qu'on la glisse, ce qui rend le même service au
         geste près. */
      if (mq.matches) setHoverSound(false);
    };
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  /* ---- Empêcher la page de défiler pendant qu'on déplace une note ----
   *
   * Le glisser est VERTICAL — c'est un changement de hauteur — donc il
   * ressemble exactement au geste qui fait défiler la page. Le navigateur
   * tranche au premier mouvement, et il tranche en faveur du défilement : la
   * note restait sur place pendant que la page filait.
   *
   * touch-action ne suffit pas ici. La propriété est bien posée sur la note,
   * mais WebKit ne l'applique pas de façon fiable aux éléments À L'INTÉRIEUR
   * d'un SVG. Il faut donc refuser le geste à la source, sur touchmove.
   *
   * Deux points rendent la chose possible :
   *
   *   — le passif doit être désactivé EXPLICITEMENT. Un écouteur de
   *     touchmove est passif par défaut sur les navigateurs mobiles, et un
   *     écouteur passif n'a pas le droit d'appeler preventDefault : l'appel
   *     est ignoré, avec un avertissement en console et rien d'autre. C'est
   *     aussi pourquoi il faut passer par addEventListener plutôt que par la
   *     propriété onTouchMove de React, qui ne laisse pas régler ce drapeau.
   *
   *   — le refus n'a lieu QUE pendant un glisser. Hors glisser, la portée se
   *     comporte comme le reste de la page et se laisse traverser du doigt.
   *     C'est ce qui évite de créer une bande de deux cents pixels où le
   *     défilement ne répond plus.
   *
   * On lit la ref et non l'état : l'écouteur est posé une seule fois, il ne
   * verrait jamais une valeur mise à jour par un rendu. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const refuser = (e) => {
      if (dragIndexRef.current !== null) e.preventDefault();
    };
    svg.addEventListener('touchmove', refuser, { passive: false });
    return () => svg.removeEventListener('touchmove', refuser);
  }, []);

  /* minY et H DÉCOUPENT le cadre, ils ne le mettent pas à l'échelle.
   *
   * Le cadre partait de l'ordonnée 0, alors que rien n'est dessiné au-dessus
   * de 51 : la note la plus haute est G5 à 60, moins son demi-axe de 9. Ces
   * cinquante et une unités de vide se retrouvaient telles quelles à l'écran
   * — une soixantaine de pixels de noir entre la consigne et la première
   * ligne, que rien dans le CSS ne pouvait expliquer puisque la marge était
   * dans l'image.
   *
   * Le découpage ne touche pas à l'échelle : celle-ci vaut la largeur rendue
   * divisée par la largeur du cadre, et la largeur ne change pas. Seule la
   * hauteur rendue diminue, exactement de ce qu'on retire.
   *
   * Onze unités de marge au-dessus de la note la plus haute, dix sous les
   * étiquettes de notes posées à 200 : de quoi ne rien tronquer. */
  const P = etroit
    ? { W: 260, minY: 40, H: 170, x1: 4, x2: 256, cleX: 2, cleY: 148, cleTaille: 78, noteX0: 68, notePas: 54, decalage: 0 }
    : { W: 700, minY: 0, H: 215, x1: 20, x2: 680, cleX: 30, cleY: 148, cleTaille: 90, noteX0: 170, notePas: 110, decalage: 26 };
  const lastHoverRef = useRef(null);
  const revealTimersRef = useRef([]);
  const dragMovedRef = useRef(false);
  const dragIndexRef = useRef(null);
  /* Date de la fin du dernier geste sur une note.
     Voir le garde-fou de onStaffClick, plus bas. */
  const finGesteNoteRef = useRef(0);
  const dailyDoneRef = useRef(false);
  const scoreTimerRef = useRef(null);
  const bilanTimerRef = useRef(null);

  // L'intro se retire d'elle-même : le jeu est déjà en place derrière elle.
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), INTRO_TOTAL);
    return () => clearTimeout(t);
  }, []);

  // Voile et correction sont tous deux différés : si le composant part
  // entre-temps (changement d'épreuve, relance), les minuteurs suivent.
  useEffect(() => () => {
    clearTimeout(scoreTimerRef.current);
    clearTimeout(bilanTimerRef.current);
  }, []);

  // Idem pour le résultat : le détail cible/proposition reste lisible en
  // dessous une fois le voile levé.
  useEffect(() => {
    if (!resultat) return;
    const t = setTimeout(() => setResultat(null), RES_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
      const sampler = new Tone.Sampler({
        urls: { C4: 'C4.mp3', A4: 'A4.mp3', C5: 'C5.mp3' },
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/piano/',
        release: 1.2,
        onload: () => {
          synthRef.current = sampler;
          hoverSynthRef.current = sampler;
          setPianoPret(true);
          /* Cette ligne répétait le bouton doré posé juste au-dessus d'elle.
             Elle sert mieux à lever la seule inquiétude d'un débutant devant
             une épreuve d'oreille : croire qu'il n'a droit qu'à une écoute. */
          setStatus(daily
            ? 'Trois ou quatre notes, une seule tentative. Réécoute autant que tu veux.'
            : 'Trois ou quatre notes, à réécouter autant de fois que tu veux.');
        },
      }).toDestination();
    });
    return () => {
      revealTimersRef.current.forEach(clearTimeout);
      // Coupe une note de piano encore en cours au moment de la relance
      try { synthRef.current?.releaseAll?.(); synthRef.current?.dispose(); } catch {}
    };
  }, []);

  // Le curseur de la barre du haut ne pilotait que l'ambiance : le piano
  // partait droit dans la sortie de Tone. On répercute donc la valeur sur le
  // sampler — y compris pendant qu'une note résonne, sans attendre la
  // suivante.
  //
  // useVolume rend un gain linéaire (0 à 1), Tone raisonne en décibels :
  // gainToDb fait la conversion, et 0 doit devenir -Infinity et non -0 dB,
  // sinon couper le son le laisserait à plein volume.
  useEffect(() => {
    const Tone = toneRef.current;
    const synth = synthRef.current;
    if (!Tone || !synth) return;
    synth.volume.value = volume > 0 ? Tone.gainToDb(volume) : -Infinity;
  }, [volume, pianoPret]);

  /* Passer la présentation.

     Le démontage de la surcouche annule les minuteurs des notes À VENIR — sa
     fonction de nettoyage s'en charge — mais pas celles qui résonnent déjà :
     un sampler continue de sonner jusqu'au relâchement. D'où le releaseAll,
     sans lequel on couperait l'image en laissant l'accord dans le vide. */
  function passerIntro() {
    try { synthRef.current?.releaseAll?.(); } catch {}
    setIntro(false);
  }

  /* Note de l'intro. Le volume n'a rien à régler ici : le sampler est déjà
     asservi au curseur de la page par l'effet ci-dessus.

     L'intro démarre au montage, sans geste utilisateur : si le contexte
     audio n'a pas encore été débloqué par le navigateur, on reste muet
     plutôt que d'appeler Tone.start(), qui échouerait de toute façon. */
  const jouerNoteIntro = useCallback((hauteur) => {
    const Tone = toneRef.current;
    const synth = synthRef.current;
    if (!Tone || !synth) return;
    const ctx = Tone.getContext?.() ?? Tone.context;
    if (ctx?.state !== 'running') {
      // Dernière chance : on relance le contexte et on laisse tomber CETTE
      // note. Le resume est asynchrone, la jouer maintenant la perdrait ;
      // les suivantes de l'accord, elles, sonneront.
      Tone.start?.()?.catch?.(() => {});
      return;
    }
    try { synth.triggerAttackRelease(hauteur, '8n'); } catch {}
  }, []);

  /* Réveil du contexte audio pour l'intro.

     Après un rafraîchissement, aucun geste n'a encore eu lieu dans la page :
     le contexte naît suspendu et rien ne le réveille avant le premier clic
     sur « Écouter l'accord » ou sur la portée. L'intro, elle, démarre au
     montage — elle restait donc muette.

     Deux tentatives complémentaires. La première, dès que le sampler est
     prêt : les navigateurs acceptent un resume() hors gestionnaire dès lors
     que la page a reçu UNE interaction à un moment quelconque (« activation
     persistante ») — ce qui couvre le clic sur l'onglet ou sur « Relancer
     l'épreuve ». La seconde, en repli, s'accroche au premier geste venu,
     pour le cas d'un arrivage direct par URL. */
  useEffect(() => {
    let vivant = true;
    const reveiller = () => {
      if (!vivant) return;
      toneRef.current?.start?.()?.catch?.(() => {});
    };

    if (pianoPret) reveiller();
    window.addEventListener('pointerdown', reveiller, { once: true });
    window.addEventListener('keydown', reveiller, { once: true });

    return () => {
      vivant = false;
      window.removeEventListener('pointerdown', reveiller);
      window.removeEventListener('keydown', reveiller);
    };
  }, [pianoPret]);

  async function ensureAudio() {
    if (toneRef.current) await toneRef.current.start();
  }

  function posFromEvent(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const y = pt.matrixTransform(svg.getScreenCTM().inverse()).y;
    return POSITIONS.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
  }

  const canPlace = () => !locked && target && userNotes.length < target.length;

  function startDrag(e, i) {
    if (locked) return;
    e.stopPropagation();
    e.preventDefault();
    dragIndexRef.current = i;
    dragMovedRef.current = false;
    setDragIndex(i);
  }

  function onStaffMove(e) {
    if (dragIndexRef.current !== null) {
      const pos = posFromEvent(e);
      if (!pos) return;
      const i = dragIndexRef.current;
      if (userNotes[i]?.name !== pos.name) {
        dragMovedRef.current = true;
        const next = [...userNotes];
        next[i] = pos;
        setUserNotes(next);
        hoverSynthRef.current?.triggerAttackRelease(pos.name, '8n', undefined, 0.5);
        setPulse((p) => p + 1);
      }
      return;
    }
    if (!canPlace()) { setHoverPos(null); return; }
    const pos = posFromEvent(e);
    if (!pos) return;
    setHoverPos(pos);
    if (lastHoverRef.current !== pos.name) {
      lastHoverRef.current = pos.name;
      if (hoverSound) {
        hoverSynthRef.current?.triggerAttackRelease(pos.name, '8n', undefined, 0.35);
      }
      setPulse((p) => p + 1);   // le contour se retrace, en phase avec le son
    }
  }

  function endDrag() {
    if (dragIndexRef.current === null) return;
    const i = dragIndexRef.current;
    const moved = dragMovedRef.current;
    dragIndexRef.current = null;
    /* Le geste vient de se terminer SUR UNE NOTE. Le clic de synthèse qui
       suit n'a rien à faire sur la portée — voir onStaffClick. */
    finGesteNoteRef.current = Date.now();
    setDragIndex(null);
    if (!moved) removeNote(i);
    else setStatus(`Note déplacée : ${userNotes[i]?.name ?? ''}`);
  }

  /* ---- Une seule phrase d'état pour toute la pose ----
   *
   * L'ancienne consigne de manche annonçait d'un bloc « glisse une note pour
   * l'ajuster, clique-la pour la retirer » — deux gestes décrits AVANT
   * qu'il y ait la moindre note à glisser ou à retirer. Une instruction
   * donnée trop tôt est une instruction perdue.
   *
   * Elle arrive donc à la première note posée, c'est-à-dire à l'instant où
   * elle devient exécutable, et disparaît quand la portée est pleine pour
   * laisser la place à la seule chose qui reste à faire.
   *
   * Les trois formulations tiennent sur une ligne de mono à 12 px : cette
   * ligne est au-dessus de la portée sur ordinateur, un retour à la ligne y
   * décalerait tout le reste du panneau.
   *
   * LE VERBE SUIT LE GESTE. On ne clique pas sur un téléphone. Décrire à
   * quelqu'un le geste qu'il ne fait pas, c'est lui faire douter du sien —
   * et c'est ce qui a fait passer un vrai défaut pour un simple contresens.
   * `etroit` sert déjà à décider de la géométrie de la portée et du mode
   * d'écoute ; il décide donc aussi du verbe.
   */
  const toucher = etroit ? 'Touche' : 'Clique';
  const toucherBref = etroit ? 'touche' : 'clique';

  function statutNotes(n, total) {
    if (!total) return '';
    if (n === 0) return `${toucher} la portée pour poser une note.`;
    if (n < total) return `${n}/${total} · glisse pour ajuster, ${toucherBref} pour retirer`;
    return `${n}/${total} · compare quand tu veux`;
  }

  /* ---- La phrase de correction ----
   *
   * Elle s'affiche à l'instant précis où l'accord se rejoue et se pose,
   * note à note, sur la portée. C'est la seconde la plus chargée de
   * l'épreuve, et elle ne durait qu'à décrire des couleurs déjà visibles :
   * « tes notes justes en vert, tes erreurs en rouge ». Une légende, là où
   * il fallait un résultat.
   *
   * Elle annonce donc D'ABORD le compte. C'est la seule information que le
   * joueur ne peut pas lire seul : distinguer trois têtes de note vertes de
   * deux vertes et une rouge demande de compter, et personne ne compte
   * pendant qu'un accord se joue. Le chiffre arrive avant le son, la
   * légende des couleurs vient derrière, une fois qu'elle a un sens.
   *
   * DEUX NOTES SUR TROIS N'EST PAS UN ÉCHEC, et la phrase ne doit pas le
   * dire. Elle constate, elle ne juge pas — le jugement est le rôle du
   * chiffre sur dix, qui tombe deux secondes plus tard.
   *
   * En quotidien, l'accord n'est pas dévoilé : le compte reste donné,
   * puisqu'il n'apprend rien de plus que la note sur dix déjà affichée,
   * mais la légende des couleurs disparaît avec ce qu'elle désignait.
   */
  function phraseCorrection(justes, total, montre, deplacees = 0) {
    const compte = `${justes} note${justes > 1 ? 's' : ''} sur ${total}`;
    if (!montre) return `${compte} · l'accord complet demain`;
    if (justes === total) return `${compte} · écoute-le une dernière fois`;
    /* Cas propre à l'arpège : les hauteurs sont là, l'ordre ne l'est pas.
       Le taire laisserait croire à des notes fausses alors que l'oreille,
       elle, a bien travaillé. */
    if (deplacees > 0) {
      return deplacees > 1
        ? `${justes}/${total} en place · en or, les notes justes mal placées`
        : `${justes}/${total} en place · en or, la note juste mal placée`;
    }
    return `${compte} · en vert l'accord, en rouge tes écarts`;
  }

  function onStaffLeave() {
    setHoverPos(null);
    lastHoverRef.current = null;
    endDrag();
  }

  function clearReveal() {
    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
    setRevealed(0);
  }

  function newRound(rng = Math.random) {
    const m = rng() < 0.5 ? 'accord' : 'arpège';
    const n = rng() < 0.5 ? 3 : 4;
    const base = Math.floor(rng() * (POSITIONS.length - (n - 1) * 2));
    let notes = Array.from({ length: n }, (_, i) => POSITIONS[base + i * 2]);
    if (m === 'arpège' && rng() < 0.5) notes = [...notes].reverse();
    clearReveal();
    setMode(m); setTarget(notes); setUserNotes([]);
    setScore(null); setVerdicts(null); setPaires(null); setLocked(false); setHoverPos(null);
    setBilan(false); setResultat(null); setEnSequence(false);
    lastHoverRef.current = null;
    /* L'ORDRE EST MAINTENANT NOTÉ EN ARPÈGE. Une règle qui coûte des points
       et que rien n'annonce est un piège ; elle tient en trois mots. */
    setStatus(m === 'accord'
      ? `Accord · ${n} notes, ordre libre. ${toucher} la portée.`
      : `Arpège · ${n} notes, dans l'ordre. ${toucher} la portée.`);
    playNotes(notes, m);
  }

  async function playNotes(notes, m) {
    await ensureAudio();
    const Tone = toneRef.current;
    const synth = synthRef.current;
    if (!synth) return 0;
    const t0 = Tone.now() + PREROLL;
    if (m === 'arpège') {
      notes.forEach((n, i) => synth.triggerAttackRelease(n.name, '8n', t0 + i * NOTE_GAP));
      return PREROLL + notes.length * NOTE_GAP + 0.4;
    }
    synth.triggerAttackRelease(notes.map(n => n.name), '2n', t0);
    return PREROLL + 1.2;
  }

  /* `montrer` sépare le SON de la RÉVÉLATION graphique.

     La cible est rejouée dans tous les cas : l'entendre une dernière fois
     n'apprend pas où elle se pose sur la portée, et couper le son ferait
     croire à une panne. Seul l'affichage des notes est retenu quand la
     correction est différée — la durée renvoyée reste la même, sans quoi la
     suite de la séquence se décalerait. */
  async function playTargetWithReveal(notes, m, montrer = true) {
    setRevealed(0);
    const dur = await playNotes(notes, m);
    if (!montrer) return dur;
    if (m === 'arpège') {
      notes.forEach((_, i) => {
        const timer = setTimeout(() => setRevealed(i + 1), (PREROLL + i * NOTE_GAP) * 1000);
        revealTimersRef.current.push(timer);
      });
    } else {
      const timer = setTimeout(() => setRevealed(notes.length), PREROLL * 1000);
      revealTimersRef.current.push(timer);
    }
    return dur;
  }

  /* ---- Le clic sur une note ne doit pas retomber sur la portée ----
   *
   * Retirer une note se fait en la touchant : `pointerdown` la saisit,
   * `pointerup` constate qu'elle n'a pas bougé et la retire. Mais le
   * navigateur émet ENSUITE un `click` de synthèse, qui remonte de la note
   * jusqu'au SVG et arrive ici. Le geste faisait donc deux choses : retirer
   * la note, puis en poser une nouvelle à l'endroit du doigt.
   *
   * Et comme les deux gestionnaires lisent le MÊME `userNotes` — celui du
   * rendu en cours, aucun des deux ne voyant l'état posé par l'autre — le
   * second écrasait purement et simplement le premier : `[...userNotes, best]`
   * repart du tableau complet. Le retrait était annulé dans la même image.
   *
   * D'où l'impression que le toucher « ne retire pas ». Le retrait avait bien
   * lieu ; il durait quelques millisecondes.
   *
   * POURQUOI SEULEMENT SUR MOBILE — il n'y a en réalité rien de tactile
   * là-dedans, le même enchaînement se produit à la souris. Mais la seconde
   * branche est gardée par `canPlace()`, qui est FAUX dès que la portée est
   * pleine : sur une manche menée jusqu'au bout, le clic parasite ne pouvait
   * rien poser et le retrait tenait. Le défaut ne se voit donc qu'en cours de
   * pose — c'est-à-dire à 2/4, exactement le cas de la capture.
   *
   * Deux gardes plutôt qu'une, parce qu'elles ne couvrent pas le même cas :
   *
   *   — `stopPropagation` sur le `<g>` de la note arrête le clic à la source,
   *     tant que sa cible est bien la note ;
   *   — ce délai rattrape les cas où elle ne l'est pas. Avec la capture de
   *     pointeur, un doigt qui quitte la boîte de la note pendant le geste
   *     fait viser au clic l'élément situé DESSOUS, c'est-à-dire la portée,
   *     et le `<g>` ne le voit jamais passer.
   *
   * Le clic de synthèse suit son `pointerup` de quelques millisecondes.
   * Cent cinquante suffisent donc largement, et restent bien en deçà du délai
   * qu'il faut à un doigt pour se reposer ailleurs sur la portée. */
  async function onStaffClick(e) {
    if (Date.now() - finGesteNoteRef.current < 150) return;
    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
    if (!canPlace()) return;
    const best = posFromEvent(e);
    if (!best) return;
    await ensureAudio();
    synthRef.current?.triggerAttackRelease(best.name, '8n');
    const next = [...userNotes, best];
    setUserNotes(next);
    setStatus(statutNotes(next.length, target.length));
    if (next.length >= target.length) setHoverPos(null);
  }

  function removeNote(i) {
    if (locked) return;
    const next = userNotes.filter((_, idx) => idx !== i);
    setUserNotes(next);
    setStatus(statutNotes(next.length, target?.length ?? 0));
  }

  async function validate() {
    if (!target || userNotes.length !== target.length) return;
    setLocked(true);
    setEnSequence(true);
    setHoverPos(null);
    setRevealed(0);
    setStatus('Lecture de tes notes…');
    const d1 = await playNotes(userNotes, mode);
    setTimeout(async () => {
      /* ---- L'APPARIEMENT SUIT LE MODE ----
       *
       * Un accord se joue d'un bloc : ses notes n'ont pas d'ordre, et la
       * colonne où le joueur pose son Do n'a aucune importance. Un arpège se
       * joue note après note : c'est une mélodie, et l'ordre EST la moitié
       * de la réponse. Les deux ne peuvent donc pas être corrigés pareil.
       *
       * ACCORD — appariement libre. On sort d'abord toutes les hauteurs
       * identiques, quel que soit leur rang, puis on trie et on apparie le
       * reste. Sans cela, une seule note fausse posée hors du registre de la
       * cible décalait tout l'alignement : sur Do5-Mi5-Sol5 joué Fa4-Do5-Mi5,
       * plus aucun écart nul, donc zéro point pour deux notes justes.
       *
       * ARPÈGE — rang par rang. Chaque note est jugée à sa place, avec un
       * palier intermédiaire : une hauteur qui appartient bien à la cible
       * mais tombe au mauvais rang coûte un forfait de 2, et non l'écart
       * brut. Sans ce palier, un arpège joué à l'envers — toutes les notes
       * entendues, l'ordre inversé — tombait à zéro, ce qui est faux : ce
       * joueur-là a bien plus entendu que celui qui a tout raté.
       *
       * `p` retient DANS QUELLE COLONNE poser chaque note de la cible à la
       * correction. C'est ce qui garde la portée et le score d'accord : une
       * note verte est toujours coiffée par la note juste, une rouge toujours
       * décalée. Sans cette table, l'écran proposait des duels colonne par
       * colonne pendant que le calcul, lui, appariait librement — d'où des
       * notes vertes en face de hauteurs qui n'étaient pas les leurs. */
      let penalty = 0;
      /* 'juste' | 'ailleurs' | 'faux' — voir COULEUR_VERDICT. */
      const v = Array(userNotes.length).fill('faux');
      const p = Array(target.length).fill(-1);

      if (mode === 'arpège') {
        // Les rangs justes d'abord : ils consomment leur hauteur.
        const libres = target.map((n) => n.midi);
        target.forEach((t, k) => {
          if (userNotes[k]?.midi === t.midi) { v[k] = 'juste'; libres[k] = null; }
        });
        target.forEach((t, k) => {
          p[k] = k;                       // en arpège la colonne EST le rang
          if (v[k] === 'juste') return;
          const u = userNotes[k];
          if (!u) { penalty += PENALITE_MAX; return; }
          const j = libres.indexOf(u.midi);
          if (j !== -1) { libres[j] = null; v[k] = 'ailleurs'; penalty += 2; return; }
          penalty += ecart(Math.abs(u.midi - t.midi));
        });
      } else {
        const uRestant = userNotes.map((n, idx) => ({ midi: n.midi, idx }));
        const tRestant = target.map((n, k) => ({ midi: n.midi, k }));

        for (let i = uRestant.length - 1; i >= 0; i -= 1) {
          const j = tRestant.findIndex((t) => t.midi === uRestant[i].midi);
          if (j === -1) continue;
          v[uRestant[i].idx] = 'juste';
          p[tRestant[j].k] = uRestant[i].idx;
          tRestant.splice(j, 1);
          uRestant.splice(i, 1);
        }

        const uSorted = uRestant.sort((a, b) => a.midi - b.midi);
        const tSorted = tRestant.sort((a, b) => a.midi - b.midi);
        tSorted.forEach((t, i) => {
          const um = uSorted[i];
          if (um === undefined) { penalty += PENALITE_MAX; return; }
          p[t.k] = um.idx;
          const d = Math.abs(um.midi - t.midi);
          if (d === 0) { v[um.idx] = 'juste'; return; }
          penalty += ecart(d);
        });
      }

      const budget = target.length * PENALITE_MAX;
      const s = Math.max(0, 10 - Math.min(penalty, budget) * (10 / budget));
      setScore(s.toFixed(1));
      setPaires(p);

      if (daily && !dailyDoneRef.current) {
        dailyDoneRef.current = true;
        /* La cible part avec le score : la page l'archive et la rendra demain.
           Le lendemain la graine a changé, rien ne permettrait de la
           retrouver. */
        onDone(Math.round(s * 10) / 10, target.map((n) => n.name).join(' · '));
      }

      // La correction : les notes du joueur prennent leur couleur, puis la
      // cible se dévoile AU RYTHME DE SON PROPRE SON. En arpège chaque note
      // apparaît sur son attaque — c'est playTargetWithReveal qui aligne les
      // deux, sur le même PREROLL et le même NOTE_GAP que la lecture.
      setVerdicts(v);
      setStatus(phraseCorrection(
        v.filter((x) => x === 'juste').length,
        target.length,
        devoile,
        v.filter((x) => x === 'ailleurs').length,
      ));

      /* On rejoue la cible dans les deux cas — l'entendre une dernière fois
         n'apprend pas où elle se pose sur la portée, et couper le son ferait
         croire à une panne. Seule la RÉVÉLATION graphique est retenue. */
      await playTargetWithReveal(target, mode, devoile);

      // Le temps de lire la portée corrigée une fois la dernière note posée,
      // puis le voile sur la note finale.
      scoreTimerRef.current = setTimeout(() => {
        setResultat(s.toFixed(1));
        // Le voile se lève : bilan en bas, et seulement là les commandes
        // redeviennent actives.
        bilanTimerRef.current = setTimeout(() => {
          setBilan(true);
          setEnSequence(false);
          if (!daily) setLocked(false);
        }, RES_TOTAL);
      }, finRevelation(target, mode) * 1000 + RES_ATTENTE_CORRECTION);
    }, (d1 + 0.5) * 1000);
  }

  const canValidate = target && userNotes.length === target.length && !locked && !enSequence;
  const ghostX = P.noteX0 + userNotes.length * P.notePas;

  // Note creuse : le contour se trace en un tour puis reste complet
  const NoteCreuse = ({ cx, cy, couleur = 'var(--or-clair)' }) => (
    <g key={pulse} style={{ pointerEvents: 'none' }}>
      {/* Halo : passe large très faible, comme sur l'onde */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none"
        stroke={couleur} strokeWidth={5} opacity={0.1} strokeLinecap="round"
        strokeDasharray={PERIMETRE}
        style={{ animation: `traceContour ${DUREE_TRACE}ms cubic-bezier(0.4, 0, 0.2, 1) both` }} />
      {/* Contour net */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="none"
        stroke={couleur} strokeWidth={1.6} strokeLinecap="round"
        strokeDasharray={PERIMETRE}
        style={{ animation: `traceContour ${DUREE_TRACE}ms cubic-bezier(0.4, 0, 0.2, 1) both` }} />
    </g>
  );

  const boutons = [
    /* Un seul accord par manche, et un seul bouton pour lui : « Écouter »
       tant qu'il n'a pas sonné, « Réécouter » une fois qu'il est là. Les deux
       ne coexistent jamais — l'un désactivé à côté de l'autre ne ferait
       qu'encombrer la rangée.

       Même intitulé en libre et en quotidien. Le bouton GÉNÈRE bien un
       accord, mais ce que le joueur constate, c'est qu'il l'entend : nommer
       l'effet plutôt que le mécanisme, et une action garde le même nom d'un
       bout à l'autre du site. */
    ...(target
      ? [{
          label: 'Réécouter l\'accord',
          /* `devoile` en troisième argument : réécouter ne doit pas
             redonner la correction. Sans lui, le bouton rejouait la
             révélation graphique après coup et rendait le masquage du défi
             du jour parfaitement inutile. */
          onClick: () => (score !== null
            ? playTargetWithReveal(target, mode, devoile)
            : playNotes(target, mode)),
          disabled: enSequence,
        }]
      : [{
          label: 'Écouter l\'accord',
          onClick: () => newRound(daily ? seeded('accords') : undefined),
          primaire: true,
          disabled: !pianoPret || enSequence,
        }]),
    { label: 'Écouter mes notes', onClick: () => userNotes.length && playNotes(userNotes, mode), disabled: !userNotes.length || enSequence },

    /* Effacer et valider n'existent que TANT QUE LA MANCHE EST OUVERTE.

       Une fois la note donnée, elles n'ont plus d'objet : effacer reviendrait
       à défaire des notes déjà jugées, et comparer à rejuger les mêmes. Les
       laisser en place, l'une grise et l'autre dorée sous un bilan qui vient
       d'annoncer le résultat, donne deux actions qui contredisent ce que la
       page vient de dire.

       La suite du parcours est portée par le bilan lui-même, qui offre
       « Nouvel accord ». Les deux boutons d'écoute, eux, restent : réentendre
       l'accord et ses propres notes après coup, c'est là que se fait
       l'oreille.

       Retirés et non désactivés, comme ailleurs : un bouton grisé promet un
       retour, et ceux-là ne reviendront pas dans cette manche. */
    ...(score === null
      ? [
          { label: 'Effacer mes notes', onClick: () => { setUserNotes([]); setStatus(statutNotes(0, target?.length ?? 0)); }, disabled: !userNotes.length || locked || enSequence },
          { label: 'Comparer', onClick: validate, primaire: true, disabled: !canValidate },
        ]
      : []),
  ];

  return (
    <div className="acc-panneau" style={{ background: 'var(--onyx)', border: '0.5px solid var(--filet)', borderRadius: 'var(--rayon-carte)', padding: 'var(--e6)', marginBottom: 'var(--e4)', position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes notePop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes traceContour {
          from { stroke-dashoffset: ${PERIMETRE}; }
          to   { stroke-dashoffset: 0; }
        }

        /* --- Intro --- */
        @keyframes accVoile {
          0%   { opacity: 0; }
          9%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes accEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes accSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes accNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes accClic {
          /* 0 % doit rester invisible : c'est l'état que fill-mode "both"
             tient pendant tout le délai avant le déclenchement. Démarrer
             visible ici faisait apparaître un petit point orange fantôme
             dès le rendu du SVG, bien avant l'arrivée du curseur. */
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes accCurseur {${keyframesCurseur()}}
        @media (prefers-reduced-motion: reduce) {
          [data-acc-surcouche], [data-acc-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <h3 className="titre-section acc-titre" style={{ marginBottom: 'var(--e1)' }}>Retrouve l&apos;accord</h3>
      {/* ---- Consigne et barème sont deux choses ----
          Réunies dans un même paragraphe centré, elles produisaient un
          orphelin : « sur dix. » restait seul sur la seconde ligne. Le défaut
          n'était pas la longueur mais le mélange — une consigne se lit, un
          barème se constate.

          La consigne garde le corps de texte et tient sur une ligne jusqu'à
          470 px. `text-wrap: balance` la répartit sur deux lignes égales en
          dessous, au lieu de casser au dernier mot possible.

          Le barème passe en étiquette mono capitales, le rôle que le document
          de design réserve aux données. Il devient une ligne qu'on scanne, et
          non une phrase qu'on lit — ce qui est exactement son usage : on ne
          lit pas deux fois « noté sur 10 », on le vérifie d'un regard. En lin
          et non en or, parce que le bouton principal est juste en dessous et
          que deux surfaces dorées dans la même zone s'annulent. */}
      <p className="description acc-desc"
        style={{ maxWidth: 470, margin: '0 auto', textWrap: 'balance' }}>
        Écoute un accord de trois ou quatre notes, repose-le sur la portée.
      </p>
      <p className="acc-bareme" style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 400,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: 'var(--lin)', margin: 'var(--e2) auto var(--e4)',
      }}>
        Écart noté sur 10
      </p>

      <div className="acc-boutons" style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 'var(--e3)' }}>
        {boutons.map((b) => (
          <button key={b.label} onClick={b.onClick} disabled={b.disabled}
            onMouseEnter={b.primaire ? undefined : survolOr}
            onMouseLeave={b.primaire ? undefined : sortieOr}
            /* ---- L'état désactivé n'est pas l'état actif en plus pâle ----
               Un fond or à 40 % d'opacité sur du noir donne un brun terreux
               qui n'est dans aucun jeton de la palette, et qui pèse autant
               qu'un bouton plein : « Comparer » indisponible attirait l'œil
               plus que l'action réellement possible.

               Un bouton désactivé perd donc sa surface. Il garde sa place et
               son intitulé — c'est ce qui dit qu'il reviendra — mais passe en
               filet et en cendre, le jeton que le document de design réserve
               justement au texte désactivé.

               Corollaire : il ne peut plus y avoir deux surfaces or à
               l'écran, puisque les actions primaires ne sont jamais toutes
               disponibles en même temps. La règle de l'accent unique tient
               d'elle-même. */
            style={{
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
              padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
              cursor: b.disabled ? 'not-allowed' : 'pointer',
              background: b.disabled ? 'transparent' : b.primaire ? 'var(--or)' : 'transparent',
              color: b.disabled ? 'var(--cendre)' : b.primaire ? 'var(--noir)' : 'var(--ivoire)',
              border: b.disabled
                ? '0.5px solid var(--filet)'
                : b.primaire ? '1px solid var(--or)' : '0.5px solid var(--filet-fort)',
              transition: 'background var(--transition-courte), border-color var(--transition-courte), color var(--transition-courte)',
            }}>
            {b.label}
          </button>
        ))}
      </div>

      <p className="acc-statut" style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--lin)', minHeight: '1.5em' }}>{status}</p>

      <svg
        ref={svgRef}
        onClick={onStaffClick}
        onMouseMove={onStaffMove}
        onMouseLeave={onStaffLeave}
        onMouseUp={endDrag}
        onPointerUp={endDrag}
        viewBox={`0 ${P.minY} ${P.W} ${P.H}`}
        width="100%"
        className="acc-portee"
        style={{ maxWidth: P.W, display: 'block', margin: 'var(--e2) auto 0', cursor: dragIndex !== null ? 'grabbing' : 'crosshair', userSelect: 'none' }}
      >
        {LINES_Y.map(y => (
          <line key={y} x1={P.x1} y1={y} x2={P.x2} y2={y} stroke="var(--filet-fort)" strokeWidth={1} />
        ))}
        <text x={P.cleX} y={P.cleY} fontSize={P.cleTaille} fill="var(--lin)">𝄞</text>

        {/* Note survolée : creuse, contour tracé en phase avec le son */}
        {hoverPos && canPlace() && dragIndex === null && (
          <g style={{ pointerEvents: 'none' }}>
            {hoverPos.ledger && (
              <line x1={ghostX - 16} y1={hoverPos.y} x2={ghostX + 16} y2={hoverPos.y}
                stroke="var(--filet-fort)" strokeWidth={1} opacity={0.5} />
            )}
            <NoteCreuse cx={ghostX} cy={hoverPos.y} />
            <text x={ghostX} y={200} textAnchor="middle" fontSize={12} fill="var(--or)"
              opacity={0.6} fontFamily="var(--mono)">{hoverPos.name}</text>
          </g>
        )}

        {/* Notes posées : pleines. En cours de glissement : creuses, retracées à chaque ligne */}
        {userNotes.map((n, i) => (
          /* ÉVÉNEMENTS DE POINTEUR, et non de souris.

             mousedown / mousemove n'existent pas sous un doigt : la note
             était donc impossible à déplacer sur mobile, alors que la
             consigne du jeu dit « ajuste-les en les glissant ». Les
             événements de pointeur couvrent les deux, souris comprise.

             setPointerCapture redirige la suite du geste vers CETTE note,
             même si le doigt sort de sa boîte de 44 par 32 — ce qui arrive
             au premier interligne franchi. Sans capture, le glisser
             s'interrompt dès le premier pixel utile.

             touchAction none sur la note seule : le navigateur cesse d'y
             interpréter le mouvement vertical comme un défilement de page.
             Limité à la note, le reste de la portée continue de défiler
             normalement. */
          <g
            key={i}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              startDrag(e, i);
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={onStaffMove}
            onPointerUp={endDrag}
            /* Le clic de synthèse émis après le pointerup s'arrête ici : sans
               cela il remonte jusqu'au SVG, où onStaffClick pose une note à
               l'endroit même de celle qu'on vient de retirer. */
            onClick={(e) => e.stopPropagation()}
            /* iOS interrompt un geste pour ses propres raisons — un appel,
               un balayage depuis le bord. Sans cette ligne, la note restait
               accrochée au doigt jusqu'au prochain toucher. */
            onPointerCancel={endDrag}
          >
            {n.ledger && (
              <line x1={P.noteX0 + i * P.notePas - 16} y1={n.y} x2={P.noteX0 + i * P.notePas + 16} y2={n.y} stroke="var(--filet-fort)" strokeWidth={1} />
            )}
            {dragIndex === i ? (
              <NoteCreuse cx={P.noteX0 + i * P.notePas} cy={n.y} couleur="var(--ivoire)" />
            ) : (
              <ellipse cx={P.noteX0 + i * P.notePas} cy={n.y} rx={11} ry={8}
                fill={verdicts === null ? 'var(--or)' : COULEUR_VERDICT[verdicts[i]]}
                style={{ cursor: locked ? 'default' : 'grab' }} />
            )}
            <rect x={P.noteX0 + i * P.notePas - 22} y={n.y - 16} width={44} height={32} fill="transparent"
              style={{ cursor: locked ? 'default' : 'grab' }} />
            <text x={P.noteX0 + i * P.notePas} y={200} textAnchor="middle" fontSize={12}
              fill={verdicts === null ? 'var(--lin)' : COULEUR_VERDICT[verdicts[i]]}
              fontFamily="var(--mono)">
              {n.name}
            </text>
          </g>
        ))}

        {target && target.slice(0, revealed).map((n, i) => {
          /* ---- Deux façons de montrer la correction ----
             Sur ordinateur, la note juste se pose À CÔTÉ de celle du joueur,
             décalée de 26 unités sur un pas de 110 : on lit la paire d'un
             regard, et l'écart vertical entre les deux dit l'erreur.

             Sur mobile, ce décalage n'a pas de place. Deux têtes de 24
             unités de large ne se séparent pas dans 14, elles se fondent en
             une tache ; et à 26 la correction empiétait sur la colonne
             suivante ou sortait du cadre. Réduire encore les notes ne ferait
             que rendre les deux illisibles au lieu d'une seule.

             La correction passe donc DANS LA MÊME COLONNE, en note creuse.
             Le plein est ce qu'on a joué, le contour est où il fallait
             jouer. Juste, l'anneau coiffe la note ; faux, on voit l'écart
             vertical dans une seule colonne — c'est-à-dire l'intervalle
             manqué, exactement ce que la disposition côte à côte donnait à
             lire, sans avoir besoin du double de largeur. */
          /* La colonne vient de l'appariement, pas du rang : c'est ce qui
             fait que l'anneau coiffe toujours une note verte. */
          const colonne = paires?.[i] ?? i;
          const x = P.noteX0 + (colonne < 0 ? i : colonne) * P.notePas + P.decalage;
          return (
            <g key={'t' + i} style={{ pointerEvents: 'none' }}>
              {n.ledger && (
                <line x1={x - 16} y1={n.y} x2={x + 16} y2={n.y} stroke="var(--filet-fort)" strokeWidth={1} />
              )}
              {etroit ? (
                <NoteContour cx={x} cy={n.y} couleur="var(--jade)" />
              ) : (
                <ellipse cx={x} cy={n.y} rx={11} ry={8} fill="var(--jade)"
                  style={{ animation: 'notePop 0.35s ease-out', transformOrigin: `${x}px ${n.y}px` }} />
              )}
              <text x={x} y={52} textAnchor="middle" fontSize={12} fill="var(--jade)" fontFamily="var(--mono)">
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Sélecteur de mode d'écoute */}
      {/* Bornée puis centrée : à pleine largeur, deux cartes de 350 px se
         lisent comme deux panneaux et non comme un choix. */}
      <div className="acc-modes" style={{
        display: 'flex', gap: 'var(--e2)', marginTop: 'var(--e4)', flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto',
      }}>
        {[
          { on: true, titre: 'Chercher à l\u2019oreille', desc: 'chaque note sonne au passage du curseur' },
          { on: false, titre: 'Poser directement', desc: 'la note sonne quand tu la places' },
        ].map((m) => (
          <button key={m.titre} onClick={() => setHoverSound(m.on)}
            style={{
              flex: '1 1 200px', padding: 'var(--e3) var(--e4)', borderRadius: 'var(--rayon-controle)',
              cursor: 'pointer', textAlign: 'left',
              border: hoverSound === m.on ? '1px solid var(--or)' : '0.5px solid var(--filet)',
              background: hoverSound === m.on ? 'var(--onyx-haut)' : 'transparent',
              color: 'var(--ivoire)',
              transition: 'border-color var(--transition-courte), background var(--transition-courte)',
            }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{m.titre}</div>
            <div className="description" style={{ marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {score !== null && bilan && (
        <div className="acc-bilan" style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'accEntree 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: +score >= 9.5 ? 'var(--jade)' : +score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {(+score).toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          {devoile ? (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              L&apos;accord : <span style={{ color: 'var(--jade)' }}>{target?.map(n => n.name).join(' · ')}</span>
              {' — '}Toi : <span style={{ color: 'var(--or)' }}>{userNotes.map(n => n.name).join(' · ')}</span>
            </p>
          ) : (
            /* Les notes du joueur restent affichées : elles sont les siennes,
               les taire ne protégerait rien et le priverait de son geste. */
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              Toi : <span style={{ color: 'var(--or)' }}>{userNotes.map(n => n.name).join(' · ')}</span>
              {' — '}accord donné demain, avec le prochain défi.
            </p>
          )}

          {/* Une seule tentative en quotidien : pas de relance là-bas. */}
          {!daily && (
            <button
              onClick={() => newRound()}
              disabled={!pianoPret}
              style={{
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
                marginTop: 'var(--e4)',
                cursor: pianoPret ? 'pointer' : 'not-allowed',
                background: 'var(--or)',
                color: 'var(--noir)',
                border: '1px solid var(--or)',
                opacity: pianoPret ? 1 : 0.4,
                transition: 'background var(--transition-courte)',
              }}
            >
              Nouvel accord
            </button>
          )}
        </div>
      )}

      {/* ---- Surcouches : placées en dernier pour passer au-dessus de tout ---- */}
      {intro && <SurcoucheIntro onNote={jouerNoteIntro} onPasser={passerIntro} />}
      {resultat !== null && <SurcoucheResultat score={resultat} />}
    </div>
  );
}
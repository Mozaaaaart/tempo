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

function SurcoucheIntro({ onNote }) {
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
      style={{
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
      aria-hidden="true"
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

export default function JeuAccordsGame({ daily = false, onDone = () => {} }) {
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('accord');
  const [userNotes, setUserNotes] = useState([]);
  const [locked, setLocked] = useState(false);
  const [pianoPret, setPianoPret] = useState(false);
  const [status, setStatus] = useState('Chargement du piano…');
  const [score, setScore] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  // Mode silencieux par défaut : le survol ne joue rien tant que le
  // joueur n'a pas activé le mode découverte lui-même.
  const [hoverSound, setHoverSound] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
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
  const lastHoverRef = useRef(null);
  const revealTimersRef = useRef([]);
  const dragMovedRef = useRef(false);
  const dragIndexRef = useRef(null);
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
          setStatus(daily
            ? 'Clique sur « Écouter la cible » pour lancer l\'épreuve du jour.'
            : 'Lance une cible pour commencer.');
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
     sur « Générer une cible » ou sur la portée. L'intro, elle, démarre au
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
    setDragIndex(null);
    if (!moved) removeNote(i);
    else setStatus(`Note déplacée : ${userNotes[i]?.name ?? ''}`);
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
    setScore(null); setVerdicts(null); setLocked(false); setHoverPos(null);
    setBilan(false); setResultat(null); setEnSequence(false);
    lastHoverRef.current = null;
    setStatus(`${m === 'accord' ? 'Accord' : 'Arpège'} · ${n} notes à placer. Glisse une note pour l'ajuster, clique-la pour la retirer.`);
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

  async function playTargetWithReveal(notes, m) {
    setRevealed(0);
    const dur = await playNotes(notes, m);
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

  async function onStaffClick(e) {
    if (dragMovedRef.current) { dragMovedRef.current = false; return; }
    if (!canPlace()) return;
    const best = posFromEvent(e);
    if (!best) return;
    await ensureAudio();
    synthRef.current?.triggerAttackRelease(best.name, '8n');
    const next = [...userNotes, best];
    setUserNotes(next);
    setStatus(`${next.length}/${target.length} note(s) posée(s)`);
    if (next.length >= target.length) setHoverPos(null);
  }

  function removeNote(i) {
    if (locked) return;
    const next = userNotes.filter((_, idx) => idx !== i);
    setUserNotes(next);
    setStatus(`${next.length}/${target?.length ?? 0} note(s) posée(s)`);
  }

  async function validate() {
    if (!target || userNotes.length !== target.length) return;
    setLocked(true);
    setEnSequence(true);
    setHoverPos(null);
    setRevealed(0);
    setStatus('Lecture : ta version…');
    const d1 = await playNotes(userNotes, mode);
    setTimeout(async () => {
      const uSorted = userNotes.map((n, idx) => ({ midi: n.midi, idx })).sort((a, b) => a.midi - b.midi);
      const tSorted = [...target.map(n => n.midi)].sort((a, b) => a - b);
      let penalty = 0;
      const v = Array(userNotes.length).fill(false);
      tSorted.forEach((tm, i) => {
        const um = uSorted[i];
        if (um === undefined) { penalty += 4; return; }
        const d = Math.abs(um.midi - tm);
        if (d === 0) { v[um.idx] = true; return; }
        if (d % 12 === 0) penalty += 1.5;
        else penalty += Math.min(d % 12, 12 - d % 12) + (d >= 12 ? 1 : 0);
      });
      const s = Math.max(0, 10 - Math.min(penalty, target.length * 4) * (10 / (target.length * 4)));
      setScore(s.toFixed(1));

      if (daily && !dailyDoneRef.current) {
        dailyDoneRef.current = true;
        onDone(Math.round(s * 10) / 10);
      }

      // La correction : les notes du joueur prennent leur couleur, puis la
      // cible se dévoile AU RYTHME DE SON PROPRE SON. En arpège chaque note
      // apparaît sur son attaque — c'est playTargetWithReveal qui aligne les
      // deux, sur le même PREROLL et le même NOTE_GAP que la lecture.
      setVerdicts(v);
      setStatus(daily
        ? 'Épreuve terminée. Une seule tentative dans le défi du jour.'
        : 'Tes notes justes en vert, tes erreurs en rouge — la cible se dévoile note à note.');

      await playTargetWithReveal(target, mode);

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
  const ghostX = 170 + userNotes.length * 110;

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
    // Une seule cible par manche, et un seul bouton pour elle : « Générer »
    // tant qu'elle n'existe pas, « Réécouter » une fois qu'elle est là. Les
    // deux ne coexistent jamais — l'un désactivé à côté de l'autre ne
    // ferait qu'encombrer la rangée.
    ...(target
      ? [{
          label: 'Réécouter la cible',
          onClick: () => (score !== null ? playTargetWithReveal(target, mode) : playNotes(target, mode)),
          disabled: enSequence,
        }]
      : [{
          label: daily ? 'Écouter la cible' : 'Générer une cible',
          onClick: () => newRound(daily ? seeded('accords') : undefined),
          primaire: true,
          disabled: !pianoPret || enSequence,
        }]),
    { label: 'Écouter ma proposition', onClick: () => userNotes.length && playNotes(userNotes, mode), disabled: !userNotes.length || enSequence },
    { label: 'Effacer les notes', onClick: () => { setUserNotes([]); setStatus('Notes effacées.'); }, disabled: !userNotes.length || locked || enSequence },
    { label: 'Valider', onClick: validate, primaire: true, disabled: !canValidate },
  ];

  return (
    <div style={{ background: 'var(--onyx)', border: '0.5px solid var(--filet)', borderRadius: 'var(--rayon-carte)', padding: 'var(--e6)', marginBottom: 'var(--e4)', position: 'relative' }}>
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

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Retrouve l'accord</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Écoute la cible, pose tes notes sur la portée, ajuste-les en les glissant, puis valide.
      </p>

      <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', marginBottom: 'var(--e3)' }}>
        {boutons.map((b) => (
          <button key={b.label} onClick={b.onClick} disabled={b.disabled}
            onMouseEnter={b.primaire ? undefined : survolOr}
            onMouseLeave={b.primaire ? undefined : sortieOr}
            style={{
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
              padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
              cursor: b.disabled ? 'not-allowed' : 'pointer',
              background: b.primaire ? 'var(--or)' : 'transparent',
              color: b.primaire ? 'var(--noir)' : 'var(--ivoire)',
              border: b.primaire ? '1px solid var(--or)' : '0.5px solid var(--filet-fort)',
              opacity: b.disabled ? 0.4 : 1,
              transition: 'background var(--transition-courte), border-color var(--transition-courte)',
            }}>
            {b.label}
          </button>
        ))}
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--lin)', minHeight: '1.5em' }}>{status}</p>

      <svg
        ref={svgRef}
        onClick={onStaffClick}
        onMouseMove={onStaffMove}
        onMouseLeave={onStaffLeave}
        onMouseUp={endDrag}
        viewBox="0 0 700 215"
        width="100%"
        style={{ maxWidth: 700, display: 'block', cursor: dragIndex !== null ? 'grabbing' : 'crosshair', marginTop: 'var(--e2)', userSelect: 'none' }}
      >
        {LINES_Y.map(y => (
          <line key={y} x1={20} y1={y} x2={680} y2={y} stroke="var(--filet-fort)" strokeWidth={1} />
        ))}
        <text x={30} y={148} fontSize={90} fill="var(--lin)">𝄞</text>

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
          <g key={i} onMouseDown={(e) => startDrag(e, i)}>
            {n.ledger && (
              <line x1={170 + i * 110 - 16} y1={n.y} x2={170 + i * 110 + 16} y2={n.y} stroke="var(--filet-fort)" strokeWidth={1} />
            )}
            {dragIndex === i ? (
              <NoteCreuse cx={170 + i * 110} cy={n.y} couleur="var(--ivoire)" />
            ) : (
              <ellipse cx={170 + i * 110} cy={n.y} rx={11} ry={8}
                fill={verdicts === null ? 'var(--or)' : verdicts[i] ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)'}
                style={{ cursor: locked ? 'default' : 'grab' }} />
            )}
            <rect x={170 + i * 110 - 22} y={n.y - 16} width={44} height={32} fill="transparent"
              style={{ cursor: locked ? 'default' : 'grab' }} />
            <text x={170 + i * 110} y={200} textAnchor="middle" fontSize={12}
              fill={verdicts === null ? 'var(--lin)' : verdicts[i] ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)'}
              fontFamily="var(--mono)">
              {n.name}
            </text>
          </g>
        ))}

        {target && target.slice(0, revealed).map((n, i) => {
          const x = 170 + i * 110 + 26;
          return (
            <g key={'t' + i} style={{ pointerEvents: 'none' }}>
              {n.ledger && (
                <line x1={x - 16} y1={n.y} x2={x + 16} y2={n.y} stroke="var(--filet-fort)" strokeWidth={1} />
              )}
              <ellipse cx={x} cy={n.y} rx={11} ry={8} fill="var(--jade)"
                style={{ animation: 'notePop 0.35s ease-out', transformOrigin: `${x}px ${n.y}px` }} />
              <text x={x} y={52} textAnchor="middle" fontSize={12} fill="var(--jade)" fontFamily="var(--mono)">
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Sélecteur de mode d'écoute */}
      <div style={{ display: 'flex', gap: 'var(--e2)', marginTop: 'var(--e4)', flexWrap: 'wrap' }}>
        {[
          { on: true, titre: 'Mode découverte', desc: 'les notes sonnent au survol' },
          { on: false, titre: 'Mode silencieux', desc: 'les notes sonnent seulement au clic' },
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
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'accEntree 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: +score >= 9.5 ? 'var(--jade)' : +score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {(+score).toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            Cible : <span style={{ color: 'var(--jade)' }}>{target?.map(n => n.name).join(' · ')}</span>
            {' — '}Toi : <span style={{ color: 'var(--or)' }}>{userNotes.map(n => n.name).join(' · ')}</span>
          </p>

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
      {intro && <SurcoucheIntro onNote={jouerNoteIntro} />}
      {resultat !== null && <SurcoucheResultat score={resultat} />}
    </div>
  );
}
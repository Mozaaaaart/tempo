'use client';
import { useEffect, useRef, useState } from 'react';
import { panel, seeded } from '@/components/dailyGames';

/** Mode libre : survie. Trois vies, le niveau monte tant qu'on tient. */
const VIES = 3;

/* ------------------------------------------------------------
   CHRONOLOGIE DE LA SURCOUCHE
   Mêmes valeurs que l'épreuve Duel : les deux jeux de survie
   partagent volontairement la même grammaire d'animation, un
   joueur qui passe de l'un à l'autre reconnaît le vocabulaire.
------------------------------------------------------------ */

/* Temps de pose entre l'arrivée du voile et le début du contenu. Toutes les
   autres temporisations s'y ajoutent : une seule valeur à toucher pour
   décaler l'ensemble. */
const DELAI_ENTREE = 500;

/* Perte ordinaire. Une réussite n'ouvre aucun voile : la série continue. */
const DUREE_PERTE = DELAI_ENTREE + 1900;

/* Dernière vie : la perte se joue d'abord en entier — il faut voir la
   pastille s'éteindre comme les fois précédentes — puis un second acte
   remplace le décompte par le verdict. */
const SORTIE_ACTE_PERTE = DELAI_ENTREE + 1900; // le décompte s'efface
const ENTREE_DEFAITE = DELAI_ENTREE + 2200;    // la croix se trace
const DUREE_DEFAITE = DELAI_ENTREE + 4000;     // durée totale du voile

/* Ouverture de run, jouée à l'envers de la défaite : le titre pose le cadre,
   les vies se comptent une par une, puis le vœu remplace le tout. */
const INTRO_TITRE = DELAI_ENTREE;
const INTRO_VIES = DELAI_ENTREE + 480;
const INTRO_PAS_VIE = 200;
const INTRO_LEGENDE = INTRO_VIES + (VIES - 1) * INTRO_PAS_VIE + 300;
const SORTIE_ACTE_INTRO = DELAI_ENTREE + 1900;
const INTRO_VOEU = DELAI_ENTREE + 2200;
const DUREE_INTRO = DELAI_ENTREE + 3600;

const DAILY_ROUNDS = 3;
const DAILY_LEVELS = [2, 3, 5]; // 3 patterns du jour : grilles 8, 10 puis 12 cases

// La grille s'agrandit avec le niveau → rythmes de plus en plus variés
const STEPS_BY_LEVEL = [8, 8, 10, 10, 12, 12, 16];

function levelConfig(level) {
  const steps = STEPS_BY_LEVEL[Math.min(level - 1, STEPS_BY_LEVEL.length - 1)];
  return {
    bpm: Math.min(80 + (level - 1) * 6, 150),
    steps,
    hits: Math.min(3 + Math.ceil(level / 2), Math.floor(steps * 0.6)),
  };
}

// Durée d'une mesure : la grille est en croches, donc steps/2 temps
const barOf = (cfg) => (60 / cfg.bpm) * (cfg.steps / 2);

// Jugements : jade réservé au parfait, carmin atténué à l'échec
const JUDGMENTS = [
  { max: 0.05, label: 'parfait', color: 'var(--jade)', pts: 1 },
  { max: 0.12, label: 'bien', color: 'var(--or-clair)', pts: 0.7 },
  { max: 0.2, label: 'limite', color: 'var(--or)', pts: 0.4 },
  { max: Infinity, label: 'hors temps', color: 'rgba(226, 75, 74, 0.75)', pts: 0 },
];

/* ============================================================
   PASTILLES DE VIE
   `perdue` = index de la pastille en train de s'éteindre. En mode
   `echelonne` chacune porte sa propre entrée décalée : animer aussi le
   conteneur ferait monter le groupe entier par-dessus et les arrivées
   individuelles se perdraient dans le mouvement d'ensemble.
============================================================ */

function Pastilles({ restantes, perdue = null, taille = 18, delai = 0, echelonne = false }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--e3)',
        justifyContent: 'center',
        animation: echelonne ? undefined : `duelTexteEntree 320ms ${delai}ms ease-out both`,
      }}
    >
      {Array.from({ length: VIES }, (_, i) => {
        const pleine = i < restantes;
        const seteint = i === perdue;
        return (
          <span
            key={i}
            style={{
              width: taille,
              height: taille,
              borderRadius: '50%',
              boxSizing: 'border-box',
              border: '1.5px solid',
              borderColor: pleine ? 'var(--ivoire)' : 'var(--filet-fort)',
              backgroundColor: pleine ? 'var(--ivoire)' : 'transparent',
              // L'extinction attend que les pastilles soient posées : le
              // remplissage `both` maintient d'ici là l'état du keyframe 0 %,
              // soit une pastille pleine — la vie est bien visible avant de
              // disparaître.
              animation: seteint
                ? `duelPointPerdu 760ms ${delai + 400}ms ease-out both`
                : echelonne
                ? `duelPointArrivee 360ms ${delai + i * INTRO_PAS_VIE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   SURCOUCHE
   Voile posé sur le panneau plutôt qu'une bannière insérée au-dessus : la
   grille rythmique ne se décale pas et le regard reste au centre.
   Le voile s'ouvre et se referme dans la même animation, calée sur la durée
   passée en prop — pas d'état de sortie à gérer côté React.
============================================================ */

function Surcouche({ annonce }) {
  const restantes = annonce.restantes ?? 0;
  const finale = Boolean(annonce.finale);
  const intro = annonce.type === 'intro';

  return (
    <div
      data-duel-surcouche
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
        animation: `duelVoile ${annonce.duree}ms ease-out both`,
      }}
      aria-live="polite"
    >
      {intro ? (
        <>
          {/* ---- Acte I : le cadre ----
              Les pastilles arrivent une par une : compter trois vies est
              plus parlant que les voir apparaître d'un bloc. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e5)',
              animation: `duelActeSortie 300ms ${SORTIE_ACTE_INTRO}ms ease-in both`,
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--or)',
              animation: `duelTexteEntree 340ms ${INTRO_TITRE}ms ease-out both`,
            }}>
              Mode survie
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e4)',
            }}>
              <Pastilles restantes={VIES} taille={20} delai={INTRO_VIES} echelonne />

              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '0.02em',
                // Ivoire plutôt que cendre : la légende nomme les pastilles
                // juste au-dessus, elle doit peser autant qu'elles.
                color: 'var(--ivoire)',
                animation: `duelTexteEntree 320ms ${INTRO_LEGENDE}ms ease-out both`,
              }}>
                {VIES} vies
              </div>
            </div>
          </div>

          {/* ---- Acte II : le vœu ---- */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 40,
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--or)',
              animation: `duelVoeu 480ms ${INTRO_VOEU}ms cubic-bezier(0.34, 1.3, 0.64, 1) both`,
            }}>
              Bonne chance
            </span>
          </div>
        </>
      ) : (
        <>
          {/* ---- Acte I : le décompte ----
              Sur la dernière vie, tout le bloc s'efface d'un coup pour
              laisser la place au verdict. Un seul wrapper animé plutôt que
              trois sorties à synchroniser. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e4)',
              animation: finale
                ? `duelActeSortie 300ms ${SORTIE_ACTE_PERTE}ms ease-in both`
                : undefined,
            }}
          >
            <Pastilles restantes={restantes} perdue={restantes} taille={20} delai={DELAI_ENTREE} />

            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 34,
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--carmin)',
              animation: `duelTexteEntree 320ms ${DELAI_ENTREE + 1000}ms ease-out both`,
            }}>
              − 1 vie
            </div>

            <div
              className="etiquette-mono"
              style={{
                color: 'var(--cendre)',
                animation: `duelTexteEntree 320ms ${DELAI_ENTREE + 1180}ms ease-out both`,
              }}
            >
              {restantes === 0
                ? 'plus de vies'
                : `${restantes} vie${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`}
            </div>
          </div>

          {/* ---- Acte II : le verdict ----
              Monté dès le départ mais tenu invisible par le `both` de son
              animation retardée : la croix se trace au trait, sans à-coup de
              mise en page puisque rien n'apparaît dans le flux. */}
          {finale && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--e4)',
              pointerEvents: 'none',
            }}>
              <svg
                width="52" height="52" viewBox="0 0 52 52" fill="none"
                stroke="var(--carmin)" strokeWidth="5" strokeLinecap="round"
                aria-hidden="true"
                style={{ animation: `duelCroixCorps 380ms ${ENTREE_DEFAITE}ms cubic-bezier(0.34, 1.3, 0.64, 1) both` }}
              >
                <line x1="13" y1="13" x2="39" y2="39" pathLength="1"
                  style={{ strokeDasharray: 1, animation: `duelCroixTrait 240ms ${ENTREE_DEFAITE + 40}ms ease-out both` }} />
                <line x1="39" y1="13" x2="13" y2="39" pathLength="1"
                  style={{ strokeDasharray: 1, animation: `duelCroixTrait 240ms ${ENTREE_DEFAITE + 220}ms ease-out both` }} />
              </svg>

              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 42,
                fontWeight: 500,
                lineHeight: 1,
                color: 'var(--carmin)',
                animation: `duelTexteEntree 320ms ${ENTREE_DEFAITE + 380}ms ease-out both`,
              }}>
                Perdu
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   ZONE DE FRAPPE
   La difficulté d'apprentissage de cette épreuve n'est pas le rythme, c'est
   de comprendre QUAND et OÙ taper. Trois choses s'en chargent, redondantes
   à dessein — un joueur qui n'en lit qu'une doit déjà s'en sortir :
   la couleur (cendre → or → jade), l'icône (inerte → ondes → ondes vives)
   et une phrase à l'impératif qui dit exactement quoi faire maintenant.
============================================================ */

const ETATS_ZONE = {
  listen: {
    bordure: 'var(--filet)', accent: 'var(--cendre)', titre: 'var(--lin)',
    intitule: 'Écoute la mesure', aide: 'ne tape pas encore',
  },
  ready: {
    bordure: 'var(--or-clair)', accent: 'var(--or-clair)', titre: 'var(--or-clair)',
    intitule: 'Prépare-toi à frapper ici', aide: 'attends que la zone passe au vert',
  },
  play: {
    bordure: 'var(--jade)', accent: 'var(--jade)', titre: 'var(--jade)',
    intitule: 'Frappe le rythme ici', aide: 'au doigt ou avec la barre d\'espace',
  },
  repos: {
    bordure: 'var(--filet)', accent: 'var(--cendre)', titre: 'var(--lin)',
    intitule: 'C\'est ici que tu frapperas le rythme', aide: 'au doigt ou avec la barre d\'espace',
  },
};

/* Cible concentrique : un point de contact et deux ondes qui s'en échappent.
   Le glyphe se lit sans légende — c'est le symbole universel du « tape ici ».
   Les ondes ne tournent qu'en préparation et en jeu : au repos elles restent
   figées, sinon la zone appellerait la frappe alors que rien ne l'attend. */
function CibleFrappe({ couleur, anime }) {
  const onde = (delai) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: anime ? `ondeFrappe 1700ms ${delai}ms ease-out infinite` : 'none',
    opacity: anime ? 0 : 0.28,
  });

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="12" stroke={couleur} strokeWidth="1.5" style={onde(850)} />
      <circle cx="22" cy="22" r="12" stroke={couleur} strokeWidth="1.5" style={onde(0)} />
      <circle cx="22" cy="22" r="5.5" fill={couleur} />
    </svg>
  );
}

function ZoneFrappe({ phase, running, impulsion, onTap }) {
  const etat = ETATS_ZONE[phase] ?? ETATS_ZONE.repos;
  const enJeu = phase === 'play';
  const enAttente = phase === 'ready';

  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onTap(); }}
      role={running ? 'button' : undefined}
      aria-label={running ? etat.intitule : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--e3)',
        border: `${enJeu ? '1px' : '0.5px'} solid ${etat.bordure}`,
        background: enJeu ? 'var(--onyx-haut)' : 'transparent',
        boxShadow: enJeu ? '0 0 26px rgba(93, 202, 165, 0.2)' : 'none',
        borderRadius: 'var(--rayon-carte)',
        padding: 'var(--e6)',
        textAlign: 'center',
        cursor: running ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'manipulation',
        marginTop: 'var(--e4)',
        animation: enAttente ? 'pulseAttente 900ms ease-in-out infinite' : 'none',
        transition: 'border-color var(--transition-courte), background var(--transition-courte), box-shadow var(--transition-courte)',
      }}
    >
      <CibleFrappe couleur={etat.accent} anime={enJeu || enAttente} />

      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 17,
        fontWeight: 500,
        lineHeight: 1.2,
        color: etat.titre,
        transition: 'color var(--transition-courte)',
      }}>
        {etat.intitule}
      </div>

      <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
        {etat.aide}
      </div>

      {/* Onde d'impact : la `key` change à chaque frappe, ce qui remonte le
          nœud et rejoue l'animation. Sans ça une frappe rapprochée de la
          précédente ne produirait aucun retour visuel. */}
      {impulsion > 0 && (
        <span
          key={impulsion}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            borderRadius: '50%',
            border: `1px solid ${etat.accent}`,
            pointerEvents: 'none',
            animation: 'impactFrappe 460ms ease-out both',
          }}
        />
      )}
    </div>
  );
}

export default function JeuRythmeGame({ daily = false, onDone = () => {} }) {
  const [phase, setPhase] = useState('idle');
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(VIES);
  const [bestLevel, setBestLevel] = useState(1);
  const [pattern, setPattern] = useState(null);
  const [patternVisible, setPatternVisible] = useState(true);
  const [cursor, setCursor] = useState(-1);
  const [stepFlash, setStepFlash] = useState({});
  const [floatingJudgment, setFloatingJudgment] = useState(null);
  // Compteur de frappes : sert uniquement de `key` à l'onde d'impact, pour
  // la faire rejouer même sur deux frappes très rapprochées.
  const [impulsion, setImpulsion] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const [dailyRound, setDailyRound] = useState(0);
  const [annonce, setAnnonce] = useState(null); // { type, restantes, finale, duree }
  const [status, setStatus] = useState(daily
    ? 'Trois patterns, un seul essai chacun. Ton score est la moyenne.'
    : 'Le niveau monte tant que tu tiens. Trois vies.');

  const toneRef = useRef(null);
  const clickRef = useRef(null);
  const clapRef = useRef(null);
  const patternRef = useRef(null);
  const phaseRef = useRef('idle');
  const configRef = useRef(levelConfig(1));
  const cycleStartRef = useRef(0);
  const matchedRef = useRef([]);
  const tapsPtsRef = useRef([]);
  const extrasRef = useRef(0);
  const timersRef = useRef([]);
  const rafRef = useRef(null);
  const livesRef = useRef(VIES);
  const levelRef = useRef(1);
  const dailyRngRef = useRef(null);
  const dailyRoundRef = useRef(0);
  const dailyScoresRef = useRef([]);
  const dailyDoneRef = useRef(false);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
      clickRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.005, octaves: 3,
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
      }).toDestination();
      clickRef.current.volume.value = -14;
      clapRef.current = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      clapRef.current.volume.value = 0;
    });

    function onKey(e) {
      // Ne pas capturer l'espace quand l'utilisateur saisit du texte ailleurs :
      // les dix épreuves sont montées simultanément dans le carrousel.
      const c = e.target;
      if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA' || c.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); tap(); }
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      stopAll();
      // Les sons déjà programmés dans Tone survivent aux timers JS :
      // disposer les synthés coupe le métronome resté en attente.
      try { clickRef.current?.dispose(); clapRef.current?.dispose(); } catch {}
    };
  }, []);

  // Intro jouée au montage, comme dans l'épreuve Duel : le composant est
  // remonté aussi bien par le clic sur l'onglet Rythme que par « Relancer
  // l'épreuve », les deux entrées passent donc par ici. Purement visuelle,
  // elle n'a besoin d'aucun geste utilisateur — l'audio, lui, attend
  // toujours le bouton de lancement.
  //
  // Coupée en mode quotidien : pas de vies à annoncer là-bas, et le format
  // court supporte mal quatre secondes de cérémonie.
  useEffect(() => {
    if (daily) return;
    setAnnonce({ type: 'intro', duree: DUREE_INTRO });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }

  // La surcouche se retire d'elle-même au terme de son animation : le
  // pattern suivant est déjà relancé derrière elle, on ne bloque rien.
  useEffect(() => {
    if (!annonce) return;
    const t = setTimeout(() => setAnnonce(null), annonce.duree);
    return () => clearTimeout(t);
  }, [annonce]);

  function schedule(fn, ms) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }

  function setPhaseBoth(p) {
    phaseRef.current = p;
    setPhase(p);
  }

  function makePattern(hits, steps, rng = Math.random) {
    const p = Array(steps).fill(false);
    p[0] = true;
    let n = 1;
    while (n < hits) {
      const i = 1 + Math.floor(rng() * (steps - 1));
      if (!p[i]) { p[i] = true; n++; }
    }
    return p;
  }

  function startRun() {
    stopAll();
    if (daily) {
      dailyRngRef.current = seeded('rythme');
      dailyRoundRef.current = 0;
      dailyScoresRef.current = [];
      setDailyRound(0);
    }
    livesRef.current = VIES;
    levelRef.current = daily ? DAILY_LEVELS[0] : 1;
    setLives(VIES);
    setLevel(levelRef.current);
    setLastScore(null);
    setAnnonce(null);
    startCycle();
  }

  async function startCycle() {
    const Tone = toneRef.current;
    if (!Tone) return;
    await Tone.start();

    const lvl = levelRef.current;
    const cfg = levelConfig(lvl);
    configRef.current = cfg;
    const p = makePattern(cfg.hits, cfg.steps, daily ? dailyRngRef.current : Math.random);
    patternRef.current = p;
    setPattern(p);
    setPatternVisible(true);
    setStepFlash({});
    setStatus(daily
      ? `Pattern ${dailyRoundRef.current + 1} sur ${DAILY_ROUNDS} · ${cfg.steps} cases — écoute et mémorise.`
      : `Niveau ${lvl} · ${cfg.bpm} BPM · ${cfg.steps} cases — écoute et mémorise.`);

    const beat = 60 / cfg.bpm;
    const bar = barOf(cfg);
    const beats = cfg.steps / 2;
    const eighth = bar / cfg.steps;
    const t0 = Tone.now() + 0.2;

    // 1. CALL : métronome + pattern joué
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', t0 + b * beat);
    p.forEach((h, i) => { if (h) clapRef.current.triggerAttackRelease('16n', t0 + i * eighth); });

    setPhaseBoth('listen');
    animateCursor(t0, bar);

    // 2. PRÉPARATION : le pattern s'efface pendant que le métronome continue
    const prep0 = t0 + bar;
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', prep0 + b * beat);
    schedule(() => {
      setPhaseBoth('ready');
      setPatternVisible(false);
      setStatus('Le rythme s\'efface. Prépare-toi.');
      animateCursor(prep0, bar);
    }, (prep0 - Tone.now()) * 1000);

    // 3. RESPONSE
    const r0 = prep0 + bar;
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease('E5', '32n', r0 + b * beat);
    cycleStartRef.current = r0;
    matchedRef.current = Array(cfg.steps).fill(false);
    tapsPtsRef.current = [];
    extrasRef.current = 0;

    // La frappe s'ouvre 250 ms AVANT la mesure : sans cette marge, le premier
    // temps est perdu (dérive du setTimeout + rendu React). Les frappes trop
    // précoces restent rejetées par le test de fenêtre dans tap().
    schedule(() => {
      setPhaseBoth('play');
      setStatus('À toi. Frappe avec la barre d\'espace ou dans la zone.');
    }, Math.max(0, (r0 - Tone.now()) * 1000 - 250));

    schedule(() => animateCursor(r0, bar), Math.max(0, (r0 - Tone.now()) * 1000));

    schedule(() => endCycle(), (r0 + bar + 0.25 - Tone.now()) * 1000);
  }

  function animateCursor(startTime, duration) {
    const Tone = toneRef.current;
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const progress = (Tone.now() - startTime) / duration;
      if (progress >= 0 && progress <= 1) setCursor(progress);
      if (progress <= 1) rafRef.current = requestAnimationFrame(loop);
      else setCursor(-1);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function tap() {
    if (phaseRef.current !== 'play' || !toneRef.current) return;
    clapRef.current?.triggerAttackRelease('16n');
    setImpulsion((n) => n + 1);
    const cfg = configRef.current;
    const bar = barOf(cfg);
    const eighth = bar / cfg.steps;
    const t = toneRef.current.now() - cycleStartRef.current;
    if (t < -0.25 || t > bar + 0.25) return;

    const p = patternRef.current;
    let best = -1, bestErr = Infinity;
    p.forEach((h, i) => {
      if (h && !matchedRef.current[i]) {
        const err = Math.abs(t - i * eighth);
        if (err < bestErr) { bestErr = err; best = i; }
      }
    });

    let judgment;
    if (best >= 0 && bestErr < 0.25) {
      matchedRef.current[best] = true;
      judgment = JUDGMENTS.find((j) => bestErr <= j.max);
      tapsPtsRef.current.push(judgment.pts);
      flashStep(best, judgment.color);
    } else {
      extrasRef.current += 1;
      judgment = JUDGMENTS[3];
    }
    showJudgment(judgment);
  }

  function flashStep(i, color) {
    setStepFlash((f) => ({ ...f, [i]: color }));
    schedule(() => setStepFlash((f) => { const n = { ...f }; delete n[i]; return n; }), 400);
  }

  function showJudgment(j) {
    setFloatingJudgment({ ...j, key: Math.random() });
    schedule(() => setFloatingJudgment(null), 600);
  }

  function endCycle() {
    setPhaseBoth('idle');
    setCursor(-1);
    setPatternVisible(true);
    const p = patternRef.current;
    const targets = p.filter(Boolean).length;
    const pts = tapsPtsRef.current.reduce((a, b) => a + b, 0);
    const missed = targets - matchedRef.current.filter(Boolean).length;
    let s = (pts / targets) * 10 - extrasRef.current - missed * 0.5;
    s = Math.max(0, Math.min(10, Math.round(s * 10) / 10));
    setLastScore(s);

    if (daily) {
      dailyScoresRef.current.push(s);
      dailyRoundRef.current += 1;
      setDailyRound(dailyRoundRef.current);
      if (dailyRoundRef.current >= DAILY_ROUNDS) {
        const avg = Math.round((dailyScoresRef.current.reduce((a, b) => a + b, 0) / DAILY_ROUNDS) * 10) / 10;
        setPhaseBoth('gameover');
        setStatus(`Terminé : ${dailyScoresRef.current.map(x => x.toFixed(1)).join(' · ')} → moyenne ${avg} sur 10.`);
        if (!dailyDoneRef.current) { dailyDoneRef.current = true; onDone(avg); }
      } else {
        levelRef.current = DAILY_LEVELS[dailyRoundRef.current];
        setLevel(levelRef.current);
        setStatus(`${s} sur 10. Pattern ${dailyRoundRef.current + 1} sur ${DAILY_ROUNDS} dans un instant.`);
        schedule(() => startCycle(), 1800);
      }
      return;
    }

    if (s >= 7) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setBestLevel((b) => Math.max(b, levelRef.current));
      // Réussite : aucun voile. Le pattern suivant est la récompense, une
      // cérémonie de félicitations ne ferait que casser la série.
      setStatus(`${s} sur 10. Niveau ${levelRef.current}.`);
      schedule(() => startCycle(), 1600);
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);

      if (livesRef.current <= 0) {
        // Le voile joue la perte en entier puis le verdict ; l'écran de fin
        // n'arrive qu'une fois la croix tracée.
        setAnnonce({ type: 'perte', restantes: 0, finale: true, duree: DUREE_DEFAITE });
        setStatus(`${s} sur 10.`);
        schedule(() => {
          setPhaseBoth('gameover');
          setStatus('Plus de vies. Run terminé.');
        }, DUREE_DEFAITE);
      } else {
        setAnnonce({
          type: 'perte',
          restantes: livesRef.current,
          finale: false,
          duree: DUREE_PERTE,
        });
        setStatus(`${s} sur 10. Le niveau ${levelRef.current} est rejoué.`);
        schedule(() => startCycle(), DUREE_PERTE);
      }
    }
  }

  const running = phase === 'listen' || phase === 'ready' || phase === 'play';
  const phaseBadge = {
    listen: { txt: 'écoute', couleur: 'var(--lin)' },
    ready: { txt: 'préparation', couleur: 'var(--or)' },
    play: { txt: 'à toi', couleur: 'var(--jade)' },
  }[phase];
  const cursorColor = phase === 'listen' ? 'var(--or)' : phase === 'ready' ? 'var(--or-clair)' : 'var(--jade)';
  const dailyFini = daily && phase === 'gameover';
  const gridSteps = pattern?.length ?? 8;
  const gridGap = gridSteps > 12 ? 5 : 8;

  return (
    // Le fond du panneau manquait à cette épreuve : les neuf autres
    // l'utilisent, et `position: relative` ancre en prime la surcouche.
    <div style={{ ...panel, position: 'relative' }}>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        @keyframes pulseAttente {
          0%, 100% {
            border-color: var(--filet);
            box-shadow: 0 0 0 rgba(250, 199, 117, 0);
          }
          50% {
            border-color: var(--or-clair);
            box-shadow: 0 0 24px rgba(250, 199, 117, 0.22);
          }
        }
        @keyframes ondeFrappe {
          from { transform: scale(0.5); opacity: 0.7; }
          to   { transform: scale(2); opacity: 0; }
        }
        @keyframes impactFrappe {
          from { transform: scale(0.35); opacity: 0.55; }
          to   { transform: scale(2.6); opacity: 0; }
        }
        @keyframes apparitionAnnonce {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Surcouche — définitions identiques à celles de l'épreuve Duel.
           Les dix épreuves sont montées simultanément dans le carrousel, donc
           ces règles coexistent dans le DOM : elles doivent rester rigoureusement
           les mêmes des deux côtés, sinon la dernière déclarée l'emporterait
           silencieusement sur l'autre. */
        @keyframes duelVoile {
          0%   { opacity: 0; }
          10%  { opacity: 1; }
          84%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes duelPointPerdu {
          0%   { transform: scale(1);
                 background-color: var(--ivoire); border-color: var(--ivoire);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
          28%  { transform: scale(1.55);
                 background-color: var(--carmin); border-color: var(--carmin);
                 box-shadow: 0 0 0 9px rgba(226, 75, 74, 0.16); }
          62%  { transform: scale(0.9);
                 background-color: transparent; border-color: var(--carmin);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
          100% { transform: scale(1);
                 background-color: transparent; border-color: var(--filet-fort);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
        }
        @keyframes duelPointArrivee {
          from { opacity: 0; transform: scale(0.2); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes duelVoeu {
          from { opacity: 0; transform: scale(0.9); letter-spacing: 0.18em; }
          to   { opacity: 1; transform: scale(1); letter-spacing: normal; }
        }
        @keyframes duelActeSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.94); }
        }
        @keyframes duelCroixCorps {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes duelCroixTrait {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes duelTexteEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-duel-surcouche], [data-duel-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      {/* Tableau de bord */}
      <div style={{ display: 'flex', gap: 'var(--e5)', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 'var(--e4)' }}>
        {daily ? (
          <Donnee etiquette="pattern" valeur={`${Math.min(dailyRound + 1, DAILY_ROUNDS)} / ${DAILY_ROUNDS}`} />
        ) : (
          <>
            <Donnee etiquette="niveau" valeur={level} accent />
            <Donnee etiquette="vies" valeur={'●'.repeat(Math.max(0, lives)) + '○'.repeat(VIES - Math.max(0, lives))} />
            <Donnee etiquette="record" valeur={`niveau ${bestLevel}`} />
          </>
        )}
        <Donnee etiquette="grille" valeur={`${gridSteps} cases`} />
        {lastScore !== null && <Donnee etiquette="dernier" valeur={`${lastScore.toFixed(1).replace('.', ',')} / 10`} />}
      </div>

      {/* Bouton de lancement ou badge de phase */}
      {!running ? (
        <button onClick={startRun} disabled={dailyFini}
          style={{
            fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
            padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
            cursor: dailyFini ? 'not-allowed' : 'pointer',
            background: dailyFini ? 'transparent' : 'var(--or)',
            color: dailyFini ? 'var(--cendre)' : 'var(--noir)',
            border: `1px solid ${dailyFini ? 'var(--filet)' : 'var(--or)'}`,
            marginBottom: 'var(--e4)',
            transition: 'background var(--transition-courte)',
          }}>
          {dailyFini ? 'Terminé pour aujourd\'hui'
            : daily ? 'Commencer l\'épreuve'
            : phase === 'gameover' ? 'Recommencer' : 'Commencer le jeu'}
        </button>
      ) : (
        <div className="etiquette-mono" style={{
          display: 'inline-block', padding: '6px 12px', marginBottom: 'var(--e4)',
          border: `1px solid ${phaseBadge.couleur}`, borderRadius: 'var(--rayon-controle)',
          color: phaseBadge.couleur,
        }}>
          {phaseBadge.txt}
        </div>
      )}

      {/* Grille rythmique */}
      <div style={{ position: 'relative', marginBottom: 'var(--e2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSteps}, 1fr)`, gap: gridGap }}>
          {Array.from({ length: gridSteps }, (_, i) => {
            const actif = pattern?.[i] && patternVisible;
            const surTemps = i % 2 === 0; // temps forts : fond onyx, filet plus présent
            return (
              <div key={i} style={{
                aspectRatio: '1 / 1.4', borderRadius: 'var(--rayon-controle)',
                background: surTemps ? 'var(--onyx)' : 'transparent',
                border: `${actif ? '1px' : '0.5px'} solid ${actif ? 'var(--or)' : surTemps ? 'var(--filet)' : 'rgba(242,236,224,0.07)'}`,
                position: 'relative',
                transition: 'border-color 0.35s ease',
                transitionDelay: `${i * 0.035}s`,
              }}>
                {pattern?.[i] && (
                  <div style={{
                    position: 'absolute', inset: '26% 28%', borderRadius: '50%',
                    background: stepFlash[i] ?? 'var(--or)',
                    opacity: (patternVisible || stepFlash[i]) ? 1 : 0,
                    transform: (patternVisible || stepFlash[i]) ? 'scale(1)' : 'scale(0.15)',
                    transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(.34,1.3,.64,1), background 0.15s',
                    transitionDelay: `${i * 0.04}s`,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Curseur qui parcourt la mesure */}
        {cursor >= 0 && (
          <div style={{
            position: 'absolute', top: -6, bottom: -6,
            left: `${cursor * 100}%`, width: 2,
            background: cursorColor,
            boxShadow: `0 0 10px ${cursorColor}`,
          }} />
        )}

        {/* Jugement flottant */}
        {floatingJudgment && (
          <div key={floatingJudgment.key} className="etiquette-mono" style={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            color: floatingJudgment.color,
            animation: 'floatUp 0.6s ease-out forwards',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {floatingJudgment.label}
          </div>
        )}
      </div>

      {/* Zone de frappe : le composant porte lui-même sa pédagogie */}
      <ZoneFrappe phase={phase} running={running} impulsion={impulsion} onTap={tap} />

      <p className="lin" style={{ fontSize: 13, minHeight: '1.5em', marginTop: 'var(--e3)' }}>{status}</p>

      {/* Écran de fin */}
      {phase === 'gameover' && (
        <div style={{
          marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'apparitionAnnonce 260ms ease-out both',
        }}>
          {daily ? (
            <>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>score de l'épreuve</div>
              <div className="score-affiche" style={{ fontSize: 38, marginTop: 'var(--e2)' }}>
                {(dailyScoresRef.current.reduce((a, b) => a + b, 0) / DAILY_ROUNDS).toFixed(1).replace('.', ',')}
                <span style={{ color: 'var(--cendre)' }}> / 10</span>
              </div>
              <p className="description" style={{ marginTop: 'var(--e2)' }}>
                Détail des trois patterns : {dailyScoresRef.current.map((x) => x.toFixed(1).replace('.', ',')).join(' · ')}
              </p>
            </>
          ) : (
            <>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>run terminé</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 500,
                color: 'var(--or)', marginTop: 'var(--e2)', lineHeight: 1.1,
              }}>
                niveau {level}
              </div>
              <p className="description" style={{ marginTop: 'var(--e2)' }}>
                {level >= bestLevel
                  ? 'Meilleur niveau de la session.'
                  : `Ton record de la session reste le niveau ${bestLevel}.`}
              </p>
            </>
          )}
        </div>
      )}

      {/* ---- Surcouche : placée en dernier pour passer au-dessus de tout ---- */}
      {annonce && <Surcouche annonce={annonce} />}
    </div>
  );
}

/* Une donnée du tableau de bord : étiquette mono en cendre, valeur en ivoire */
function Donnee({ etiquette, valeur, accent = false }) {
  return (
    <div>
      <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>{etiquette}</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 14, marginTop: 2,
        color: accent ? 'var(--or)' : 'var(--ivoire)',
      }}>
        {valeur}
      </div>
    </div>
  );
}
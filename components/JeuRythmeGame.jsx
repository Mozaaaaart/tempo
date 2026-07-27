'use client';
import { useEffect, useRef, useState } from 'react';
import { seeded } from '@/components/dailyGames';

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

export default function JeuRythmeGame({ daily = false, onDone = () => {} }) {
  const [phase, setPhase] = useState('idle');
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [bestLevel, setBestLevel] = useState(1);
  const [pattern, setPattern] = useState(null);
  const [patternVisible, setPatternVisible] = useState(true);
  const [cursor, setCursor] = useState(-1);
  const [stepFlash, setStepFlash] = useState({});
  const [floatingJudgment, setFloatingJudgment] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  const [dailyRound, setDailyRound] = useState(0);
  const [annonce, setAnnonce] = useState(null); // { type: 'perte' | 'reussite', texte }
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
  const livesRef = useRef(3);
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
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stopAll();
    };
  }, []);

  function stopAll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }

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
    livesRef.current = 3;
    levelRef.current = daily ? DAILY_LEVELS[0] : 1;
    setLives(3);
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
      setAnnonce({ type: 'reussite', texte: `Réussi — niveau ${levelRef.current} débloqué` });
      setStatus(`${s} sur 10.`);
      schedule(() => { setAnnonce(null); startCycle(); }, 1600);
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        setAnnonce(null);
        setPhaseBoth('gameover');
        setStatus('Plus de vies. Run terminé.');
      } else {
        setAnnonce({
          type: 'perte',
          texte: `Vie perdue — il t'en reste ${livesRef.current} sur 3`,
        });
        setStatus(`${s} sur 10. Le niveau ${levelRef.current} est rejoué.`);
        schedule(() => { setAnnonce(null); startCycle(); }, 2000);
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
    <div style={{ marginBottom: 'var(--e4)' }}>
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
        @keyframes apparitionAnnonce {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Tableau de bord */}
      <div style={{ display: 'flex', gap: 'var(--e5)', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 'var(--e4)' }}>
        {daily ? (
          <Donnee etiquette="pattern" valeur={`${Math.min(dailyRound + 1, DAILY_ROUNDS)} / ${DAILY_ROUNDS}`} />
        ) : (
          <>
            <Donnee etiquette="niveau" valeur={level} accent />
            <Donnee etiquette="vies" valeur={'●'.repeat(lives) + '○'.repeat(3 - lives)} />
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

      {/* Annonce entre deux patterns : vie perdue ou niveau débloqué */}
      {annonce && (
        <div style={{
          marginBottom: 'var(--e4)', padding: 'var(--e3) var(--e4)',
          border: `1px solid ${annonce.type === 'perte' ? 'rgba(226, 75, 74, 0.5)' : 'var(--or)'}`,
          borderRadius: 'var(--rayon-controle)',
          color: annonce.type === 'perte' ? 'rgba(226, 75, 74, 0.9)' : 'var(--or)',
          fontSize: 14, fontWeight: 500,
          animation: 'apparitionAnnonce 220ms ease-out both',
        }}>
          {annonce.texte}
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

      {/* Zone de frappe : pulse pendant la préparation, s'allume au moment de jouer */}
      <div
        onPointerDown={(e) => { e.preventDefault(); tap(); }}
        className="etiquette-mono"
        style={{
          border: `${phase === 'play' ? '1px' : '0.5px'} solid ${phase === 'play' ? 'var(--jade)' : 'var(--filet)'}`,
          color: phase === 'play' ? 'var(--jade)' : phase === 'ready' ? 'var(--or-clair)' : 'var(--cendre)',
          background: phase === 'play' ? 'var(--onyx-haut)' : 'transparent',
          boxShadow: phase === 'play' ? '0 0 26px rgba(93, 202, 165, 0.2)' : 'none',
          borderRadius: 'var(--rayon-carte)', padding: 'var(--e7)', textAlign: 'center',
          cursor: running ? 'pointer' : 'default',
          userSelect: 'none', marginTop: 'var(--e4)',
          animation: phase === 'ready' ? 'pulseAttente 900ms ease-in-out infinite' : 'none',
          transition: 'border-color var(--transition-courte), color var(--transition-courte), background var(--transition-courte), box-shadow var(--transition-courte)',
        }}>
        {phase === 'play' ? 'frappe ici ou avec la barre d\'espace'
          : phase === 'ready' ? 'ta mesure arrive'
          : 'zone de frappe'}
      </div>

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
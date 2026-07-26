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

const JUDGMENTS = [
  { max: 0.05, label: '✨ Parfait !', color: '#4ade80', pts: 1 },
  { max: 0.12, label: '👍 Bien', color: '#f2c14e', pts: 0.7 },
  { max: 0.2, label: '😬 Limite', color: '#fb923c', pts: 0.4 },
  { max: Infinity, label: '❌ Raté', color: '#f87171', pts: 0 },
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
  const [status, setStatus] = useState(daily
    ? '3 patterns, un seul essai chacun. Ton score = la moyenne.'
    : 'Un run : le niveau monte tant que tu tiens. 3 vies. Prêt ?');

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
      ? `Pattern ${dailyRoundRef.current + 1}/${DAILY_ROUNDS} · ${cfg.steps} cases — écoute et mémorise…`
      : `Niveau ${lvl} · ${cfg.bpm} BPM · ${cfg.steps} cases — écoute et mémorise…`);

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
      setStatus('Le rythme s\'efface… prépare-toi !');
      animateCursor(prep0, bar);
    }, (prep0 - Tone.now()) * 1000);

    // 3. RESPONSE
    const r0 = prep0 + bar;
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease('E5', '32n', r0 + b * beat);
    cycleStartRef.current = r0;
    matchedRef.current = Array(cfg.steps).fill(false);
    tapsPtsRef.current = [];
    extrasRef.current = 0;

    schedule(() => {
      setPhaseBoth('play');
      setStatus('À toi ! (Espace ou clic)');
      animateCursor(r0, bar);
    }, (r0 - Tone.now()) * 1000);

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
        setStatus(`Terminé : ${dailyScoresRef.current.map(x => x.toFixed(1)).join(' · ')} → moyenne ${avg}/10.`);
        if (!dailyDoneRef.current) { dailyDoneRef.current = true; onDone(avg); }
      } else {
        levelRef.current = DAILY_LEVELS[dailyRoundRef.current];
        setLevel(levelRef.current);
        setStatus(`${s}/10 — pattern ${dailyRoundRef.current + 1}/${DAILY_ROUNDS} arrive…`);
        schedule(() => startCycle(), 1800);
      }
      return;
    }

    if (s >= 7) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setBestLevel((b) => Math.max(b, levelRef.current));
      setStatus(`${s}/10 — niveau suivant ! 🔥`);
      schedule(() => startCycle(), 1400);
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
      if (livesRef.current <= 0) {
        setPhaseBoth('gameover');
        setStatus(`Game over — tu as atteint le niveau ${levelRef.current}.`);
      } else {
        setStatus(`${s}/10 — raté, ${livesRef.current} vie(s) restante(s). On retente le niveau.`);
        schedule(() => startCycle(), 1800);
      }
    }
  }

  const running = phase === 'listen' || phase === 'ready' || phase === 'play';
  const phaseBadge = {
    listen: { txt: '👂 ÉCOUTE', bg: '#26221a', border: '#f2c14e', color: '#f2c14e' },
    ready: { txt: '🕐 PRÉPARE-TOI…', bg: '#2b2115', border: '#fb923c', color: '#fb923c' },
    play: { txt: '🥁 REJOUE DE MÉMOIRE !', bg: '#14432b', border: '#4ade80', color: '#4ade80' },
  }[phase];
  const cursorColor = phase === 'listen' ? '#f2c14e' : phase === 'ready' ? '#fb923c' : '#4ade80';
  const dailyFini = daily && phase === 'gameover';
  const gridSteps = pattern?.length ?? 8;
  const gridGap = gridSteps > 12 ? 5 : 8;

  return (
    <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
      `}</style>

      <h3 style={{ marginBottom: 4 }}>Reproduis le rythme</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        {daily
          ? '3 patterns de tailles différentes : écoute, mémorise — le rythme s\'efface avant ton tour. Score = moyenne des 3.'
          : 'Écoute, mémorise : le rythme s\'efface avant ton tour. Plus le niveau monte, plus la grille s\'agrandit — et les mesures deviennent irrégulières.'}
      </p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontFamily: 'monospace', fontSize: '0.9rem', color: '#9aa0b4' }}>
        {daily ? (
          <span>Pattern : <strong style={{ color: '#f2c14e' }}>{Math.min(dailyRound + 1, DAILY_ROUNDS)}/{DAILY_ROUNDS}</strong></span>
        ) : (
          <>
            <span>Niveau : <strong style={{ color: '#f2c14e' }}>{level}</strong></span>
            <span>Vies : <strong style={{ color: '#f87171' }}>{'♥'.repeat(lives)}{'♡'.repeat(3 - lives)}</strong></span>
            <span>Record : <strong style={{ color: '#4ade80' }}>niveau {bestLevel}</strong></span>
          </>
        )}
        <span>Grille : <strong style={{ color: '#8b7cf6' }}>{gridSteps} cases</strong></span>
        {lastScore !== null && <span>Dernier : <strong style={{ color: '#e9e7de' }}>{lastScore}/10</strong></span>}
      </div>

      {!running && (
        <button onClick={startRun} disabled={dailyFini}
          style={{
            padding: '12px 22px', borderRadius: 10, border: 'none',
            cursor: dailyFini ? 'not-allowed' : 'pointer', background: '#f2c14e',
            color: '#1a1405', fontWeight: 700, fontSize: '1rem', marginBottom: 16,
            opacity: dailyFini ? 0.45 : 1,
          }}>
          {dailyFini ? '✔ Terminé pour aujourd\'hui'
            : daily ? '▶ Lancer les 3 patterns'
            : phase === 'gameover' ? '🔄 Nouveau run' : '▶ Lancer le run'}
        </button>
      )}
      {running && (
        <div style={{
          display: 'inline-block', padding: '8px 16px', borderRadius: 10, marginBottom: 16,
          background: phaseBadge.bg, border: `1px solid ${phaseBadge.border}`,
          color: phaseBadge.color, fontFamily: 'monospace', fontWeight: 700,
        }}>
          {phaseBadge.txt}
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSteps}, 1fr)`, gap: gridGap }}>
          {Array.from({ length: gridSteps }, (_, i) => {
            const actif = pattern?.[i] && patternVisible;
            const surTemps = i % 2 === 0; // les temps forts, un peu plus marqués
            return (
              <div key={i} style={{
                aspectRatio: '1 / 1.4', borderRadius: 8,
                background: stepFlash[i] ?? (actif ? '#2b2f52' : surTemps ? '#1e2338' : '#1c2032'),
                border: `1px solid ${actif ? '#8b7cf6' : surTemps ? '#333a55' : '#2a2f45'}`,
                position: 'relative',
                transition: 'background 0.35s ease, border-color 0.35s ease',
                transitionDelay: `${i * 0.035}s`,
              }}>
                {pattern?.[i] && (
                  <div style={{
                    position: 'absolute', inset: '26% 28%', borderRadius: '50%',
                    background: stepFlash[i] ?? '#8b7cf6',
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
        {cursor >= 0 && (
          <div style={{
            position: 'absolute', top: -6, bottom: -6,
            left: `${cursor * 100}%`, width: 3, borderRadius: 2,
            background: cursorColor, boxShadow: `0 0 8px ${cursorColor}`,
          }} />
        )}
        {floatingJudgment && (
          <div key={floatingJudgment.key} style={{
            position: 'absolute', top: -34, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem',
            color: floatingJudgment.color, animation: 'floatUp 0.6s ease-out forwards',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {floatingJudgment.label}
          </div>
        )}
      </div>

      <div
        onPointerDown={(e) => { e.preventDefault(); tap(); }}
        style={{
          border: `1px dashed ${phase === 'play' ? '#4ade80' : '#2a2f45'}`,
          color: phase === 'play' ? '#4ade80' : '#9aa0b4',
          borderRadius: 14, padding: 34, textAlign: 'center',
          cursor: running ? 'pointer' : 'default',
          fontFamily: 'monospace', userSelect: 'none', marginTop: 14,
        }}>
        {phase === 'play' ? '🥁 FRAPPE ICI (ou Espace)' : phase === 'ready' ? '🕐 Ta mesure arrive…' : 'Zone de frappe'}
      </div>

      <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 12 }}>{status}</p>

      {phase === 'gameover' && (
        <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
          <div style={{ fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700, color: '#f2c14e' }}>
            {daily
              ? `${Math.round((dailyScoresRef.current.reduce((a, b) => a + b, 0) / DAILY_ROUNDS) * 10) / 10} / 10`
              : `Niveau ${level}`}
          </div>
          {!daily && (
            <div style={{ color: '#9aa0b4', fontSize: '0.85rem', marginTop: 6 }}>
              Record de la session : niveau {bestLevel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
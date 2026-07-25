'use client';
import { useEffect, useRef, useState } from 'react';

const STEPS = 8;
const BPM = 100;
const EIGHTH = 60 / BPM / 2;
const BAR = EIGHTH * STEPS;
const BEAT = 60 / BPM;

export default function JeuRythme() {
  const [pattern, setPattern] = useState(null);
  const [recording, setRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [status, setStatus] = useState('Génère un pattern pour commencer.');
  const [score, setScore] = useState(null);
  const [detail, setDetail] = useState('');

  const toneRef = useRef(null);
  const clickRef = useRef(null);
  const clapRef = useRef(null);
  const tapsRef = useRef([]);
  const recStartRef = useRef(0);
  const recordingRef = useRef(false);
  const patternRef = useRef(null);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
      clickRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 2,
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination();
      clapRef.current = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      clapRef.current.volume.value = -4;
    });

    function onKey(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        tap();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function ensureAudio() {
    if (toneRef.current) await toneRef.current.start();
  }

  function newRound() {
    const p = Array(STEPS).fill(false);
    p[0] = true;
    let hits = 1;
    const wanted = 4 + Math.floor(Math.random() * 3);
    while (hits < wanted) {
      const i = 1 + Math.floor(Math.random() * (STEPS - 1));
      if (!p[i]) { p[i] = true; hits++; }
    }
    setPattern(p);
    patternRef.current = p;
    setScore(null);
    setStatus('Pattern généré — écoute-le, puis reproduis-le.');
    playPattern(p);
  }

  async function playPattern(p = patternRef.current) {
    if (!p) return;
    await ensureAudio();
    const Tone = toneRef.current;
    const t0 = Tone.now() + 0.2;
    for (let b = 0; b < 4; b++) {
      clickRef.current.triggerAttackRelease(b === 0 ? 'C3' : 'G2', '16n', t0 + b * BEAT);
    }
    p.forEach((h, i) => {
      if (h) clapRef.current.triggerAttackRelease('16n', t0 + i * EIGHTH);
    });
    for (let i = 0; i < STEPS; i++) {
      setTimeout(() => setCurrentStep(i), (0.2 + i * EIGHTH) * 1000);
    }
    setTimeout(() => setCurrentStep(-1), (0.2 + BAR) * 1000 + 150);
  }

  async function record() {
    if (!patternRef.current || recordingRef.current) return;
    await ensureAudio();
    const Tone = toneRef.current;
    tapsRef.current = [];
    recordingRef.current = true;
    setRecording(true);
    const t0 = Tone.now() + 0.2;
    for (let b = 0; b < 4; b++) {
      clickRef.current.triggerAttackRelease(b === 0 ? 'C3' : 'G2', '16n', t0 + b * BEAT);
    }
    recStartRef.current = t0 + 4 * BEAT;
    for (let b = 0; b < 4; b++) {
      clickRef.current.triggerAttackRelease('G2', '16n', recStartRef.current + b * BEAT);
    }
    setStatus('4 clics de compte à rebours… puis tape le rythme !');
    setTimeout(() => {
      recordingRef.current = false;
      setRecording(false);
      scoreIt();
    }, (0.2 + 4 * BEAT + BAR + 0.25) * 1000);
  }

  function tap() {
    if (!recordingRef.current || !toneRef.current) return;
    clapRef.current?.triggerAttackRelease('16n');
    const t = toneRef.current.now() - recStartRef.current;
    if (t > -0.25 && t < BAR + 0.25) tapsRef.current.push(t);
  }

  function scoreIt() {
    const p = patternRef.current;
    const taps = tapsRef.current;
    const targets = p.map((h, i) => (h ? i * EIGHTH : null)).filter(v => v !== null);
    const used = new Set();
    let pts = 0;
    targets.forEach(t => {
      let best = -1, bestErr = Infinity;
      taps.forEach((tp, i) => {
        if (!used.has(i) && Math.abs(tp - t) < bestErr) {
          bestErr = Math.abs(tp - t);
          best = i;
        }
      });
      if (best >= 0 && bestErr < 0.25) {
        used.add(best);
        pts += bestErr < 0.05 ? 1 : Math.max(0, 1 - (bestErr - 0.05) / 0.2);
      }
    });
    const extras = taps.length - used.size;
    let s = (pts / targets.length) * 10 - extras;
    s = Math.max(0, Math.min(10, s));
    setScore(s.toFixed(1));
    setDetail(`${targets.length} frappes attendues · ${taps.length} jouées · ${extras > 0 ? extras + ' en trop' : 'aucune en trop'}`);
    setStatus('Terminé ! « Nouveau pattern » ou réessaie avec « Reproduire ».');
  }

  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 4px' }}>Reproduis le rythme</h2>
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>
        Écoute le pattern, puis lance l'enregistrement : après 4 clics de compte à rebours,
        tape le rythme en cliquant la zone ou avec la barre Espace.
      </p>

      <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={newRound}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#f2c14e', color: '#1a1405', fontWeight: 600 }}>
            Nouveau pattern
          </button>
          <button onClick={() => playPattern()} disabled={!pattern}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: pattern ? 'pointer' : 'not-allowed', background: '#1c2032', color: '#e9e7de', opacity: pattern ? 1 : 0.45, fontWeight: 600 }}>
            Écouter le pattern
          </button>
          <button onClick={record} disabled={!pattern || recording}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', cursor: pattern && !recording ? 'pointer' : 'not-allowed', background: '#f2c14e', color: '#1a1405', opacity: pattern && !recording ? 1 : 0.45, fontWeight: 600 }}>
            Reproduire (rec)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <div key={i} style={{
              aspectRatio: '1 / 1.4', borderRadius: 10,
              background: pattern?.[i] ? (currentStep === i ? '#3a3f6e' : '#2b2f52') : (currentStep === i ? '#151826' : '#1c2032'),
              border: `1px solid ${pattern?.[i] ? '#8b7cf6' : '#2a2f45'}`,
              boxShadow: currentStep === i ? '0 0 0 2px #f2c14e' : 'none',
              position: 'relative',
            }}>
              {pattern?.[i] && (
                <div style={{ position: 'absolute', inset: '28% 32%', borderRadius: '50%', background: '#8b7cf6' }} />
              )}
            </div>
          ))}
        </div>

        <div
          onPointerDown={async (e) => { e.preventDefault(); await ensureAudio(); tap(); }}
          style={{
            border: `1px dashed ${recording ? '#f2c14e' : '#2a2f45'}`,
            color: recording ? '#f2c14e' : '#9aa0b4',
            borderRadius: 14, padding: 34, textAlign: 'center', cursor: 'pointer',
            fontFamily: 'monospace', userSelect: 'none',
          }}>
          Zone de frappe — clique ici ou appuie sur Espace
        </div>

        <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 12 }}>{status}</p>

        {score !== null && (
          <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
            <div style={{
              fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700,
              color: +score >= 8 ? '#4ade80' : +score >= 5 ? '#f2c14e' : '#f87171'
            }}>
              {score} / 10
            </div>
            <div style={{ color: '#9aa0b4', fontSize: '0.85rem', marginTop: 6 }}>{detail}</div>
          </div>
        )}
      </div>
    </main>
  );
}
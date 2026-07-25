'use client';
import { useEffect, useRef, useState } from 'react';

const POSITIONS = [
  { name: 'C4', midi: 60, y: 158, ledger: true },
  { name: 'D4', midi: 62, y: 151 },
  { name: 'E4', midi: 64, y: 144 },
  { name: 'F4', midi: 65, y: 137 },
  { name: 'G4', midi: 67, y: 130 },
  { name: 'A4', midi: 69, y: 123 },
  { name: 'B4', midi: 71, y: 116 },
  { name: 'C5', midi: 72, y: 109 },
  { name: 'D5', midi: 74, y: 102 },
  { name: 'E5', midi: 76, y: 95 },
  { name: 'F5', midi: 77, y: 88 },
  { name: 'G5', midi: 79, y: 81 },
];
const LINES_Y = [88, 102, 116, 130, 144];

export default function JeuAccords() {
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('accord');
  const [userNotes, setUserNotes] = useState([]);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('Clique sur « Nouvelle cible » pour commencer.');
  const [score, setScore] = useState(null);
  const toneRef = useRef(null);
  const synthRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 1.2 },
      }).toDestination();
    });
  }, []);

  async function ensureAudio() {
    if (toneRef.current) await toneRef.current.start();
  }

  function newRound() {
    const m = Math.random() < 0.5 ? 'accord' : 'arpège';
    const n = Math.random() < 0.5 ? 3 : 4;
    const base = Math.floor(Math.random() * (POSITIONS.length - (n - 1) * 2));
    const notes = Array.from({ length: n }, (_, i) => POSITIONS[base + i * 2]);
    setMode(m); setTarget(notes); setUserNotes([]);
    setScore(null); setLocked(false);
    setStatus(`Mode : ${m} · Place tes ${n} notes sur la portée.`);
    playNotes(notes, m);
  }

  async function playNotes(notes, m) {
    await ensureAudio();
    const Tone = toneRef.current;
    const synth = synthRef.current;
    if (!synth) return;
    const t0 = Tone.now() + 0.15;
    if (m === 'arpège') {
      notes.forEach((n, i) => synth.triggerAttackRelease(n.name, '8n', t0 + i * 0.42));
    } else {
      synth.triggerAttackRelease(notes.map(n => n.name), '2n', t0);
    }
  }

  async function onStaffClick(e) {
    if (locked || !target || userNotes.length >= target.length) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const y = pt.matrixTransform(svg.getScreenCTM().inverse()).y;
    const best = POSITIONS.reduce((a, b) => Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a);
    await ensureAudio();
    synthRef.current?.triggerAttackRelease(best.name, '8n');
    const next = [...userNotes, best];
    setUserNotes(next);
    setStatus(`${next.length}/${target.length} note(s) posée(s)`);
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
    setStatus('Lecture : ta version… puis la cible.');
    await playNotes(userNotes, mode);
    setTimeout(async () => {
      await playNotes(target, mode);
      const u = [...userNotes.map(n => n.midi)].sort((a, b) => a - b);
      const t = [...target.map(n => n.midi)].sort((a, b) => a - b);
      let penalty = 0;
      t.forEach((tm, i) => {
        const um = u[i];
        if (um === undefined) { penalty += 4; return; }
        const d = Math.abs(um - tm);
        if (d === 0) return;
        if (d % 12 === 0) penalty += 1.5;
        else penalty += Math.min(d % 12, 12 - d % 12) + (d >= 12 ? 1 : 0);
      });
      const s = Math.max(0, 10 - Math.min(penalty, t.length * 4) * (10 / (t.length * 4)));
      setScore(s.toFixed(1));
      setLocked(false);
      setStatus('Terminé ! Lance une nouvelle cible pour rejouer.');
    }, (target.length * 0.42 + 0.8) * 1000);
  }

  const canValidate = target && userNotes.length === target.length && !locked;

  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 4px' }}>Retrouve l'accord</h2>
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>Écoute la cible, place tes notes (elles sonnent au clic), puis valide.</p>

      <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { label: 'Nouvelle cible', onClick: newRound, primary: true },
            { label: 'Réécouter cible', onClick: () => target && playNotes(target, mode), disabled: !target },
            { label: 'Écouter ma version', onClick: () => userNotes.length && playNotes(userNotes, mode), disabled: !userNotes.length },
            { label: 'Effacer', onClick: () => { setUserNotes([]); setStatus('Notes effacées.'); }, disabled: !userNotes.length },
            { label: 'Valider', onClick: validate, primary: true, disabled: !canValidate },
          ].map((b) => (
            <button key={b.label} onClick={b.onClick} disabled={b.disabled}
              style={{
                padding: '10px 16px', borderRadius: 10, border: 'none',
                cursor: b.disabled ? 'not-allowed' : 'pointer',
                background: b.primary ? '#f2c14e' : '#1c2032',
                color: b.primary ? '#1a1405' : '#e9e7de',
                opacity: b.disabled ? 0.45 : 1, fontWeight: 600
              }}>
              {b.label}
            </button>
          ))}
        </div>

        <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em' }}>{status}</p>

        <svg
          ref={svgRef}
          onClick={onStaffClick}
          viewBox="0 0 700 190"
          width="100%"
          style={{ maxWidth: 700, display: 'block', cursor: 'crosshair', marginTop: 8 }}
        >
          {LINES_Y.map(y => (
            <line key={y} x1={20} y1={y} x2={680} y2={y} stroke="#2a2f45" strokeWidth={1.5} />
          ))}
          <text x={30} y={142} fontSize={64} fill="#9aa0b4">𝄞</text>
          {userNotes.map((n, i) => (
            <g key={i} onClick={(e) => { e.stopPropagation(); removeNote(i); }}>
              {n.ledger && (
                <line x1={170 + i * 110 - 16} y1={n.y} x2={170 + i * 110 + 16} y2={n.y} stroke="#2a2f45" strokeWidth={1.5} />
              )}
              <ellipse cx={170 + i * 110} cy={n.y} rx={11} ry={8} fill="#f2c14e" style={{ cursor: 'pointer' }} />
              <text x={170 + i * 110} y={178} textAnchor="middle" fontSize={12} fill="#9aa0b4" fontFamily="monospace">
                {n.name}
              </text>
            </g>
          ))}
        </svg>

        {score !== null && (
          <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
            <div style={{
              fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700,
              color: +score >= 8 ? '#4ade80' : +score >= 5 ? '#f2c14e' : '#f87171'
            }}>
              {score} / 10
            </div>
            <div style={{ color: '#9aa0b4', fontSize: '0.85rem', marginTop: 6 }}>
              Cible : {target?.map(n => n.name).join(' · ')} — Toi : {userNotes.map(n => n.name).join(' · ')}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
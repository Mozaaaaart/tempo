'use client';
import { useEffect, useRef, useState } from 'react';
import { seeded } from '@/components/dailyGames';

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

export default function JeuAccordsGame({ daily = false, onDone = () => {} }) {
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('accord');
  const [userNotes, setUserNotes] = useState([]);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState(daily ? 'Chargement du piano…' : 'Clique sur « Nouvelle cible » pour commencer.');
  const [score, setScore] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoverSound, setHoverSound] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  const toneRef = useRef(null);
  const synthRef = useRef(null);
  const hoverSynthRef = useRef(null);
  const svgRef = useRef(null);
  const lastHoverRef = useRef(null);
  const revealTimersRef = useRef([]);
  const dragMovedRef = useRef(false);
  const dragIndexRef = useRef(null);
  const dailyDoneRef = useRef(false);

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
          if (daily && !target) newRound(seeded('accords'));
        },
      }).toDestination();
    });
    return () => revealTimersRef.current.forEach(clearTimeout);
  }, []);

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
    lastHoverRef.current = null;
    setStatus(`Mode : ${m} · Pose tes ${n} notes. Glisse une note posée pour l'ajuster, clique-la pour la retirer.`);
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
    setHoverPos(null);
    setStatus('Lecture : ta version…');
    const d1 = await playNotes(userNotes, mode);
    setTimeout(async () => {
      setStatus('…puis la cible (en vert).');
      await playTargetWithReveal(target, mode);
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
      setVerdicts(v);
      const s = Math.max(0, 10 - Math.min(penalty, target.length * 4) * (10 / (target.length * 4)));
      setScore(s.toFixed(1));
      if (daily && !dailyDoneRef.current) {
        dailyDoneRef.current = true;
        onDone(Math.round(s * 10) / 10);
        setStatus('Terminé ! Une seule tentative dans le défi du jour.');
      } else {
        setLocked(false);
        setStatus('Terminé ! Tes notes justes en vert, tes erreurs en rouge — la cible en vert à côté.');
      }
    }, (d1 + 0.5) * 1000);
  }

  const canValidate = target && userNotes.length === target.length && !locked;
  const ghostX = 170 + userNotes.length * 110;

  const boutons = [
    ...(daily ? [] : [{ label: 'Nouvelle cible', onClick: () => newRound(), primary: true }]),
    { label: 'Réécouter cible', onClick: () => target && (score !== null ? playTargetWithReveal(target, mode) : playNotes(target, mode)), disabled: !target },
    { label: 'Écouter ma version', onClick: () => userNotes.length && playNotes(userNotes, mode), disabled: !userNotes.length },
    { label: 'Effacer', onClick: () => { setUserNotes([]); setStatus('Notes effacées.'); }, disabled: !userNotes.length || locked },
    { label: 'Valider', onClick: validate, primary: true, disabled: !canValidate },
  ];

  return (
    <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <style>{`
        @keyframes notePop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <h3 style={{ marginBottom: 4 }}>Retrouve l'accord</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Écoute la cible, pose tes notes sur la portée, ajuste-les en les glissant, puis valide.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {boutons.map((b) => (
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
        onMouseMove={onStaffMove}
        onMouseLeave={onStaffLeave}
        onMouseUp={endDrag}
        viewBox="0 0 700 215"
        width="100%"
        style={{ maxWidth: 700, display: 'block', cursor: dragIndex !== null ? 'grabbing' : 'crosshair', marginTop: 8, userSelect: 'none' }}
      >
        {LINES_Y.map(y => (
          <line key={y} x1={20} y1={y} x2={680} y2={y} stroke="#2a2f45" strokeWidth={1.5} />
        ))}
        <text x={30} y={148} fontSize={90} fill="#9aa0b4">𝄞</text>

        {hoverPos && canPlace() && dragIndex === null && (
          <g style={{ pointerEvents: 'none' }}>
            {hoverPos.ledger && (
              <line x1={ghostX - 16} y1={hoverPos.y} x2={ghostX + 16} y2={hoverPos.y}
                stroke="#2a2f45" strokeWidth={1.5} opacity={0.5} />
            )}
            <ellipse cx={ghostX} cy={hoverPos.y} rx={11} ry={8} fill="#f2c14e" opacity={0.35} />
            <text x={ghostX} y={200} textAnchor="middle" fontSize={12} fill="#f2c14e"
              opacity={0.6} fontFamily="monospace">{hoverPos.name}</text>
          </g>
        )}

        {userNotes.map((n, i) => (
          <g key={i} onMouseDown={(e) => startDrag(e, i)}>
            {n.ledger && (
              <line x1={170 + i * 110 - 16} y1={n.y} x2={170 + i * 110 + 16} y2={n.y} stroke="#2a2f45" strokeWidth={1.5} />
            )}
            <ellipse cx={170 + i * 110} cy={n.y} rx={11} ry={8}
              fill={verdicts === null ? '#f2c14e' : verdicts[i] ? '#4ade80' : '#f87171'}
              stroke={dragIndex === i ? '#e9e7de' : 'none'} strokeWidth={2}
              style={{ cursor: locked ? 'default' : 'grab' }} />
            <rect x={170 + i * 110 - 22} y={n.y - 16} width={44} height={32} fill="transparent"
              style={{ cursor: locked ? 'default' : 'grab' }} />
            <text x={170 + i * 110} y={200} textAnchor="middle" fontSize={12}
              fill={verdicts === null ? '#9aa0b4' : verdicts[i] ? '#4ade80' : '#f87171'}
              fontFamily="monospace">
              {n.name}
            </text>
          </g>
        ))}

        {target && target.slice(0, revealed).map((n, i) => {
          const x = 170 + i * 110 + 26;
          return (
            <g key={'t' + i} style={{ pointerEvents: 'none' }}>
              {n.ledger && (
                <line x1={x - 16} y1={n.y} x2={x + 16} y2={n.y} stroke="#2a2f45" strokeWidth={1.5} />
              )}
              <ellipse cx={x} cy={n.y} rx={11} ry={8} fill="#4ade80"
                style={{ animation: 'notePop 0.35s ease-out', transformOrigin: `${x}px ${n.y}px` }} />
              <text x={x} y={52} textAnchor="middle" fontSize={12} fill="#4ade80" fontFamily="monospace">
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { on: true, icon: '🎹', titre: 'Mode découverte', desc: 'les notes sonnent au survol' },
          { on: false, icon: '🤫', titre: 'Mode silencieux', desc: 'les notes sonnent seulement au clic' },
        ].map((m) => (
          <button key={m.titre} onClick={() => setHoverSound(m.on)}
            style={{
              flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              textAlign: 'left', border: hoverSound === m.on ? '1px solid #f2c14e' : '1px solid #2a2f45',
              background: hoverSound === m.on ? '#26221a' : '#1c2032',
              color: '#e9e7de',
            }}>
            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{m.icon} {m.titre}</div>
            <div style={{ color: '#9aa0b4', fontSize: '0.8rem', marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {score !== null && (
        <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
          <div style={{
            fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700,
            color: +score >= 8 ? '#4ade80' : +score >= 5 ? '#f2c14e' : '#f87171'
          }}>
            {score} / 10
          </div>
          <div style={{ color: '#9aa0b4', fontSize: '0.85rem', marginTop: 6 }}>
            Cible : <span style={{ color: '#4ade80' }}>{target?.map(n => n.name).join(' · ')}</span> — Toi : <span style={{ color: '#f2c14e' }}>{userNotes.map(n => n.name).join(' · ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
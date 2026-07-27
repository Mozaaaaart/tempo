'use client';
import { useEffect, useRef, useState } from 'react';
import { seeded, survolOr, sortieOr } from '@/components/dailyGames';

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

export default function JeuAccordsGame({ daily = false, onDone = () => {} }) {
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState('accord');
  const [userNotes, setUserNotes] = useState([]);
  const [locked, setLocked] = useState(false);
  const [pianoPret, setPianoPret] = useState(false);
  const [status, setStatus] = useState('Chargement du piano…');
  const [score, setScore] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoverSound, setHoverSound] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [dragIndex, setDragIndex] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  const [pulse, setPulse] = useState(0);   // incrémenté à chaque note jouée → relance le tracé
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
          setPianoPret(true);
          setStatus(daily
            ? 'Clique sur « Écouter la cible » pour lancer l\'épreuve du jour.'
            : 'Lance une cible pour commencer.');
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
        setStatus('Épreuve terminée. Une seule tentative dans le défi du jour.');
      } else {
        setLocked(false);
        setStatus('Tes notes justes en vert, tes erreurs en rouge — la cible en vert à côté.');
      }
    }, (d1 + 0.5) * 1000);
  }

  const canValidate = target && userNotes.length === target.length && !locked;
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
    ...(daily
      ? (target ? [] : [{ label: 'Écouter la cible', onClick: () => newRound(seeded('accords')), primaire: true, disabled: !pianoPret }])
      : [{ label: 'Générer une cible', onClick: () => newRound(), primaire: true, disabled: !pianoPret }]),
    { label: 'Réécouter la cible', onClick: () => target && (score !== null ? playTargetWithReveal(target, mode) : playNotes(target, mode)), disabled: !target },
    { label: 'Écouter ma proposition', onClick: () => userNotes.length && playNotes(userNotes, mode), disabled: !userNotes.length },
    { label: 'Effacer les notes', onClick: () => { setUserNotes([]); setStatus('Notes effacées.'); }, disabled: !userNotes.length || locked },
    { label: 'Valider', onClick: validate, primaire: true, disabled: !canValidate },
  ];

  return (
    <div style={{ background: 'var(--onyx)', border: '0.5px solid var(--filet)', borderRadius: 'var(--rayon-carte)', padding: 'var(--e6)', marginBottom: 'var(--e4)' }}>
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

      {score !== null && (
        <div style={{ marginTop: 'var(--e4)', paddingTop: 'var(--e4)', borderTop: '0.5px solid var(--filet)' }}>
          <div className="score-affiche" style={{
            color: +score >= 9.5 ? 'var(--jade)' : +score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {(+score).toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            Cible : <span style={{ color: 'var(--jade)' }}>{target?.map(n => n.name).join(' · ')}</span>
            {' — '}Toi : <span style={{ color: 'var(--or)' }}>{userNotes.map(n => n.name).join(' · ')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
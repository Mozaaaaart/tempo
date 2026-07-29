'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { searchTracks, trackDetails, freshPreviewUrl } from '@/utils/deezer';

/* ============================================================
   UTILITAIRES SEED — même défi pour tous dans le Quotidien,
   tirage aléatoire dans les versions libres (via setSeedSalt)
============================================================ */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TODAY = new Date().toISOString().slice(0, 10);
let SEED_SALT = '';
export function setSeedSalt(salt) { SEED_SALT = salt; }
export const seeded = (name) => mulberry32(hashStr(TODAY + '|' + SEED_SALT + '|' + name));

export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// "Get Lucky (feat. Pharrell) - Radio Edit" → "getlucky"
export const normTitle = (s) => norm(String(s).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').split(' - ')[0]);

/* ============================================================
   STYLES PARTAGÉS — jetons du design system
============================================================ */
export const panel = {
  background: 'var(--onyx)',
  border: '0.5px solid var(--filet)',
  borderRadius: 'var(--rayon-carte)',
  padding: 'var(--e6)',
  marginBottom: 'var(--e4)',
};

export const btn = (primaire, disabled) => ({
  fontFamily: 'var(--sans)',
  fontSize: 14,
  fontWeight: 500,
  padding: '9px 16px',
  borderRadius: 'var(--rayon-controle)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: primaire ? 'var(--or)' : 'transparent',
  color: primaire ? 'var(--noir)' : 'var(--ivoire)',
  border: primaire ? '1px solid var(--or)' : '0.5px solid var(--filet-fort)',
  opacity: disabled ? 0.4 : 1,
  transition: 'background var(--transition-courte), border-color var(--transition-courte), color var(--transition-courte)',
});

/* Survol des boutons en contour : bordure et texte passent en or */
export const survolOr = (ev) => {
  if (ev.currentTarget.disabled) return;
  ev.currentTarget.style.borderColor = 'var(--or)';
  ev.currentTarget.style.color = 'var(--or)';
};
export const sortieOr = (ev) => {
  if (ev.currentTarget.disabled) return;
  ev.currentTarget.style.borderColor = 'var(--filet-fort)';
  ev.currentTarget.style.color = 'var(--ivoire)';
};

/* ============================================================
   LECTEUR AUDIO — une seule piste à la fois, coupée au démontage.
   Un useState ne convient pas ici : la fonction de nettoyage du
   useEffect(..., []) capturerait la valeur initiale (null) et
   laisserait l'extrait tourner quand le jeu est relancé.
============================================================ */
export function useLecteurAudio() {
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  function arreter() {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }

  // Coupe le son au démontage (changement d'épreuve, relance, navigation)
  useEffect(() => arreter, []);

  function jouer(url, secondes, { depart = 0, onFin } = {}) {
    arreter();
    const a = new Audio(url);
    audioRef.current = a;
    if (depart) a.currentTime = depart;
    a.play().catch((e) => console.error('Lecture impossible:', e));
    if (secondes) {
      timerRef.current = setTimeout(() => {
        a.pause();
        onFin?.();
      }, secondes * 1000);
    }
    return a;
  }

  return { jouer, arreter };
}

export const inputStyle = {
  fontFamily: 'var(--sans)',
  fontSize: 14,
  background: 'var(--onyx-haut)',
  color: 'var(--ivoire)',
  border: '0.5px solid var(--filet-fort)',
  borderRadius: 'var(--rayon-controle)',
  padding: '9px 14px',
  minWidth: 220,
};

export const statusStyle = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--lin)',
  minHeight: '1.5em',
  marginTop: 'var(--e4)',
};

/* Score : jade réservé au parfait (≥ 9,5), carmin à l'échec (< 4) */
export function ScoreBox({ score, detail }) {
  if (score === null || score === undefined) return null;
  const n = Number(score);
  const couleur = n >= 9.5 ? 'var(--jade)' : n < 4 ? 'var(--carmin)' : 'var(--ivoire)';
  return (
    <div style={{ marginTop: 'var(--e4)', paddingTop: 'var(--e4)', borderTop: '0.5px solid var(--filet)' }}>
      <div className="score-affiche" style={{ color: couleur }}>
        {n.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
      </div>
      {detail && <p className="description" style={{ marginTop: 'var(--e2)' }}>{detail}</p>}
    </div>
  );
}

/* ============================================================
   AUTOCOMPLETE ARTISTES — liste scrollable, clavier ↑↓ + Entrée
============================================================ */
export function ArtistInput({ value, onChange, onSubmit, disabled, placeholder = 'Nom d\'artiste…' }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const q = norm(value);
  const matches = q
    ? ARTISTS.filter((a) => norm(a.nom).includes(q)).slice(0, 60)
    : [...ARTISTS].sort((a, b) => a.nom.localeCompare(b.nom));

  function pick(nom) {
    onChange(nom);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[highlight] && norm(value) !== norm(matches[highlight].nom)) {
        e.preventDefault();
        pick(matches[highlight].nom);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={inputStyle}
      />
      {open && !disabled && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          width: '100%', minWidth: 220, maxHeight: 200, overflowY: 'auto',
          background: 'var(--onyx)', border: '0.5px solid var(--or)', borderRadius: 'var(--rayon-controle)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
        }}>
          {matches.map((a, i) => (
            <div key={a.nom}
              onMouseDown={(e) => { e.preventDefault(); pick(a.nom); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                background: i === highlight ? 'var(--onyx-haut)' : 'transparent',
                color: i === highlight ? 'var(--or)' : 'var(--ivoire)',
              }}>
              {a.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= 1 · TROUVE L'ARTISTE ================= */
const MAX_TRIES = 6;
const CELL_DELAY = 0.25; // secondes entre chaque colonne révélée

export function JeuArtiste({ onDone }) {
  const target = useMemo(() => ARTISTS[Math.floor(seeded('artiste')() * ARTISTS.length)], []);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState(`Devine l'artiste du jour — ${MAX_TRIES} essais.`);
  const [score, setScore] = useState(null);
  const [animatingRow, setAnimatingRow] = useState(-1);

  const NB_COLS = 7;

  function guess() {
    if (done) return;
    const g = ARTISTS.find((a) => norm(a.nom) === norm(input));
    if (!g) { setStatus('Artiste absent de la base — utilise l\'autocomplétion.'); return; }
    if (guesses.some((x) => x.nom === g.nom)) { setStatus('Déjà essayé !'); return; }
    const next = [...guesses, g];
    setGuesses(next);
    setInput('');
    setAnimatingRow(next.length - 1);

    // Le verdict tombe APRÈS la révélation de la dernière colonne (suspense)
    const revealMs = (NB_COLS - 1) * CELL_DELAY * 1000 + 500;
    if (g.nom === target.nom) {
      setDone(true);
      setStatus('…');
      setTimeout(() => {
        const pts = [10, 8, 6, 4, 2, 1][next.length - 1];
        setScore(pts); onDone(pts);
        setStatus(`🎉 Trouvé en ${next.length} essai(s) !`);
      }, revealMs);
    } else if (next.length >= MAX_TRIES) {
      setDone(true);
      setStatus('…');
      setTimeout(() => {
        setScore(0); onDone(0);
        setStatus(`Perdu… c'était ${target.nom}.`);
      }, revealMs);
    } else {
      setStatus('…');
      setTimeout(() => {
        setStatus(`Raté — ${MAX_TRIES - next.length} essai(s) restant(s).`);
      }, revealMs);
    }
  }

  const cell = (val, ok, col, animate, arrow = '') => (
    <div style={{
      background: 'var(--onyx-haut)',
      color: ok ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)',
      border: `0.5px solid ${ok ? 'var(--jade)' : 'rgba(226, 75, 74, 0.3)'}`,
      borderRadius: 'var(--rayon-controle)', padding: '8px 6px', fontSize: 12, textAlign: 'center',
      ...(animate ? {
        animation: `cellFlip 0.5s ease-out both`,
        animationDelay: `${col * CELL_DELAY}s`,
      } : {}),
    }}>
      {val}{arrow}
    </div>
  );

  return (
    <div style={{ ...panel, overflow: 'visible' }}>
      <style>{`
        @keyframes cellFlip {
          0% { transform: rotateX(90deg); opacity: 0; background: var(--onyx-haut); color: transparent; }
          50% { transform: rotateX(90deg); opacity: 1; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
      `}</style>

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve l'artiste</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Vert = attribut exact. ▲/▼ = la cible a plus/moins (streams) ou est plus tardive/précoce (débuts).
      </p>

      <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', marginBottom: 'var(--e2)' }}>
        <ArtistInput value={input} onChange={setInput} onSubmit={guess} disabled={done} />
        <button onClick={guess} disabled={done} style={btn(true, done)}>Essayer</button>
      </div>

      {guesses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr', gap: 6, marginTop: 'var(--e3)', perspective: '600px' }}>
          {['Artiste', 'Genre', 'Pays', 'Débuts', 'Format', 'Sexe', 'Streams'].map((h) => (
            <div key={h} className="etiquette-mono" style={{ color: 'var(--cendre)', textAlign: 'center', fontSize: 9.5 }}>{h}</div>
          ))}
          {guesses.map((g, rowIdx) => {
            const animate = rowIdx === animatingRow;
            const arrowDebut = g.debut === target.debut ? '' : target.debut > g.debut ? ' ▲' : ' ▼';
            const arrowStreams = g.streams === target.streams ? '' : target.streams > g.streams ? ' ▲' : ' ▼';
            return (
              <RowFragment key={g.nom}>
                {cell(g.nom, g.nom === target.nom, 0, animate)}
                {cell(g.genre, g.genre === target.genre, 1, animate)}
                {cell(g.pays, g.pays === target.pays, 2, animate)}
                {cell(g.debut + 's', g.debut === target.debut, 3, animate, arrowDebut)}
                {cell(g.type, g.type === target.type, 4, animate)}
                {cell(g.sexe, g.sexe === target.sexe, 5, animate)}
                {cell('~' + g.streams + ' Mds', g.streams === target.streams, 6, animate, arrowStreams)}
              </RowFragment>
            );
          })}
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

function RowFragment({ children }) {
  return <>{children}</>;
}

/* ================= 2 · POCHETTE FLOUTÉE ================= */
const BLURS = [24, 16, 10, 5, 2];
const POINTS = [10, 8, 6, 4, 2];

export function JeuPochette({ onDone }) {
  const [track, setTrack] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState([]);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement de la pochette du jour…');
  const [score, setScore] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement de la pochette du jour…');
    try {
      const rng = seeded('pochette');
      const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
      const tracks = await searchTracks(artist.nom, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');
      const t = tracks[Math.floor(rng() * tracks.length)];
      setTrack({ ...t, artisteNom: artist.nom });
      setStatus(`De quel artiste est cette pochette ? ${BLURS.length} essais.`);
    } catch (err) {
      console.error('Erreur pochette:', err);
      setLoadError(true);
      setStatus('Impossible de charger la pochette.');
    }
  }

  function guess() {
    if (done || !track) return;
    const g = ARTISTS.find((a) => norm(a.nom) === norm(input));
    if (!g) { setStatus('Artiste absent de la base — utilise l\'autocomplétion.'); return; }
    if (tried.includes(g.nom)) { setStatus('Déjà essayé !'); return; }
    setInput('');
    setTried([...tried, g.nom]);
    if (norm(g.nom) === norm(track.artisteNom)) {
      const pts = POINTS[tries];
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Exact ! C'était ${track.artistName} — album « ${track.albumName} ».`);
    } else {
      const next = tries + 1;
      setTries(next);
      if (next >= BLURS.length) {
        setScore(0); setDone(true); onDone(0);
        setStatus(`Perdu… c'était ${track.artistName} — « ${track.albumName} ».`);
      } else {
        setStatus(`Raté — le flou diminue. ${BLURS.length - next} essai(s) restant(s).`);
      }
    }
  }

  const blur = done ? 0 : BLURS[Math.min(tries, BLURS.length - 1)];

  return (
    <div style={{ ...panel, overflow: 'visible' }}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Pochette floutée</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Le flou diminue à chaque mauvaise réponse. Trouve l'artiste de cet album.
      </p>

      {track && (
        <div style={{ width: 260, height: 260, overflow: 'hidden', borderRadius: 'var(--rayon-carte)', margin: '0 auto var(--e4)', border: '0.5px solid var(--filet)' }}>
          <img
            src={track.artworkUrl100}
            alt="Pochette mystère"
            width={260} height={260}
            style={{
              filter: `blur(${blur}px)`,
              transform: 'scale(1.15)',
              transition: 'filter 0.4s ease',
              display: 'block', width: '100%', height: '100%', objectFit: 'cover',
            }}
          />
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <ArtistInput value={input} onChange={setInput} onSubmit={guess} disabled={done || !track} />
          <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Essayer</button>
        </div>
      )}

      {tried.length > 0 && !done && (
        <p className="description" style={{ textAlign: 'center', marginTop: 'var(--e3)' }}>
          Déjà essayé : {tried.join(' · ')}
        </p>
      )}

      <p style={{ ...statusStyle, textAlign: 'center' }}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 3 · TROUVE LE BPM ================= */
const BPM_MIN = 60, BPM_MAX = 180;

export function JeuBPM({ onDone }) {
  const [track, setTrack] = useState(null);
  const [realBpm, setRealBpm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState(110);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const { jouer, arreter } = useLecteurAudio();

  useEffect(() => {
    import('tone').then(setTone);
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du morceau du jour…');
    try {
      const rng = seeded('bpm');
      // Essaie jusqu'à 5 artistes différents (certains n'ont aucun BPM chez Deezer)
      const artistStart = Math.floor(rng() * ARTISTS.length);
      let found = null;

      for (let a = 0; a < 5 && !found; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const d = await trackDetails(t.trackId);
          if (d.bpm && d.bpm > 0) { found = { ...t, bpm: Math.round(d.bpm) }; break; }
        }
      }

      if (!found) throw new Error('Aucun BPM trouvé après plusieurs artistes');

      setTrack(found);
      setRealBpm(found.bpm);
      setStatus('Écoute l\'extrait (7 s), règle le curseur, puis valide.');
    } catch (err) {
      console.error('Erreur BPM:', err);
      setLoadError(true);
      setStatus('Impossible de charger un morceau avec BPM.');
    }
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 7);
  }

  async function testMetro() {
    if (!tone) return;
    await tone.start();
    const synth = new tone.MembraneSynth({
      pitchDecay: 0.005, octaves: 3,
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    }).toDestination();
    synth.volume.value = 6;
    const t0 = tone.now() + 0.15;
    const spb = 60 / guess;
    for (let b = 0; b < 6; b++) {
      synth.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', t0 + b * spb);
    }
    setTimeout(() => synth.dispose(), (6 * spb + 1) * 1000);
  }

  function validate() {
    if (done || realBpm === null) return;
    setDone(true);
    arreter();
    const diff = Math.abs(guess - realBpm);
    const s = Math.round(Math.max(0, diff <= 2 ? 10 : 10 - (diff - 2) * 0.4) * 10) / 10;
    setScore(s);
    onDone(s);
    setStatus(diff === 0
      ? `Tempo exact. ${track.artistName} — ${track.trackName}.`
      : `${diff} BPM d'écart. ${track.artistName} — ${track.trackName}.`);
  }

  // Position d'une valeur sur la barre, en pourcentage
  const pos = (v) => ((Math.min(Math.max(v, BPM_MIN), BPM_MAX) - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
  const juste = done && Math.abs(guess - realBpm) <= 2;
  const couleurResultat = !done ? 'var(--or)' : juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.75)';

  return (
    <div style={panel}>
      <style>{`
        @keyframes reveleCible {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve le BPM</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Sept secondes d'écoute, puis règle le curseur. Le métronome est là pour comparer.
      </p>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            <button onClick={playClip} disabled={!track} style={btn(false, !track)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>Écouter l'extrait (7 s)</button>
            <button onClick={testMetro} disabled={!track} style={btn(false, !track)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>Tester mon métronome</button>
            <button onClick={validate} disabled={!track || done} style={btn(true, !track || done)}>Valider</button>
          </div>

          {/* Barre de réglage + repère de la bonne réponse après validation */}
          <div style={{ position: 'relative', marginTop: 'var(--e6)', paddingTop: done ? 'var(--e6)' : 0, transition: 'padding-top var(--transition-courte)' }}>

            {done && (
              <div style={{
                position: 'absolute', top: 0, left: `${pos(realBpm)}%`, bottom: -4,
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'reveleCible 320ms ease-out both',
                pointerEvents: 'none', zIndex: 3,
              }}>
                <div className="etiquette-mono" style={{
                  color: 'var(--noir)', background: 'var(--jade)',
                  padding: '3px 8px', borderRadius: 'var(--rayon-controle)',
                  whiteSpace: 'nowrap', fontWeight: 500,
                }}>
                  {realBpm} bpm
                </div>
                <div style={{
                  width: 2, flex: 1, background: 'var(--jade)',
                  boxShadow: '0 0 10px var(--jade)', marginTop: 4,
                }} />
              </div>
            )}

            {/* Piste dessinée : l'apparence native de l'input est masquée en CSS */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: done ? 'calc(var(--e6) + 8px)' : 8, height: 4,
              borderRadius: 2, background: 'var(--filet)', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pos(guess)}%`, borderRadius: 2,
                background: couleurResultat,
                boxShadow: done ? `0 0 14px ${couleurResultat}` : 'none',
                transition: 'background var(--transition-courte), box-shadow var(--transition-courte)',
              }} />
            </div>

            <input
              className="curseur-nu"
              type="range" min={BPM_MIN} max={BPM_MAX} value={guess}
              onChange={(e) => setGuess(+e.target.value)}
              disabled={done}
              style={{ width: '100%', position: 'relative', zIndex: 2 }}
            />
          </div>

          <div style={{ marginTop: 'var(--e3)', fontSize: 14 }}>
            Ta proposition :{' '}
            <span style={{ fontFamily: 'var(--mono)', color: couleurResultat, transition: 'color var(--transition-courte)' }}>
              {guess} BPM
            </span>
            {done && (
              <span style={{ marginLeft: 'var(--e3)', color: juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.9)' }}>
                {guess === realBpm ? 'tempo exact'
                  : guess < realBpm ? `${realBpm - guess} BPM trop lent`
                  : `${guess - realBpm} BPM trop rapide`}
              </span>
            )}
          </div>
        </>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 4 · UNE SECONDE DE PLUS ================= */
const SEC_DURATIONS = [1, 2, 4, 7, 11, 16];
const SEC_POINTS = [10, 8, 6, 4, 2, 1];

export function JeuSeconde({ onDone }) {
  const [track, setTrack] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState([]);
  const [artistFound, setArtistFound] = useState(false);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const artistFoundAtRef = useRef(0);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du morceau du jour…');
    try {
      const rng = seeded('seconde');
      const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
      let tracks = await searchTracks(artist.nom, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');
      // Ne garder que les morceaux populaires ; repli sur le top 8 de l'artiste
      const hits = tracks.filter((t) => t.rank >= 700000);
      tracks = hits.length >= 3 ? hits : [...tracks].sort((a, b) => b.rank - a.rank).slice(0, 8);
      const t = tracks[Math.floor(rng() * tracks.length)];
      setTrack(t);
      setStatus(`Devine le titre OU l'artiste. Tu entends ${SEC_DURATIONS[0]} seconde pour commencer.`);
    } catch (err) {
      console.error('Erreur seconde:', err);
      setLoadError(true);
      setStatus('Impossible de charger le morceau.');
    }
  }

  async function play() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const dur = done ? 30 : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)];
    setPlaying(true);
    jouer(url, dur, { onFin: () => setPlaying(false) });
  }

  function finish(pts, msg) {
    setScore(pts); setDone(true); onDone(pts);
    setStatus(msg);
  }

  function fail(passed) {
    const next = tries + 1;
    setTries(next);
    if (next >= SEC_DURATIONS.length) {
      const half = artistFound ? Math.max(1, Math.round(SEC_POINTS[artistFoundAtRef.current] / 2)) : 0;
      finish(half, `Perdu… c'était « ${track.trackName} » de ${track.artistName}.${half ? ` (+${half} pts pour l'artiste)` : ''}`);
    } else {
      setStatus(`${passed ? 'Passé' : 'Raté'} — tu entends maintenant ${SEC_DURATIONS[next]} secondes. ${SEC_DURATIONS.length - next} essai(s) restant(s).`);
    }
  }

  function guess() {
    if (done || !track || !input.trim()) return;
    const g = input.trim();
    setInput('');
    setTried([...tried, g]);
    const a = normTitle(g);
    const titleOk = a === normTitle(track.trackName)
      || (a.length > 3 && normTitle(track.trackName).includes(a))
      || lev(a, normTitle(track.trackName)) <= 2;
    const artistOk = norm(g) === norm(track.artistName) || lev(norm(g), norm(track.artistName)) <= 2;

    if (titleOk) {
      finish(SEC_POINTS[tries], `🎉 Exact ! C'était « ${track.trackName} » de ${track.artistName}.`);
    } else if (artistOk && !artistFound) {
      setArtistFound(true);
      artistFoundAtRef.current = tries;
      setStatus(`👍 Artiste trouvé : ${track.artistName} ! Maintenant le titre pour le score plein — ou continue de rater, tu garderas la moitié.`);
    } else if (artistOk && artistFound) {
      setStatus('Tu as déjà trouvé l\'artiste — cherche le titre maintenant !');
    } else {
      fail(false);
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Une seconde de plus</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Devine le <strong>titre</strong> (score plein) ou l'<strong>artiste</strong> (moitié des points).
        Chaque erreur allonge l'extrait : {SEC_DURATIONS.join(' → ')} s.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SEC_DURATIONS.length}, 1fr)`, gap: 6, marginBottom: 'var(--e4)' }}>
        {SEC_DURATIONS.map((d, i) => (
          <div key={d} style={{
            height: 6, borderRadius: 3,
            background: i <= tries || done ? 'var(--or)' : 'var(--onyx-haut)',
            border: '0.5px solid var(--filet)',
            transition: 'background var(--transition-courte)',
          }} title={`${d} s`} />
        ))}
      </div>

      {artistFound && !done && (
        <p style={{ color: 'var(--jade)', fontSize: 13, marginBottom: 'var(--e3)' }}>
          Artiste trouvé : {track.artistName}
        </p>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', marginBottom: 'var(--e3)' }}>
            <button onClick={play} disabled={!track || playing} style={btn(false, !track || playing)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>
              Écouter ({done ? '30' : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)]} s)
            </button>
            <button onClick={() => fail(true)} disabled={!track || done || tries >= SEC_DURATIONS.length - 1}
              style={btn(false, !track || done || tries >= SEC_DURATIONS.length - 1)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>
              Plus long
            </button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guess()}
              placeholder={artistFound ? 'Titre du morceau…' : 'Titre ou artiste…'}
              disabled={done || !track} style={inputStyle} />
            <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
          </div>
        </>
      )}

      {tried.length > 0 && !done && (
        <p className="description" style={{ marginTop: 'var(--e3)' }}>
          Déjà essayé : {tried.join(' · ')}
        </p>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 5 · TROUVE L'INSTRUMENT ================= */
const FAMILLES = {
  'Piano': 'Claviers', 'Orgue': 'Claviers', 'Harmonium': 'Claviers',
  'Violon': 'Cordes frottées', 'Violoncelle': 'Cordes frottées', 'Contrebasse': 'Cordes frottées',
  'Guitare acoustique': 'Cordes pincées', 'Guitare électrique': 'Cordes pincées',
  'Guitare classique': 'Cordes pincées', 'Harpe': 'Cordes pincées', 'Basse': 'Cordes pincées',
  'Flûte': 'Bois', 'Clarinette': 'Bois', 'Saxophone': 'Bois', 'Basson': 'Bois',
  'Trompette': 'Cuivres', 'Trombone': 'Cuivres', 'Tuba': 'Cuivres', 'Cor': 'Cuivres',
  'Xylophone': 'Percussions', 'Boîte à rythmes': 'Percussions',
};
const INSTRUMENTS = Object.keys(FAMILLES);

const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const SAMPLES = {
  'Piano':              { dir: 'piano',           candidates: ['C4', 'A4', 'C5', 'E4'], shift: 0 },
  'Orgue':              { dir: 'organ',           candidates: ['C4', 'A4', 'C5', 'F4'], shift: 0 },
  'Harmonium':          { dir: 'harmonium',       candidates: ['C4', 'A4', 'C5', 'D4'], shift: 0 },
  'Violon':             { dir: 'violin',          candidates: ['C4', 'A4', 'C5', 'G4', 'E4'], shift: 0 },
  'Violoncelle':        { dir: 'cello',           candidates: ['C3', 'A3', 'C4', 'E3', 'G3'], shift: -12 },
  'Contrebasse':        { dir: 'contrabass',      candidates: ['C2', 'A2', 'E2', 'G2', 'C3'], shift: -24 },
  'Guitare acoustique': { dir: 'guitar-acoustic', candidates: ['C4', 'E3', 'A3', 'G3'], shift: -12 },
  'Guitare électrique': { dir: 'guitar-electric', candidates: ['C4', 'E3', 'A3', 'D4'], shift: -12 },
  'Guitare classique':  { dir: 'guitar-nylon',    candidates: ['C4', 'E3', 'A3', 'G3'], shift: -12 },
  'Harpe':              { dir: 'harp',            candidates: ['C4', 'A4', 'C5', 'E4', 'G4'], shift: 0 },
  'Basse':              { dir: 'bass-electric',   candidates: ['E2', 'G2', 'A2', 'C2'], shift: -24 },
  'Flûte':              { dir: 'flute',           candidates: ['C4', 'C5', 'A4', 'E4'], shift: 12 },
  'Clarinette':         { dir: 'clarinet',        candidates: ['D4', 'F4', 'A4', 'D5'], shift: 0 },
  'Saxophone':          { dir: 'saxophone',       candidates: ['C4', 'A4', 'E4', 'G4', 'D4'], shift: 0 },
  'Basson':             { dir: 'bassoon',         candidates: ['C3', 'A2', 'E3', 'G2'], shift: -12 },
  'Trompette':          { dir: 'trumpet',         candidates: ['C4', 'A4', 'F4', 'G4', 'D5'], shift: 0 },
  'Trombone':           { dir: 'trombone',        candidates: ['C3', 'A2', 'F3', 'D3'], shift: -12 },
  'Tuba':               { dir: 'tuba',            candidates: ['C2', 'A2', 'F2', 'D2'], shift: -24 },
  'Cor':                { dir: 'french-horn',     candidates: ['C3', 'A2', 'F3', 'D3'], shift: -12 },
  'Xylophone':          { dir: 'xylophone',       candidates: ['C5', 'G4', 'C6', 'A4'], shift: 12 },
};

// 5 mélodies classiques (domaine public) — le timbre reste le seul mystère
const MELODIES_CLASSIQUES = [
  { nom: 'Ode à la joie (Beethoven)', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'], gap: 0.35 },
  { nom: 'La Lettre à Élise (Beethoven)', notes: ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4'], gap: 0.3 },
  { nom: 'Petite musique de nuit (Mozart)', notes: ['G4', 'D4', 'G4', 'D4', 'G4', 'D4', 'G4', 'B4', 'D5'], gap: 0.28 },
  { nom: 'Dans l\'antre du roi de la montagne (Grieg)', notes: ['B3', 'C#4', 'D4', 'E4', 'F#4', 'D4', 'F#4'], gap: 0.32 },
  { nom: 'Frère Jacques (traditionnel)', notes: ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4'], gap: 0.35 },
];

export function JeuInstrument({ onDone }) {
  const target = useMemo(() => INSTRUMENTS[Math.floor(seeded('instrument')() * INSTRUMENTS.length)], []);
  const melodie = useMemo(() => MELODIES_CLASSIQUES[Math.floor(seeded('instrumentMelodie')() * MELODIES_CLASSIQUES.length)], []);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState(null);
  const [loadingSound, setLoadingSound] = useState(false);
  const [status, setStatus] = useState('Écoute le timbre mystère, puis choisis l\'instrument.');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const samplerRef = useRef(null);

  useEffect(() => {
    import('tone').then(setTone);
    return () => samplerRef.current?.dispose();
  }, []);

  // Ne garde que les échantillons réellement présents sur le serveur
  async function existingUrls(dir, candidates) {
    const urls = {};
    for (const note of candidates) {
      try {
        const res = await fetch(`${SAMPLE_BASE}${dir}/${note}.mp3`, { method: 'HEAD' });
        if (res.ok) urls[note] = `${note}.mp3`;
        if (Object.keys(urls).length >= 3) break;
      } catch { /* réseau : on tente le suivant */ }
    }
    if (!Object.keys(urls).length) urls[candidates[0]] = `${candidates[0]}.mp3`;
    return urls;
  }

  async function play() {
    if (!tone) return;
    await tone.start();

    // Cas particulier : la boîte à rythmes est électronique par nature → synthèse
    if (target === 'Boîte à rythmes') {
      const t0 = tone.now() + 0.15;
      const kick = new tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 2,
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination();
      const clap = new tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      clap.volume.value = -4;
      [0, 0.5, 1, 1.5].forEach((d) => kick.triggerAttackRelease('C2', '16n', t0 + d));
      [0.25, 0.75, 1.25, 1.75].forEach((d) => clap.triggerAttackRelease('16n', t0 + d));
      setTimeout(() => { kick.dispose(); clap.dispose(); }, 3500);
      return;
    }

    if (!samplerRef.current) {
      setLoadingSound(true);
      const cfg = SAMPLES[target];
      try {
        const urls = await existingUrls(cfg.dir, cfg.candidates);
        await new Promise((resolve, reject) => {
          const s = new tone.Sampler({
            urls,
            baseUrl: SAMPLE_BASE + cfg.dir + '/',
            release: 1,
            onload: () => { samplerRef.current = s; resolve(); },
            onerror: (e) => reject(e),
          }).toDestination();
        });
      } catch (e) {
        console.error('Échec chargement samples:', e);
        setLoadingSound(false);
        setStatus('Impossible de charger ce son — réessaie.');
        return;
      }
      setLoadingSound(false);
    }

    const cfg = SAMPLES[target];
    const t0 = tone.now() + 0.15;
    melodie.notes.forEach((n, i) => {
      const note = tone.Frequency(n).transpose(cfg.shift);
      samplerRef.current.triggerAttackRelease(note, '4n', t0 + i * melodie.gap);
    });
  }

  function pick(n) {
    if (done) return;
    setDone(true);
    setPicked(n);
    let s = 0, msg = 'Raté !';
    if (n === target) { s = 10; msg = '🎉 Exact !'; }
    else if (FAMILLES[n] === FAMILLES[target]) { s = 5; msg = `Presque — bonne famille (${FAMILLES[target]}) !`; }
    setScore(s);
    onDone(s);
    setStatus(`${msg} C'était : ${target}.`);
  }

  // Boutons groupés par famille pour rester lisibles
  const parFamille = INSTRUMENTS.reduce((acc, n) => {
    (acc[FAMILLES[n]] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve l'instrument</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Un instrument mystère joue « {melodie.nom} » — vrai son acoustique.
        Bonne famille mais mauvais instrument = 5 points.
      </p>

      <button onClick={play} disabled={!tone || loadingSound}
        style={{ ...btn(true, !tone || loadingSound), marginBottom: 'var(--e4)' }}>
        {loadingSound ? 'Chargement du son…' : 'Écouter le timbre'}
      </button>

      {Object.entries(parFamille).map(([fam, list]) => (
        <div key={fam} style={{ marginBottom: 'var(--e3)' }}>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e1)' }}>
            {fam}
          </div>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            {list.map((n) => (
              <button key={n} onClick={() => pick(n)} disabled={done}
                style={{
                  ...btn(false, done),
                  padding: '8px 13px', fontSize: 13,
                  ...(done && n === target
                    ? { background: 'var(--onyx-haut)', color: 'var(--jade)', border: '1px solid var(--jade)', opacity: 1 }
                    : {}),
                  ...(done && n === picked && n !== target
                    ? { background: 'var(--onyx-haut)', color: 'rgba(226, 75, 74, 0.9)', border: '1px solid rgba(226, 75, 74, 0.6)', opacity: 1 }
                    : {}),
                }}
                onMouseEnter={(ev) => { if (!done) survolOr(ev); }}
                onMouseLeave={(ev) => { if (!done) sortieOr(ev); }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 6 · PAROLES MYSTÈRES ================= */
const PAROLES_POINTS = [10, 5, 2];
const PAROLES_LINES = 4; // nb de lignes affichées — rester court (droit de citation)

export function JeuParoles({ onDone }) {
  const [track, setTrack] = useState(null);
  const [excerpt, setExcerpt] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement des paroles du jour…');
  const [score, setScore] = useState(null);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement des paroles du jour…');
    try {
      const rng = seeded('paroles');
      const artistStart = Math.floor(rng() * ARTISTS.length);

      // Essaie jusqu'à 5 artistes (Lyrics.ovh ne couvre pas tout le monde)
      for (let a = 0; a < 5; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        let tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;
        const hits = tracks.filter((t) => t.rank >= 700000);
        tracks = hits.length >= 3 ? hits : [...tracks].sort((x, y) => y.rank - x.rank).slice(0, 8);

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const res = await fetch(`/api/lyrics?${new URLSearchParams({ artist: t.artistName, title: normTitle(t.trackName) })}`);
          if (!res.ok) continue;
          const data = await res.json();
          const ex = extractExcerpt(data.lyrics, t.trackName);
          if (ex) {
            setTrack(t);
            setExcerpt(ex);
            setStatus('De quel morceau viennent ces paroles ? 3 essais (10 → 5 → 2 pts).');
            return;
          }
        }
      }
      throw new Error('Aucune parole disponible après plusieurs artistes');
    } catch (err) {
      console.error('Erreur paroles:', err);
      setLoadError(true);
      setStatus('Impossible de charger des paroles aujourd\'hui.');
    }
  }

  // Extrait PAROLES_LINES lignes consécutives qui ne contiennent PAS le titre
  function extractExcerpt(lyrics, title) {
    if (!lyrics) return null;
    const titleWords = normTitle(title);
    const lines = lyrics.split('\n').map((l) => l.trim())
      .filter((l) => l.length > 15 && l.length < 80)
      .filter((l) => !norm(l).includes(titleWords));
    if (lines.length < PAROLES_LINES) return null;
    const start = Math.min(Math.floor(lines.length / 3), lines.length - PAROLES_LINES);
    return lines.slice(start, start + PAROLES_LINES).join('\n');
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 10);
  }

  function guess() {
    if (done || !track || !input.trim()) return;
    const g = normTitle(input);
    const b = normTitle(track.trackName);
    setInput('');
    const ok = g === b || (g.length > 3 && b.includes(g)) || lev(g, b) <= 2;
    if (ok) {
      const pts = PAROLES_POINTS[tries];
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Exact ! C'était « ${track.trackName} » de ${track.artistName}.`);
    } else if (tries >= PAROLES_POINTS.length - 1) {
      setScore(0); setDone(true); onDone(0);
      setStatus(`Perdu… c'était « ${track.trackName} » de ${track.artistName}.`);
    } else {
      const next = tries + 1;
      setTries(next);
      if (next === 1) {
        setStatus(`Raté — 2ᵉ essai (5 pts max). Indice : c'est un morceau de ${track.artistName}.`);
      } else {
        setStatus('Raté — dernier essai (2 pts max). Écoute l\'extrait pour t\'aider !');
      }
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Paroles mystères</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Retrouve le titre à partir des paroles. Essai 2 : l'artiste est donné. Essai 3 : l'extrait audio se débloque.
      </p>

      {excerpt && (
        <blockquote style={{
          borderLeft: '1px solid var(--or)', background: 'var(--onyx-haut)', borderRadius: 0,
          padding: 'var(--e3) var(--e5)', whiteSpace: 'pre-line',
          marginBottom: 'var(--e4)', color: 'var(--ivoire)',
        }}>
          « {excerpt} »
        </blockquote>
      )}

      {tries >= 1 && !done && (
        <p style={{ color: 'var(--jade)', fontSize: 13, marginBottom: 'var(--e3)' }}>
          Artiste : {track?.artistName}
        </p>
      )}

      {(tries >= 2 || done) && track && (
        <div style={{ marginBottom: 'var(--e4)' }}>
          <button onClick={playClip} style={btn(false, false)}
            onMouseEnter={survolOr} onMouseLeave={sortieOr}>
            Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
            placeholder="Titre du morceau…" disabled={done || !track} style={inputStyle} />
          <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 7 · COMPLÈTE LE REFRAIN ================= */
export function JeuRefrain({ onDone }) {
  const [track, setTrack] = useState(null);
  const [context, setContext] = useState([]);
  const [answer, setAnswer] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du refrain du jour…');
  const [score, setScore] = useState(null);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du refrain du jour…');
    try {
      const rng = seeded('refrain');
      const artistStart = Math.floor(rng() * ARTISTS.length);

      for (let a = 0; a < 5; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const res = await fetch(`/api/lyrics?${new URLSearchParams({ artist: t.artistName, title: normTitle(t.trackName) })}`);
          if (!res.ok) continue;
          const data = await res.json();
          const seq = extractSequence(data.lyrics, rng);
          if (seq) {
            setTrack(t);
            setContext(seq.context);
            setAnswer(seq.answer);
            setStatus(`« ${t.trackName} » de ${t.artistName} — tape la ligne qui suit. 2 essais (10 puis 5 pts).`);
            return;
          }
        }
      }
      throw new Error('Aucune parole exploitable après plusieurs artistes');
    } catch (err) {
      console.error('Erreur refrain:', err);
      setLoadError(true);
      setStatus('Impossible de charger un refrain aujourd\'hui.');
    }
  }

  // Cherche 4 lignes consécutives valides : 3 de contexte + 1 à deviner
  function extractSequence(lyrics, rng) {
    if (!lyrics) return null;
    const lines = lyrics.split('\n').map((l) => l.trim());
    const validAt = (i) => lines[i] && lines[i].length > 10 && lines[i].length < 80;
    const candidates = [];
    for (let i = 0; i + 3 < lines.length; i++) {
      if (validAt(i) && validAt(i + 1) && validAt(i + 2) && validAt(i + 3)) {
        candidates.push(i);
      }
    }
    if (!candidates.length) return null;
    const i = candidates[Math.floor(rng() * candidates.length)];
    return { context: [lines[i], lines[i + 1], lines[i + 2]], answer: lines[i + 3] };
  }

  // Indice du 2e essai : la moitié des mots révélée
  function hint() {
    const words = answer.split(/\s+/);
    return words.map((w, i) => (i < Math.ceil(words.length / 2) ? w : '_'.repeat(Math.max(3, w.length)))).join(' ');
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 10);
  }

  function guess() {
    if (done || !answer || !input.trim()) return;
    const a = norm(input);
    const b = norm(answer);
    setInput('');
    const tolerance = Math.max(2, Math.floor(b.length / 5)); // ~20% d'erreurs tolérées
    const ok = a === b || lev(a, b) <= tolerance;
    if (ok) {
      const pts = tries === 0 ? 10 : 5;
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Exact ! La ligne était : « ${answer} »`);
    } else if (tries >= 1) {
      setScore(0); setDone(true); onDone(0);
      setStatus(`Perdu… la ligne était : « ${answer} »`);
    } else {
      setTries(1);
      setStatus('Raté — dernier essai (5 pts max) : moitié des mots révélée + extrait audio débloqué.');
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Complète le refrain</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Trois lignes du morceau te sont données — tape la ligne suivante. Fautes et accents tolérés.
      </p>

      {context.length > 0 && (
        <blockquote style={{
          borderLeft: '1px solid var(--or)', background: 'var(--onyx-haut)', borderRadius: 0,
          padding: 'var(--e3) var(--e5)', whiteSpace: 'pre-line',
          marginBottom: 'var(--e4)', color: 'var(--ivoire)',
        }}>
          {context.join('\n')}
          {'\n'}
          <span style={{ color: 'var(--or)' }}>{done ? answer : tries >= 1 ? hint() : '␣␣␣␣␣␣␣␣␣␣␣␣ ?'}</span>
        </blockquote>
      )}

      {(tries >= 1 || done) && track && (
        <div style={{ marginBottom: 'var(--e4)' }}>
          <button onClick={playClip} style={btn(false, false)}
            onMouseEnter={survolOr} onMouseLeave={sortieOr}>
            Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
            placeholder="La ligne suivante…" disabled={done || !answer}
            style={{ ...inputStyle, minWidth: 320 }} />
          <button onClick={guess} disabled={done || !answer} style={btn(true, done || !answer)}>Valider</button>
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}
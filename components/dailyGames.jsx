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
   STYLES PARTAGÉS
============================================================ */
export const panel = { background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24, marginBottom: 16 };
export const btn = (primary, disabled) => ({
  padding: '10px 16px', borderRadius: 10, border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: primary ? '#f2c14e' : '#1c2032',
  color: primary ? '#1a1405' : '#e9e7de',
  opacity: disabled ? 0.45 : 1, fontWeight: 600,
});
export const inputStyle = {
  background: '#1c2032', border: '1px solid #2a2f45', color: '#e9e7de',
  borderRadius: 10, padding: '10px 14px', minWidth: 220, fontSize: '0.95rem',
};
export const statusStyle = { color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 14 };

export function ScoreBox({ score }) {
  if (score === null) return null;
  return (
    <div style={{ marginTop: 12, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
      <div style={{
        fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700,
        color: score >= 8 ? '#4ade80' : score >= 4 ? '#f2c14e' : '#f87171',
      }}>
        {score} / 10
      </div>
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
          position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4,
          width: '100%', minWidth: 220, maxHeight: 240, overflowY: 'auto',
          background: '#1c2032', border: '1px solid #2a2f45', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {matches.map((a, i) => (
            <div key={a.nom}
              onMouseDown={(e) => { e.preventDefault(); pick(a.nom); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: '0.9rem',
                background: i === highlight ? '#26221a' : 'transparent',
                color: i === highlight ? '#f2c14e' : '#e9e7de',
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
  const [animatingRow, setAnimatingRow] = useState(-1); // index de la ligne en cours d'animation

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
      setDone(true); // bloque l'input tout de suite
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

  // Une cellule : si sa ligne est en cours d'animation, elle se retourne avec un délai selon sa colonne
  const cell = (val, ok, col, animate, arrow = '') => (
    <div style={{
      background: ok ? '#14432b' : '#3a1d22',
      color: ok ? '#4ade80' : '#f87171',
      borderRadius: 8, padding: '8px 6px', fontSize: '0.82rem', textAlign: 'center',
      ...(animate ? {
        animation: `cellFlip 0.5s ease-out both`,
        animationDelay: `${col * CELL_DELAY}s`,
      } : {}),
    }}>
      {val}{arrow}
    </div>
  );

  return (
    <div style={panel}>
      <style>{`
        @keyframes cellFlip {
          0% { transform: rotateX(90deg); opacity: 0; background: #1c2032; color: transparent; }
          50% { transform: rotateX(90deg); opacity: 1; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
      `}</style>

      <h3 style={{ marginBottom: 4 }}>Trouve l'artiste</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Vert = attribut exact. ▲/▼ = la cible a plus/moins (streams) ou est plus tardive/précoce (débuts).
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <ArtistInput value={input} onChange={setInput} onSubmit={guess} disabled={done} />
        <button onClick={guess} disabled={done} style={btn(true, done)}>Essayer</button>
      </div>

      {guesses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr', gap: 6, marginTop: 12, perspective: '600px' }}>
          {['Artiste', 'Genre', 'Pays', 'Débuts', 'Format', 'Sexe', 'Streams'].map((h) => (
            <div key={h} style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.66rem', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>{h}</div>
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
    <div style={panel}>
      <h3 style={{ marginBottom: 4 }}>Pochette floutée</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Le flou diminue à chaque mauvaise réponse. Trouve l'artiste de cet album.
      </p>

      {track && (
        <div style={{ width: 260, height: 260, overflow: 'hidden', borderRadius: 12, margin: '0 auto 16px', border: '1px solid #2a2f45' }}>
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <ArtistInput value={input} onChange={setInput} onSubmit={guess} disabled={done || !track} />
          <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Essayer</button>
        </div>
      )}

      {tried.length > 0 && !done && (
        <p style={{ color: '#9aa0b4', fontSize: '0.82rem', textAlign: 'center', marginTop: 10 }}>
          Déjà essayé : {tried.join(' · ')}
        </p>
      )}

      <p style={{ ...statusStyle, textAlign: 'center' }}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 3 · TROUVE LE BPM ================= */
export function JeuBPM({ onDone }) {
  const [track, setTrack] = useState(null);
  const [realBpm, setRealBpm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState(110);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const [audio, setAudio] = useState(null);
  const [tone, setTone] = useState(null);

  useEffect(() => {
    import('tone').then(setTone);
    load();
    return () => audio?.pause();
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
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length]; // pas de 17 pour varier
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
    audio?.pause();
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const a = new Audio(url);
    a.play();
    setAudio(a);
    setTimeout(() => a.pause(), 7000);
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
    audio?.pause();
    const diff = Math.abs(guess - realBpm);
    const s = Math.round(Math.max(0, diff <= 2 ? 10 : 10 - (diff - 2) * 0.4) * 10) / 10;
    setScore(s);
    onDone(s);
    setStatus(`C'était ${realBpm} BPM (${track.artistName} — ${track.trackName}) · écart de ${diff}.`);
  }

  return (
    <div style={panel}>
      <h3 style={{ marginBottom: 4 }}>Trouve le BPM</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        7 secondes d'écoute, puis règle le curseur. Tu peux tester ton métronome autant que tu veux avant de valider.
      </p>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={playClip} disabled={!track} style={btn(false, !track)}>🔊 Écouter l'extrait (7 s)</button>
            <button onClick={testMetro} disabled={!track} style={btn(false, !track)}>Tester mon métronome</button>
            <button onClick={validate} disabled={!track || done} style={btn(true, !track || done)}>Valider</button>
          </div>

          <input
            type="range" min={60} max={180} value={guess}
            onChange={(e) => setGuess(+e.target.value)}
            disabled={done}
            style={{ width: '100%', accentColor: '#f2c14e', margin: '18px 0 6px' }}
          />
          <div style={{ fontSize: '1.05rem' }}>
            Ma proposition : <strong style={{ color: '#f2c14e', fontFamily: 'monospace' }}>{guess}</strong> BPM
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
  const [audio, setAudio] = useState(null);
  const artistFoundAtRef = useRef(0);

  useEffect(() => {
    load();
    return () => audio?.pause();
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
    audio?.pause();
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const a = new Audio(url);
    a.currentTime = 0;
    a.play();
    setAudio(a);
    setPlaying(true);
    const dur = done ? 30 : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)];
    setTimeout(() => { a.pause(); setPlaying(false); }, dur * 1000);
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
      <h3 style={{ marginBottom: 4 }}>Une seconde de plus</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Devine le <strong>titre</strong> (score plein) ou l'<strong>artiste</strong> (moitié des points).
        Chaque erreur allonge l'extrait : {SEC_DURATIONS.join(' → ')} s.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SEC_DURATIONS.length}, 1fr)`, gap: 6, marginBottom: 14 }}>
        {SEC_DURATIONS.map((d, i) => (
          <div key={d} style={{
            height: 8, borderRadius: 4,
            background: i <= tries || done ? '#f2c14e' : '#1c2032',
            border: '1px solid #2a2f45',
          }} title={`${d} s`} />
        ))}
      </div>

      {artistFound && !done && (
        <p style={{ color: '#4ade80', fontSize: '0.9rem', marginBottom: 10 }}>
          ✓ Artiste : {track.artistName}
        </p>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={play} disabled={!track || playing} style={btn(false, !track || playing)}>
              🔊 Écouter ({done ? '30' : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)]} s)
            </button>
            <button onClick={() => fail(true)} disabled={!track || done || tries >= SEC_DURATIONS.length - 1}
              style={btn(false, !track || done || tries >= SEC_DURATIONS.length - 1)}>
              ➕ Plus long
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guess()}
              placeholder={artistFound ? 'Titre du morceau…' : 'Titre ou artiste…'}
              disabled={done || !track} style={inputStyle} />
            <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
          </div>
        </>
      )}

      {tried.length > 0 && !done && (
        <p style={{ color: '#9aa0b4', fontSize: '0.82rem', marginTop: 10 }}>
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
// candidates = notes testées à la volée ; on ne garde que les fichiers réellement présents
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
    // Si la vérification échoue partout (CORS, hors-ligne), on tente quand même la 1re note
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
      <h3 style={{ marginBottom: 4 }}>Trouve l'instrument</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Un instrument mystère joue « {melodie.nom} » — vrai son acoustique.
        Bonne famille mais mauvais instrument = 5 points.
      </p>

      <button onClick={play} disabled={!tone || loadingSound} style={{ ...btn(false, !tone || loadingSound), marginBottom: 14 }}>
        {loadingSound ? 'Chargement du son…' : '🔊 Écouter le timbre'}
      </button>

      {Object.entries(parFamille).map(([fam, list]) => (
        <div key={fam} style={{ marginBottom: 10 }}>
          <div style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            {fam}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {list.map((n) => (
              <button key={n} onClick={() => pick(n)} disabled={done}
                style={{
                  ...btn(false, done),
                  padding: '8px 13px', fontSize: '0.88rem',
                  ...(done && n === target ? { background: '#14432b', color: '#4ade80', opacity: 1 } : {}),
                  ...(done && n === picked && n !== target ? { background: '#3a1d22', color: '#f87171', opacity: 1 } : {}),
                }}>
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
const PAROLES_LINES = 4;       // nb de lignes affichées — rester court (droit de citation)
const PAROLES_MIN_RANK = 800000; // seuil de popularité Deezer (0-1M) : on ne garde que les hits

export function JeuParoles({ onDone }) {
  const [track, setTrack] = useState(null);
  const [excerpt, setExcerpt] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [audio, setAudio] = useState(null);
  const [status, setStatus] = useState('Chargement des paroles du jour…');
  const [score, setScore] = useState(null);

  useEffect(() => {
    load();
    return () => audio?.pause();
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
        // Ne garder que les morceaux très connus ; repli sur le top 8 de l'artiste
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
    audio?.pause();
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const a = new Audio(url);
    a.play();
    setAudio(a);
    setTimeout(() => a.pause(), 10000);
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
      <h3 style={{ marginBottom: 4 }}>Paroles mystères</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Retrouve le titre à partir des paroles. Essai 2 : l'artiste est donné. Essai 3 : l'extrait audio se débloque.
      </p>

      {excerpt && (
        <blockquote style={{
          borderLeft: '3px solid #8b7cf6', background: '#1c2032', borderRadius: 8,
          padding: '12px 18px', fontStyle: 'italic', whiteSpace: 'pre-line',
          marginBottom: 14, color: '#e9e7de',
        }}>
          « {excerpt} »
        </blockquote>
      )}

      {tries >= 1 && !done && (
        <p style={{ color: '#4ade80', fontSize: '0.9rem', marginBottom: 10 }}>
          ✓ Artiste : {track?.artistName}
        </p>
      )}

      {(tries >= 2 || done) && track && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={playClip} style={btn(false, false)}>
            🔊 Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    load();
    return () => audio?.pause();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du refrain du jour…');
    try {
      const rng = seeded('refrain');
      const artistStart = Math.floor(rng() * ARTISTS.length);

      // Essaie jusqu'à 5 artistes (Lyrics.ovh ne couvre pas tout le monde)
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
    audio?.pause();
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const a = new Audio(url);
    a.play();
    setAudio(a);
    setTimeout(() => a.pause(), 10000);
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
      <h3 style={{ marginBottom: 4 }}>Complète le refrain</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Trois lignes du morceau te sont données — tape la ligne suivante. Fautes et accents tolérés.
      </p>

      {context.length > 0 && (
        <blockquote style={{
          borderLeft: '3px solid #8b7cf6', background: '#1c2032', borderRadius: 8,
          padding: '12px 18px', fontStyle: 'italic', whiteSpace: 'pre-line',
          marginBottom: 14, color: '#e9e7de',
        }}>
          {context.join('\n')}
          {'\n'}
          <span style={{ color: '#f2c14e' }}>{done ? answer : tries >= 1 ? hint() : '␣␣␣␣␣␣␣␣␣␣␣␣ ?'}</span>
        </blockquote>
      )}

      {(tries >= 1 || done) && track && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={playClip} style={btn(false, false)}>
            🔊 Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
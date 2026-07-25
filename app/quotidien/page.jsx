'use client';
import { useEffect, useMemo, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { searchTracks, trackDetails } from '@/utils/deezer';

/* ---------- utilitaires seed : même défi pour tous, chaque jour ---------- */
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
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const TODAY = new Date().toISOString().slice(0, 10);
const seeded = (name) => mulberry32(hashStr(TODAY + '|' + name));

/* ---------- styles partagés ---------- */
const panel = { background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24, marginBottom: 16 };
const btn = (primary, disabled) => ({
  padding: '10px 16px', borderRadius: 10, border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: primary ? '#f2c14e' : '#1c2032',
  color: primary ? '#1a1405' : '#e9e7de',
  opacity: disabled ? 0.45 : 1, fontWeight: 600,
});
const inputStyle = {
  background: '#1c2032', border: '1px solid #2a2f45', color: '#e9e7de',
  borderRadius: 10, padding: '10px 14px', minWidth: 220, fontSize: '0.95rem',
};
const statusStyle = { color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 14 };

function ScoreBox({ score }) {
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

/* ================= PAGE ================= */
export default function Quotidien() {
  const [scores, setScores] = useState({ artiste: null, pochette: null, bpm: null });
  const report = (jeu) => (s) => setScores((prev) => ({ ...prev, [jeu]: s }));

  const total = Object.values(scores).filter((v) => v !== null).reduce((a, b) => a + b, 0);
  const max = Object.keys(scores).length * 10;

  function share() {
    const emo = ['artiste', 'pochette', 'bpm'].map((k) => {
      const s = scores[k];
      if (s === null) return '⬜';
      return s >= 8 ? '🟩' : s >= 4 ? '🟨' : '🟥';
    }).join('');
    const txt = `tempo. quotidien ${TODAY} — ${total}/${max}\n${emo}`;
    navigator.clipboard?.writeText(txt);
    alert('Copié dans le presse-papiers :\n\n' + txt);
  }

  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 4px' }}>Le Quotidien — {TODAY}</h2>
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>Même défi pour tout le monde aujourd'hui.</p>

      <div style={{ ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>Score du jour : <strong style={{ fontFamily: 'monospace', color: '#f2c14e', fontSize: '1.2rem' }}>{total} / {max}</strong></div>
        <button onClick={share} style={btn(true, false)}>Partager mon score</button>
      </div>

      <JeuArtiste onDone={report('artiste')} />
      <JeuPochette onDone={report('pochette')} />
      <JeuBPM onDone={report('bpm')} />

      <p style={{ color: '#9aa0b4', fontSize: '0.85rem', marginTop: 20 }}>
        Les autres sous-jeux (une note de plus, instrument…) arrivent aux prochaines étapes.
      </p>
    </main>
  );
}

/* ================= 1 · TROUVE L'ARTISTE ================= */
const MAX_TRIES = 6;

function JeuArtiste({ onDone }) {
  const target = useMemo(() => ARTISTS[Math.floor(seeded('artiste')() * ARTISTS.length)], []);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState(`Devine l'artiste du jour — ${MAX_TRIES} essais.`);
  const [score, setScore] = useState(null);

  function guess() {
    if (done) return;
    const g = ARTISTS.find((a) => norm(a.nom) === norm(input));
    if (!g) { setStatus('Artiste absent de la base — utilise l\'autocomplétion.'); return; }
    if (guesses.some((x) => x.nom === g.nom)) { setStatus('Déjà essayé !'); return; }
    const next = [...guesses, g];
    setGuesses(next);
    setInput('');
    if (g.nom === target.nom) {
      const pts = [10, 8, 6, 4, 2, 1][next.length - 1];
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Trouvé en ${next.length} essai(s) !`);
    } else if (next.length >= MAX_TRIES) {
      setScore(0); setDone(true); onDone(0);
      setStatus(`Perdu… c'était ${target.nom}.`);
    } else {
      setStatus(`Raté — ${MAX_TRIES - next.length} essai(s) restant(s).`);
    }
  }

  const cell = (val, ok, arrow = '') => (
    <div style={{
      background: ok ? '#14432b' : '#3a1d22', color: ok ? '#4ade80' : '#f87171',
      borderRadius: 8, padding: '8px 6px', fontSize: '0.82rem', textAlign: 'center',
    }}>
      {val}{arrow}
    </div>
  );

  return (
    <div style={panel}>
      <h3 style={{ marginBottom: 4 }}>1 · Trouve l'artiste</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        Vert = attribut exact. ▲/▼ = la cible a plus/moins (streams) ou est plus tardive/précoce (débuts).
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <input list="artistes" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guess()} placeholder="Nom d'artiste…"
          disabled={done} style={inputStyle} />
        <datalist id="artistes">
          {ARTISTS.map((a) => <option key={a.nom} value={a.nom} />)}
        </datalist>
        <button onClick={guess} disabled={done} style={btn(true, done)}>Essayer</button>
      </div>

      {guesses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr', gap: 6, marginTop: 12 }}>
          {['Artiste', 'Genre', 'Pays', 'Débuts', 'Format', 'Sexe', 'Streams'].map((h) => (
            <div key={h} style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.66rem', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>{h}</div>
          ))}
          {guesses.map((g) => {
            const arrowDebut = g.debut === target.debut ? '' : target.debut > g.debut ? ' ▲' : ' ▼';
            const arrowStreams = g.streams === target.streams ? '' : target.streams > g.streams ? ' ▲' : ' ▼';
            return (
              <FragmentRow key={g.nom}>
                {cell(g.nom, g.nom === target.nom)}
                {cell(g.genre, g.genre === target.genre)}
                {cell(g.pays, g.pays === target.pays)}
                {cell(g.debut + 's', g.debut === target.debut, arrowDebut)}
                {cell(g.type, g.type === target.type)}
                {cell(g.sexe, g.sexe === target.sexe)}
                {cell('~' + g.streams + ' Mds', g.streams === target.streams, arrowStreams)}
              </FragmentRow>
            );
          })}
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

/* ================= 2 · POCHETTE FLOUTÉE ================= */
const BLURS = [24, 16, 10, 5, 2]; // px de flou selon le nombre d'essais consommés
const POINTS = [10, 8, 6, 4, 2];

function JeuPochette({ onDone }) {
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
      // Artiste du jour (seed différente du jeu 1), puis un de ses morceaux
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
      <h3 style={{ marginBottom: 4 }}>2 · Pochette floutée</h3>
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
          <input list="artistes-pochette" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()} placeholder="Nom d'artiste…"
            disabled={done || !track} style={inputStyle} />
          <datalist id="artistes-pochette">
            {ARTISTS.map((a) => <option key={a.nom} value={a.nom} />)}
          </datalist>
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
function JeuBPM({ onDone }) {
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
      const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
      const tracks = await searchTracks(artist.nom, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');

      // Chercher un morceau dont Deezer connaît le BPM (bpm > 0)
      let found = null;
      const start = Math.floor(rng() * tracks.length);
      for (let i = 0; i < Math.min(tracks.length, 8); i++) {
        const t = tracks[(start + i) % tracks.length];
        const d = await trackDetails(t.trackId);
        if (d.bpm && d.bpm > 0) { found = { ...t, bpm: Math.round(d.bpm) }; break; }
      }
      if (!found) throw new Error('Aucun BPM disponible pour cet artiste');

      setTrack(found);
      setRealBpm(found.bpm);
      setStatus('Écoute l\'extrait (5 s), règle le curseur, puis valide.');
    } catch (err) {
      console.error('Erreur BPM:', err);
      setLoadError(true);
      setStatus('Impossible de charger un morceau avec BPM.');
    }
  }

  function playClip() {
    if (!track) return;
    audio?.pause();
    const a = new Audio(track.previewUrl);
    a.play();
    setAudio(a);
    setTimeout(() => a.pause(), 5000);
  }

  async function testMetro() {
    if (!tone) return;
    await tone.start();
    const synth = new tone.MembraneSynth({
      pitchDecay: 0.005, octaves: 2,
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    }).toDestination();
    synth.volume.value = 6; // bien audible
    const t0 = tone.now() + 0.15;
    const spb = 60 / guess;
    for (let b = 0; b < 6; b++) {
      // premier temps plus aigu pour marquer le départ
      synth.triggerAttackRelease(b === 0 ? 'A4' : 'E4', '32n', t0 + b * spb);
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
      <h3 style={{ marginBottom: 4 }}>3 · Trouve le BPM</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        5 secondes d'écoute, puis règle le curseur. Tu peux tester ton métronome autant que tu veux avant de valider.
      </p>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={playClip} disabled={!track} style={btn(false, !track)}>🔊 Écouter l'extrait (5 s)</button>
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
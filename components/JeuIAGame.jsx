'use client';
import { useEffect, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { AI_ARTISTS } from '@/data/ai-tracks';
import { searchTracks, trackDetails, freshPreviewUrl } from '@/utils/deezer';
import { seeded } from '@/components/dailyGames';

const normName = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const DAILY_ROUNDS = 3;

const NICHE_TERMS = [
  'rain', 'nuit', 'road', 'lumière', 'garden', 'hiver', 'fever', 'silence',
  'mercredi', 'horizon', 'papier', 'sable', 'echo', 'valley', 'brume', 'sunday',
];
const NICHE_MAX_RANK = 150000;
const HUMAN_CUTOFF = '2023-01-01';

export default function JeuIAGame({ daily = false, onDone = () => {} }) {
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [answered, setAnswered] = useState(true);
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({ good: 0, total: 0, streak: 0, best: 0 });
  const [dailyCount, setDailyCount] = useState(0);
  const [status, setStatus] = useState(daily
    ? `${DAILY_ROUNDS} extraits à démasquer. Clique sur « Nouvel extrait ».`
    : 'Clique sur « Nouvel extrait » pour commencer.');
  const audioRef = useRef(null);
  const stopTimerRef = useRef(null);
  const dailyRngRef = useRef(null);
  const dailyCountRef = useRef(0);
  const dailyGoodRef = useRef(0);
  const dailyDoneRef = useRef(false);

  useEffect(() => {
    if (daily) dailyRngRef.current = seeded('ia');
    return () => {
      clearTimeout(stopTimerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  async function pickNicheHuman(rnd) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const term = NICHE_TERMS[Math.floor(rnd() * NICHE_TERMS.length)];
      const tracks = (await searchTracks(term, { limit: 50 }))
        .filter((t) => t.rank > 0 && t.rank < NICHE_MAX_RANK);
      const shuffled = tracks.sort(() => rnd() - 0.5).slice(0, 5);
      for (const t of shuffled) {
        const d = await trackDetails(t.trackId);
        if (d.release_date && d.release_date < HUMAN_CUTOFF && d.preview) {
          return { trackId: t.trackId, isAI: false, label: `${t.artistName} — ${t.trackName}`, url: d.preview };
        }
      }
    }
    return null;
  }

  async function newRound() {
    if (daily && dailyCountRef.current >= DAILY_ROUNDS) return;
    clearTimeout(stopTimerRef.current);
    audioRef.current?.pause();
    setLoading(true);
    setResult(null);
    setStatus('Chargement d\'un extrait…');

    try {
      const rnd = daily ? dailyRngRef.current : Math.random;
      const isAI = rnd() < 0.5;
      let r;
      if (isAI) {
        const shuffledAI = [...AI_ARTISTS].sort(() => rnd() - 0.5);
        let t = null;
        for (const name of shuffledAI) {
          const tracks = (await searchTracks(name, { limit: 25 }))
            .filter((x) => normName(x.artistName) === normName(name));
          if (tracks.length) { t = tracks[Math.floor(rnd() * tracks.length)]; break; }
        }
        if (!t) throw new Error('Aucun artiste IA disponible sur Deezer');
        r = { trackId: t.trackId, isAI: true, label: `${t.artistName} — ${t.trackName}` };
      } else {
        r = await pickNicheHuman(rnd);
        if (!r) {
          const artist = ARTISTS[Math.floor(rnd() * ARTISTS.length)];
          const tracks = await searchTracks(artist.nom, { limit: 25 });
          if (!tracks.length) throw new Error('Aucun résultat');
          const t = tracks[Math.floor(rnd() * tracks.length)];
          r = { trackId: t.trackId, isAI: false, label: `${t.artistName} — ${t.trackName}` };
        }
      }

      if (!r.url) {
        const url = await freshPreviewUrl(r.trackId);
        if (!url) throw new Error('Preview indisponible pour ce morceau');
        r.url = url;
      }

      setRound(r);
      setAnswered(false);
      setLoading(false);
      setStatus('Écoute bien… humain ou IA ?');
      play(r.url);
    } catch (err) {
      console.error('Erreur IA:', err);
      setLoading(false);
      setStatus(`Erreur de chargement : ${err?.message ?? err} — réessaie.`);
    }
  }

  function play(url = round?.url) {
    if (!url) return;
    clearTimeout(stopTimerRef.current);
    audioRef.current?.pause();
    const a = new Audio(url);
    a.play().catch((e) => {
      console.error('Lecture impossible:', e);
      setStatus('Extrait momentanément indisponible — reclique sur Réécouter.');
    });
    audioRef.current = a;
    setPlaying(true);
    stopTimerRef.current = setTimeout(() => { a.pause(); setPlaying(false); }, 12000);
  }

  function answer(saysAI) {
    if (answered || !round) return;
    setAnswered(true);
    clearTimeout(stopTimerRef.current);
    audioRef.current?.pause();
    setPlaying(false);

    const correct = saysAI === round.isAI;
    const streak = correct ? stats.streak + 1 : 0;
    setStats({
      good: stats.good + (correct ? 1 : 0),
      total: stats.total + 1,
      streak,
      best: Math.max(stats.best, streak),
    });
    setResult({
      correct,
      revealText: round.isAI ? `🤖 C'était une IA : ${round.label}.` : `👤 C'était humain : ${round.label}.`,
    });

    if (daily) {
      dailyCountRef.current += 1;
      if (correct) dailyGoodRef.current += 1;
      setDailyCount(dailyCountRef.current);
      if (dailyCountRef.current >= DAILY_ROUNDS && !dailyDoneRef.current) {
        dailyDoneRef.current = true;
        const s = Math.round((dailyGoodRef.current / DAILY_ROUNDS) * 10 * 10) / 10;
        onDone(s);
        setStatus(`Terminé : ${dailyGoodRef.current}/${DAILY_ROUNDS} bonnes réponses → ${s}/10.`);
        return;
      }
      setStatus(`Manche ${dailyCountRef.current + 1}/${DAILY_ROUNDS} — « Nouvel extrait » pour continuer.`);
      return;
    }
    setStatus('« Nouvel extrait » pour continuer.');
  }

  const dailyFini = daily && dailyCount >= DAILY_ROUNDS;
  const btnStyle = (primary, disabled) => ({
    padding: '10px 16px', borderRadius: 10, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: primary ? '#f2c14e' : '#1c2032',
    color: primary ? '#1a1405' : '#e9e7de',
    opacity: disabled ? 0.45 : 1, fontWeight: 600,
  });

  return (
    <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24, marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Humain ou IA ?</h3>
      <p style={{ color: '#9aa0b4', fontSize: '0.9rem', marginBottom: 14 }}>
        {daily
          ? `${DAILY_ROUNDS} extraits : vrais morceaux ou musique 100% générée par IA ?`
          : 'Certains extraits sont de vrais morceaux (souvent obscurs…), d\'autres sont 100% générés par IA. 97% des gens n\'y arrivent pas — et toi ?'}
      </p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontFamily: 'monospace', fontSize: '0.9rem', color: '#9aa0b4' }}>
        {daily ? (
          <span>Manche : <strong style={{ color: '#f2c14e' }}>{Math.min(dailyCount + 1, DAILY_ROUNDS)}/{DAILY_ROUNDS}</strong></span>
        ) : (
          <>
            <span>Score : <strong style={{ color: '#e9e7de' }}>{stats.good}/{stats.total}</strong></span>
            <span>Série : <strong style={{ color: '#f2c14e' }}>{stats.streak}</strong></span>
            <span>Record : <strong style={{ color: '#4ade80' }}>{stats.best}</strong></span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={newRound} disabled={loading || dailyFini} style={btnStyle(true, loading || dailyFini)}>
          {loading ? 'Chargement…' : dailyFini ? '✔ Terminé' : 'Nouvel extrait'}
        </button>
        <button onClick={() => play()} disabled={!round || loading || playing} style={btnStyle(false, !round || loading || playing)}>
          🔊 Réécouter (12 s)
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => answer(false)} disabled={answered} style={btnStyle(false, answered)}>👤 Humain</button>
        <button onClick={() => answer(true)} disabled={answered} style={btnStyle(false, answered)}>🤖 IA</button>
      </div>

      <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 12 }}>{status}</p>

      {result && (
        <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
          <div style={{
            fontSize: '2rem', fontFamily: 'monospace', fontWeight: 700,
            color: result.correct ? '#4ade80' : '#f87171',
          }}>
            {result.correct ? '✔ Bien vu !' : '✘ Raté !'}
          </div>
          <div style={{ color: '#9aa0b4', fontSize: '0.9rem', marginTop: 8 }}>{result.revealText}</div>
        </div>
      )}
    </div>
  );
}
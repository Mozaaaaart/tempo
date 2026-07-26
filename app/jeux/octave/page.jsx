'use client';
import { useEffect, useRef, useState } from 'react';
import { searchTracks, highResArtwork, freshPreviewUrl } from '@/utils/deezer';

const TERMS = [
  'queen', 'daft punk', 'michael jackson', 'abba', 'coldplay',
  'stromae', 'the beatles', 'ed sheeran', 'david bowie', 'angele',
  'dua lipa', 'bruno mars', 'adele', 'indochine', 'imagine dragons',
];

export default function JeuOctave() {
  const [status, setStatus] = useState('Clique sur « Nouvelle chanson » pour commencer.');
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState(true);
  const [result, setResult] = useState(null);
  const [track, setTrack] = useState(null);

  const toneRef = useRef(null);
  const audioRef = useRef(null);
  const pitchRef = useRef(null);
  const shiftRef = useRef(0);
  const stopTimerRef = useRef(null);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
    });
    return () => stopAll();
  }, []);

  function stopAll() {
    clearTimeout(stopTimerRef.current);
    try { audioRef.current?.pause(); } catch {}
    try { pitchRef.current?.dispose(); } catch {}
    audioRef.current = null;
    pitchRef.current = null;
  }

  async function newRound() {
    const Tone = toneRef.current;
    if (!Tone) return;
    await Tone.start();
    stopAll();
    setLoading(true);
    setResult(null);
    setTrack(null);
    setStatus('Chargement d\'un extrait…');

    try {
      const term = TERMS[Math.floor(Math.random() * TERMS.length)];
      const tracks = await searchTracks(term, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');
      const t = tracks[Math.floor(Math.random() * tracks.length)];

      // 50% original, 25% tierce au-dessus, 25% tierce en dessous
      const r = Math.random();
      shiftRef.current = r < 0.25 ? 0 : r < 0.5 ? 1 : -1;

      // URL fraîche (les jetons des previews Deezer expirent)
      const fresh = (await freshPreviewUrl(t.trackId)) ?? t.previewUrl;
      const proxied = `/api/itunes/preview?url=${encodeURIComponent(fresh)}`;

      // Élément <audio> natif : décode tous les formats sans problème
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = proxied;
      audio.preload = 'auto';

      // Attendre que l'audio soit prêt (ou échoue)
      await new Promise((resolve, reject) => {
        audio.addEventListener('canplay', resolve, { once: true });
        audio.addEventListener('error', () => reject(new Error(`Lecture impossible (code ${audio.error?.code ?? '?'} : ${audio.error?.message ?? 'inconnu'})`)), { once: true });
        audio.load();
      });

      // Branchement : <audio> → PitchShift → sortie
      const pitch = new Tone.PitchShift({
        pitch: shiftRef.current,
        windowSize: 0.02,  // fenêtre plus courte = transitoires plus nets (défaut : 0.1)
        delayTime: 0,
        feedback: 0,
      }).toDestination();
      const source = Tone.getContext().createMediaElementSource(audio);
      Tone.connect(source, pitch);

      audioRef.current = audio;
      pitchRef.current = pitch;
      setTrack(t);
      setAnswered(false);
      setLoading(false);
      setStatus('Écoute bien… original ou modifié ?');
      play();
    } catch (err) {
      console.error('Erreur tierce:', err);
      setLoading(false);
      setStatus(`Erreur de chargement : ${err?.message ?? err}`);
    }
  }

  function play() {
    const audio = audioRef.current;
    if (!audio) return;
    clearTimeout(stopTimerRef.current);
    // extrait de 8 secondes à partir d'un point aléatoire des 15 premières secondes
    audio.currentTime = Math.random() * 15;
    audio.play();
    stopTimerRef.current = setTimeout(() => audio.pause(), 8000);
  }

  function answer(a) {
    if (answered) return;
    setAnswered(true);
    clearTimeout(stopTimerRef.current);
    audioRef.current?.pause();
    const shift = shiftRef.current;
    const truth = shift === 0 ? 'orig' : shift > 0 ? 'up' : 'down';
    let score = 0, msg = 'Raté !';
    if (a === truth) { score = 10; msg = '🎉 Exact !'; }
    else if (truth !== 'orig' && a !== 'orig') { score = 5; msg = 'Bien vu, c\'était modifié — mais mauvaise direction.'; }
    const lbl = truth === 'orig' ? 'à sa hauteur d\'origine' : truth === 'up' ? 'une tierce au-dessus' : 'une tierce en dessous';
    setResult({ score, msg, lbl });
    setStatus('« Nouvelle chanson » pour continuer.');
  }

  const btnStyle = (primary, disabled) => ({
    padding: '10px 16px', borderRadius: 10, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: primary ? '#f2c14e' : '#1c2032',
    color: primary ? '#1a1405' : '#e9e7de',
    opacity: disabled ? 0.45 : 1, fontWeight: 600,
  });

  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 4px' }}>Tierce ou pas ?</h2>
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>
        Un extrait d'un vrai morceau est joué — parfois à sa hauteur d'origine, parfois décalé
        d'une tierce vers le haut ou le bas (tempo inchangé). Plus subtil qu'il n'y paraît…
      </p>

      <div style={{ background: '#151826', border: '1px solid #2a2f45', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={newRound} disabled={loading} style={btnStyle(true, loading)}>
            {loading ? 'Chargement…' : 'Nouvelle chanson'}
          </button>
          <button onClick={play} disabled={!track || loading} style={btnStyle(false, !track || loading)}>
            🔊 Réécouter
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => answer('orig')} disabled={answered} style={btnStyle(false, answered)}>🎯 Original</button>
          <button onClick={() => answer('up')} disabled={answered} style={btnStyle(false, answered)}>⬆️ Tierce au-dessus</button>
          <button onClick={() => answer('down')} disabled={answered} style={btnStyle(false, answered)}>⬇️ Tierce en dessous</button>
        </div>

        <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '1.4em', marginTop: 12 }}>{status}</p>

        {result && track && (
          <div style={{ marginTop: 16, textAlign: 'center', background: '#1c2032', borderRadius: 12, padding: 18, border: '1px dashed #2a2f45' }}>
            <div style={{
              fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 700,
              color: result.score >= 8 ? '#4ade80' : result.score >= 5 ? '#f2c14e' : '#f87171'
            }}>
              {result.score} / 10
            </div>
            <img src={highResArtwork(track.artworkUrl100, 200)} alt="" width={120}
              style={{ borderRadius: 8, margin: '12px auto', display: 'block' }} />
            <div style={{ color: '#9aa0b4', fontSize: '0.9rem' }}>
              {result.msg} C'était <strong style={{ color: '#e9e7de' }}>{track.artistName} — {track.trackName}</strong>, joué {result.lbl}.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
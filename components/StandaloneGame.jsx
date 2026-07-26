'use client';
import { useEffect, useRef, useState } from 'react';
import { setSeedSalt, btn } from '@/components/dailyGames';

/**
 * Enveloppe une version "jeu libre" d'un sous-jeu du quotidien :
 * tirage aléatoire + bouton Rejouer qui re-tire tout.
 *
 * Le contenu n'est rendu qu'après le montage côté client : le salt étant
 * aléatoire, un rendu serveur produirait un tirage différent du client
 * (erreur d'hydratation React).
 */
export default function StandaloneGame({ titre, description, Jeu }) {
  const [mounted, setMounted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const saltRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // Nouveau salt à chaque partie (uniquement côté client)
  if (mounted) {
    if (saltRef.current === null) saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
  }

  function rejouer() {
    saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
    setLastScore(null);
    setRunKey((k) => k + 1);
  }

  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 4px' }}>{titre}</h2>
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>{description}</p>

      {mounted ? (
        <div key={runKey}>
          <Jeu onDone={setLastScore} />
        </div>
      ) : (
        <p style={{ color: '#9aa0b4', fontFamily: 'monospace', fontSize: '0.85rem' }}>Chargement du jeu…</p>
      )}

      {lastScore !== null && (
        <button onClick={rejouer} style={{ ...btn(true, false), marginTop: 4 }}>
          🔄 Rejouer (nouveau tirage)
        </button>
      )}
    </main>
  );
}
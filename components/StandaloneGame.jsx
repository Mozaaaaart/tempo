'use client';
import { useEffect, useRef, useState } from 'react';
import { setSeedSalt, btn } from '@/components/dailyGames';
import PageEpreuve from '@/components/PageEpreuve';

/**
 * Version "épreuve libre" d'un sous-jeu du quotidien : tirage aléatoire
 * et relance illimitée, dans l'enveloppe visuelle commune.
 *
 * Le contenu n'est rendu qu'après le montage côté client : le salt étant
 * aléatoire, un rendu serveur produirait un tirage différent du client.
 */
export default function StandaloneGame({ num, titre, description, Jeu }) {
  const [mounted, setMounted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const saltRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  if (mounted) {
    if (saltRef.current === null) saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
  }

  function relancer() {
    saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
    setLastScore(null);
    setRunKey((k) => k + 1);
  }

  return (
    <PageEpreuve num={num} titre={titre} description={description}>
      {mounted ? (
        <div key={runKey}>
          <Jeu onDone={setLastScore} />
        </div>
      ) : (
        <p className="lin" style={{ fontSize: 13 }}>Chargement de l'épreuve…</p>
      )}

      {lastScore !== null && (
        <button onClick={relancer} style={{ ...btn(true, false), marginTop: 'var(--e4)' }}>
          Relancer l'épreuve
        </button>
      )}
    </PageEpreuve>
  );
}
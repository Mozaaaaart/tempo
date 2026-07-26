'use client';
import { useState } from 'react';
import {
  TODAY, setSeedSalt, panel, btn,
  JeuArtiste, JeuPochette, JeuBPM, JeuSeconde, JeuInstrument, JeuParoles, JeuRefrain,
} from '@/components/dailyGames';
import JeuAccordsGame from '@/components/JeuAccordsGame';
import JeuRythmeGame from '@/components/JeuRythmeGame';
import JeuIAGame from '@/components/JeuIAGame';

const ORDRE = ['artiste', 'pochette', 'bpm', 'seconde', 'instrument', 'paroles', 'refrain', 'accords', 'rythme', 'ia'];

export default function Quotidien() {
  setSeedSalt(''); // défi du jour : seed pure, identique pour tous
  const [scores, setScores] = useState(Object.fromEntries(ORDRE.map((k) => [k, null])));
  const report = (jeu) => (s) => setScores((prev) => ({ ...prev, [jeu]: s }));

  const total = Math.round(Object.values(scores).filter((v) => v !== null).reduce((a, b) => a + b, 0) * 10) / 10;
  const max = ORDRE.length * 10;

  function share() {
    const emo = ORDRE.map((k) => {
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
      <p style={{ color: '#9aa0b4', marginBottom: 24 }}>
        10 défis, les mêmes pour tout le monde aujourd'hui. Envie de t'entraîner ? Chaque jeu existe aussi en version libre depuis l'accueil.
      </p>

      <div style={{ ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>Score du jour : <strong style={{ fontFamily: 'monospace', color: '#f2c14e', fontSize: '1.2rem' }}>{total} / {max}</strong></div>
        <button onClick={share} style={btn(true, false)}>Partager mon score</button>
      </div>

      <JeuArtiste onDone={report('artiste')} />
      <JeuPochette onDone={report('pochette')} />
      <JeuBPM onDone={report('bpm')} />
      <JeuSeconde onDone={report('seconde')} />
      <JeuInstrument onDone={report('instrument')} />
      <JeuParoles onDone={report('paroles')} />
      <JeuRefrain onDone={report('refrain')} />
      <JeuAccordsGame daily onDone={report('accords')} />
      <JeuRythmeGame daily onDone={report('rythme')} />
      <JeuIAGame daily onDone={report('ia')} />
    </main>
  );
}
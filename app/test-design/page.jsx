'use client';
import { useState } from 'react';
import Onde from '@/components/Onde';
import { Etiquette } from '@/components/ui';

const EPREUVES = ['Accords', 'Rythme', 'Artiste', 'Pochette', 'Humain ou IA'];

export default function TestDesign() {
  const [active, setActive] = useState(null);

  return (
    <main className="contenu">
      <Etiquette>évaluation auditive</Etiquette>
      <h1 className="titre-page" style={{ marginTop: 'var(--e3)', marginBottom: 'var(--e6)' }}>
        L'onde
      </h1>

      <Onde sections={5} active={active} />

      {/* Grille des cinq épreuves : survole une colonne, la lumière s'y déplace */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--e3)', marginTop: 'var(--e5)' }}
        onMouseLeave={() => setActive(null)}
      >
        {EPREUVES.map((nom, k) => (
          <div
            key={nom}
            onMouseEnter={() => setActive(k)}
            style={{
              paddingTop: 'var(--e3)',
              borderTop: `${active === k ? '1px' : '0.5px'} solid ${active === k ? 'var(--or)' : 'var(--filet)'}`,
              cursor: 'pointer',
              transition: 'border-color var(--transition-courte)',
            }}
          >
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--cendre)', letterSpacing: '0.09em' }}>
              {String(k + 1).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 14, marginTop: 'var(--e1)' }}>{nom}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--e7)' }}>
        <Etiquette couleur="var(--cendre)">réemploi — bandeau d'épreuve</Etiquette>
        <div style={{ marginTop: 'var(--e3)' }}>
          <Onde variante="bandeau" sections={3} active={1} />
        </div>
      </div>
    </main>
  );
}
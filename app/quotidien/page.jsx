'use client';
import { useEffect, useState } from 'react';
import {
  TODAY, setSeedSalt,
  JeuArtiste, JeuPochette, JeuBPM, JeuSeconde, JeuInstrument, JeuParoles, JeuRefrain,
} from '@/components/dailyGames';
import JeuAccordsGame from '@/components/JeuAccordsGame';
import JeuRythmeGame from '@/components/JeuRythmeGame';
import JeuIAGame from '@/components/JeuIAGame';

const ORDRE = [
  { cle: 'accords', nom: 'Accords' },
  { cle: 'rythme', nom: 'Rythme' },
  { cle: 'artiste', nom: 'Artiste' },
  { cle: 'pochette', nom: 'Pochette' },
  { cle: 'ia', nom: 'Humain ou IA' },
  { cle: 'seconde', nom: 'Une seconde de plus' },
  { cle: 'bpm', nom: 'Tempo' },
  { cle: 'instrument', nom: 'Instrument' },
  { cle: 'paroles', nom: 'Paroles' },
  { cle: 'refrain', nom: 'Refrain' },
];

// Palette de partage du doc de design
function carre(s) {
  if (s === null) return '⬛';
  if (s >= 9) return '🟨';
  if (s >= 7) return '🟧';
  if (s >= 4) return '🟫';
  return '⬛';
}

export default function Quotidien() {
  setSeedSalt(''); // défi du jour : seed pure, identique pour tous
  const [scores, setScores] = useState(Object.fromEntries(ORDRE.map((e) => [e.cle, null])));
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [tick, setTick] = useState(0);
  const [copie, setCopie] = useState(false);
  const report = (cle) => (s) => setScores((prev) => ({ ...prev, [cle]: s }));

  const faits = Object.values(scores).filter((v) => v !== null);
  const total = Math.round(faits.reduce((a, b) => a + b, 0) * 10) / 10;
  const max = ORDRE.length * 10;

  function aller(n) {
    const cible = Math.min(Math.max(n, 0), ORDRE.length - 1);
    if (cible === index) return;
    setDir(cible > index ? 1 : -1);
    setTick((t) => t + 1);
    setIndex(cible);
  }

  // Flèches ← → du clavier, sauf quand on saisit du texte
  useEffect(() => {
    function onKey(e) {
      const cible = e.target;
      if (cible && (cible.tagName === 'INPUT' || cible.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') aller(index - 1);
      if (e.key === 'ArrowRight') aller(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index]);

  function partager() {
    const ligne = ORDRE.map((e) => carre(scores[e.cle])).join('');
    const txt = `Mozart Benchmark — ${TODAY}\n${total.toFixed(1).replace('.', ',')} / ${max}\n${ligne}`;
    navigator.clipboard?.writeText(txt);
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  }

  // Flèche en contour, s'inverse au survol
  const fleche = (dispo) => ({
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    color: dispo ? 'var(--or)' : 'var(--cendre)',
    border: `1px solid ${dispo ? 'var(--or)' : 'var(--filet)'}`,
    cursor: dispo ? 'pointer' : 'not-allowed', flexShrink: 0,
    transition: 'color var(--transition-courte), border-color var(--transition-courte), background var(--transition-courte)',
  });

  // Keyframes alternées : l'animation se rejoue même deux fois dans le même sens
  const nomAnim = dir > 0
    ? (tick % 2 ? 'glisseDroiteA' : 'glisseDroiteB')
    : (tick % 2 ? 'glisseGaucheA' : 'glisseGaucheB');

  const peutPrecedent = index > 0;
  const peutSuivant = index < ORDRE.length - 1;

  return (
    <main className="contenu">
      <style>{`
        @keyframes glisseDroiteA { from { transform: translateX(42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes glisseDroiteB { from { transform: translateX(42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes glisseGaucheA { from { transform: translateX(-42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes glisseGaucheB { from { transform: translateX(-42px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {/* En-tête, identique à l'accueil */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--e3)', marginBottom: 'var(--e7)' }}>
        <a href="/" style={{
          width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--or)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--or)', flexShrink: 0,
        }}>MB</a>
        <div style={{ flex: 1 }}>
          <a href="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ivoire)' }}>Mozart Benchmark</a>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>évaluation auditive</div>
        </div>
        <nav style={{ display: 'flex', gap: 'var(--e4)', fontSize: 12 }}>
          <a href="/epreuves" style={{ color: 'var(--lin)' }}>toutes les épreuves</a>
          <a href="/" style={{ color: 'var(--lin)' }}>accueil</a>
        </nav>
      </header>

      {/* Titre à gauche, score cumulé à droite */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--e5)', flexWrap: 'wrap' }}>
        <div>
          <div className="etiquette-mono">défi du jour · {TODAY}</div>
          <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>Dix épreuves, une tentative</h1>
          <p className="lin" style={{ marginTop: 'var(--e2)', maxWidth: 470 }}>
            Le même défi pour tout le monde jusqu'à minuit. Pour t'entraîner sans limite, les épreuves
            sont aussi jouables <a href="/epreuves">en accès libre</a>.
          </p>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>score cumulé</div>
          <div className="score-affiche" style={{ marginTop: 'var(--e1)', fontSize: 32 }}>
            {total.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ {max}</span>
          </div>
          <div className="description" style={{ marginTop: 'var(--e1)' }}>
            {faits.length} / {ORDRE.length} terminée(s)
          </div>
        </div>
      </div>

      {/* Progression : segments cliquables + curseur qui glisse vers l'épreuve active */}
      <div style={{ position: 'relative', marginTop: 'var(--e6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ORDRE.length}, 1fr)`, gap: 4 }}>
          {ORDRE.map((e, k) => (
            <button
              key={e.cle}
              onClick={() => aller(k)}
              title={`${e.nom}${scores[e.cle] !== null ? ` — ${scores[e.cle]}/10` : ''}`}
              style={{
                height: 3, border: 'none', padding: 0, cursor: 'pointer',
                background: scores[e.cle] !== null ? 'var(--or)' : 'var(--filet)',
                transition: 'background var(--transition-courte)',
              }}
            />
          ))}
        </div>

        {/* Curseur de l'épreuve affichée : glisse d'un segment à l'autre */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, left: 0, height: 3,
            width: `calc((100% - ${(ORDRE.length - 1) * 4}px) / ${ORDRE.length})`,
            transform: `translateX(calc(${index} * (100% + 4px)))`,
            background: 'var(--or-clair)',
            transition: 'transform var(--transition-onde)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Navigation entre épreuves */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--e4)',
        borderBottom: '0.5px solid var(--filet)',
        padding: 'var(--e4) 0', marginBottom: 'var(--e5)',
      }}>
        <button
          onClick={() => aller(index - 1)}
          disabled={!peutPrecedent}
          style={fleche(peutPrecedent)}
          aria-label="Épreuve précédente"
          onMouseEnter={(ev) => { if (peutPrecedent) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
          onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = peutPrecedent ? 'var(--or)' : 'var(--cendre)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4L3 8l4 4" />
          </svg>
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
            épreuve {String(index + 1).padStart(2, '0')} / {ORDRE.length}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{ORDRE[index].nom}</div>
        </div>

        <button
          onClick={() => aller(index + 1)}
          disabled={!peutSuivant}
          style={fleche(peutSuivant)}
          aria-label="Épreuve suivante"
          onMouseEnter={(ev) => { if (peutSuivant) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
          onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = peutSuivant ? 'var(--or)' : 'var(--cendre)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {/* Les dix épreuves : toutes montées, une seule visible (la progression est conservée) */}
      <div style={{ overflowX: 'clip', overflowY: 'visible' }}>
        <div style={{ animation: `${nomAnim} 300ms cubic-bezier(0.4, 0, 0.2, 1) both` }}>
          {ORDRE.map((e, k) => (
            <div key={e.cle} style={{ display: k === index ? 'block' : 'none' }}>
              {e.cle === 'accords' && <JeuAccordsGame daily onDone={report('accords')} />}
              {e.cle === 'rythme' && <JeuRythmeGame daily onDone={report('rythme')} />}
              {e.cle === 'artiste' && <JeuArtiste onDone={report('artiste')} />}
              {e.cle === 'pochette' && <JeuPochette onDone={report('pochette')} />}
              {e.cle === 'ia' && <JeuIAGame daily onDone={report('ia')} />}
              {e.cle === 'seconde' && <JeuSeconde onDone={report('seconde')} />}
              {e.cle === 'bpm' && <JeuBPM onDone={report('bpm')} />}
              {e.cle === 'instrument' && <JeuInstrument onDone={report('instrument')} />}
              {e.cle === 'paroles' && <JeuParoles onDone={report('paroles')} />}
              {e.cle === 'refrain' && <JeuRefrain onDone={report('refrain')} />}
            </div>
          ))}
        </div>
      </div>

      {/* Partage */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        borderTop: '0.5px solid var(--filet)',
        paddingTop: 'var(--e4)', marginTop: 'var(--e5)',
      }}>
        <button
          onClick={partager}
          disabled={faits.length === 0}
          style={{
            fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
            padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
            cursor: faits.length === 0 ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: faits.length === 0 ? 'var(--cendre)' : 'var(--or)',
            border: `1px solid ${faits.length === 0 ? 'var(--filet)' : 'var(--or)'}`,
            transition: 'background var(--transition-courte), color var(--transition-courte), box-shadow var(--transition-courte)',
          }}
          onMouseEnter={(ev) => {
            if (faits.length === 0) return;
            ev.currentTarget.style.background = 'var(--or)';
            ev.currentTarget.style.color = 'var(--noir)';
            ev.currentTarget.style.boxShadow = '0 0 22px rgba(239, 159, 39, 0.28)';
          }}
          onMouseLeave={(ev) => {
            ev.currentTarget.style.background = 'transparent';
            ev.currentTarget.style.color = faits.length === 0 ? 'var(--cendre)' : 'var(--or)';
            ev.currentTarget.style.boxShadow = 'none';
          }}
        >
          {copie ? 'Copié dans le presse-papiers' : 'Partager mon résultat'}
        </button>
      </div>

      <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
        Nouveau défi chaque jour à minuit.
      </footer>
    </main>
  );
}
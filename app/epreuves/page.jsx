'use client';
import { useEffect, useRef, useState } from 'react';
import Onde from '@/components/Onde';
import { setSeedSalt, JeuArtiste, JeuPochette, JeuBPM, JeuSeconde, JeuInstrument, JeuParoles, JeuRefrain } from '@/components/dailyGames';
import JeuAccordsGame from '@/components/JeuAccordsGame';
import JeuRythmeGame from '@/components/JeuRythmeGame';
import JeuIAGame from '@/components/JeuIAGame';

const EPREUVES = [
  { num: '01', nom: 'Accords', court: 'Accords', desc: 'Place trois ou quatre notes sur la portée, écoute l\'écart avec la cible.' },
  { num: '02', nom: 'Rythme', court: 'Rythme', desc: 'Reproduis un pattern de batterie de mémoire, à cinquante millisecondes près.' },
  { num: '03', nom: 'Artiste', court: 'Artiste', desc: 'Devine l\'artiste. Genre, pays, décennie : les indices tombent à chaque erreur.' },
  { num: '04', nom: 'Pochette', court: 'Pochette', desc: 'Une pochette d\'album, floutée à l\'extrême. Le flou se lève à chaque tentative.' },
  { num: '05', nom: 'Humain ou IA', court: 'Humain / IA', desc: 'Un extrait, deux origines possibles : un musicien ou une machine.' },
  { num: '06', nom: 'Une seconde de plus', court: 'Une seconde', desc: 'Une seconde d\'extrait pour commencer. Chaque erreur en dévoile un peu plus.' },
  { num: '07', nom: 'Tempo', court: 'Tempo', desc: 'Sept secondes d\'écoute, un curseur, un métronome pour comparer.' },
  { num: '08', nom: 'Instrument', court: 'Instrument', desc: 'Un timbre acoustique isolé sur un air connu. Vingt-et-un instruments possibles.' },
  { num: '09', nom: 'Paroles', court: 'Paroles', desc: 'Quatre lignes de paroles. Retrouve le morceau dont elles viennent.' },
  { num: '10', nom: 'Refrain', court: 'Refrain', desc: 'Trois lignes te sont données. Tape celle qui suit.' },
];

// Bouton en contour : s'inverse au survol
const BOUTON_CONTOUR = {
  fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
  padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
  cursor: 'pointer',
  background: 'transparent', color: 'var(--or)',
  border: '1px solid var(--or)',
  transition: 'background var(--transition-courte), color var(--transition-courte)',
};

export default function Epreuves() {
  const [monte, setMonte] = useState(false);
  const [index, setIndex] = useState(0);
  const [ondeIndex, setOndeIndex] = useState(0); // position de la lumière, animée à l'arrivée
  const [dir, setDir] = useState(1);
  const [tick, setTick] = useState(0);
  // Une clé de relance par épreuve : remonter le jeu = nouveau tirage
  const [cles, setCles] = useState(() => EPREUVES.map(() => 0));
  const saltRef = useRef(null);

  // Ouvre directement l'épreuve demandée par l'URL (?e=4).
  // L'onde, elle, part de la première et glisse jusqu'à la bonne section.
  useEffect(() => {
    setMonte(true);
    const params = new URLSearchParams(window.location.search);
    const n = parseInt(params.get('e'), 10);
    if (n >= 1 && n <= EPREUVES.length) {
      setIndex(n - 1);
      const t = setTimeout(() => setOndeIndex(n - 1), 450);
      return () => clearTimeout(t);
    }
  }, []);

  if (monte) {
    if (saltRef.current === null) saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
  }

  function aller(n) {
    const cible = Math.min(Math.max(n, 0), EPREUVES.length - 1);
    if (cible === index) return;
    setDir(cible > index ? 1 : -1);
    setTick((t) => t + 1);
    setIndex(cible);
    setOndeIndex(cible);
  }

  function relancer() {
    saltRef.current = Math.random().toString(36).slice(2);
    setSeedSalt(saltRef.current);
    setCles((c) => c.map((v, k) => (k === index ? v + 1 : v)));
  }

  useEffect(() => {
    function onKey(e) {
      const c = e.target;
      if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') aller(index - 1);
      if (e.key === 'ArrowRight') aller(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index]);

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

  const e = EPREUVES[index];

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
          <a href="/" style={{ color: 'var(--lin)' }}>accueil</a>
        </nav>
      </header>

      {/* Titre de l'épreuve · carte du défi */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--e5)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minHeight: 118 }}>
          <div className="etiquette-mono">épreuve {e.num} · accès libre</div>
          <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>{e.nom}</h1>
          <p className="lin" style={{ marginTop: 'var(--e2)', maxWidth: 470 }}>{e.desc}</p>
        </div>

        {/* Carte du défi du jour : seul élément encadré de la page */}
        <a href="/quotidien"
          style={{
            display: 'block', padding: 'var(--e3) var(--e4)',
            border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
            color: 'inherit', maxWidth: 260, background: 'transparent',
            boxShadow: '0 0 0 rgba(239, 159, 39, 0)',
            transition: 'box-shadow var(--transition-courte), background var(--transition-courte), border-color var(--transition-courte)',
          }}
          onMouseEnter={(ev) => {
            ev.currentTarget.style.boxShadow = '0 0 22px rgba(239, 159, 39, 0.6)';
            ev.currentTarget.style.background = 'var(--onyx-haut)';
            ev.currentTarget.style.borderColor = 'var(--or-clair)';
          }}
          onMouseLeave={(ev) => {
            ev.currentTarget.style.boxShadow = '0 0 0 rgba(239, 159, 39, 0)';
            ev.currentTarget.style.background = 'transparent';
            ev.currentTarget.style.borderColor = 'var(--or)';
          }}
        >
          <div className="etiquette-mono">défi du jour</div>
          <p style={{ fontSize: 13, marginTop: 'var(--e1)' }}>
            Dix épreuves, une tentative chacune, les mêmes pour tous →
          </p>
        </a>
      </div>

      {/* L'onde, allumée sur l'épreuve en cours */}
      <div style={{ marginTop: 'var(--e5)' }}>
        <Onde variante="bandeau" sections={EPREUVES.length} active={ondeIndex} />
      </div>

      {/* Les dix épreuves : numéro + nom, filet or sur l'active */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`, gap: 6, marginTop: 'var(--e4)', marginBottom: 'var(--e5)' }}>
        {EPREUVES.map((x, k) => (
          <button key={x.num} onClick={() => aller(k)}
            style={{
              paddingTop: 'var(--e2)', paddingBottom: 'var(--e2)',
              background: 'none', cursor: 'pointer', textAlign: 'left',
              borderTop: `${k === index ? '1px' : '0.5px'} solid ${k === index ? 'var(--or)' : 'var(--filet)'}`,
              borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
              outline: 'none',
              transition: 'border-color var(--transition-courte)',
            }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
              color: k === index ? 'var(--or)' : 'var(--cendre)',
              transition: 'color var(--transition-courte)',
            }}>
              {x.num}
            </div>
            <div style={{
              fontSize: 11.5, marginTop: 2, lineHeight: 1.25,
              color: k === index ? 'var(--ivoire)' : 'var(--lin)',
              transition: 'color var(--transition-courte)',
            }}>
              {x.court}
            </div>
          </button>
        ))}
      </div>

      {/* Bandeau d'action : contexte, relance, navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--e4)',
        borderTop: '0.5px solid var(--filet)', paddingTop: 'var(--e3)', marginBottom: 'var(--e4)',
      }}>
        <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
          {e.nom} · rejouable à volonté
        </span>

        <button
          onClick={relancer}
          style={BOUTON_CONTOUR}
          onMouseEnter={(ev) => {
            ev.currentTarget.style.background = 'var(--or)';
            ev.currentTarget.style.color = 'var(--noir)';
          }}
          onMouseLeave={(ev) => {
            ev.currentTarget.style.background = 'transparent';
            ev.currentTarget.style.color = 'var(--or)';
          }}
        >
          Relancer l'épreuve
        </button>

        {/* Navigation, poussée tout à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)', marginLeft: 'auto' }}>
          <button onClick={() => aller(index - 1)} disabled={index === 0} style={fleche(index > 0)} aria-label="Épreuve précédente"
            onMouseEnter={(ev) => { if (index > 0) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = index > 0 ? 'var(--or)' : 'var(--cendre)'; }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 8H3M7 4L3 8l4 4" />
            </svg>
          </button>
          <button onClick={() => aller(index + 1)} disabled={index === EPREUVES.length - 1} style={fleche(index < EPREUVES.length - 1)} aria-label="Épreuve suivante"
            onMouseEnter={(ev) => { if (index < EPREUVES.length - 1) { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; } }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = index < EPREUVES.length - 1 ? 'var(--or)' : 'var(--cendre)'; }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Les dix jeux : montés une fois, un seul visible → aucun rechargement.
          overflowX clip (et non hidden) : les listes déroulantes peuvent dépasser vers le bas. */}
      <div style={{ overflowX: 'clip', overflowY: 'visible' }}>
        <div style={{ animation: `${nomAnim} 300ms cubic-bezier(0.4, 0, 0.2, 1) both` }}>
          {monte ? EPREUVES.map((x, k) => (
            <div key={x.num} style={{ display: k === index ? 'block' : 'none' }}>
              {k === 0 && <JeuAccordsGame key={cles[0]} />}
              {k === 1 && <JeuRythmeGame key={cles[1]} />}
              {k === 2 && <JeuArtiste key={cles[2]} onDone={() => {}} />}
              {k === 3 && <JeuPochette key={cles[3]} onDone={() => {}} />}
              {k === 4 && <JeuIAGame key={cles[4]} />}
              {k === 5 && <JeuSeconde key={cles[5]} onDone={() => {}} />}
              {k === 6 && <JeuBPM key={cles[6]} onDone={() => {}} />}
              {k === 7 && <JeuInstrument key={cles[7]} onDone={() => {}} />}
              {k === 8 && <JeuParoles key={cles[8]} onDone={() => {}} />}
              {k === 9 && <JeuRefrain key={cles[9]} onDone={() => {}} />}
            </div>
          )) : (
            <p className="lin" style={{ fontSize: 13 }}>Chargement des épreuves…</p>
          )}
        </div>
      </div>

      <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
        Mozart Benchmark — extraits fournis par Deezer, sons de synthèse et échantillons libres.
      </footer>
    </main>
  );
}
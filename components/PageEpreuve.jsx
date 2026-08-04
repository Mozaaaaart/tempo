'use client';
import { useEffect, useState } from 'react';
import Onde from '@/components/Onde';
import { memoriserDirection, lireDirection } from '@/components/transition';

const EPREUVES = [
  { href: '/jeux/accords', num: '01', nom: 'Accords' },
  { href: '/jeux/rythme', num: '02', nom: 'Rythme' },
  { href: '/jeux/artiste', num: '03', nom: 'Artiste' },
  { href: '/jeux/pochette', num: '04', nom: 'Pochette' },
  { href: '/jeux/ia', num: '05', nom: 'Humain ou IA' },
  { href: '/jeux/seconde', num: '06', nom: 'Une seconde' },
  { href: '/jeux/bpm', num: '07', nom: 'Tempo' },
  { href: '/jeux/instrument', num: '08', nom: 'Instrument' },
  { href: '/jeux/paroles', num: '09', nom: 'Paroles' },
  { href: '/jeux/refrain', num: '10', nom: 'Refrain' },
];

/**
 * Enveloppe commune des pages d'épreuve : reprend le rythme vertical de
 * l'accueil (en-tête, onde, filets) pour que le fil visuel ne se rompe pas.
 * Le contenu entre en glissant depuis le côté d'où vient le visiteur.
 */
export default function PageEpreuve({ num, titre, description, children }) {
  const indexActif = EPREUVES.findIndex((e) => e.num === num);
  const [dir, setDir] = useState(0);

  // La direction a été notée par la page précédente au moment du clic
  useEffect(() => { setDir(lireDirection()); }, []);

  const precedente = indexActif > 0 ? EPREUVES[indexActif - 1] : null;
  const suivante = indexActif >= 0 && indexActif < EPREUVES.length - 1 ? EPREUVES[indexActif + 1] : null;

  const fleche = (dispo) => ({
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: dispo ? 'var(--or)' : 'transparent',
    color: dispo ? 'var(--noir)' : 'var(--cendre)',
    border: `1px solid ${dispo ? 'var(--or)' : 'var(--filet)'}`,
    cursor: dispo ? 'pointer' : 'not-allowed',
    flexShrink: 0, textDecoration: 'none',
  });

  const nomAnim = dir > 0 ? 'entreeDroite' : dir < 0 ? 'entreeGauche' : 'entreeSimple';

  return (
    <main className="contenu">
      <style>{`
        @keyframes entreeDroite {
          from { transform: translateX(42px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes entreeGauche {
          from { transform: translateX(-42px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes entreeSimple {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* En-tête, identique à l'accueil */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--e3)', marginBottom: 'var(--e7)' }}>
        <a href="/" style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '1px solid var(--or)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--or)', flexShrink: 0,
        }}>
          MB
        </a>
        <div style={{ flex: 1 }}>
          <a href="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ivoire)' }}>Mozart Benchmark</a>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>évaluation auditive</div>
        </div>
        <nav style={{ display: 'flex', gap: 'var(--e4)', fontSize: 12 }}>
          <a href="/epreuves" style={{ color: 'var(--lin)' }}>toutes les épreuves</a>
          <a href="/quotidien" style={{ color: 'var(--lin)' }}>défi du jour</a>
        </nav>
      </header>

      {/* Titre + flèches de navigation */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--e4)' }}>
        <div style={{ flex: 1 }}>
          {num && <div className="etiquette-mono">épreuve {num}</div>}
          <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>{titre}</h1>
          {description && (
            /* `pretty` et non `balance` : le texte est aligné à gauche et peut
               dépasser deux lignes. `balance` égalise les longueurs, ce qui n'a
               de sens que sur un bloc centré et court ; `pretty` ne corrige que
               le défaut réel — le dernier mot resté seul sur sa ligne. */
            <p className="lin" style={{
              marginTop: 'var(--e2)', maxWidth: 470, textWrap: 'pretty',
            }}>{description}</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--e2)', paddingTop: 'var(--e5)' }}>
          {precedente ? (
            <a href={precedente.href} onClick={() => memoriserDirection(-1)}
              style={fleche(true)} aria-label={`Épreuve précédente : ${precedente.nom}`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 8H3M7 4L3 8l4 4" />
              </svg>
            </a>
          ) : <span style={fleche(false)} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 8H3M7 4L3 8l4 4" />
                </svg>
              </span>}

          {suivante ? (
            <a href={suivante.href} onClick={() => memoriserDirection(1)}
              style={fleche(true)} aria-label={`Épreuve suivante : ${suivante.nom}`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
          ) : <span style={fleche(false)} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>}
        </div>
      </div>

      {/* L'onde, allumée sur l'épreuve en cours */}
      <div style={{ marginTop: 'var(--e5)' }}>
        <Onde variante="bandeau" sections={EPREUVES.length} active={indexActif >= 0 ? indexActif : null} />
      </div>

      {/* Les dix épreuves en filets, comme la grille d'accueil */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`, gap: 6, marginTop: 'var(--e4)', marginBottom: 'var(--e7)' }}>
        {EPREUVES.map((e, k) => (
          <a key={e.num} href={e.href}
            onClick={() => memoriserDirection(k > indexActif ? 1 : -1)}
            title={e.nom}
            style={{
              paddingTop: 'var(--e2)',
              borderTop: `${k === indexActif ? '1px' : '0.5px'} solid ${k === indexActif ? 'var(--or)' : 'var(--filet)'}`,
              color: k === indexActif ? 'var(--or)' : 'var(--cendre)',
              fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.06em',
              display: 'block',
              transition: 'color var(--transition-courte), border-color var(--transition-courte)',
            }}>
            {e.num}
          </a>
        ))}
      </div>

      {/* Le jeu entre en glissant depuis le côté d'où l'on vient */}
      <div style={{ overflowX: 'hidden' }}>
        <div style={{ animation: `${nomAnim} 300ms cubic-bezier(0.4, 0, 0.2, 1) both` }}>
          {children}
        </div>
      </div>
    </main>
  );
}
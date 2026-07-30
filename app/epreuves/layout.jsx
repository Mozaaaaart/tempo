'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Onde from '@/components/Onde';
import { EPREUVES } from '@/data/epreuves';
import { EpreuveContext } from '@/components/EpreuveContext';
import VolumeControl from '@/components/VolumeControl';

/**
 * Enveloppe des dix épreuves.
 *
 * Tout l'intérêt de ce fichier tient en une propriété de l'App Router : Next
 * conserve l'INSTANCE du layout quand on navigue entre deux routes sœurs
 * (/epreuves/pochette → /epreuves/tempo). L'<Onde> n'est donc jamais
 * démontée : sa boucle requestAnimationFrame continue de tourner et sa
 * lumière glisse d'une section à l'autre, exactement comme quand tout tenait
 * dans une seule page. Seul le contenu de {children} est remplacé.
 *
 * Corollaire : toute navigation interne DOIT passer par <Link> ou
 * router.push(). Un simple <a href> déclencherait un rechargement complet,
 * remonterait l'onde et casserait l'animation.
 */

const BOUTON_CONTOUR = {
  fontFamily: 'var(--sans)',
  fontSize: 14,
  fontWeight: 500,
  padding: '9px 16px',
  borderRadius: 'var(--rayon-controle)',
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--or)',
  border: '1px solid var(--or)',
  transition: 'background var(--transition-courte), color var(--transition-courte)',
};

export default function EpreuvesLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  // /epreuves/pochette → 'pochette'
  const slug = pathname.split('/')[2] ?? '';
  const trouve = EPREUVES.findIndex((x) => x.slug === slug);
  const index = trouve < 0 ? 0 : trouve;
  const e = EPREUVES[index];

  // Direction du glissement, calculée PENDANT le rendu et non dans un effet :
  // un useEffect s'exécuterait après la première image du nouveau contenu,
  // qui partirait donc du mauvais côté le temps d'une frame.
  const precRef = useRef(index);
  const dirRef = useRef(1);
  if (precRef.current !== index) {
    dirRef.current = index > precRef.current ? 1 : -1;
    precRef.current = index;
  }

  // Position de la lumière sur l'onde.
  // Premier chargement (arrivée directe par URL, pub, moteur de recherche) :
  // la lumière part de la première section et glisse jusqu'à la bonne, comme
  // le faisait l'ancien ?e=N. Ensuite, elle suit la navigation immédiatement,
  // l'inertie de l'onde se chargeant du reste.
  const [ondeIndex, setOndeIndex] = useState(0);
  const premierRef = useRef(true);

  useEffect(() => {
    if (premierRef.current) {
      premierRef.current = false;
      if (index === 0) return;
      const t = setTimeout(() => setOndeIndex(index), 450);
      return () => clearTimeout(t);
    }
    setOndeIndex(index);
  }, [index]);

  // Relance : le bouton est ici, le jeu est dans {children}
  const [cleRelance, setCleRelance] = useState(0);
  const ctx = useMemo(
    () => ({ cleRelance, relancer: () => setCleRelance((k) => k + 1) }),
    [cleRelance]
  );

  // Flèches du clavier. scroll: false → on reste à la même hauteur de page,
  // le décor étant identique d'une épreuve à l'autre.
  useEffect(() => {
    function onKey(ev) {
      const c = ev.target;
      if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA')) return;
      if (ev.key === 'ArrowLeft' && index > 0) {
        router.push(`/epreuves/${EPREUVES[index - 1].slug}`, { scroll: false });
      }
      if (ev.key === 'ArrowRight' && index < EPREUVES.length - 1) {
        router.push(`/epreuves/${EPREUVES[index + 1].slug}`, { scroll: false });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, router]);

  const fleche = (dispo) => ({
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: dispo ? 'var(--or)' : 'var(--cendre)',
    border: `1px solid ${dispo ? 'var(--or)' : 'var(--filet)'}`,
    cursor: dispo ? 'pointer' : 'not-allowed',
    flexShrink: 0,
    textDecoration: 'none',
    transition:
      'color var(--transition-courte), border-color var(--transition-courte), background var(--transition-courte)',
  });

  const precedente = index > 0 ? EPREUVES[index - 1] : null;
  const suivante = index < EPREUVES.length - 1 ? EPREUVES[index + 1] : null;

  const SVG_GAUCHE = (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
  const SVG_DROITE = (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );

  return (
    <EpreuveContext.Provider value={ctx}>
      <main className="contenu">
        <style>{`
          @keyframes glisseDroite {
            from { transform: translateX(42px); opacity: 0 }
            to   { transform: translateX(0);    opacity: 1 }
          }
          @keyframes glisseGauche {
            from { transform: translateX(-42px); opacity: 0 }
            to   { transform: translateX(0);     opacity: 1 }
          }
          @media (prefers-reduced-motion: reduce) {
            .glissiere { animation: none !important }
          }
        `}</style>

        {/* En-tête, identique à l'accueil, avec le curseur de volume en plus :
            c'est ici, et non sur l'accueil, qu'on écoute des extraits de jeu. */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--e3)', marginBottom: 'var(--e7)' }}>
          <Link href="/" style={{
            width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--or)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--or)', flexShrink: 0,
          }}>MB</Link>
          <div style={{ flex: 1 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ivoire)' }}>
              Mozart Benchmark
            </Link>
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>évaluation auditive</div>
          </div>
          <nav style={{ display: 'flex', gap: 'var(--e4)', fontSize: 12 }}>
            <Link href="/" style={{ color: 'var(--lin)' }}>accueil</Link>
          </nav>
        </header>

        {/* Titre de l'épreuve · carte du défi.
            Le titre change avec l'URL mais n'est pas remonté : pas de saut. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--e5)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minHeight: 118 }}>
            <div className="etiquette-mono">épreuve {e.num} · accès libre</div>
            <h1 className="titre-page" style={{ marginTop: 'var(--e2)' }}>{e.nom}</h1>
            <p className="lin" style={{ marginTop: 'var(--e2)', maxWidth: 470 }}>{e.desc}</p>
          </div>

          <Link href="/quotidien"
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
          </Link>
        </div>

        {/* L'onde. Jamais démontée : c'est elle qui porte la continuité visuelle. */}
        <div style={{ marginTop: 'var(--e5)' }}>
          <Onde variante="bandeau" sections={EPREUVES.length} active={ondeIndex} />
        </div>

        {/* Le carrousel : dix liens réels, une URL chacun.
            prefetch charge la route voisine avant même le clic → transition
            instantanée, sans écran blanc. */}
        <nav
          aria-label="Les dix épreuves"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`,
            gap: 6,
            marginTop: 'var(--e4)',
            marginBottom: 'var(--e5)',
          }}
        >
          {EPREUVES.map((x, k) => (
            <Link
              key={x.slug}
              href={`/epreuves/${x.slug}`}
              scroll={false}
              prefetch
              aria-current={k === index ? 'page' : undefined}
              style={{
                paddingTop: 'var(--e2)', paddingBottom: 'var(--e2)',
                display: 'block', textAlign: 'left', textDecoration: 'none',
                borderTop: `${k === index ? '1px' : '0.5px'} solid ${k === index ? 'var(--or)' : 'var(--filet)'}`,
                transition: 'border-color var(--transition-courte)',
              }}
            >
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
            </Link>
          ))}
        </nav>

        {/* Bandeau d'action : contexte, relance, navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--e4)',
          borderTop: '0.5px solid var(--filet)', paddingTop: 'var(--e3)', marginBottom: 'var(--e4)',
        }}>
          <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
            {e.nom} · rejouable à volonté
          </span>

          <button
            onClick={ctx.relancer}
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
            Relancer l&apos;épreuve
          </button>

          <VolumeControl compact />

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)', marginLeft: 'auto' }}>
            {precedente ? (
              <Link href={`/epreuves/${precedente.slug}`} scroll={false} prefetch
                style={fleche(true)} aria-label={`Épreuve précédente : ${precedente.nom}`}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--or)'; }}>
                {SVG_GAUCHE}
              </Link>
            ) : (
              <span style={fleche(false)} aria-hidden="true">{SVG_GAUCHE}</span>
            )}

            {suivante ? (
              <Link href={`/epreuves/${suivante.slug}`} scroll={false} prefetch
                style={fleche(true)} aria-label={`Épreuve suivante : ${suivante.nom}`}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--or)'; ev.currentTarget.style.color = 'var(--noir)'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--or)'; }}>
                {SVG_DROITE}
              </Link>
            ) : (
              <span style={fleche(false)} aria-hidden="true">{SVG_DROITE}</span>
            )}
          </div>
        </div>

        {/* Le jeu glisse depuis le côté d'où l'on vient.
            key={slug} : le changement de clé remonte le bloc, donc l'animation
            se rejoue à chaque épreuve — y compris deux fois dans le même sens.
            overflowX clip (et non hidden) : les listes déroulantes des jeux
            peuvent dépasser vers le bas. */}
        <div style={{ overflowX: 'clip', overflowY: 'visible' }}>
          <div
            key={slug}
            className="glissiere"
            style={{
              animation: `${dirRef.current > 0 ? 'glisseDroite' : 'glisseGauche'} 300ms cubic-bezier(0.4, 0, 0.2, 1) both`,
            }}
          >
            {children}
          </div>
        </div>

        <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
          Mozart Benchmark — extraits fournis par Deezer, sons de synthèse et échantillons libres.
        </footer>
      </main>
    </EpreuveContext.Provider>
  );
}
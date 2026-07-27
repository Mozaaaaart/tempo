'use client';
import { useState } from 'react';
import Onde from '@/components/Onde';

const EPREUVES = [
  { num: '01', titre: 'Accords', href: '/epreuves?e=1',
    desc: 'Place trois ou quatre notes sur la portée, écoute l\'écart avec la cible.' },
  { num: '02', titre: 'Rythme', href: '/epreuves?e=2',
    desc: 'Reproduis un pattern de batterie au clic, à cinquante millisecondes près.' },
  { num: '03', titre: 'Artiste', href: '/epreuves?e=3',
    desc: 'Devine l\'artiste du jour. Genre, pays, décennie : les indices tombent à chaque erreur.' },
  { num: '04', titre: 'Pochette', href: '/epreuves?e=4',
    desc: 'Une pochette d\'album, floutée à l\'extrême. Le flou se lève à chaque tentative.' },
  { num: '05', titre: 'Humain ou IA', href: '/epreuves?e=5',
    desc: 'Deux extraits, l\'un composé par un humain, l\'autre par une machine. À toi de trancher.' },
];

export default function Accueil() {
  const [active, setActive] = useState(null);

  const styleColonne = (k) => ({
    paddingTop: 'var(--e3)',
    borderTop: `${active === k ? '1px' : '0.5px'} solid ${active === k ? 'var(--or)' : 'var(--filet)'}`,
    transition: 'border-color var(--transition-courte)',
    color: 'inherit',
    display: 'block',
  });

  const styleBlocQuotidien = {
    display: 'block', marginTop: 'var(--e7)', padding: 'var(--e5)',
    border: '1px solid var(--or)', borderRadius: 'var(--rayon-carte)',
    color: 'inherit', background: 'transparent',
    boxShadow: '0 0 0 rgba(239, 159, 39, 0)',
    transition: 'box-shadow var(--transition-courte), background var(--transition-courte), border-color var(--transition-courte)',
  };

  // Halo doré au survol : box-shadow plutôt que filter, bien moins coûteux
  function allumer(ev) {
    ev.currentTarget.style.boxShadow = '0 0 26px rgba(239, 159, 39, 0.6)';
    ev.currentTarget.style.background = 'var(--onyx-haut)';
    ev.currentTarget.style.borderColor = 'var(--or-clair)';
  }
  function eteindre(ev) {
    ev.currentTarget.style.boxShadow = '0 0 0 rgba(239, 159, 39, 0)';
    ev.currentTarget.style.background = 'transparent';
    ev.currentTarget.style.borderColor = 'var(--or)';
  }

  return (
    <main className="contenu">
      {/* 1 — En-tête */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--e3)', marginBottom: 'var(--e8)' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          border: '1px solid var(--or)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--or)', flexShrink: 0,
        }}>
          MB
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Mozart Benchmark</div>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>évaluation auditive</div>
        </div>
        <nav style={{ display: 'flex', gap: 'var(--e4)', fontSize: 12 }}>
          <a href="/epreuves" style={{ color: 'var(--lin)' }}>toutes les épreuves</a>
          <a href="/quotidien" style={{ color: 'var(--lin)' }}>défi du jour</a>
        </nav>
      </header>

      {/* 2 — Titre */}
      <h1 className="titre-page">
        L'oreille se travaille.<br />La tienne vaut combien ?
      </h1>

      {/* 3 — Sous-titre */}
      <p className="lin" style={{ marginTop: 'var(--e3)', maxWidth: 390 }}>
        Cinq épreuves courtes, notées sur dix. Aucune connaissance en solfège requise.
      </p>

      {/* 4 — Lien d'entrée */}
      <div style={{ marginTop: 'var(--e5)' }}>
        <a href="/quotidien" style={{ fontSize: 14 }}>Commencer le défi du jour →</a>
      </div>

      {/* 5 — L'onde */}
      <div style={{ marginTop: 'var(--e7)' }}>
        <Onde sections={5} active={active} />
      </div>

      {/* 6 — Grille des cinq épreuves */}
      <div
        className="grille-epreuves"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--e3)', marginTop: 'var(--e5)' }}
        onMouseLeave={() => setActive(null)}
      >
        {EPREUVES.map((e, k) => (
          <a key={e.num} href={e.href} onMouseEnter={() => setActive(k)} onFocus={() => setActive(k)} style={styleColonne(k)}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.09em', color: 'var(--cendre)' }}>
              {e.num}
            </div>
            <div style={{ fontSize: 14, marginTop: 'var(--e1)', color: active === k ? 'var(--or)' : 'var(--ivoire)', transition: 'color var(--transition-courte)' }}>
              {e.titre}
            </div>
          </a>
        ))}
      </div>

      {/* 7 — Ligne de description (hauteur fixe : la page ne saute pas) */}
      <p className="description" style={{ marginTop: 'var(--e4)', minHeight: '2.6em' }}>
        {active === null ? 'Survole une épreuve pour la découvrir.' : EPREUVES[active].desc}
      </p>

      {/* 8 — Bloc du défi quotidien : seul élément encadré */}
      <a href="/quotidien" style={styleBlocQuotidien} onMouseEnter={allumer} onMouseLeave={eteindre}>
        <div className="etiquette-mono">défi du jour</div>
        <p style={{ fontSize: 14, marginTop: 'var(--e2)' }}>
          Dix épreuves, les mêmes pour tous, jusqu'à minuit. Ton résultat se partage en une ligne.
        </p>
      </a>

      {/* 9 — Mention de pied */}
      <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
        Mozart Benchmark — extraits fournis par Deezer, sons de synthèse et échantillons libres.
      </footer>
    </main>
  );
}
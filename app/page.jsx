'use client';
import { useState } from 'react';
import Link from 'next/link';
import Onde from '@/components/Onde';
import Ambiance from '@/components/Ambiance';
import { EPREUVES as CATALOGUE, lienEpreuve } from '@/data/epreuves';

/**
 * Les cinq épreuves mises en avant sur l'accueil, dans l'ordre d'affichage.
 * Seuls les slugs sont listés ici : titres et URLs viennent de la source
 * unique. Renommer un slug dans data/epreuves.js ne peut donc pas laisser un
 * lien mort derrière lui — la page lèverait une erreur au build.
 */
const VITRINE = ['accords', 'rythme', 'artiste', 'pochette', 'humain-ou-ia'];

/**
 * Accroches propres à l'accueil, plus courtes et plus racoleuses que les
 * descriptions du catalogue, qui servent aux métadonnées et aux pages
 * d'épreuve. C'est le seul texte volontairement dupliqué.
 */
const ACCROCHES = {
  'accords': 'Place trois ou quatre notes sur la portée, écoute l\'écart avec la cible.',
  'rythme': 'Reproduis un pattern de batterie au clic, à cinquante millisecondes près.',
  'artiste': 'Devine l\'artiste du jour. Genre, pays, décennie : les indices tombent à chaque erreur.',
  'pochette': 'Une pochette d\'album, floutée à l\'extrême. Le flou se lève à chaque tentative.',
  'humain-ou-ia': 'Deux extraits, l\'un composé par un humain, l\'autre par une machine. À toi de trancher.',
};

const EPREUVES = VITRINE.map((slug) => {
  const e = CATALOGUE.find((x) => x.slug === slug);
  if (!e) throw new Error(`Slug inconnu dans la vitrine de l'accueil : ${slug}`);
  return {
    num: e.num,
    titre: e.nom,
    href: lienEpreuve(e.slug),
    desc: ACCROCHES[slug] ?? e.desc,
  };
});

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
      {/* 1 — En-tête.
          ATTENTION : ne monter qu'UN SEUL <Ambiance> par page. Deux instances
          créent deux AudioContext indépendants qui jouent simultanément —
          son doublé, décalage entre les deux, oscillateurs en double. Celui
          de la page vit désormais au bloc 4. */}
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
          {/* Vers la première épreuve directement : /epreuves ne fait que
              rediriger, autant s'épargner l'aller-retour serveur. */}
          <Link href={lienEpreuve(CATALOGUE[0].slug)} style={{ color: 'var(--lin)' }}>
            toutes les épreuves
          </Link>
          <Link href="/quotidien" style={{ color: 'var(--lin)' }}>défi du jour</Link>
        </nav>
      </header>

      {/* 2 — Titre */}
      <h1 className="titre-page">
        L&apos;oreille se travaille.<br />La tienne vaut combien ?
      </h1>

      {/* 3 — Sous-titre */}
      <p className="lin" style={{ marginTop: 'var(--e3)', maxWidth: 390 }}>
        Cinq épreuves courtes, notées sur dix. Aucune connaissance en solfège requise.
      </p>

      {/* 4 — Invitation à activer le son, avec le réglage à côté.
          `deploye` garde le curseur visible en permanence : à cet endroit il
          fait partie du message, il ne doit pas se dérober quand la souris
          s'éloigne. */}
      <div style={{
        marginTop: 'var(--e5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--e3)',
        flexWrap: 'wrap',
        rowGap: 'var(--e2)',
      }}>
        <span className="lin" style={{ fontSize: 14, color: '#EF9F27' }}>
          Ce site s&apos;écoute. Activez le son pour l&apos;ambiance.
        </span>
        <Ambiance deploye />
      </div>

      {/* 5 — L'onde.
          `active` illumine la section, `survol` fait enfler l'onde au-dessus
          d'elle. Sur l'accueil, le survol pilote les deux, d'où la même valeur. */}
      <div style={{ marginTop: 'var(--e7)' }}>
        <Onde sections={EPREUVES.length} active={active} survol={active} />
      </div>

      {/* 6 — Grille des cinq épreuves */}
      <div
        className="grille-epreuves"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${EPREUVES.length}, 1fr)`, gap: 'var(--e3)', marginTop: 'var(--e5)' }}
        onMouseLeave={() => setActive(null)}
      >
        {EPREUVES.map((e, k) => (
          <Link
            key={e.href}
            href={e.href}
            onMouseEnter={() => setActive(k)}
            onFocus={() => setActive(k)}
            style={styleColonne(k)}
          >
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '0.09em', color: 'var(--cendre)' }}>
              {e.num}
            </div>
            <div style={{
              fontSize: 14, marginTop: 'var(--e1)',
              color: active === k ? 'var(--or)' : 'var(--ivoire)',
              transition: 'color var(--transition-courte)',
            }}>
              {e.titre}
            </div>
          </Link>
        ))}
      </div>

      {/* 7 — Ligne de description (hauteur fixe : la page ne saute pas) */}
      <p className="description" style={{ marginTop: 'var(--e4)', minHeight: '2.6em' }}>
        {active === null ? 'Survole une épreuve pour la découvrir.' : EPREUVES[active].desc}
      </p>

      {/* 8 — Bloc du défi quotidien : seul élément encadré, et désormais le
             principal appel à l'action de la page. */}
      <Link href="/quotidien" style={styleBlocQuotidien} onMouseEnter={allumer} onMouseLeave={eteindre}>
        <div className="etiquette-mono">défi du jour</div>
        <p style={{ fontSize: 14, marginTop: 'var(--e2)' }}>
          Dix épreuves, les mêmes pour tous, jusqu&apos;à minuit. Ton résultat se partage en une ligne.
        </p>
      </Link>

      {/* 9 — Mention de pied */}
      <footer style={{ marginTop: 'var(--e8)', textAlign: 'center', fontSize: 11, color: 'var(--cendre)' }}>
        Mozart Benchmark — extraits fournis par Deezer, sons de synthèse et échantillons libres.
      </footer>
    </main>
  );
}
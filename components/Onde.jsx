'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * L'onde — élément signature du site.
 * Faisceau de sinusoïdes tressées ; la lumière dorée se déplace LE LONG du tracé
 * (stroke-dasharray + dashoffset), jamais par masque rectangulaire.
 *
 * Géométrie (doc de design) :
 *   s    = signe(t) · |t|^0.62        amplitude du brin
 *   φ    = t · 0.55                   dérive de phase → torsion en ruban
 *   e(x) = sin(πx/W)^0.72             enveloppe, l'onde meurt sur les bords
 *   y(x) = cy + A · s · e(x) · sin(2π·f·x/W + φ)
 *
 * La largeur W est celle du conteneur : le tracé est recalculé au redimensionnement,
 * ce qui garde une épaisseur de trait constante quelle que soit la largeur.
 */

const FREQUENCE = 2.35;
const OPACITE_HALO = 0.02;
const LARGEUR_HALO = 6;
const LARGEUR_COEUR = 1;
const RETARD_PAR_BRIN = 90;

const PRESETS = {
  principale: { desktop: { brins: 19, amplitude: 68, hauteur: 130, pas: 4 },
                mobile:  { brins: 11, amplitude: 44, hauteur: 100, pas: 6 } },
  bandeau:    { desktop: { brins: 9,  amplitude: 26, hauteur: 54,  pas: 4 },
                mobile:  { brins: 7,  amplitude: 20, hauteur: 46,  pas: 6 } },
};

function construireBrins({ brins, amplitude, hauteur, pas, sections, W }) {
  const cy = hauteur / 2;
  const resultat = [];

  for (let i = 0; i < brins; i++) {
    const t = brins === 1 ? 0 : -1 + (2 * i) / (brins - 1);
    const s = Math.sign(t) * Math.pow(Math.abs(t), 0.62);
    const phi = t * 0.55;

    const pts = [];
    for (let x = 0; x <= W; x += pas) {
      const env = Math.pow(Math.max(0, Math.sin((Math.PI * x) / W)), 0.72);
      pts.push([x, cy + amplitude * s * env * Math.sin((2 * Math.PI * FREQUENCE * x) / W + phi)]);
    }
    if (pts[pts.length - 1][0] < W) pts.push([W, cy]);

    // Longueur d'arc cumulée — c'est elle qui aligne la lumière sur les colonnes
    const cum = [0];
    for (let j = 1; j < pts.length; j++) {
      cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    }
    const total = cum[cum.length - 1];

    const arcEn = (xq) => {
      const q = Math.min(Math.max(xq, 0), W);
      const idx = Math.min(Math.floor(q / pas), pts.length - 2);
      const [x0] = pts[idx];
      const [x1] = pts[idx + 1];
      const ratio = x1 === x0 ? 0 : (q - x0) / (x1 - x0);
      return cum[idx] + (cum[idx + 1] - cum[idx]) * ratio;
    };

    const centres = Array.from({ length: sections }, (_, k) => arcEn(((k + 0.5) * W) / sections));

    resultat.push({
      d: 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L'),
      total,
      centres,
      segment: total / sections,
      opacite: 0.26 + 0.6 * Math.abs(t),
      retard: Math.abs(t) * RETARD_PAR_BRIN,
    });
  }
  return resultat;
}

export default function Onde({ variante = 'principale', sections = 5, active = null }) {
  const [mobile, setMobile] = useState(false);
  const [largeur, setLargeur] = useState(0);
  const boiteRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // Mesure la largeur réelle du conteneur et suit ses changements
  useEffect(() => {
    const el = boiteRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entree]) => {
      setLargeur(Math.round(entree.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cfg = PRESETS[variante][mobile ? 'mobile' : 'desktop'];
  const { hauteur } = cfg;
  // Amplitude proportionnelle à la largeur : une onde très large mérite plus de relief
  // Léger gain avec la largeur, mais plafonné : l'onde reste une bande, pas un bloc
  const amplitude = Math.min(cfg.amplitude * Math.min(1.25, Math.max(1, largeur / 728) * 0.6), hauteur / 2 - 6);
  const W = largeur || 728;

  const brins = useMemo(
    () => construireBrins({ ...cfg, amplitude, sections, W }),
    [cfg.brins, cfg.hauteur, cfg.pas, amplitude, sections, W]
  );

  const gradId = `onde-or-${variante}`;

  return (
    <div ref={boiteRef} style={{ width: '100%' }}>
      {largeur > 0 && (
        <svg
          viewBox={`0 0 ${W} ${hauteur}`}
          width="100%"
          height={hauteur}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5A3406" />
              <stop offset="18%" stopColor="#BA7517" />
              <stop offset="38%" stopColor="#EF9F27" />
              <stop offset="55%" stopColor="#FAC775" />
              <stop offset="72%" stopColor="#EF9F27" />
              <stop offset="88%" stopColor="#8F5A10" />
              <stop offset="100%" stopColor="#4A2B05" />
            </linearGradient>
          </defs>

          {/* Couche éteinte : bronze, présente en permanence */}
          <g fill="none" stroke="var(--bronze)">
            {brins.map((b, i) => (
              <g key={`b${i}`}>
                <path d={b.d} strokeWidth={LARGEUR_HALO} opacity={OPACITE_HALO * 0.4} />
                <path d={b.d} strokeWidth={LARGEUR_COEUR} opacity={b.opacite * 0.4} />
              </g>
            ))}
          </g>

          {/* Couche allumée : or, visible sur un segment qui glisse le long du tracé */}
          <g fill="none" stroke={`url(#${gradId})`}>
            {brins.map((b, i) => {
              const centre = active === null ? null : b.centres[active];
              const segCoeur = b.segment;
              const segHalo = b.segment * 1.45;
              const offCoeur = centre === null ? b.total * 2 : segCoeur / 2 - centre;
              const offHalo = centre === null ? b.total * 2 : segHalo / 2 - centre;
              const transition = `stroke-dashoffset var(--transition-onde) ${b.retard}ms`;
              return (
                <g key={`o${i}`}>
                  <path
                    d={b.d}
                    strokeWidth={LARGEUR_HALO}
                    opacity={OPACITE_HALO}
                    strokeDasharray={`${segHalo} ${b.total}`}
                    strokeDashoffset={offHalo}
                    style={{ transition }}
                  />
                  <path
                    d={b.d}
                    strokeWidth={LARGEUR_COEUR}
                    opacity={b.opacite}
                    strokeDasharray={`${segCoeur} ${b.total}`}
                    strokeDashoffset={offCoeur}
                    style={{ transition }}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
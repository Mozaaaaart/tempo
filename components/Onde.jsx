'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * L'onde — élément signature du site, en mouvement permanent.
 *
 * Géométrie de base :
 *   s    = signe(t) · |t|^0.62        amplitude du brin
 *   e(x) = sin(πx/W)^0.72             enveloppe, l'onde meurt sur les bords
 *   y(x) = cy + A · s · e(x) · sin(2π·f·x/W + φ)
 *
 * Trois mouvements superposés, de périodes différentes (l'ensemble ne boucle
 * donc jamais visiblement) : écoulement, torsion, respiration.
 *
 * L'illumination du survol est animée EN JAVASCRIPT, pas en CSS : le tracé
 * étant recalculé à chaque image, une transition CSS redémarrerait sans cesse
 * et n'atteindrait jamais sa cible. Chaque brin a sa propre inertie, ce qui
 * reproduit le décalage de départ du centre vers les bords.
 */

const FREQUENCE = 2.35;
const OPACITE_HALO = 0.02;
const LARGEUR_HALO = 6;
const LARGEUR_COEUR = 1;

// Périodes des trois mouvements, en millisecondes
const PERIODE_ECOULEMENT = 8000;
const PERIODE_TORSION = 19000;
const PERIODE_RESPIRATION = 7000;

const TORSION_BASE = 0.55;
const TORSION_VARIATION = 0.35;
const RESPIRATION = 0.45;        // ±38 % d'amplitude : le faisceau enfle nettement
const RESPIRATION_PAR_BRIN = 0.16;

// Inertie de la lumière : plus la valeur est petite, plus le brin est lent.
// Exprimée sur une base de 30 i/s, puis corrigée selon la cadence réelle.
const INERTIE_CENTRE = 0.16;
const INERTIE_BORD = 0.10;

const IMAGES_PAR_SECONDE = 60;

const PRESETS = {
  principale: { desktop: { brins: 19, amplitude: 54, hauteur: 168, pas: 6 },
                mobile:  { brins: 11, amplitude: 34, hauteur: 124, pas: 8 } },
  bandeau:    { desktop: { brins: 9,  amplitude: 20, hauteur: 70,  pas: 6 },
                mobile:  { brins: 7,  amplitude: 16, hauteur: 58,  pas: 8 } },
};

const TAU = Math.PI * 2;

function construireBrins({ brins, amplitude, hauteur, pas, sections, W, temps = 0 }) {
  const cy = hauteur / 2;

  const ecoulement = (temps / PERIODE_ECOULEMENT) * TAU;
  const torsion = TORSION_BASE + TORSION_VARIATION * Math.sin((temps / PERIODE_TORSION) * TAU);
  const souffle = 1 + RESPIRATION * Math.sin((temps / PERIODE_RESPIRATION) * TAU);

  const resultat = [];

  for (let i = 0; i < brins; i++) {
    const t = brins === 1 ? 0 : -1 + (2 * i) / (brins - 1);
    const s = Math.sign(t) * Math.pow(Math.abs(t), 0.62);
    const phi = t * torsion + ecoulement + t * 0.35;
    // Respiration globale + décalage par brin : le faisceau s'ouvre et se referme
    const ampli = amplitude * souffle
      * (1 + RESPIRATION_PAR_BRIN * Math.sin((temps / PERIODE_RESPIRATION) * TAU + t * 2.4));

    const pts = [];
    for (let x = 0; x <= W; x += pas) {
      const env = Math.pow(Math.max(0, Math.sin((Math.PI * x) / W)), 0.72);
      pts.push([x, cy + ampli * s * env * Math.sin((TAU * FREQUENCE * x) / W + phi)]);
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

    // Position relative (0 → 1) du milieu de chaque section
    const centres = Array.from({ length: sections }, (_, k) => arcEn(((k + 0.5) * W) / sections) / total);

    resultat.push({
      d: 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L'),
      total,
      centres,
      t,
      opacite: 0.26 + 0.6 * Math.abs(t),
    });
  }
  return resultat;
}

export default function Onde({ variante = 'principale', sections = 5, active = null }) {
  const [mobile, setMobile] = useState(false);
  const [largeur, setLargeur] = useState(0);
  const [temps, setTemps] = useState(0);
  const boiteRef = useRef(null);

  // Position animée de la lumière, par brin (index de section, valeur continue)
  const posRef = useRef([]);
  const opaciteRef = useRef(0);
  const activeRef = useRef(null);
  activeRef.current = active;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

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
  const { hauteur, brins: nbBrins } = cfg;

  // Horloge : fait avancer l'onde ET rapproche la lumière de sa cible
  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    const debut = performance.now();
    let dernier = 0;
    let avant = 0;
    const intervalle = 1000 / IMAGES_PAR_SECONDE;

    const boucle = (t) => {
      if (t - dernier >= intervalle) {
        dernier = t;
        const cible = activeRef.current;

        // Facteur ramené à une base de 30 i/s : la vitesse perçue ne dépend
        // plus de la cadence de rafraîchissement de l'écran.
        const dt = Math.min((t - (avant || t)) / (1000 / 30), 3);
        avant = t;

        if (posRef.current.length !== nbBrins) {
          posRef.current = Array.from({ length: nbBrins }, () => cible ?? 0);
        }
        if (cible !== null) {
          for (let i = 0; i < nbBrins; i++) {
            const u = nbBrins === 1 ? 0 : Math.abs(-1 + (2 * i) / (nbBrins - 1));
            const k = INERTIE_CENTRE + (INERTIE_BORD - INERTIE_CENTRE) * u;
            const kdt = reduit ? 1 : 1 - Math.pow(1 - k, dt);
            const ecart = cible - posRef.current[i];
            // Sous ce seuil, on se pose exactement : évite la traîne infinie
            posRef.current[i] = Math.abs(ecart) < 0.005
              ? cible
              : posRef.current[i] + ecart * kdt;
          }
        }
        const kOp = reduit ? 1 : 1 - Math.pow(1 - 0.12, dt);
        opaciteRef.current += ((cible === null ? 0 : 1) - opaciteRef.current) * kOp;

        setTemps(reduit ? 0 : t - debut);
      }
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [nbBrins]);

  // Plafond calculé sur l'amplitude MAXIMALE atteinte pendant la respiration,
  // pour que les crêtes ne sortent jamais du cadre.
  const gonflementMax = (1 + RESPIRATION) * (1 + RESPIRATION_PAR_BRIN);
  const amplitude = Math.min(
    cfg.amplitude * Math.min(1.25, Math.max(1, largeur / 728) * 0.6),
    (hauteur / 2 - 4) / gonflementMax
  );
  const W = largeur || 728;

  const brinsCalcules = useMemo(
    () => construireBrins({ ...cfg, amplitude, sections, W, temps }),
    [cfg.brins, cfg.hauteur, cfg.pas, amplitude, sections, W, temps]
  );

  const gradId = `onde-or-${variante}`;

  // Centre interpolé entre deux sections, selon la position animée du brin
  function centreAnime(b, i) {
    const p = posRef.current[i] ?? 0;
    const a = Math.max(0, Math.min(Math.floor(p), sections - 1));
    const z = Math.max(0, Math.min(a + 1, sections - 1));
    return b.centres[a] + (b.centres[z] - b.centres[a]) * (p - a);
  }

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
            {brinsCalcules.map((b, i) => (
              <g key={`b${i}`}>
                <path d={b.d} strokeWidth={LARGEUR_HALO} opacity={OPACITE_HALO * 0.4} />
                <path d={b.d} strokeWidth={LARGEUR_COEUR} opacity={b.opacite * 0.4} />
              </g>
            ))}
          </g>

          {/* Couche allumée : or, sur un segment qui suit la courbe */}
          <g fill="none" stroke={`url(#${gradId})`} opacity={opaciteRef.current}>
            {brinsCalcules.map((b, i) => {
              const ratio = centreAnime(b, i);
              const segCoeur = b.total / sections;
              const segHalo = segCoeur * 1.45;
              const offCoeur = segCoeur / 2 - ratio * b.total;
              const offHalo = segHalo / 2 - ratio * b.total;
              return (
                <g key={`o${i}`}>
                  <path
                    d={b.d}
                    strokeWidth={LARGEUR_HALO}
                    opacity={OPACITE_HALO}
                    strokeDasharray={`${segHalo} ${b.total}`}
                    strokeDashoffset={offHalo}
                  />
                  <path
                    d={b.d}
                    strokeWidth={LARGEUR_COEUR}
                    opacity={b.opacite}
                    strokeDasharray={`${segCoeur} ${b.total}`}
                    strokeDashoffset={offCoeur}
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
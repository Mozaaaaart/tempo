'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * L'onde — élément signature du site, en mouvement permanent.
 *
 * ------------------------------------------------------------------ modèle
 *
 *     y_i(x) = cy + A_i · vrille(x) · PROFIL(x) · sin(θ(x) + δ_i)
 *
 * La différence avec la version précédente tient en un mot : PROFIL est FIXE.
 *
 * Ce n'est plus une somme de paquets qui dérivent chacun à leur vitesse — la
 * composition changeait alors en permanence et rien n'était reconnaissable.
 * C'est désormais une enveloppe écrite à la main, position par position :
 * deux petites bosses, un grand pic, un creux profond, un pic moyen, une
 * bosse finale. Cette silhouette ne bouge jamais.
 *
 * Ce qui bouge, c'est l'oscillation qui la traverse : θ(x) défile, donc les
 * brins glissent à l'intérieur d'une forme immobile. Le lobe reste un lobe,
 * mais il vit.
 *
 * COHÉRENCE — pourquoi ça ne se tresse pas
 * PROFIL, vrille et θ sont identiques pour tous les brins ; seul A_i change.
 * La famille est de la forme A_i · f(x) : les brins ne se croisent qu'aux
 * zéros de f, tous au même endroit et en même temps. Toute phase propre à un
 * brin casserait la propriété — d'où la valeur minuscule de RETARD.
 *
 * L'illumination du survol est animée EN JAVASCRIPT, pas en CSS : le tracé
 * étant recalculé à chaque image, une transition CSS redémarrerait sans cesse
 * et n'atteindrait jamais sa cible.
 */

// ------------------------------------------------------------------ profil

/**
 * LA SILHOUETTE. C'est ici que tout se joue.
 *
 * Chaque point est [position, amplitude] :
 *   position   0 = bord gauche, 1 = bord droit
 *   amplitude  0 = ligne plate, 1 = pleine hauteur
 *
 * Entre deux points, interpolation lissée (dérivée nulle aux nœuds) : les
 * lobes montent et redescendent en douceur, sans angle.
 *
 * Pour redessiner la forme, il suffit de réécrire cette table. Ajouter un
 * lobe = ajouter trois points (pied, sommet, pied). Aplatir une zone = mettre
 * l'amplitude à 0 sur deux points consécutifs.
 */
const PROFIL = [
  [0.000, 0.00],
  [0.040, 0.00],
  [0.075, 0.20],  // première petite bosse
  [0.110, 0.06],
  [0.150, 0.30],  // seconde bosse, un peu plus haute
  [0.195, 0.10],
  [0.250, 0.46],  // montée vers le grand pic
  [0.300, 0.72],
  [0.345, 1.00],  // LE grand pic
  [0.395, 0.66],
  [0.445, 0.30],
  [0.490, 0.14],
  [0.530, 0.25],  // palier calme au centre
  [0.570, 0.22],
  [0.610, 0.62],
  [0.650, 0.92],  // creux profond (l'amplitude est haute, la phase l'inverse)
  [0.690, 0.58],
  [0.730, 0.22],
  [0.765, 0.10],
  [0.805, 0.40],  // pic moyen
  [0.845, 0.62],
  [0.885, 0.34],
  [0.925, 0.25],  // bosse finale
  [0.960, 0.13],
  [1.000, 0.05],
];

// Nombre d'oscillations sur toute la largeur. Plus c'est haut, plus les brins
// sont serrés à l'intérieur de chaque lobe.
const FREQUENCE = 1.6;

// Temps que met l'oscillation à parcourir un cycle complet, ms.
// C'est la seule animation de la forme : le profil, lui, ne bouge pas.
const PERIODE_ECOULEMENT = 4600;

// ------------------------------------------------------------------- vrille

// Demi-tours de vrille sur la largeur. 0 désactive la torsion.
// Garder bas : sur une silhouette fixe, un pincement viendrait écraser un lobe.
const TORSION_TOURS = 0.1;
const PERIODE_TORSION = 18000;

// -------------------------------------------------------------- respiration

const PERIODE_RESPIRATION = 8000;
const RESPIRATION = 0.16;          // ±12 % : la silhouette doit rester stable
const RESPIRATION_PAR_BRIN = 0.08;

// Déphasage résiduel entre le brin du haut et celui du bas, en radians.
// Au-delà de ~0,25 le tressage revient.
const RETARD = 0.14;

// Répartition des brins : exposant < 1 les resserre vers les bords du ruban,
// ce qui épaissit le contour des lobes — c'est l'effet de maille de la référence.
const REPARTITION = 0.72;

// ------------------------------------------------------------------ lumière

const INERTIE_CENTRE = 0.16;
const INERTIE_BORD = 0.10;

const OPACITE_HALO = 0.02;
const LARGEUR_HALO = 6;
const LARGEUR_COEUR = 0.8;

const IMAGES_PAR_SECONDE = 60;

const PRESETS = {
  principale: { desktop: { brins: 30, amplitude: 54, hauteur: 168, pas: 5 },
                mobile:  { brins: 17, amplitude: 34, hauteur: 124, pas: 7 } },
  bandeau:    { desktop: { brins: 17, amplitude: 20, hauteur: 70,  pas: 5 },
                mobile:  { brins: 11, amplitude: 16, hauteur: 58,  pas: 7 } },
};

const TAU = Math.PI * 2;

const osc = (temps, periode, phase = 0) =>
  periode ? Math.sin((temps / periode) * TAU + phase) : 0;

const adoucir = (z) => z * z * (3 - 2 * z);

/**
 * Amplitude du profil à la position u, par interpolation lissée entre les
 * deux points encadrants. La table étant courte et ordonnée, une recherche
 * linéaire depuis un curseur qui avance suffit — appelée une seule fois par
 * abscisse, pas une fois par brin.
 */
function profilEn(u, curseur) {
  while (curseur.i < PROFIL.length - 2 && PROFIL[curseur.i + 1][0] < u) curseur.i++;
  const [x0, a0] = PROFIL[curseur.i];
  const [x1, a1] = PROFIL[curseur.i + 1];
  if (x1 === x0) return a0;
  const z = Math.min(Math.max((u - x0) / (x1 - x0), 0), 1);
  return a0 + (a1 - a0) * adoucir(z);
}

export const GONFLEMENT_MAX = (1 + RESPIRATION) * (1 + RESPIRATION_PAR_BRIN);

function construireBrins({ brins, amplitude, hauteur, pas, sections, W, temps = 0 }) {
  const cy = hauteur / 2;

  const ecoulement = (temps / PERIODE_ECOULEMENT) * TAU;
  const rotation = temps / PERIODE_TORSION;
  const souffle = 1 + RESPIRATION * osc(temps, PERIODE_RESPIRATION);

  const xs = [];
  for (let x = 0; x <= W; x += pas) xs.push(x);
  if (xs[xs.length - 1] < W) xs.push(W);
  const n = xs.length;

  /**
   * Décomposition sinus / cosinus :
   *
   *   f(u, δ) = PROFIL(u) · vrille(u) · sin(θ(u) + δ)
   *           = cos(δ) · S(u) + sin(δ) · C(u)
   *
   * S et C ne dépendent pas du brin : calculés une seule fois pour toute
   * l'onde. Le retard d'un brin ne coûte alors que deux multiplications par
   * point au lieu d'un appel trigonométrique.
   */
  const S = new Float64Array(n);
  const C = new Float64Array(n);
  const curseur = { i: 0 };

  for (let j = 0; j < n; j++) {
    const u = xs[j] / W;

    const enveloppe = profilEn(u, curseur);
    const vrille = TORSION_TOURS
      ? Math.cos(TAU * (TORSION_TOURS * u + rotation))
      : 1;

    const poids = enveloppe * vrille;
    const theta = TAU * FREQUENCE * u - ecoulement;

    S[j] = poids * Math.sin(theta);
    C[j] = poids * Math.cos(theta);
  }

  const resultat = [];

  for (let i = 0; i < brins; i++) {
    const t = brins === 1 ? 0 : -1 + (2 * i) / (brins - 1);
    const s = Math.sign(t) * Math.pow(Math.abs(t), REPARTITION);

    const ampli = amplitude * s * souffle
      * (1 + RESPIRATION_PAR_BRIN * osc(temps, PERIODE_RESPIRATION, t * 2.4));

    const delta = t * RETARD;
    const cd = Math.cos(delta);
    const sd = Math.sin(delta);

    const pts = new Array(n);
    for (let j = 0; j < n; j++) {
      pts[j] = [xs[j], cy + ampli * (S[j] * cd + C[j] * sd)];
    }

    const cum = [0];
    for (let j = 1; j < n; j++) {
      cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    }
    const total = cum[cum.length - 1];

    const arcEn = (xq) => {
      const q = Math.min(Math.max(xq, 0), W);
      const idx = Math.min(Math.floor(q / pas), n - 2);
      const [x0] = pts[idx];
      const [x1] = pts[idx + 1];
      const ratio = x1 === x0 ? 0 : (q - x0) / (x1 - x0);
      return cum[idx] + (cum[idx + 1] - cum[idx]) * ratio;
    };

    const centres = Array.from({ length: sections }, (_, k) => arcEn(((k + 0.5) * W) / sections) / total);

    resultat.push({
      d: 'M' + pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L'),
      total,
      centres,
      t,
      opacite: 0.22 + 0.62 * Math.abs(t),
    });
  }
  return resultat;
}

export default function Onde({ variante = 'principale', sections = 5, active = null, complete = false }) {
  const [mobile, setMobile] = useState(false);
  const [largeur, setLargeur] = useState(0);
  const [temps, setTemps] = useState(0);
  const boiteRef = useRef(null);

  const posRef = useRef([]);
  const opaciteRef = useRef(0);
  const activeRef = useRef(null);
  activeRef.current = active;

  /* AMPLEUR du segment illuminé, en fraction de la longueur totale du tracé.

     Vaut 1 / sections en temps normal : la lumière couvre exactement une
     section, c'est elle qui désigne l'élément actif. `complete` la porte à 1,
     et le tracé s'allume alors sur toute sa longueur.

     Animée comme le reste, par relaxation dans la boucle plutôt que par une
     transition CSS : la longueur vit dans un stroke-dasharray recalculé à
     chaque image, CSS n'a aucune prise dessus. La lumière s'ÉTEND donc depuis
     la section courante au lieu d'apparaître d'un coup — le geste dit
     « l'ensemble est achevé », ce qu'un basculement instantané ne dirait pas.

     Initialisée à null : la valeur de départ dépend de `sections`, qui n'est
     pas connu à la création de la ref. */
  const ampleurRef = useRef(null);
  /* La CIBLE, et non le booléen : la boucle n'a ainsi pas besoin de lire
     `sections`, qu'elle capturerait par fermeture alors que ses dépendances
     ne le déclarent pas. Sans effet aujourd'hui, `sections` étant constant,
     mais c'est le genre de dette qui se paie le jour où il cesse de l'être. */
  const ampleurCibleRef = useRef(1 / sections);
  ampleurCibleRef.current = complete ? 1 : 1 / sections;

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
            posRef.current[i] = Math.abs(ecart) < 0.005
              ? cible
              : posRef.current[i] + ecart * kdt;
          }
        }
        const kOp = reduit ? 1 : 1 - Math.pow(1 - 0.12, dt);
        opaciteRef.current += ((cible === null ? 0 : 1) - opaciteRef.current) * kOp;

        const ampleurCible = ampleurCibleRef.current;
        if (ampleurRef.current === null) ampleurRef.current = ampleurCible;
        // Plus lent que l'opacité : l'étalement doit se voir se produire.
        const kAmp = reduit ? 1 : 1 - Math.pow(1 - 0.07, dt);
        ampleurRef.current += (ampleurCible - ampleurRef.current) * kAmp;

        setTemps(reduit ? 0 : t - debut);
      }
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(raf);
  }, [nbBrins]);

  const amplitude = Math.min(
    cfg.amplitude * Math.min(1.25, Math.max(1, largeur / 728) * 0.6),
    (hauteur / 2 - 4) / GONFLEMENT_MAX
  );
  const W = largeur || 728;

  const brinsCalcules = useMemo(
    () => construireBrins({ ...cfg, amplitude, sections, W, temps }),
    [cfg.brins, cfg.hauteur, cfg.pas, amplitude, sections, W, temps]
  );

  const idOr = `onde-or-${variante}`;
  const idBase = `onde-base-${variante}`;

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
            <linearGradient id={idOr} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5A3406" />
              <stop offset="18%" stopColor="#BA7517" />
              <stop offset="38%" stopColor="#EF9F27" />
              <stop offset="55%" stopColor="#FAC775" />
              <stop offset="72%" stopColor="#EF9F27" />
              <stop offset="88%" stopColor="#8F5A10" />
              <stop offset="100%" stopColor="#4A2B05" />
            </linearGradient>

            <linearGradient id={idBase} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2A1803" />
              <stop offset="22%" stopColor="#4E3009" />
              <stop offset="45%" stopColor="#6E440D" />
              <stop offset="62%" stopColor="#7C4E10" />
              <stop offset="80%" stopColor="#4E3009" />
              <stop offset="100%" stopColor="#241403" />
            </linearGradient>

            
          </defs>


          <g fill="none" stroke={`url(#${idBase})`}>
            {brinsCalcules.map((b, i) => (
              <g key={`b${i}`}>
                <path d={b.d} strokeWidth={LARGEUR_HALO} opacity={OPACITE_HALO * 0.4} />
                <path d={b.d} strokeWidth={LARGEUR_COEUR} opacity={b.opacite} />
              </g>
            ))}
          </g>

          <g fill="none" stroke={`url(#${idOr})`} opacity={opaciteRef.current}>
            {brinsCalcules.map((b, i) => {
              const ratio = centreAnime(b, i);
              const ampleur = ampleurRef.current ?? 1 / sections;

              /* Le CENTRE glisse vers le milieu du tracé à mesure que la
                 lumière s'étend.

                 Sans ça, le segment reste calé sur la section active : une
                 fois porté à la longueur entière, il déborde d'un côté — où
                 le tracé le rogne — et manque de l'autre. Avec une épreuve
                 près du bord, il n'en restait visible qu'un peu plus de la
                 moitié.

                 À pleine ampleur le centre vaut donc 0,5, l'écart de phase
                 s'annule et le tracé est couvert d'un bout à l'autre. */
              const etendue = sections > 1
                ? Math.max(0, Math.min(1, (ampleur - 1 / sections) / (1 - 1 / sections)))
                : 1;
              const centre = ratio + (0.5 - ratio) * etendue;

              const segCoeur = b.total * ampleur;
              const segHalo = segCoeur * 1.45;
              const offCoeur = segCoeur / 2 - centre * b.total;
              const offHalo = segHalo / 2 - centre * b.total;
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
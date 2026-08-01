'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « TROUVE L'INSTRUMENT »

   Même dispositif que les autres épreuves : une surcouche `absolute` posée
   DANS le panneau du jeu, pas un voile plein écran, pour que le jeu reste
   visible en transparence derrière. Le panneau parent doit donc porter
   `position: 'relative'`.

   Ce que la démonstration doit faire comprendre : on écoute un timbre, on
   choisit d'abord un GROUPE, puis un instrument dans ce groupe. Le passage
   d'un écran à l'autre est le point clé — sans lui, on ne comprend pas
   pourquoi seuls six choix apparaissent d'abord.

   Le scénario est une table d'instants jouée par des minuteurs : les deux
   écrans se remplacent, ce qu'une @keyframes ne saurait pas orchestrer.
============================================================ */

const T_TITRE = 240;
const T_ACCROCHE = 620;
const T_DISQUE = 960;
const T_GROUPES = 1320;
const T_CURSEUR = 1620;

/* Acte 1 — on écoute le timbre. */
const T_VERS_DISQUE = 1900;
const T_CLIC_DISQUE = 2340;
const T_FIN_ECOUTE = 3200;

/* Acte 2 — on choisit le groupe. */
const T_VERS_GROUPE = 3300;
const T_CLIC_GROUPE = 3740;

/* Acte 3 — on choisit l'instrument dans ce groupe. */
const T_VERS_INSTRU = 4100;
const T_CLIC_INSTRU = 4540;
const T_VERDICT = 4780;
const T_SORTIE = T_VERDICT + 1500;
export const INTRO_INSTRUMENT_TOTAL = T_SORTIE + 420;

/* Les six groupes du jeu, avec leurs deux premiers instruments en exemple. */
const DEMO_GROUPES = [
  { nom: 'Claviers', ex: 'piano, orgue…' },
  { nom: 'Cordes frottées', ex: 'violon, violoncelle…' },
  { nom: 'Cordes pincées', ex: 'guitare acoustique…' },
  { nom: 'Bois', ex: 'flûte, clarinette…' },
  { nom: 'Cuivres', ex: 'trompette, trombone…' },
  { nom: 'Percussions', ex: 'xylophone…' },
];
const DEMO_CHOISI = 1;                       // « Cordes frottées »
const DEMO_INSTRUMENTS = ['Violon', 'Violoncelle', 'Contrebasse'];
const DEMO_BON = 0;                          // « Violon »

const SCENE_L = 520;
const SCENE_H = 380;
const H_CONTRAINTE = SCENE_H + 40;

/* Géométrie de la grille des groupes, pour placer le curseur dessus. */
const GRILLE_L = 460;
const CARTE_L = (GRILLE_L - 2 * 8) / 3;
const CARTE_H = 54;
const GRILLE_X = (SCENE_L - GRILLE_L) / 2;
const GRILLE_Y = 232;

const REPOS = { x: 440, y: 344 };
const DISQUE = { x: 268, y: 150 };
const carteCentre = (i) => ({
  x: GRILLE_X + (i % 3) * (CARTE_L + 8) + CARTE_L / 2,
  y: GRILLE_Y + Math.floor(i / 3) * (CARTE_H + 8) + CARTE_H / 2,
});
/* Cible du dernier clic : le premier instrument du groupe.
   Le repère n'est pas GRILLE_Y : l'écran 2 empile d'abord sa barre de retour
   (~22 px) et sa gouttière (12 px), la rangée de pastilles ne commence donc
   que 34 px plus bas, et son centre 16 px encore après.
   En X, les trois pastilles sont centrées sur la scène ; « Violon » étant la
   plus étroite, son centre tombe à gauche du milieu. */
const INSTRU_CIBLE = { x: 156, y: GRILLE_Y + 50 };

export default function IntroInstrument({ onFin }) {
  const [echelle, setEchelle] = useState(1);
  const [t, setT] = useState(0);
  const hote = useRef(null);
  const fini = useRef(false);
  const minuteurs = useRef([]);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    minuteurs.current.forEach(clearTimeout);
    onFin?.();
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }

    [T_VERS_DISQUE, T_CLIC_DISQUE, T_FIN_ECOUTE,
      T_VERS_GROUPE, T_CLIC_GROUPE,
      T_VERS_INSTRU, T_CLIC_INSTRU, T_VERDICT].forEach((instant) => {
      minuteurs.current.push(setTimeout(() => setT(instant), instant));
    });
    minuteurs.current.push(setTimeout(terminer, INTRO_INSTRUMENT_TOTAL));

    const surTouche = (e) => { if (e.key === 'Escape') terminer(); };
    window.addEventListener('keydown', surTouche);
    return () => {
      minuteurs.current.forEach(clearTimeout);
      window.removeEventListener('keydown', surTouche);
    };
  }, []);

  useEffect(() => {
    const calc = () => {
      const l = hote.current?.offsetWidth ?? SCENE_L;
      const h = hote.current?.offsetHeight ?? SCENE_H;
      setEchelle(Math.min(1, (l - 24) / SCENE_L, (h - 40) / H_CONTRAINTE));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  /* ---- États dérivés de l'horloge ---- */
  const joue = t >= T_CLIC_DISQUE && t < T_FIN_ECOUTE;
  const etapeGroupes = t < T_CLIC_GROUPE;      // premier écran
  const valide = t >= T_VERDICT;

  const main = t < T_VERS_DISQUE ? REPOS
    : t < T_VERS_GROUPE ? DISQUE
      : t < T_VERS_INSTRU ? carteCentre(DEMO_CHOISI)
        : INSTRU_CIBLE;

  const legende = t < T_VERS_GROUPE ? 'écoute le timbre'
    : t < T_VERS_INSTRU ? 'choisis le groupe'
      : 'puis l\u2019instrument';

  return (
    <div
      ref={hote}
      data-inst-surcouche
      onClick={terminer}
      role="button"
      tabIndex={0}
      aria-label="Passer la présentation"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); terminer(); }
      }}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `instVoile ${INTRO_INSTRUMENT_TOTAL}ms ease-out both`,
      }}
    >
      <style>{`
        @keyframes instVoile {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes instEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes instSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes instHaloIntro {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes instClicIntro {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-inst-surcouche], [data-inst-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>

      <div style={{
        width: SCENE_L, height: SCENE_H, position: 'relative',
        transform: `scale(${echelle})`, transformOrigin: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, animation: `instSortie 340ms ${T_SORTIE}ms ease-in both` }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `instEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Trouve l&apos;instrument
          </div>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 38, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `instEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            Le bon groupe vaut 5 points, le bon instrument 10
          </div>

          {/* ---------- Disque d'écoute ---------- */}
          <div style={{
            position: 'absolute', top: 76, left: '50%', marginLeft: -52,
            width: 104, height: 104,
            animation: `instEntree 340ms ${T_DISQUE}ms ease-out both`,
          }}>
            {joue && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid var(--or)',
                animation: 'instHaloIntro 1500ms ease-out infinite',
              }} />
            )}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
              background: 'var(--onyx-haut)',
              border: `1px solid ${joue ? 'var(--or)' : 'var(--filet-fort)'}`,
              color: joue ? 'var(--or)' : 'var(--ivoire)',
              transition: 'border-color 250ms ease, color 250ms ease',
            }}>
              {joue ? (
                <svg width="13" height="16" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="13" height="16" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 0v12l10-6z" />
                </svg>
              )}
              <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
                {joue ? 'écoute' : 'instrument mystère'}
              </span>
            </div>
          </div>

          {/* ---------- Légende de phase ---------- */}
          <div className="etiquette-mono" style={{
            position: 'absolute', top: 196, left: 0, right: 0, textAlign: 'center',
            color: 'var(--lin)',
            animation: `instEntree 320ms ${T_DISQUE + 160}ms ease-out both`,
          }}>
            {legende}
          </div>

          {/* ---------- Écran 1 : les groupes ---------- */}
          {/* Deux éléments imbriqués, et c'est nécessaire : une animation avec
             `both` fige opacity à sa valeur finale et l'emporte sur le style
             inline. Posées sur le même nœud, l'entrée et la bascule d'écran se
             disputaient la propriété — la grille ne disparaissait jamais.
             L'extérieur porte donc l'entrée, l'intérieur la bascule. */}
          <div style={{
            position: 'absolute', top: GRILLE_Y, left: GRILLE_X, width: GRILLE_L,
            pointerEvents: 'none',
            animation: `instEntree 340ms ${T_GROUPES}ms ease-out both`,
          }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8,
            opacity: etapeGroupes ? 1 : 0,
            transform: etapeGroupes ? 'none' : 'translateY(-6px)',
            transition: 'opacity 260ms ease, transform 260ms ease',
          }}>
            {DEMO_GROUPES.map((g, i) => {
              const vise = i === DEMO_CHOISI && t >= T_CLIC_GROUPE - 200;
              return (
                <div key={g.nom} style={{
                  height: CARTE_H, boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  padding: '0 var(--e2)',
                  borderRadius: 'var(--rayon-controle)',
                  border: `0.5px solid ${vise ? 'var(--or)' : 'var(--filet-fort)'}`,
                  color: vise ? 'var(--or)' : 'var(--ivoire)',
                  transition: 'border-color 200ms ease, color 200ms ease',
                }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500 }}>
                    {g.nom}
                  </span>
                  <span style={{
                    fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--lin)',
                    maxWidth: '100%', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {g.ex}
                  </span>
                </div>
              );
            })}
          </div>
          </div>

          {/* ---------- Écran 2 : les instruments du groupe ---------- */}
          <div style={{
            position: 'absolute', top: GRILLE_Y, left: 0, right: 0,
            opacity: etapeGroupes ? 0 : 1,
            transform: etapeGroupes ? 'translateY(6px)' : 'none',
            transition: 'opacity 260ms ease 120ms, transform 260ms ease 120ms',
            pointerEvents: 'none',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--e3)', marginBottom: 'var(--e3)',
            }}>
              <span style={{
                padding: '4px 10px', borderRadius: 'var(--rayon-controle)',
                border: '0.5px solid var(--filet-fort)',
                fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--lin)',
              }}>
                ← Retour
              </span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, color: 'var(--ivoire)' }}>
                {DEMO_GROUPES[DEMO_CHOISI].nom}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {DEMO_INSTRUMENTS.map((n, i) => {
                const bon = i === DEMO_BON;
                const vise = bon && t >= T_CLIC_INSTRU - 200;
                return (
                  <span key={n} style={{
                    padding: '8px 13px', borderRadius: 'var(--rayon-controle)',
                    background: 'var(--onyx-haut)',
                    border: `${valide && bon ? '1px' : '0.5px'} solid ${
                      valide && bon ? 'var(--jade)' : vise ? 'var(--or)' : 'var(--filet-fort)'}`,
                    color: valide && bon ? 'var(--jade)' : vise ? 'var(--or)' : 'var(--ivoire)',
                    fontFamily: 'var(--sans)', fontSize: 12.5,
                    transition: 'border-color 200ms ease, color 200ms ease',
                  }}>
                    {n}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ---------- Verdict ---------- */}
          <div style={{
            position: 'absolute', top: 336, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--jade)',
            opacity: 0,
            animation: valide ? 'instEntree 320ms ease-out both' : 'none',
          }}>
            C&apos;était un violon — 10 points
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${main.x}px, ${main.y}px)`,
            transition: 'transform 420ms cubic-bezier(0.5, 0, 0.2, 1)',
            opacity: t >= T_CURSEUR ? 1 : 0,
          }}>
            {[T_CLIC_DISQUE, T_CLIC_GROUPE, T_CLIC_INSTRU].map((instant) => (
              <div key={instant} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%', opacity: 0,
                animation: `instClicIntro 460ms ${instant - 40}ms ease-out both`,
              }} />
            ))}
            <svg width="16" height="21" viewBox="0 0 16 21" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
              <path
                d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SURCOUCHE DE RÉSULTAT
   Même dispositif que les autres épreuves : la note occupe le panneau le
   temps d'être lue, sa couleur dit le verdict avant le chiffre, la jauge la
   situe sur dix.
============================================================ */

function paletteScore(valeur) {
  const n = +valeur;
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'mauvais groupe' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'timbre reconnu' };
  if (n >= 4) return { couleur: 'var(--or)', mention: 'bon groupe' };
  return { couleur: 'var(--ivoire)', mention: 'de justesse' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_INSTRUMENT_TOTAL = 2900;

export function ResultatInstrument({ score, detail = null }) {
  const { couleur, mention } = paletteScore(score);
  // La jauge se remplit par transition plutôt que par @keyframes : sa valeur
  // d'arrivée dépend du score, et une keyframe est une règle statique qu'on
  // ne peut pas paramétrer par instance.
  const [remplie, setRemplie] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRemplie(true), RES_BARRE);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      data-inst-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e3)', textAlign: 'center', padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `instVoile ${RES_INSTRUMENT_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes instVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes instEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes instSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes instNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-inst-surcouche], [data-inst-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e3)',
        animation: `instSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `instEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
        }}>
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 62, fontWeight: 500, lineHeight: 1,
          color: couleur,
          animation: `instNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
        }}>
          {(+score).toFixed(1).replace('.', ',')}
          <span style={{ color: 'var(--cendre)', fontSize: 30 }}> / 10</span>
        </div>

        <div style={{
          width: 200, height: 3, borderRadius: 2,
          background: 'var(--filet-fort)', overflow: 'hidden', marginTop: 'var(--e2)',
        }}>
          <div style={{
            height: '100%', width: '100%', borderRadius: 2, background: couleur,
            transformOrigin: 'left center',
            transform: `scaleX(${remplie ? Math.max(0, Math.min(1, +score / 10)) : 0})`,
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, lineHeight: 1,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: couleur,
          marginTop: 'var(--e2)',
          animation: `instEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {detail && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
            maxWidth: 320,
            animation: `instEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
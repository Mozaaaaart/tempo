'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « HUMAIN OU IA »

   Même dispositif que les épreuves Accords, Artiste et Pochette : une
   surcouche `absolute` posée DANS le panneau du jeu, pas un voile plein
   écran, pour que le jeu reste visible en transparence derrière. Le panneau
   parent doit donc porter `position: 'relative'`.

   Le scénario montre les trois temps de l'épreuve dans l'ordre : on LANCE un
   extrait, on l'ÉCOUTE, on TRANCHE. Le premier temps compte autant que les
   autres — sans lui, on ne comprend pas d'où sort le son.

   Scénario linéaire, donc entièrement en @keyframes datées, comme celle
   d'Accords. Noms préfixés `ia` : les dix épreuves étant montées simultanément
   dans le carrousel, des @keyframes homonymes s'écraseraient silencieusement.
============================================================ */

/* ---- ACTE I : le cadre ----
   Même grammaire que l'ouverture de run du Duel : le titre pose le mode, la
   pastille se compte, puis la légende la nomme. Ici il n'y en a qu'une, et
   c'est tout le propos — elle bat pour dire sa fragilité. */
const A1_TITRE = 240;
const A1_VIE = 720;    // la pastille se pose
/* La légende attend que la pastille soit posée : nommer « 1 vie » avant
   qu'elle n'existe ferait lire le texte et manquer l'objet. */
const A1_LEGENDE = 1120;
const A1_SORTIE = 1780;   // l'acte s'efface

/* ---- ACTE II : la démonstration ----
   On lance un extrait, on l'écoute, on tranche. Le premier temps compte
   autant que les autres — sans lui, on ne comprend pas d'où sort le son. */
/* L'acte II démarre pendant que l'acte I finit de s'effacer : sa sortie dure
   340 ms, l'entrée du suivant peut donc commencer avant qu'elle soit terminée.
   Attendre la fin complète créait un temps mort au milieu de l'intro. */
const A2 = 1980;   // origine de l'acte II
const T_ACCROCHE = A2 + 0;
const T_BOUTON = A2 + 320;   // « Nouvel extrait » apparaît
const T_CURSEUR = A2 + 620;
const D_CURSEUR = 2900;       // durée totale du trajet
const T_CLIC1 = A2 + 1300;  // clic sur « Nouvel extrait »
const T_LECTURE = A2 + 1480;  // l'extrait part : l'indicateur pulse
const T_CARTES = A2 + 2050;  // les deux réponses apparaissent
const T_CLIC2 = A2 + 3050;  // le curseur choisit « IA »
const T_VERDICT = A2 + 3350;  // la carte bascule en jade, l'autre s'estompe
const T_REVELATION = A2 + 3750;
/* La montée de niveau ferme la démonstration : c'est elle qui dit ce qu'on
   gagne à répondre juste, et donc pourquoi on enchaîne. */
const T_NIVEAU = A2 + 4250;
const T_SORTIE = A2 + 5800;
export const INTRO_IA_TOTAL = A2 + 6250;

const SCENE_L = 520;
const SCENE_H = 344;
const H_CONTRAINTE = SCENE_H + 40;

const REPOS = { x: 430, y: 290 };
const BOUTON = { x: 268, y: 64 };
const CARTE_IA = { x: 348, y: 195 };

function keyframesCurseur() {
  const p = (t) => (((t - T_CURSEUR) / D_CURSEUR) * 100).toFixed(1);
  const pos = (c) => `translate(${c.x}px, ${c.y}px)`;
  return `
    0%   { transform: ${pos(REPOS)}; opacity: 0; }
    6%   { transform: ${pos(REPOS)}; opacity: 1; }
    ${p(T_CLIC1)}%  { transform: ${pos(BOUTON)}; }
    ${p(T_CARTES)}%  { transform: ${pos(BOUTON)}; }
    ${p(T_CLIC2)}%  { transform: ${pos(CARTE_IA)}; }
    92%  { transform: ${pos(CARTE_IA)}; opacity: 1; }
    100% { transform: ${pos(CARTE_IA)}; opacity: 0; }
  `;
}

const STYLES_COMMUNS = `
  @keyframes iaVoile {
    0%   { opacity: 0; }
    6%   { opacity: 1; }
    94%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes iaEntree {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes iaSortie {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
  }
`;

const IconeHautParleur = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M3 6h2.4L8.6 3.3v9.4L5.4 10H3z" strokeLinejoin="round" />
    <path d="M11 5.8a3 3 0 0 1 0 4.4" strokeLinecap="round" />
  </svg>
);

export default function IntroIA({ onFin }) {
  const [echelle, setEchelle] = useState(1);
  const hote = useRef(null);
  const fini = useRef(false);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    onFin?.();
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }
    const t = setTimeout(terminer, INTRO_IA_TOTAL);
    const surTouche = (e) => { if (e.key === 'Escape') terminer(); };
    window.addEventListener('keydown', surTouche);
    return () => { clearTimeout(t); window.removeEventListener('keydown', surTouche); };
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

  const carte = (choisie) => ({
    width: 172, height: 46, boxSizing: 'border-box',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '0 var(--e4)',
    borderRadius: 'var(--rayon-controle)',
    background: 'var(--onyx-haut)',
    border: '0.5px solid var(--filet-fort)',
    fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
    color: 'var(--ivoire)',
    animation: choisie
      ? `iaEntree 340ms ${T_CARTES}ms ease-out both, iaJuste 420ms ${T_VERDICT}ms ease-out forwards`
      : `iaEntree 340ms ${T_CARTES}ms ease-out both, iaEcarte 420ms ${T_VERDICT}ms ease-out forwards`,
  });

  return (
    <div
      ref={hote}
      data-ia-surcouche
      onClick={terminer}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `iaVoile ${INTRO_IA_TOTAL}ms ease-out both`,
      }}
      aria-hidden="true"
    >
      <style>{`
        ${STYLES_COMMUNS}
        @keyframes iaChiffreSort {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-30px); }
        }
        @keyframes iaChiffreEntre {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes iaVieArrivee {
          0%   { opacity: 0; transform: scale(0.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes iaVieBat {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.14); }
        }
        @keyframes iaPulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @keyframes iaJuste {
          to { border-color: var(--jade); color: var(--jade); }
        }
        @keyframes iaEcarte {
          to { opacity: 0.3; }
        }
        @keyframes iaClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes iaCurseur {${keyframesCurseur()}}
        @media (prefers-reduced-motion: reduce) {
          [data-ia-surcouche], [data-ia-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        width: SCENE_L, height: SCENE_H, position: 'relative',
        transform: `scale(${echelle})`, transformOrigin: 'center',
      }}>
        {/* ============ ACTE I — le cadre ============ */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)',
          animation: `iaSortie 340ms ${A1_SORTIE}ms ease-in both`,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `iaEntree 340ms ${A1_TITRE}ms ease-out both`,
          }}>
            Mode survie
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 'var(--e4)',
          }}>
            {/* La pastille bat : c'est ce battement, plus que le chiffre, qui
                dit qu'elle est la seule et qu'elle peut se perdre. */}
            <span style={{
              width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box',
              border: '1.5px solid var(--ivoire)', backgroundColor: 'var(--ivoire)',
              animation: `iaVieArrivee 420ms ${A1_VIE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both, iaVieBat 2000ms ${A1_VIE + 420}ms ease-in-out infinite`,
            }} />

            <div style={{
              fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
              letterSpacing: '0.02em',
              // Ivoire plutôt que cendre : la légende nomme la pastille juste
              // au-dessus, elle doit peser autant qu'elle.
              color: 'var(--ivoire)',
              animation: `iaEntree 320ms ${A1_LEGENDE}ms ease-out both`,
            }}>
              1 vie
            </div>
          </div>
        </div>

        {/* ============ ACTE II — la démonstration ============
            Monté dès le départ mais tenu invisible par le `both` de ses
            animations retardées : rien n'apparaît dans le flux, donc aucun
            à-coup de mise en page quand l'acte I s'efface. */}
        <div style={{ position: 'absolute', inset: 0, animation: `iaSortie 340ms ${T_SORTIE}ms ease-in both` }}>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            opacity: 0,
            animation: `iaEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            Écoute l&apos;extrait, puis tranche
          </div>

          {/* ---------- 1 · on lance l'extrait ---------- */}
          <div style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            opacity: 0,
            animation: `iaEntree 340ms ${T_BOUTON}ms ease-out both`,
          }}>
            <div style={{
              padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
              background: 'var(--or)', color: 'var(--noir)',
              border: '1px solid var(--or)',
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
            }}>
              Nouvel extrait
            </div>
          </div>

          {/* ---------- 2 · il joue ---------- */}
          <div style={{
            position: 'absolute', top: 110, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            opacity: 0,
            animation: `iaEntree 320ms ${T_LECTURE}ms ease-out both`,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 13px', borderRadius: 'var(--rayon-controle)',
              border: '0.5px solid var(--filet-fort)',
              background: 'var(--onyx-haut)',
              fontFamily: 'var(--mono)', fontSize: 11.5, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--or)',
              animation: `iaPulse 1400ms ${T_LECTURE}ms ease-in-out infinite`,
            }}>
              {IconeHautParleur}
              extrait en cours · 12 s
            </div>
          </div>

          {/* ---------- 3 · on tranche ---------- */}
          <div style={{
            position: 'absolute', top: 172, left: 0, right: 0,
            display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
          }}>
            <div style={carte(false)}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <circle cx="10" cy="6.4" r="3.4" />
    <path d="M3.4 17.2c0-3.6 3-6 6.6-6s6.6 2.4 6.6 6" strokeLinecap="round" />
  </svg>
              Humain
            </div>
            <div style={carte(true)}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="3.6" y="6.4" width="12.8" height="10" rx="2.4" />
    <path d="M10 3v3.4M7.2 10.6v1.6M12.8 10.6v1.6" strokeLinecap="round" />
  </svg>
              IA
            </div>
          </div>

          {/* ---------- Révélation ---------- */}
          <div style={{
            position: 'absolute', top: 246, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--lin)',
            opacity: 0,
            animation: `iaEntree 340ms ${T_REVELATION}ms ease-out both`,
          }}>
            C&apos;était bien une IA
          </div>

          {/* ---------- Montée de niveau ----------
               Le run démarre au niveau 1 : une bonne réponse fait donc passer
               à 2. Le 1 sort par le haut pendant que le 2 entre par le bas —
               on voit le chiffre CHANGER, ce qu'un « niveau 2 » posé d'un coup
               ne dirait pas. */}
          <div style={{
            position: 'absolute', top: 288, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
            opacity: 0,
            animation: `iaEntree 320ms ${T_NIVEAU}ms ease-out both`,
          }}>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>niveau</span>

            <span style={{
              position: 'relative', display: 'inline-block',
              width: 22, height: 30, overflow: 'hidden',
              fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, lineHeight: '30px',
            }}>
              <span style={{
                position: 'absolute', inset: 0, color: 'var(--lin)',
                animation: `iaChiffreSort 420ms ${T_NIVEAU + 320}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
              }}>
                1
              </span>
              <span style={{
                position: 'absolute', inset: 0, color: 'var(--or)',
                animation: `iaChiffreEntre 420ms ${T_NIVEAU + 320}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
              }}>
                2
              </span>
            </span>

          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            animation: `iaCurseur ${D_CURSEUR}ms ${T_CURSEUR}ms cubic-bezier(0.5, 0, 0.2, 1) both`,
          }}>
            {[T_CLIC1, T_CLIC2].map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%',
                opacity: 0,
                animation: `iaClic 460ms ${t - 40}ms ease-out both`,
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
   Posée en fin de série quotidienne, comme sur les autres épreuves.
============================================================ */

function paletteScore(valeur) {
  const n = +valeur;
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'aucune trouvée' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'sans faute' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bonne oreille' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'correct' };
  return { couleur: 'var(--ivoire)', mention: 'difficile' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_IA_TOTAL = 2900;

export function ResultatIA({ score, detail = null }) {
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
      data-ia-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e3)', textAlign: 'center', padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `iaVoile ${RES_IA_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        ${STYLES_COMMUNS}
        @keyframes iaNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ia-surcouche], [data-ia-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e3)',
        animation: `iaSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `iaEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
        }}>
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 62, fontWeight: 500, lineHeight: 1,
          color: couleur,
          animation: `iaNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
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
          animation: `iaEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {detail && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
            animation: `iaEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SURCOUCHE DE DÉFAITE

   Deux actes, comme la fin de run du Duel. La perte se joue d'abord en
   entier — la pastille doit s'éteindre sous les yeux, sinon on ne comprend
   pas ce qu'on vient de perdre — puis un second acte remplace le décompte
   par le verdict. Les deux vivent dans le même voile, l'un s'efface pendant
   que l'autre monte.
============================================================ */

/* La pastille est NOMMÉE avant d'être éteinte. Dans le Duel, trois points
   identiques sont sous les yeux depuis le début du run : le joueur sait ce
   qu'il regarde. Ici un point isolé sur un voile ne se rattache à rien, et
   le nommer après l'avoir éteint arrive trop tard. */
const DEF_ETIQUETTE = 200;                 // « ta dernière vie »
const DEF_VIE = 340;                 // la pastille se pose, pleine
const DEF_EXTINCTION = DEF_VIE + 520;      // elle vire au carmin puis s'éteint
const DEF_MOINS_UNE = DEF_VIE + 880;      // « − 1 vie »
const DEF_SORTIE_ACTE = DEF_VIE + 1720;     // le décompte s'efface
const DEF_CROIX = DEF_VIE + 2020;     // la croix se trace
const DEF_MOT = DEF_CROIX + 380;
const DEF_NIVEAU = DEF_MOT + 320;
const DEF_SORTIE = DEF_MOT + 1300;
export const DEFAITE_IA_TOTAL = DEF_SORTIE + 400;

export function DefaiteIA({ niveau }) {
  return (
    <div
      data-ia-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `iaVoile ${DEFAITE_IA_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        ${STYLES_COMMUNS}
        @keyframes iaPointPerdu {
          0%   { transform: scale(1);
                 background-color: var(--ivoire); border-color: var(--ivoire);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
          28%  { transform: scale(1.55);
                 background-color: var(--carmin); border-color: var(--carmin);
                 box-shadow: 0 0 0 9px rgba(226, 75, 74, 0.16); }
          62%  { transform: scale(0.9);
                 background-color: transparent; border-color: var(--carmin);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
          100% { transform: scale(1);
                 background-color: transparent; border-color: var(--filet-fort);
                 box-shadow: 0 0 0 0 rgba(226, 75, 74, 0); }
        }
        @keyframes iaCroixCorps {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes iaCroixTrait {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ia-surcouche], [data-ia-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      {/* ---- Acte I : le décompte ----
          Tout le bloc s'efface d'un coup pour laisser la place au verdict :
          un seul conteneur animé plutôt que deux sorties à synchroniser. */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
        animation: `iaSortie 300ms ${DEF_SORTIE_ACTE}ms ease-in both`,
      }}>
        {/* L'étiquette arrive en premier et dit ce que le point représente ;
            la pastille se pose ensuite sous elle. */}
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `iaEntree 300ms ${DEF_ETIQUETTE}ms ease-out both`,
        }}>
          ta dernière vie
        </div>

        {/* L'extinction attend que la pastille soit posée : le remplissage
            `both` maintient d'ici là l'état du keyframe 0 %, soit une pastille
            pleine — la vie est donc bien visible avant de disparaître. */}
        <span style={{
          width: 20, height: 20, borderRadius: '50%', boxSizing: 'border-box',
          border: '1.5px solid var(--ivoire)', backgroundColor: 'var(--ivoire)',
          animation: `iaVieArrivee 360ms ${DEF_VIE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both, iaPointPerdu 760ms ${DEF_EXTINCTION}ms ease-out both`,
        }} />

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 500, lineHeight: 1,
          color: 'var(--carmin)',
          animation: `iaEntree 320ms ${DEF_MOINS_UNE}ms ease-out both`,
        }}>
          − 1 vie
        </div>
      </div>

      {/* ---- Acte II : le verdict ----
          Monté dès le départ mais tenu invisible par le `both` de ses
          animations retardées : la croix se trace au trait, sans à-coup de
          mise en page puisque rien n'apparaît dans le flux. */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 'var(--e4)',
        pointerEvents: 'none',
        animation: `iaSortie 320ms ${DEF_SORTIE}ms ease-in both`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e4)' }}>
          <svg
            width="52" height="52" viewBox="0 0 52 52" fill="none"
            stroke="var(--carmin)" strokeWidth="5" strokeLinecap="round"
            aria-hidden="true"
            style={{ animation: `iaCroixCorps 380ms ${DEF_CROIX}ms cubic-bezier(0.34, 1.3, 0.64, 1) both` }}
          >
            <line x1="13" y1="13" x2="39" y2="39" pathLength="1"
              style={{ strokeDasharray: 1, animation: `iaCroixTrait 240ms ${DEF_CROIX + 40}ms ease-out both` }} />
            <line x1="39" y1="13" x2="13" y2="39" pathLength="1"
              style={{ strokeDasharray: 1, animation: `iaCroixTrait 240ms ${DEF_CROIX + 220}ms ease-out both` }} />
          </svg>

          <span style={{
            fontFamily: 'var(--mono)', fontSize: 42, fontWeight: 500, lineHeight: 1,
            color: 'var(--carmin)',
            animation: `iaEntree 320ms ${DEF_MOT}ms ease-out both`,
          }}>
            Perdu
          </span>
        </div>

        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `iaEntree 320ms ${DEF_NIVEAU}ms ease-out both`,
        }}>
          niveau {niveau}
        </div>
      </div>
    </div>
  );
}
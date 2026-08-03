'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « TROUVE LE BPM »

   Même dispositif que les autres épreuves : une surcouche `absolute` posée
   DANS le panneau du jeu, pas un voile plein écran, pour que le jeu reste
   visible en transparence derrière. Le panneau parent doit donc porter
   `position: 'relative'`.

   Ce que la démonstration doit faire comprendre, dans l'ordre : on écoute un
   extrait, on règle un tempo, on le compare au métronome — et c'est cette
   comparaison qui est le geste de l'épreuve, pas le réglage lui-même. Le
   disque bat donc à la vitesse réglée pendant que le curseur la déplace : le
   lien entre le chiffre et la pulsation se voit au lieu de s'expliquer.

   Le scénario est une table d'instants jouée par des minuteurs, car le
   curseur balaie plusieurs valeurs — une @keyframes ne saurait pas faire
   défiler un nombre.
============================================================ */

const T_TITRE = 240;
const T_ACCROCHE = 620;
const T_DISQUE = 960;
const T_CURSEUR_UI = 1300;   // la barre de réglage
const T_MAIN = 1620;   // le curseur de souris entre

/* Acte 1 — on écoute l'extrait. */
const T_VERS_EXTRAIT = 1900;
const T_CLIC_EXTRAIT = 2340;
/* Les deux écoutes sont symboliques : il suffit de voir le bouton s'allumer
   et le glyphe basculer pour comprendre qu'un son part. L'intro montre le
   geste, elle ne le rejoue pas à l'échelle. */
const D_ECOUTE = 750;
const T_FIN_EXTRAIT = T_CLIC_EXTRAIT + D_ECOUTE;

/* Acte 2 — on règle le tempo. La valeur balaie de 110 à 128. */
const T_VERS_BARRE = T_FIN_EXTRAIT + 60;
const T_GLISSE = T_VERS_BARRE + 440;
/* Pas du balayage. Il ne descend pas en dessous de ~40 ms : en dessous, le
   chiffre change plus vite que l'œil ne le lit et le glissement devient un
   saut. */
const PAS_GLISSE = 50;     // ms entre deux valeurs
const BPM_DEPART = 110;
const BPM_CIBLE = 128;

/* Acte 3 — on écoute le métronome, puis on valide. */
const T_VERS_DISQUE = T_GLISSE + (BPM_CIBLE - BPM_DEPART) * PAS_GLISSE + 260;
const T_CLIC_DISQUE = T_VERS_DISQUE + 440;
const T_VERS_VALIDER = T_CLIC_DISQUE + D_ECOUTE;
const T_CLIC_VALIDER = T_VERS_VALIDER + 440;
const T_VERDICT = T_CLIC_VALIDER + 260;
const T_SORTIE = T_VERDICT + 1500;
export const INTRO_BPM_TOTAL = T_SORTIE + 420;

const SCENE_L = 520;
const SCENE_H = 400;
const H_CONTRAINTE = SCENE_H + 40;

const REPOS = { x: 440, y: 360 };
const EXTRAIT = { x: 196, y: 336 };
const DISQUE = { x: 268, y: 150 };
const VALIDER = { x: 348, y: 336 };

/* Géométrie de la barre de réglage, en coordonnées de scène. Elle sert à la
   fois à dessiner la poignée et à placer le curseur de souris : c'est ce qui
   permet à la main de SUIVRE la poignée pendant le glissement, au lieu de
   rester posée à côté pendant que la valeur bouge toute seule. */
const BARRE_X = SCENE_L / 2 - 190;   // bord gauche
const BARRE_L = 380;
const BARRE_Y = 252;

const posBpm = (v) => ((v - 60) / 120) * 100;
const xPoignee = (v) => BARRE_X + (posBpm(v) / 100) * BARRE_L;

export default function IntroBPM({ onFin }) {
  const [echelle, setEchelle] = useState(1);
  const [t, setT] = useState(0);          // horloge de la scène, en ms
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

    /* Une horloge plutôt qu'un compteur d'étapes : le balayage du tempo passe
       par des dizaines de valeurs, les nommer une à une n'aurait pas de sens.
       Chaque instant remarquable pose simplement `t` à sa valeur. */
    const jalons = [
      T_VERS_EXTRAIT, T_CLIC_EXTRAIT, T_FIN_EXTRAIT,
      T_VERS_BARRE, T_VERS_DISQUE, T_CLIC_DISQUE,
      T_VERS_VALIDER, T_CLIC_VALIDER, T_VERDICT,
    ];
    for (let v = 0; v <= BPM_CIBLE - BPM_DEPART; v++) jalons.push(T_GLISSE + v * PAS_GLISSE);
    jalons.sort((a, b) => a - b).forEach((instant) => {
      minuteurs.current.push(setTimeout(() => setT(instant), instant));
    });
    minuteurs.current.push(setTimeout(terminer, INTRO_BPM_TOTAL));

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
  const bpm = t < T_GLISSE
    ? BPM_DEPART
    : Math.min(BPM_CIBLE, BPM_DEPART + Math.floor((t - T_GLISSE) / PAS_GLISSE) + 1);

  const extraitJoue = t >= T_CLIC_EXTRAIT && t < T_FIN_EXTRAIT;
  const metroJoue = t >= T_CLIC_DISQUE && t < T_VERS_VALIDER;
  const valide = t >= T_VERDICT;

  // Pendant le réglage, la main est SUR la poignée : elle la tire vers la
  // droite au lieu de regarder le chiffre monter à distance.
  const glisse = t >= T_VERS_BARRE && t < T_VERS_DISQUE;
  const main = t < T_VERS_EXTRAIT ? REPOS
    : t < T_VERS_BARRE ? EXTRAIT
      : glisse ? { x: xPoignee(bpm), y: BARRE_Y }
        : t < T_VERS_VALIDER ? DISQUE
          : VALIDER;

  // Le déplacement suit le pas du glissement une fois la poignée saisie :
  // avec la transition longue des trajets, la main traînait derrière elle.
  const transitionMain = t >= T_GLISSE && glisse
    ? `transform ${PAS_GLISSE}ms linear`
    : 'transform 420ms cubic-bezier(0.5, 0, 0.2, 1)';

  const pos = posBpm;
  const couleurDisque = valide ? 'var(--jade)' : metroJoue ? 'var(--or)' : 'var(--ivoire)';

  const legende = t < T_VERS_BARRE ? 'écoute l\u2019extrait'
    : t < T_VERS_DISQUE ? 'règle le tempo'
      : t < T_VERS_VALIDER ? 'compare au métronome'
        : 'valide';

  return (
    <div
      ref={hote}
      data-bpm-surcouche
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
        animation: `bpmVoile ${INTRO_BPM_TOTAL}ms ease-out both`,
      }}
    >
      <style>{`
        @keyframes bpmVoile {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bpmEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bpmSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes bpmPouls {
          0%   { transform: scale(1);    }
          22%  { transform: scale(1.07); }
          100% { transform: scale(1);    }
        }
        @keyframes bpmHaloIntro {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes bpmClicIntro {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-bpm-surcouche], [data-bpm-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>

      <div style={{
        width: SCENE_L, height: SCENE_H, position: 'relative',
        /* flexShrink: 0 est ce qui fait tenir toute la scène.

           Cette boîte est un enfant flex, et un enfant flex se laisse
           RÉTRÉCIR par défaut. Sur un panneau étroit, les 520 px demandés
           devenaient donc 370, et la scène se retrouvait mesurée en deux
           unités différentes : les éléments posés en pourcentage — le disque
           en left 50 % — suivaient la nouvelle largeur, ceux posés en pixels
           — le pointeur et ses cercles de clic — restaient sur l'ancienne.
           Le geste se jouait à côté de ce qu'il désignait, d'autant plus loin
           que l'écran était étroit.

           La mise à l'échelle doit venir de scale() et de lui seul : elle
           conserve les proportions, là où le rétrécissement flex déplace les
           repères les uns par rapport aux autres. */
        flexShrink: 0,
        transform: `scale(${echelle})`, transformOrigin: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, animation: `bpmSortie 340ms ${T_SORTIE}ms ease-in both` }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 25, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `bpmEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Trouve le BPM
          </div>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 38, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `bpmEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            Le BPM, c&apos;est le nombre de battements par minute
          </div>

          {/* ---------- Disque ---------- */}
          <div style={{
            position: 'absolute', top: 76, left: '50%', marginLeft: -56,
            width: 112, height: 112,
            animation: `bpmEntree 340ms ${T_DISQUE}ms ease-out both`,
          }}>
            {metroJoue && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid var(--or)',
                animation: `bpmHaloIntro ${(60 / bpm).toFixed(3)}s ease-out infinite`,
              }} />
            )}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
              background: 'var(--onyx-haut)',
              border: `1px solid ${metroJoue ? 'var(--or)' : valide ? 'var(--jade)' : 'var(--filet-fort)'}`,
              color: couleurDisque,
              transition: 'border-color 250ms ease, color 250ms ease',
              animation: metroJoue ? `bpmPouls ${(60 / bpm).toFixed(3)}s ease-out infinite` : 'none',
            }}>
              {metroJoue ? (
                <svg width="12" height="15" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="12" height="15" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 0v12l10-6z" />
                </svg>
              )}
              <span style={{ display: 'block', lineHeight: 1 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 500 }}>{bpm}</span>
                <span className="etiquette-mono" style={{ display: 'block', color: 'var(--cendre)', marginTop: 6 }}>
                  bpm
                </span>
              </span>
            </div>
          </div>

          {/* ---------- Légende de phase ---------- */}
          <div className="etiquette-mono" style={{
            position: 'absolute', top: 204, left: 0, right: 0, textAlign: 'center',
            color: 'var(--lin)',
            animation: `bpmEntree 320ms ${T_DISQUE + 160}ms ease-out both`,
          }}>
            {legende}
          </div>

          {/* ---------- Barre de réglage ---------- */}
          <div style={{
            position: 'absolute', top: 244, left: '50%', marginLeft: -190, width: 380,
            animation: `bpmEntree 320ms ${T_CURSEUR_UI}ms ease-out both`,
          }}>
            <div style={{ position: 'relative', height: 16 }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 6, height: 4,
                borderRadius: 2, background: 'var(--filet)',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pos(bpm)}%`, borderRadius: 2,
                  background: valide ? 'var(--jade)' : 'var(--or)',
                  transition: `width ${PAS_GLISSE}ms linear, background 250ms ease`,
                }} />
              </div>
              <div style={{
                position: 'absolute', top: 2, left: `${pos(bpm)}%`, marginLeft: -6,
                width: 12, height: 12, borderRadius: '50%',
                background: 'var(--ivoire)',
                // Poignée saisie : elle enfle légèrement et s'entoure d'un
                // halo, comme sous un vrai clic maintenu.
                transform: glisse ? 'scale(1.25)' : 'scale(1)',
                boxShadow: glisse ? '0 0 0 5px rgba(239, 159, 39, 0.18)' : 'none',
                transition: `left ${PAS_GLISSE}ms linear, transform 200ms ease, box-shadow 200ms ease`,
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
              color: 'var(--cendre)', marginTop: 4,
            }}>
              <span>60 lent</span>
              <span>180 rapide</span>
            </div>
          </div>

          {/* ---------- Commandes ---------- */}
          <div style={{
            position: 'absolute', top: 316, left: 0, right: 0,
            display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
            animation: `bpmEntree 320ms ${T_CURSEUR_UI + 120}ms ease-out both`,
          }}>
            <div style={{
              height: 40, padding: '0 16px', boxSizing: 'border-box',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              borderRadius: 'var(--rayon-controle)',
              border: `0.5px solid ${extraitJoue ? 'var(--or)' : 'var(--filet-fort)'}`,
              color: extraitJoue ? 'var(--or)' : 'var(--ivoire)',
              fontFamily: 'var(--sans)', fontSize: 13.5,
              transition: 'border-color 250ms ease, color 250ms ease',
            }}>
              {extraitJoue ? (
                <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 0v12l10-6z" />
                </svg>
              )}
              Écouter l&apos;extrait
            </div>

            <div style={{
              height: 40, padding: '0 18px', boxSizing: 'border-box',
              display: 'inline-flex', alignItems: 'center',
              borderRadius: 'var(--rayon-controle)',
              background: 'var(--or)', color: 'var(--noir)',
              border: '1px solid var(--or)',
              fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500,
            }}>
              Valider
            </div>
          </div>

          {/* ---------- Verdict ---------- */}
          <div style={{
            position: 'absolute', top: 368, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--jade)',
            opacity: 0,
            animation: valide ? 'bpmEntree 320ms ease-out both' : 'none',
          }}>
            Tempo exact — 128 BPM
          </div>

          {/* ---------- Curseur de souris ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${main.x}px, ${main.y}px)`,
            transition: transitionMain,
            opacity: t >= T_MAIN ? 1 : 0,
          }}>
            {[T_CLIC_EXTRAIT, T_GLISSE, T_CLIC_DISQUE, T_CLIC_VALIDER].map((instant) => (
              <div key={instant} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%', opacity: 0,
                animation: `bpmClicIntro 460ms ${instant - 40}ms ease-out both`,
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
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'à côté' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'tempo juste' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bonne pulsation' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'approchant' };
  return { couleur: 'var(--ivoire)', mention: 'de justesse' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_BPM_TOTAL = 2900;

export function ResultatBPM({ score, detail = null }) {
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
      data-bpm-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e3)', textAlign: 'center', padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `bpmVoile ${RES_BPM_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes bpmVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bpmEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bpmSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes bpmNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-bpm-surcouche], [data-bpm-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e3)',
        animation: `bpmSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `bpmEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
        }}>
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 62, fontWeight: 500, lineHeight: 1,
          color: couleur,
          animation: `bpmNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
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
          animation: `bpmEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {detail && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
            maxWidth: 320,
            animation: `bpmEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
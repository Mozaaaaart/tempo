'use client';
import { useEffect, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « TROUVE L'ARTISTE »

   Même principe que celle de l'épreuve Accords : une surcouche `absolute`
   posée DANS le panneau du jeu — pas un voile plein écran — pour que le jeu
   reste visible en transparence derrière. Le panneau parent doit donc porter
   `position: 'relative'`.

   Tout est joué par @keyframes CSS sur des délais : aucune machine à états,
   donc aucune dérive possible entre les étapes. Les noms d'animation sont
   préfixés `art` — les dix épreuves étant montées simultanément dans le
   carrousel, des @keyframes homonymes s'écraseraient silencieusement.
============================================================ */

/* Chronologie, en ms depuis l'ouverture de la surcouche. */
const T_TITRE = 240;
const T_ACCROCHE = 640;    // la ligne sous le titre, une fois le titre posé
const T_SCENE = 900;    // portrait + champ de recherche
const T_CURSEUR = 1400;   // apparition du curseur et début du trajet
const D_CURSEUR = 2350;   // durée totale du trajet
const T_CLIC1 = 2150;   // clic dans le champ → le menu s'ouvre
const T_DEFILE = 2650;   // le menu défile
const T_CLIC2 = 3450;   // clic sur l'artiste → le menu se ferme
const T_INDICES = 3950;   // les indices tombent un par un
const PAS_CELLULE = 150;
const T_FLOU = 5150;   // le flou se lève sur le portrait
const T_SORTIE = 6150;   // tout le bloc s'efface, le voile suit
export const INTRO_ARTISTE_TOTAL = 6600;

/* Repère de la scène : largeur fixe, mise à l'échelle sur petit écran. */
const SCENE_L = 620;
const SCENE_H = 350;
const RANGEE = 34;   // hauteur d'une ligne du menu déroulant
const DEFILEMENT = 2;    // lignes parcourues par le défilement

/* Positions du curseur dans le repère de la scène */
const REPOS = { x: 430, y: 340 };
const CHAMP = { x: 312, y: 236 };
const CHOIX = { x: 215, y: 318 };

const COLONNES = ['Artiste', 'Genre', 'Pays', 'Débuts', 'Format', 'Sexe', 'Streams'];

/* Le trajet du curseur est daté sur les mêmes instants que les clics :
   une seule source de vérité, le geste et son effet ne peuvent pas se décaler. */
function keyframesCurseur() {
  const p = (t) => (((t - T_CURSEUR) / D_CURSEUR) * 100).toFixed(1);
  const pos = (c) => `translate(${c.x}px, ${c.y}px)`;
  return `
    0%   { transform: ${pos(REPOS)}; opacity: 0; }
    5%   { transform: ${pos(REPOS)}; opacity: 1; }
    ${p(T_CLIC1)}%  { transform: ${pos(CHAMP)}; }
    ${p(T_DEFILE)}%  { transform: ${pos(CHAMP)}; }
    ${p(T_CLIC2)}%  { transform: ${pos(CHOIX)}; }
    92%  { transform: ${pos(CHOIX)}; opacity: 1; }
    100% { transform: ${pos(CHOIX)}; opacity: 0; }
  `;
}

export default function IntroArtiste({ onFin, exclure = null }) {
  const [photo, setPhoto] = useState(null);
  const [echelle, setEchelle] = useState(1);
  const hote = useRef(null);
  const fini = useRef(false);

  /* ---- Artiste de démonstration : jamais celui du jour ---- */
  const demoNom = ['Adele', 'Coldplay', 'Queen'].find((n) => n !== exclure) ?? 'Adele';
  const demo = ARTISTS.find((a) => a.nom === demoNom);
  const tries = [...ARTISTS].sort((a, b) => a.nom.localeCompare(b.nom));
  const iDemo = tries.findIndex((a) => a.nom === demoNom);
  const depart = Math.max(0, iDemo - 3);
  const fenetre = tries.slice(depart, depart + 7).map((a) => a.nom);
  const iDansFenetre = fenetre.indexOf(demoNom);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    onFin?.();
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Mouvement réduit : on ne joue rien, on rend la main tout de suite.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }

    const t = setTimeout(terminer, INTRO_ARTISTE_TOTAL);
    const surTouche = (e) => { if (e.key === 'Escape') terminer(); };
    window.addEventListener('keydown', surTouche);
    return () => { clearTimeout(t); window.removeEventListener('keydown', surTouche); };
  }, []);

  /* ---- La scène a une largeur fixe : on la réduit si le panneau est étroit ---- */
  useEffect(() => {
    const calc = () => {
      const l = hote.current?.offsetWidth ?? SCENE_L;
      setEchelle(Math.min(1, (l - 24) / SCENE_L));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  /* ---- Portrait réel, flouté jusqu'à la révélation ---- */
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await fetch(`/api/deezer?term=${encodeURIComponent(demoNom)}&limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        const t = (data?.data ?? []).find((x) => x.artist?.picture_xl || x.artist?.picture_big);
        if (!annule) setPhoto(t?.artist?.picture_xl ?? t?.artist?.picture_big ?? null);
      } catch { /* le dégradé de repli suffit */ }
    })();
    return () => { annule = true; };
  }, [demoNom]);

  const indices = [demo.nom, demo.genre, demo.pays, demo.debut + 's', demo.type, demo.sexe, '~' + demo.streams + ' Mds'];

  return (
    <div
      ref={hote}
      data-art-surcouche
      onClick={terminer}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: `artVoile ${INTRO_ARTISTE_TOTAL}ms ease-out both`,
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes artVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes artEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes artSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes artMenu {
          0%   { opacity: 0; transform: translateY(-6px); }
          14%  { opacity: 1; transform: translateY(0); }
          88%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes artDefile {
          0%,  33%  { transform: translateY(0); }
          72%, 100% { transform: translateY(-${RANGEE * DEFILEMENT}px); }
        }
        @keyframes artSurvol {
          0%,  62%  { background: transparent; color: var(--ivoire); }
          75%, 100% { background: var(--onyx-haut); color: var(--or); }
        }
        @keyframes artChampActif {
          0%,  100% { border-color: var(--or); }
        }
        @keyframes artFondu {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes artParution {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes artCellule {
          0%   { opacity: 0; transform: rotateX(90deg); }
          55%  { opacity: 1; transform: rotateX(90deg); }
          100% { opacity: 1; transform: rotateX(0deg); }
        }
        @keyframes artFlou {
          from { filter: blur(20px); transform: scale(1.2); }
          to   { filter: blur(0px);  transform: scale(1); }
        }
        @keyframes artClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes artCurseur {${keyframesCurseur()}}
        @media (prefers-reduced-motion: reduce) {
          [data-art-surcouche], [data-art-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        width: SCENE_L, height: SCENE_H, position: 'relative',
        transform: `scale(${echelle})`, transformOrigin: 'center',
      }}>

        {/* Tout l'acte s'efface d'un bloc plutôt que par sorties séparées. */}
        <div style={{
          position: 'absolute', inset: 0,
          animation: `artSortie 340ms ${T_SORTIE}ms ease-in both`,
        }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `artEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Trouve l&apos;artiste
          </div>

          {/* ---------- Portrait ---------- */}
          <div style={{
            position: 'absolute', top: 76, left: '50%', marginLeft: -65,
            width: 130, height: 130, overflow: 'hidden',
            borderRadius: 'var(--rayon-carte)',
            border: '0.5px solid var(--filet)',
            background: 'linear-gradient(145deg, #3a2a12, #0B0B0B)',
            animation: `artEntree 340ms ${T_SCENE}ms ease-out both`,
          }}>
            {photo && (
              <img
                src={photo} alt="" width={130} height={130}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  filter: 'blur(20px)', transform: 'scale(1.2)',
                  animation: `artFlou 900ms ${T_FLOU}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                }}
              />
            )}
          </div>

          {/* ---------- Champ de recherche ---------- */}
          <div style={{
            position: 'absolute', top: 224, left: '50%', marginLeft: -150,
            width: 300, height: 38, boxSizing: 'border-box', padding: '0 14px',
            display: 'flex', alignItems: 'center',
            background: 'var(--onyx-haut)',
            border: '0.5px solid var(--filet-fort)',
            borderRadius: 'var(--rayon-controle)',
            fontFamily: 'var(--sans)', fontSize: 14,
            animation: `artEntree 340ms ${T_SCENE}ms ease-out both`,
          }}>
            <span style={{
              position: 'absolute', left: 14, color: 'var(--cendre)',
              animation: `artFondu 120ms ${T_CLIC2}ms ease-out both`,
            }}>
              Nom d&apos;artiste…
            </span>
            <span style={{
              position: 'absolute', left: 14, color: 'var(--ivoire)', opacity: 0,
              animation: `artParution 160ms ${T_CLIC2 + 60}ms ease-out both`,
            }}>
              {demoNom}
            </span>
          </div>

          {/* ---------- Menu déroulant (par-dessus les indices, comme en jeu) ---------- */}
          <div style={{
            position: 'absolute', top: 266, left: '50%', marginLeft: -150,
            width: 300, height: RANGEE * 4, overflow: 'hidden', zIndex: 5,
            background: 'var(--onyx)',
            border: '0.5px solid var(--or)',
            borderRadius: 'var(--rayon-controle)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
            opacity: 0,
            animation: `artMenu ${T_CLIC2 + 200 - T_CLIC1}ms ${T_CLIC1}ms ease-out both`,
          }}>
            <div style={{
              animation: `artDefile ${T_CLIC2 - T_CLIC1}ms ${T_CLIC1}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
            }}>
              {fenetre.map((nom, i) => (
                <div key={nom} style={{
                  height: RANGEE, display: 'flex', alignItems: 'center', padding: '0 14px',
                  fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ivoire)',
                  ...(i === iDansFenetre
                    ? { animation: `artSurvol ${T_CLIC2 - T_CLIC1}ms ${T_CLIC1}ms linear both` }
                    : {}),
                }}>
                  {nom}
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Indices : tous verts, révélés un par un ---------- */}
          <div style={{
            position: 'absolute', top: 284, left: '50%', marginLeft: -300,
            width: 600,
            display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr',
            gap: 6, perspective: '600px',
          }}>
            {COLONNES.map((h) => (
              <div key={h} style={{
                fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--cendre)', textAlign: 'center',
                opacity: 0,
                animation: `artParution 200ms ${T_INDICES - 120}ms ease-out both`,
              }}>{h}</div>
            ))}
            {indices.map((v, i) => (
              <div key={i} style={{
                background: 'var(--onyx-haut)', color: 'var(--jade)',
                border: '0.5px solid var(--jade)', borderRadius: 'var(--rayon-controle)',
                padding: '9px 6px', fontSize: 12, textAlign: 'center', whiteSpace: 'nowrap',
                animation: `artCellule 420ms ${T_INDICES + i * PAS_CELLULE}ms ease-out both`,
              }}>
                {v}
              </div>
            ))}
          </div>

          {/* ---------- Accroche, sous le titre ---------- */}
          <div style={{
            position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `artEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            7 essais pour le trouver
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            animation: `artCurseur ${D_CURSEUR}ms ${T_CURSEUR}ms cubic-bezier(0.5, 0, 0.2, 1) both`,
          }}>
            {[T_CLIC1, T_CLIC2].map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%',
                opacity: 0,
                animation: `artClic 460ms ${t - 60}ms ease-out both`,
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
   Même dispositif que l'épreuve Accords : la note ne s'affiche pas
   discrètement sous la grille, elle occupe le panneau le temps d'être lue.
   Sa couleur dit le verdict avant même qu'on ait lu le chiffre, et la jauge
   le situe sur dix.
============================================================ */

/* Quatre paliers. Le jade reste réservé au sans-faute — trouvé du premier
   coup — et le carmin à la partie perdue. */
function paletteScore(valeur) {
  const n = +valeur;
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'perdu' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'du premier coup' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bien vu' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'trouvé' };
  return { couleur: 'var(--ivoire)', mention: 'de justesse' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_ARTISTE_TOTAL = 2900;

export function ResultatArtiste({ score, artiste = null }) {
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
      data-art-surcouche
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--e3)',
        textAlign: 'center',
        padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: `artVoile ${RES_ARTISTE_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes artVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes artEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes artSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes artNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-art-surcouche], [data-art-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--e3)',
        animation: `artSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div
          className="etiquette-mono"
          style={{
            color: 'var(--cendre)',
            animation: `artEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
          }}
        >
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 62,
          fontWeight: 500,
          lineHeight: 1,
          color: couleur,
          animation: `artNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
        }}>
          {(+score).toFixed(1).replace('.', ',')}
          <span style={{ color: 'var(--cendre)', fontSize: 30 }}> / 10</span>
        </div>

        {/* Jauge : situe la note sur dix d'un coup d'œil */}
        <div style={{
          width: 200,
          height: 3,
          borderRadius: 2,
          background: 'var(--filet-fort)',
          overflow: 'hidden',
          marginTop: 'var(--e2)',
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: couleur,
            transformOrigin: 'left center',
            transform: `scaleX(${remplie ? Math.max(0, Math.min(1, +score / 10)) : 0})`,
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: couleur,
          marginTop: 'var(--e2)',
          animation: `artEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {artiste && (
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 12.5,
            color: 'var(--lin)',
            animation: `artEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            C&apos;était {artiste}
          </div>
        )}
      </div>
    </div>
  );
}
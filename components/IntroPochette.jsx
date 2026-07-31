'use client';
import { useEffect, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « POCHETTE FLOUTÉE »

   Même dispositif que les épreuves Accords et Artiste : une surcouche
   `absolute` posée DANS le panneau du jeu, pas un voile plein écran, pour que
   le jeu reste visible en transparence derrière. Le panneau parent doit donc
   porter `position: 'relative'`.

   Différence avec l'intro d'Artiste : la règle de CETTE épreuve n'est pas
   « propose un nom », c'est « le flou baisse à chaque erreur ». Une seule
   tentative ne la montrerait pas. La démonstration se trompe donc deux fois
   avant de trouver — c'est le seul moyen de faire voir le flou reculer.

   Conséquence technique : trois cycles identiques (ouvrir, défiler, choisir)
   ne se scénarisent pas proprement en @keyframes, qui ne savent pas boucler
   avec des valeurs différentes à chaque tour. Le scénario est donc une table
   d'événements datés, jouée par des minuteurs ; les changements d'état
   passent ensuite par de simples `transition` CSS. Les entrées et le voile,
   eux, restent en @keyframes préfixées `poch`.
============================================================ */

/* Chronologie, en ms depuis l'ouverture de la surcouche. */
const T_TITRE = 240;
const T_ACCROCHE = 640;
const T_SCENE = 900;    // pochette + champ de recherche
const T_CURSEUR = 1450;  // apparition du curseur

/* Un cycle = ouvrir le menu, le faire défiler, choisir. Cinq cycles :
   quatre erreurs qui font reculer le flou, puis la bonne réponse. Les cycles
   sont resserrés à 1250 ms pour que cinq passes tiennent en neuf secondes. */
const CYCLES = [1900, 3150, 4400, 5650, 6900];
const OUVRIR = 0;
const DEFILER = 300;
const CHOISIR = 800;

const T_REVELATION = CYCLES[CYCLES.length - 1] + CHOISIR + 150;
const T_SORTIE = T_REVELATION + 1100;
export const INTRO_POCHETTE_TOTAL = T_SORTIE + 450;

/* Flou après 0, 1, 2… réponses. La dernière valeur est 0 : la bonne réponse
   dévoile d'un coup ce que quatre erreurs n'avaient fait qu'entrouvrir. */
const FLOUS = [30, 22, 15, 9, 4, 0];

/* Mise en page de la colonne de réponses, calquée sur celle du jeu : la
   gouttière est calculée pour que les cinq jetons finissent au bas de la
   pochette. */
const COUVERTURE = 170;
const JETON_H = 26;
const JETON_TXT = 12;
const JETON_GAP = (COUVERTURE - 5 * JETON_H) / 4;

/* Repère de la scène : largeur fixe, mise à l'échelle sur petit écran. */
const SCENE_L = 620;
/* Deux hauteurs, et c'est nécessaire.
   · SCENE_H     — hauteur de CENTRAGE. Le menu déroulant n'est visible qu'une
                   fraction du temps ; le compter en entier laissait un vide
                   permanent sous le champ qui poussait la scène vers le haut.
   · SCENE_H_BAS — dernier pixel réellement occupé, menu déployé compris.

   La scène n'a pas d'overflow propre : le menu peut déborder de sa boîte de
   centrage. En revanche le VOILE, lui, rogne. Le menu est donc visible tant
   que (H − k·SCENE_H)/2 + k·SCENE_H_BAS ≤ H, ce qui donne la contrainte
   d'échelle ci-dessous — sans elle, la liste se coupait en bas du panneau. */
const SCENE_H = 360;
const SCENE_H_BAS = 402;
const H_CONTRAINTE = 2 * SCENE_H_BAS - SCENE_H;
const RANGEE = 34;   // hauteur d'une ligne du menu déroulant
const VISIBLES = 3;    // lignes visibles dans le menu
const DEFILEMENT = 2;    // lignes parcourues par le défilement

/* Positions du curseur dans le repère de la scène */
const REPOS = { x: 430, y: 380 };
const CHAMP = { x: 312, y: 270 };
const CHOIX = { x: 215, y: 352 };

export default function IntroPochette({ onFin, exclure = null }) {
  const [pochette, setPochette] = useState(null);
  const [echelle, setEchelle] = useState(1);
  const [etape, setEtape] = useState(-1);   // index dans le scénario
  const hote = useRef(null);
  const fini = useRef(false);
  const minuteurs = useRef([]);

  /* ---- Artiste de démonstration : jamais celui du jour ---- */
  const demoNom = ['Queen', 'Coldplay', 'Adele'].find((n) => n !== exclure) ?? 'Queen';
  const tries = [...ARTISTS].sort((a, b) => a.nom.localeCompare(b.nom));
  const iDemo = tries.findIndex((a) => a.nom === demoNom);

  /* Quatre mauvaises réponses puis la bonne. Chaque fenêtre de menu place le
     nom visé en 4ᵉ position : après un défilement de deux lignes, il tombe
     pile au milieu des trois lignes visibles. */
  const leurres = tries
    .filter((a) => a.nom !== demoNom)
    .slice(Math.max(0, iDemo - 9), Math.max(0, iDemo - 9) + 4)
    .map((a) => a.nom);
  const secours = ['ABBA', 'AC/DC', 'Adele', 'Coldplay'];
  const choix = [...Array(4)].map((_, i) => leurres[i] ?? secours[i]).concat(demoNom);

  function fenetreDe(nom) {
    const i = tries.findIndex((a) => a.nom === nom);
    const depart = Math.max(0, i - 3);
    const noms = tries.slice(depart, depart + VISIBLES + DEFILEMENT).map((a) => a.nom);
    return { noms, cible: noms.indexOf(nom) };
  }

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    minuteurs.current.forEach(clearTimeout);
    onFin?.();
  }

  /* ---- Scénario : une table d'instants, un état par instant ---- */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }

    const evenements = [];
    CYCLES.forEach((base, i) => {
      evenements.push({ t: base + OUVRIR, e: i * 3 });
      evenements.push({ t: base + DEFILER, e: i * 3 + 1 });
      evenements.push({ t: base + CHOISIR, e: i * 3 + 2 });
    });
    evenements.forEach(({ t, e }) => minuteurs.current.push(setTimeout(() => setEtape(e), t)));
    minuteurs.current.push(setTimeout(terminer, INTRO_POCHETTE_TOTAL));

    const surTouche = (ev) => { if (ev.key === 'Escape') terminer(); };
    window.addEventListener('keydown', surTouche);
    return () => {
      minuteurs.current.forEach(clearTimeout);
      window.removeEventListener('keydown', surTouche);
    };
  }, []);

  /* ---- La scène a une largeur fixe : on la réduit si le panneau est étroit ---- */
  useEffect(() => {
    const calc = () => {
      const l = hote.current?.offsetWidth ?? SCENE_L;
      const h = hote.current?.offsetHeight ?? SCENE_H;
      // Les DEUX dimensions comptent : le panneau est court tant que le jeu
      // n'a rien chargé, et ne tenir compte que de la largeur faisait sortir
      // le titre du cadre, donc disparaître sous l'overflow du voile.
      setEchelle(Math.min(1, (l - 24) / SCENE_L, (h - 40) / H_CONTRAINTE));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  /* ---- Pochette réelle, floutée jusqu'à la bonne réponse ----
     Deux précautions ajoutées après un écart entre local et production :
     · une seconde tentative, la première requête vers la fonction serverless
       pouvant échouer ou traîner sur un démarrage à froid ;
     · les erreurs sont tracées au lieu d'être avalées, sinon le seul symptôme
       visible est un cadre vide, qui ne dit pas d'où vient le problème. */
  useEffect(() => {
    let annule = false;

    async function tenter() {
      const res = await fetch(`/api/deezer?term=${encodeURIComponent(demoNom)}&limit=10`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`/api/deezer a répondu ${res.status}`);
      const data = await res.json();
      const t = (data?.data ?? []).find((x) => x.album?.cover_xl || x.album?.cover_big);
      const url = t?.album?.cover_xl ?? t?.album?.cover_big ?? null;
      if (!url) throw new Error('Aucune pochette dans la réponse Deezer');
      return url;
    }

    (async () => {
      for (let essai = 0; essai < 2 && !annule; essai++) {
        try {
          const url = await tenter();
          if (!annule) setPochette(url);
          return;
        } catch (err) {
          console.warn(`Intro pochette — tentative ${essai + 1} :`, err.message);
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    })();

    return () => { annule = true; };
  }, [demoNom]);

  /* ---- États dérivés du numéro d'étape ---- */
  const cycle = etape < 0 ? -1 : Math.floor(etape / 3);
  const phase = etape < 0 ? -1 : etape % 3;          // 0 ouvrir · 1 défiler · 2 choisir
  const menuOuvert = phase === 0 || phase === 1;
  const defile = phase === 1;
  const faits = etape < 0 ? 0 : cycle + (phase === 2 ? 1 : 0);   // réponses déjà données
  const flou = FLOUS[Math.min(faits, FLOUS.length - 1)];
  const trouve = faits >= choix.length;

  const nomVise = choix[Math.max(0, Math.min(cycle, choix.length - 1))];
  const { noms, cible } = fenetreDe(nomVise);
  const rates = choix.slice(0, Math.min(faits, choix.length - 1));

  const curseur = etape < 0 ? REPOS : menuOuvert && defile ? CHOIX : menuOuvert ? CHAMP : CHOIX;

  return (
    <div
      ref={hote}
      data-poch-surcouche
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
        animation: `pochVoile ${INTRO_POCHETTE_TOTAL}ms ease-out both`,
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes pochVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pochEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pochSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes pochJeton {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pochClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes pochCurseurEntree {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-poch-surcouche], [data-poch-surcouche] * {
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

        {/* Tout l'acte s'efface d'un bloc plutôt que par sorties séparées. */}
        <div style={{
          position: 'absolute', inset: 0,
          animation: `pochSortie 340ms ${T_SORTIE}ms ease-in both`,
        }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `pochEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Pochette floutée
          </div>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `pochEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            7 essais, le flou baisse à chaque erreur
          </div>

          {/* ---------- Pochette ---------- */}
          <div style={{
            position: 'absolute', top: 72, left: '50%', marginLeft: -85,
            width: COUVERTURE, height: COUVERTURE, overflow: 'hidden',
            borderRadius: 'var(--rayon-carte)',
            border: `${trouve ? '1px' : '0.5px'} solid ${trouve ? 'var(--or)' : 'var(--filet)'}`,
            background: 'linear-gradient(145deg, #3a2a12, #0B0B0B)',
            transition: 'border-color 400ms ease',
            animation: `pochEntree 340ms ${T_SCENE}ms ease-out both`,
          }}>
            {pochette && (
              <img
                src={pochette} alt="" referrerPolicy="no-referrer"
                onError={() => console.warn('Intro pochette — image refusée par le CDN :', pochette)}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  filter: `blur(${flou}px)`,
                  transform: trouve ? 'scale(1)' : 'scale(1.2)',
                  transition: 'filter 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            )}
          </div>

          {/* ---------- Champ de recherche ---------- */}
          <div style={{
            position: 'absolute', top: 258, left: '50%', marginLeft: -150,
            width: 300, height: 38, boxSizing: 'border-box', padding: '0 14px',
            display: 'flex', alignItems: 'center',
            background: 'var(--onyx-haut)',
            border: phase === 2 && !trouve
              ? '1px solid var(--carmin)'
              : `0.5px solid ${menuOuvert ? 'var(--or)' : 'var(--filet-fort)'}`,
            borderRadius: 'var(--rayon-controle)',
            fontFamily: 'var(--sans)', fontSize: 14,
            color: phase === 2 ? 'var(--ivoire)' : 'var(--cendre)',
            transition: 'border-color 250ms ease, color 250ms ease',
            animation: `pochEntree 340ms ${T_SCENE}ms ease-out both`,
          }}>
            {phase === 2 ? choix[cycle] : 'Nom d\u2019artiste\u2026'}
          </div>

          {/* ---------- Réponses données, en colonne à droite de la pochette ----------
               Même disposition que dans le jeu : c'est ce que l'intro doit
               apprendre à lire, pas une mise en page de démonstration. */}
          <div style={{
            position: 'absolute', top: 72, left: '50%', marginLeft: 98,
            width: 130, display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start', gap: JETON_GAP,
          }}>
            {rates.map((nom) => (
              <span key={nom} style={{
                fontFamily: 'var(--sans)', fontSize: JETON_TXT,
                height: JETON_H, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center',
                color: 'rgba(226, 75, 74, 0.65)',
                border: '0.5px solid rgba(226, 75, 74, 0.3)',
                borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                padding: '0 9px', maxWidth: '100%',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                animation: 'pochJeton 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}>
                {nom}
              </span>
            ))}
            {trouve && (
              <span style={{
                fontFamily: 'var(--sans)', fontSize: JETON_TXT,
                height: JETON_H, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center',
                color: 'var(--jade)',
                border: '0.5px solid var(--jade)',
                borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                padding: '0 9px', maxWidth: '100%',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                animation: 'pochJeton 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}>
                {demoNom}
              </span>
            )}
          </div>

          {/* ---------- Menu déroulant, par-dessus le reste comme en jeu ---------- */}
          <div style={{
            position: 'absolute', top: 300, left: '50%', marginLeft: -150,
            width: 300, height: RANGEE * VISIBLES, overflow: 'hidden', zIndex: 5,
            background: 'var(--onyx)',
            border: '0.5px solid var(--or)',
            borderRadius: 'var(--rayon-controle)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
            opacity: menuOuvert ? 1 : 0,
            transform: menuOuvert ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 220ms ease, transform 220ms ease',
            pointerEvents: 'none',
          }}>
            <div style={{
              transform: `translateY(${defile ? -RANGEE * DEFILEMENT : 0}px)`,
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}>
              {noms.map((nom, i) => {
                const survole = defile && i === cible;
                return (
                  <div key={nom} style={{
                    height: RANGEE, display: 'flex', alignItems: 'center', padding: '0 14px',
                    fontFamily: 'var(--sans)', fontSize: 13,
                    background: survole ? 'var(--onyx-haut)' : 'transparent',
                    color: survole ? 'var(--or)' : 'var(--ivoire)',
                    transition: 'background 200ms ease, color 200ms ease',
                  }}>
                    {nom}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${curseur.x}px, ${curseur.y}px)`,
            transition: 'transform 480ms cubic-bezier(0.5, 0, 0.2, 1)',
            opacity: 0,
            animation: `pochCurseurEntree 260ms ${T_CURSEUR}ms ease-out forwards`,
          }}>
            {/* Une onde de clic par instant de clic du scénario */}
            {CYCLES.flatMap((base) => [base + OUVRIR, base + CHOISIR]).map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%',
                opacity: 0,
                animation: `pochClic 460ms ${t - 40}ms ease-out both`,
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
   Identique de forme à celles d'Accords et d'Artiste : le chiffre occupe le
   panneau le temps d'être lu, sa couleur dit le verdict, la jauge le situe
   sur dix.
============================================================ */

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
export const RES_POCHETTE_TOTAL = 2900;

export function ResultatPochette({ score, artiste = null }) {
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
      data-poch-surcouche
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
        animation: `pochVoile ${RES_POCHETTE_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes pochVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pochEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pochSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes pochNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-poch-surcouche], [data-poch-surcouche] * {
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
        animation: `pochSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div
          className="etiquette-mono"
          style={{
            color: 'var(--cendre)',
            animation: `pochEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
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
          animation: `pochNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
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
          animation: `pochEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {artiste && (
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 12.5,
            color: 'var(--lin)',
            animation: `pochEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            C&apos;était {artiste}
          </div>
        )}
      </div>
    </div>
  );
}
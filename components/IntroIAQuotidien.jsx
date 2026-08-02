'use client';
import { useEffect } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — HUMAIN OU IA, MODE DÉFI DU JOUR

   Surcouche `absolute` posée DANS le panneau du jeu. Le panneau parent doit
   porter position relative — c'est déjà le cas.

   POURQUOI ELLE REPREND LA SCÈNE DU MODE LIBRE

   La démonstration de l'acte II — le bouton « Nouvel extrait », l'indicateur
   qui pulse pendant l'écoute, les deux cartes « Humain » et « IA », le
   curseur qui tranche — montre exactement l'écran du jeu. Elle est reprise
   telle quelle : une présentation qui ne ressemble pas au plateau qu'elle
   annonce manque son objet.

   CE QUI CHANGE PAR RAPPORT À CELLE DU MODE LIBRE

   L'acte I du mode libre annonce « Mode survie » et fait battre une pastille
   de vie unique. C'est le contraire du défi : là-bas une seule erreur
   termine le run, ici le format est fixe et une erreur ne coûte que ses
   points. Trois différences, donc trois remplacements :

     · l'acte d'ouverture annonce le format au lieu de la survie ;
     · le compteur de niveau, qui roulait de 1 à 2, devient « manche 1
       sur N » — le compte ne récompense pas, il situe ;
     · un acte final montre la série entière, une erreur comprise, puis la
       note qu'on en tire.

   Le nombre de manches est une prop et non une constante : il vit dans
   JeuIAGame (DAILY_ROUNDS), et la note en découle. La durée de l'extrait
   aussi (EXTRAIT_SEC) — l'indicateur affiche un chiffre, il doit être le bon.

   Préfixe des @keyframes : `iq`. Les dix épreuves sont montées simultanément
   dans le carrousel, des noms homonymes s'écraseraient silencieusement.
============================================================ */

/* ---- Acte I — le format ---- */
const A1_TITRE = 240;
const A1_REGLE = 660;
const A1_SORTIE = 1780;

/* ---- Acte II — la démonstration, reprise du mode libre ---- */
const A2 = 1980;
const T_ACCROCHE = A2;
const T_BOUTON = A2 + 320;    // « Nouvel extrait » apparaît
const T_CURSEUR = A2 + 620;
const D_CURSEUR = 2900;       // durée totale du trajet
const T_CLIC1 = A2 + 1300;   // clic sur « Nouvel extrait »
const T_LECTURE = A2 + 1480;   // l'extrait part : l'indicateur pulse
const T_CARTES = A2 + 2050;   // les deux réponses apparaissent
const T_CLIC2 = A2 + 3050;   // le curseur choisit « IA »
const T_VERDICT = A2 + 3350;   // la carte bascule en jade, l'autre s'estompe
const T_REVELATION = A2 + 3750;
const T_MANCHE = A2 + 4250;   // « manche 1 sur N »
const T_SORTIE_II = A2 + 5600;

/* ---- Acte III — le format et la note ---- */
const T_ACTE_III = T_SORTIE_II + 180;
const T_PASTILLES = T_ACTE_III + 400;
const PAS_PASTILLE = 300;

export function instantsIA(manches) {
  const tCalcul = T_PASTILLES + manches * PAS_PASTILLE + 320;
  const tNote = tCalcul + 620;
  const tSortie = tNote + 1400;
  return { tCalcul, tNote, tSortie, total: tSortie + 420 };
}

export function dureeIntroIA(manches = 3) {
  return instantsIA(manches).total;
}

export const INTRO_IA_QUOTIDIEN_TOTAL = dureeIntroIA(3);

/* ---------- Repère de la scène ----------
   Valeurs du mode libre : la scène doit occuper la même surface, sans quoi
   la reconnaissance ne joue plus. */
const SCENE_L = 520;
const SCENE_H = 344;

const REPOS = { x: 430, y: 290 };
const BOUTON = { x: 268, y: 64 };
const CARTE_IA = { x: 348, y: 195 };

/* Trajet du curseur, daté sur les mêmes instants que les clics : le geste ne
   peut donc pas se décaler de son effet. Concaténation de chaînes et non
   gabarit — un accent grave égaré fermerait le bloc CSS en plein milieu, ce
   qui ne se voit qu'au build. */
function keyframesCurseur() {
  const p = (t) => (((t - T_CURSEUR) / D_CURSEUR) * 100).toFixed(1);
  const pos = (c) => 'translate(' + c.x + 'px, ' + c.y + 'px)';
  return [
    '0%   { transform: ' + pos(REPOS) + '; opacity: 0; }',
    '6%   { transform: ' + pos(REPOS) + '; opacity: 1; }',
    p(T_CLIC1) + '% { transform: ' + pos(BOUTON) + '; }',
    p(T_CARTES) + '% { transform: ' + pos(BOUTON) + '; }',
    p(T_CLIC2) + '% { transform: ' + pos(CARTE_IA) + '; }',
    '92%  { transform: ' + pos(CARTE_IA) + '; opacity: 1; }',
    '100% { transform: ' + pos(CARTE_IA) + '; opacity: 0; }',
  ].join('\n');
}

const IconeHautParleur = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.3" aria-hidden="true">
    <path d="M3 6h2.4L8.6 3.3v9.4L5.4 10H3z" strokeLinejoin="round" />
    <path d="M11 5.8a3 3 0 0 1 0 4.4" strokeLinecap="round" />
  </svg>
);

const IconeHumain = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.3" aria-hidden="true">
    <circle cx="10" cy="6.4" r="3.4" />
    <path d="M3.4 17.2c0-3.6 3-6 6.6-6s6.6 2.4 6.6 6" strokeLinecap="round" />
  </svg>
);

const IconeIA = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    strokeWidth="1.3" aria-hidden="true">
    <rect x="3.6" y="6.4" width="12.8" height="10" rx="2.4" />
    <path d="M10 3v3.4M7.2 10.6v1.6M12.8 10.6v1.6" strokeLinecap="round" />
  </svg>
);

const virgule = (x) => x.toFixed(1).replace('.', ',');

export default function IntroIAQuotidien({ manches = 3, secondes = 12, onFin }) {
  const { tCalcul, tNote, tSortie, total } = instantsIA(manches);

  /* La série de démonstration se trompe UNE fois. C'est elle qui dit ce que
     le mode libre ne dit pas : une erreur ne termine rien, elle coûte
     seulement sa part de points. */
  const resultats = Array.from({ length: manches }, (_, i) => i !== manches - 1);
  const bonnes = resultats.filter(Boolean).length;

  /* Même formule que le jeu : la part de bonnes réponses, ramenée sur dix,
     à une décimale. Avec trois manches, deux bonnes font 6,7 — un barème en
     « points par manche » mentirait, dix ne se divise pas par trois. */
  const note = Math.round((bonnes / manches) * 10 * 10) / 10;

  useEffect(() => {
    if (typeof onFin !== 'function') return undefined;
    const t = setTimeout(onFin, total);
    return () => clearTimeout(t);
  }, [onFin, total]);

  const passer = typeof onFin === 'function' ? onFin : undefined;

  return (
    <div
      data-iq-surcouche
      onClick={passer}
      role={passer ? 'button' : undefined}
      tabIndex={passer ? 0 : undefined}
      aria-label={passer ? 'Passer la présentation' : undefined}
      onKeyDown={passer ? (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') {
          ev.preventDefault();
          passer();
        }
      } : undefined}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: passer ? 'pointer' : 'default',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: 'iqVoile ' + total + 'ms ease-out both',
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes iqVoile {
          0%   { opacity: 0; }
          3%   { opacity: 1; }
          ${((tSortie / total) * 100).toFixed(2)}% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes iqEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes iqSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        /* L'indicateur d'écoute respire tant que l'extrait tourne. */
        @keyframes iqPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
        /* La carte choisie vire au jade, l'autre s'estompe : le verdict se lit
           sur le geste qu'on vient de faire, pas à côté. */
        @keyframes iqJuste {
          to { border-color: var(--jade); color: var(--jade); }
        }
        @keyframes iqEcarte {
          to { opacity: 0.28; }
        }
        @keyframes iqClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes iqPastille {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes iqCurseur { ${keyframesCurseur()} }
        @media (prefers-reduced-motion: reduce) {
          [data-iq-surcouche], [data-iq-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
        /* Largeur fixe : sur un panneau étroit la scène est mise à l'échelle
           plutôt que recomposée, sinon elle cesserait de ressembler au
           plateau qu'elle annonce. */
        @media (max-width: 640px) { [data-iq-scene] { transform: scale(0.82); } }
        @media (max-width: 500px) { [data-iq-scene] { transform: scale(0.62); } }
      `}</style>

      <div
        data-iq-scene
        style={{ position: 'relative', width: SCENE_L, height: SCENE_H, flexShrink: 0 }}
      >
        {/* ============ ACTE I — le format ============
            Le mode libre annonce ici « Mode survie » et fait battre une
            pastille de vie. Dans le défi il n'y a ni survie ni vie : ce qu'il
            faut poser d'entrée, c'est le nombre de manches. */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--e4)',
          animation: 'iqSortie 340ms ' + A1_SORTIE + 'ms ease-in both',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: 'iqEntree 340ms ' + A1_TITRE + 'ms ease-out both',
          }}>
            Humain ou IA
          </div>

          <div style={{
            fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--ivoire)',
            animation: 'iqEntree 320ms ' + A1_REGLE + 'ms ease-out both',
          }}>
            {manches} extraits, une seule tentative chacun
          </div>
        </div>

        {/* ============ ACTE II — la démonstration ============
            Monté dès le départ mais tenu invisible par le remplissage `both`
            de ses animations retardées : rien n'apparaît dans le flux, donc
            aucun à-coup de mise en page quand l'acte I s'efface. */}
        <div style={{
          position: 'absolute', inset: 0,
          animation: 'iqSortie 340ms ' + T_SORTIE_II + 'ms ease-in both',
        }}>
          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            opacity: 0,
            animation: 'iqEntree 320ms ' + T_ACCROCHE + 'ms ease-out both',
          }}>
            Écoute l&apos;extrait, puis tranche
          </div>

          {/* ---------- 1 · on lance l'extrait ---------- */}
          <div style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            opacity: 0,
            animation: 'iqEntree 340ms ' + T_BOUTON + 'ms ease-out both',
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
            animation: 'iqEntree 320ms ' + T_LECTURE + 'ms ease-out both',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 13px', borderRadius: 'var(--rayon-controle)',
              border: '0.5px solid var(--filet-fort)',
              background: 'var(--onyx-haut)',
              fontFamily: 'var(--mono)', fontSize: 11.5, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--or)',
              animation: 'iqPulse 1400ms ' + T_LECTURE + 'ms ease-in-out infinite',
            }}>
              {IconeHautParleur}
              extrait en cours · {secondes} s
            </div>
          </div>

          {/* ---------- 3 · on tranche ---------- */}
          <div style={{
            position: 'absolute', top: 172, left: 0, right: 0,
            display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
          }}>
            {[
              { icone: IconeHumain, mot: 'Humain', choisie: false },
              { icone: IconeIA, mot: 'IA', choisie: true },
            ].map((c) => (
              <div key={c.mot} style={{
                width: 172, height: 46, boxSizing: 'border-box',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '0 var(--e4)',
                borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                border: '0.5px solid var(--filet-fort)',
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                color: 'var(--ivoire)',
                animation: c.choisie
                  ? 'iqEntree 340ms ' + T_CARTES + 'ms ease-out both, '
                    + 'iqJuste 420ms ' + T_VERDICT + 'ms ease-out forwards'
                  : 'iqEntree 340ms ' + T_CARTES + 'ms ease-out both, '
                    + 'iqEcarte 420ms ' + T_VERDICT + 'ms ease-out forwards',
              }}>
                {c.icone}
                {c.mot}
              </div>
            ))}
          </div>

          {/* ---------- Révélation ---------- */}
          <div style={{
            position: 'absolute', top: 246, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--lin)',
            opacity: 0,
            animation: 'iqEntree 340ms ' + T_REVELATION + 'ms ease-out both',
          }}>
            C&apos;était bien une IA
          </div>

          {/* ---------- Le compte des manches ----------
              Le mode libre fait rouler un niveau de 1 à 2. Ici il n'y a pas de
              niveau : il y a une manche sur N, et le compte ne récompense
              rien, il situe. */}
          <div style={{
            position: 'absolute', top: 288, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--e2)',
            opacity: 0,
            animation: 'iqEntree 320ms ' + T_MANCHE + 'ms ease-out both',
          }}>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>manche</span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500,
              color: 'var(--or)', lineHeight: 1,
            }}>
              1
            </span>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>sur {manches}</span>
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            animation: 'iqCurseur ' + D_CURSEUR + 'ms ' + T_CURSEUR + 'ms cubic-bezier(0.5, 0, 0.2, 1) both',
          }}>
            {[T_CLIC1, T_CLIC2].map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%',
                opacity: 0,
                animation: 'iqClic 460ms ' + (t - 40) + 'ms ease-out both',
              }} />
            ))}
            <svg width="16" height="21" viewBox="0 0 16 21"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} aria-hidden="true">
              <path d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ============ ACTE III — la série et la note ============ */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)',
          animation: 'iqSortie 340ms ' + tSortie + 'ms ease-in both',
        }}>
          <div className="etiquette-mono" style={{
            color: 'var(--lin)', opacity: 0,
            animation: 'iqEntree 320ms ' + T_ACTE_III + 'ms ease-out both',
          }}>
            aucune vie — une erreur n&apos;arrête rien
          </div>

          {/* La série se remplit une pastille à la fois, avec un raté à la
              fin : c'est lui qui prouve que le run va à son terme. */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
            {resultats.map((ok, i) => (
              <div key={i} style={{
                width: 42, height: 42, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid ' + (ok ? 'var(--or)' : 'var(--filet-fort)'),
                background: ok ? 'var(--or)' : 'transparent',
                color: ok ? 'var(--noir)' : 'var(--cendre)',
                opacity: 0,
                animation: 'iqPastille 320ms ' + (T_PASTILLES + i * PAS_PASTILLE)
                  + 'ms cubic-bezier(0.34, 1.4, 0.64, 1) both',
              }}>
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true">
                  {ok ? <path d="M3 8.5l3.5 3.5L13 5" /> : <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />}
                </svg>
              </div>
            ))}
          </div>

          {/* Le calcul. Formulé en part et non en points par manche : dix ne se
              divise pas par trois, annoncer « 3,33 points » serait exact et
              illisible. */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--lin)',
            opacity: 0,
            animation: 'iqEntree 340ms ' + tCalcul + 'ms ease-out both',
          }}>
            {bonnes} bonne{bonnes > 1 ? 's' : ''} réponse{bonnes > 1 ? 's' : ''} sur {manches}
          </div>

          <div style={{
            textAlign: 'center', opacity: 0,
            animation: 'iqEntree 380ms ' + tNote + 'ms ease-out both',
          }}>
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
              note de l&apos;épreuve
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 500,
              color: 'var(--or)', marginTop: 'var(--e2)', lineHeight: 1.1,
            }}>
              {virgule(note)} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
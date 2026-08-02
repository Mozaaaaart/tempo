'use client';
import { useEffect } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — RYTHME, MODE DÉFI DU JOUR

   Surcouche `absolute` posée DANS le panneau du jeu. Le panneau parent doit
   porter position relative — c'est déjà le cas.

   POURQUOI ELLE REPREND LA SCÈNE DU MODE LIBRE

   Une première version dessinait sa propre mise en page : cases carrées,
   jugements flottants, badges resserrés. Elle était lisible mais elle ne
   ressemblait pas au jeu, et une présentation qui ne montre pas l'écran qu'on
   va voir manque son objet. Celle-ci reprend donc la démonstration du mode
   libre au détail près — même grille de huit pas, mêmes notes rondes, même
   tête de lecture, même zone de frappe, mêmes étiquettes de phase — pour que
   le joueur reconnaisse le plateau à la seconde où le voile se lève.

   La mesure de préparation est conservée telle quelle. C'est le passage le
   plus utile de toute la démonstration : le contretemps le plus courant chez
   un nouveau joueur est de frapper dès la fin de l'écoute. Montrer la mesure
   à vide vaut mieux que l'écrire.

   CE QUI CHANGE PAR RAPPORT À CELLE DU MODE LIBRE

   Elle s'arrête sur un compteur de NIVEAU qui roule de 1 à 2, et elle est
   précédée d'un acte sur les vies. Ni niveau ni vie n'existent dans le défi :
   le format y est fixe, une manche ratée ne coûte rien, et la note est la
   MOYENNE des manches. Les deux derniers actes sont donc remplacés :

     · le compteur devient la note de la manche, sur dix ;
     · un acte final aligne les N notes et en tire la moyenne. C'est le point
       qu'aucune autre épreuve ne partage, il mérite un acte à lui seul.

   Le nombre de manches est une prop et non une constante : il vit dans
   JeuRythmeGame (DAILY_ROUNDS). Le figer ici ferait mentir la présentation au
   premier réglage changé, et la moyenne affichée serait fausse.

   Préfixe des @keyframes : `rq`. Les dix épreuves sont montées simultanément
   dans le carrousel, des noms homonymes s'écraseraient silencieusement.
============================================================ */

/* ---------- Chronologie, en ms depuis l'ouverture ---------- */

const DELAI_ENTREE = 300;

/* ---- Acte I — le plateau et les deux temps du geste ---- */
const T_TITRE = DELAI_ENTREE;
const T_REGLE = DELAI_ENTREE + 340;

const D2 = DELAI_ENTREE + 680;
const PAS_DEMO = 180;                 // durée d'un pas de la mesure
const DEMO_MOTIF = [0, 2, 3, 5];      // les temps frappés, sur 8 pas
const DEMO_PAS = 8;
const MESURE = DEMO_PAS * PAS_DEMO;

const D2_ECOUTE = D2;                             // étiquette « écoute »
const D2_GRILLE = D2 + 260;                       // la grille apparaît
const D2_LECTURE = D2 + 620;                      // la tête de lecture part
const D2_PREP = D2_LECTURE + MESURE + 240;        // « mesure de préparation »
const D2_PREP_TETE = D2_PREP + 260;               // le décompte bat
const D2_ATOI = D2_PREP_TETE + MESURE + 240;      // « à toi »
const D2_FRAPPES = D2_ATOI + 340;                 // les frappes
const D2_NOTE = D2_FRAPPES + MESURE + 240;        // la note de la manche
const D2_SORTIE = D2_NOTE + 1200;

/* ---- Acte II — la moyenne ---- */
const T_ACTE_II = D2_SORTIE + 180;
const T_TUILES = T_ACTE_II + 360;
const PAS_TUILE = 260;

export function instantsRythme(manches) {
  const tMoyenne = T_TUILES + manches * PAS_TUILE + 280;
  const tSortie = tMoyenne + 1400;
  return { tMoyenne, tSortie, total: tSortie + 420 };
}

export function dureeIntroRythme(manches = 5) {
  return instantsRythme(manches).total;
}

export const INTRO_RYTHME_QUOTIDIEN_TOTAL = dureeIntroRythme(5);

/* ---------- Repère de la scène ----------
   Largeurs reprises de la démonstration du mode libre : la grille fait 400,
   la zone de frappe autant. Changer ces valeurs romprait la reconnaissance. */
const SCENE_L = 440;
const SCENE_H = 452;
const GRILLE_L = 400;

/* Curseur : coordonnées relatives à la ZONE DE FRAPPE, qui le contient.
   Valeurs du mode libre, inchangées. */
const CURSEUR_REPOS = { x: 210, y: 210 };
const CURSEUR_ZONE = { x: 40, y: 34 };
const CURSEUR_DEBUT = D2_PREP_TETE;
const CURSEUR_FIN = D2_FRAPPES + MESURE + 200;

/* Trajet généré à partir des mêmes instants que les impacts : le geste ne
   peut donc pas se décaler de son effet. Concaténation de chaînes et non
   gabarit — un accent grave égaré fermerait le bloc CSS en plein milieu, ce
   qui ne se voit qu'au build. */
function trajetCurseur() {
  const duree = CURSEUR_FIN - CURSEUR_DEBUT;
  const p = (t) => (((t - CURSEUR_DEBUT) / duree) * 100).toFixed(1);
  const pos = (c, ecrase) => 'translate(' + c.x + 'px, ' + (c.y + (ecrase || 0)) + 'px)';

  const etapes = [];
  etapes.push('0% { transform: ' + pos(CURSEUR_REPOS) + '; opacity: 0; }');
  etapes.push('8% { transform: ' + pos(CURSEUR_REPOS) + '; opacity: 1; }');
  etapes.push(p(D2_FRAPPES - 200) + '% { transform: ' + pos(CURSEUR_ZONE) + '; opacity: 1; }');
  /* Une frappe = une descente brève de cinq pixels puis un retour : c'est le
     geste qu'on reconnaît, plus que le déplacement lui-même. */
  DEMO_MOTIF.forEach((pas) => {
    const t = D2_FRAPPES + pas * PAS_DEMO;
    etapes.push(p(t - 40) + '% { transform: ' + pos(CURSEUR_ZONE) + '; }');
    etapes.push(p(t) + '% { transform: ' + pos(CURSEUR_ZONE, 5) + '; }');
    etapes.push(p(t + 70) + '% { transform: ' + pos(CURSEUR_ZONE) + '; }');
  });
  etapes.push('94% { transform: ' + pos(CURSEUR_ZONE) + '; opacity: 1; }');
  etapes.push('100% { transform: ' + pos(CURSEUR_ZONE) + '; opacity: 0; }');
  return etapes.join('\n');
}

/* Notes de démonstration. On en prend autant que de manches, et la moyenne
   affichée est celle des notes réellement montrées — une moyenne fausse dans
   une présentation qui explique la moyenne serait le pire des défauts. */
const NOTES_DEMO = [7.8, 9.1, 6.4, 8.0, 7.7, 8.6, 7.2, 9.4, 6.9, 8.3];

function notesPour(manches) {
  const n = [];
  for (let i = 0; i < manches; i += 1) n.push(NOTES_DEMO[i % NOTES_DEMO.length]);
  return n;
}

const virgule = (x) => x.toFixed(1).replace('.', ',');

export default function IntroRythmeQuotidien({ manches = 5, onFin }) {
  const notes = notesPour(manches);
  const moyenne = Math.round((notes.reduce((a, b) => a + b, 0) / manches) * 10) / 10;
  const { tMoyenne, tSortie, total } = instantsRythme(manches);

  /* La surcouche se retire d'elle-même : le jeu est déjà en place derrière,
     on ne bloque rien. Le parent n'a qu'un booléen à baisser. */
  useEffect(() => {
    if (typeof onFin !== 'function') return undefined;
    const t = setTimeout(onFin, total);
    return () => clearTimeout(t);
  }, [onFin, total]);

  const passer = typeof onFin === 'function' ? onFin : undefined;

  return (
    <div
      data-rq-surcouche
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
        background: 'rgba(6, 6, 7, 0.88)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: 'rqVoile ' + total + 'ms ease-out both',
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes rqVoile {
          0%   { opacity: 0; }
          3%   { opacity: 1; }
          ${((tSortie / total) * 100).toFixed(2)}% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes rqEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rqEtiquetteSort {
          to { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes rqActeSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.94); }
        }
        /* --- La note ronde : trois temps, comme dans le vrai jeu ---
           elle s'allume à l'écoute, s'éteint dès la fin de la mesure — on doit
           la reproduire de mémoire, pas la recopier — puis reparaît en jade
           sous la frappe. L'ordre de déclaration compte : la dernière
           animation en cours l'emporte, et la sortie garde la main entre deux
           éclats grâce au remplissage forwards. */
        @keyframes rqNote {
          0%   { opacity: 0; transform: scale(0.2); }
          40%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rqNoteSort {
          to { opacity: 0; transform: scale(0.35); }
        }
        @keyframes rqNoteFlash {
          0%   { opacity: 0; transform: scale(0.35); background-color: var(--jade); }
          35%  { opacity: 1; transform: scale(1.2);  background-color: var(--jade); }
          100% { opacity: 0; transform: scale(1);    background-color: var(--jade); }
        }
        @keyframes rqCaseAllume {
          from { border-color: var(--filet); border-width: 0.5px; }
          to   { border-color: var(--or);    border-width: 1px; }
        }
        @keyframes rqCaseEteint {
          to { border-color: var(--filet); border-width: 0.5px; }
        }
        @keyframes rqCaseFrappe {
          0%   { border-color: var(--jade); border-width: 1px; }
          70%  { border-color: var(--jade); border-width: 1px; }
          100% { border-color: var(--filet); border-width: 0.5px; }
        }
        /* --- La tête de lecture traverse trois fois : écoute, préparation,
           reprise — puis s'efface. La laisser au bord droit donnait une barre
           orpheline. --- */
        @keyframes rqTete {
          from { opacity: 1; left: 0; }
          to   { opacity: 1; left: 100%; }
        }
        @keyframes rqTetePrep {
          from { opacity: 1; left: 0; background: var(--or-clair); }
          to   { opacity: 1; left: 100%; background: var(--or-clair); }
        }
        @keyframes rqTeteJade {
          from { opacity: 1; left: 0; background: var(--jade); }
          to   { opacity: 1; left: 100%; background: var(--jade); }
        }
        @keyframes rqTeteSort {
          to { opacity: 0; }
        }
        @keyframes rqBattement {
          0%   { opacity: 0; transform: scale(0.4);
                 background-color: var(--or-clair); border-color: var(--or-clair); }
          30%  { opacity: 1; transform: scale(1.25);
                 background-color: var(--or-clair); border-color: var(--or-clair); }
          100% { opacity: 1; transform: scale(1);
                 background-color: transparent; border-color: var(--filet-fort); }
        }
        /* La zone clignote pendant la préparation : l'endroit où frapper est
           désigné AVANT qu'on ait le droit de le faire. */
        @keyframes rqAttente {
          0%, 100% { border-color: var(--filet); }
          50%      { border-color: var(--or-clair); }
        }
        @keyframes rqImpact {
          0%   { opacity: 0; transform: scale(0.94); }
          35%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.03); }
        }
        @keyframes rqOnde {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes rqTuile {
          from { opacity: 0; transform: translateY(-10px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rqTrait {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes rqCurseur { ${trajetCurseur()} }
        @media (prefers-reduced-motion: reduce) {
          [data-rq-surcouche], [data-rq-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
        /* La scène a une largeur fixe : sur un panneau étroit elle est mise à
           l'échelle plutôt que recomposée, sinon elle cesserait de ressembler
           au plateau qu'elle annonce. */
        @media (max-width: 620px) { [data-rq-scene] { transform: scale(0.82); } }
        @media (max-width: 480px) { [data-rq-scene] { transform: scale(0.62); } }
      `}</style>

      <div
        data-rq-scene
        style={{ position: 'relative', width: SCENE_L, height: SCENE_H, flexShrink: 0 }}
      >
        {/* ============ ACTE I — le plateau et le geste ============ */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)',
          pointerEvents: 'none',
          animation: 'rqActeSortie 340ms ' + D2_SORTIE + 'ms ease-in both',
        }}>
          {/* En-tête : le nom de l'épreuve, puis la règle. La règle attend que
              le titre soit posé — les deux ensemble se lisent comme un pavé,
              l'un après l'autre comme une phrase. */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, lineHeight: 1,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
              animation: 'rqEntree 340ms ' + T_TITRE + 'ms ease-out both',
            }}>
              Rythme
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
              letterSpacing: '0.02em', color: 'var(--lin)', marginTop: 10,
              animation: 'rqEntree 320ms ' + T_REGLE + 'ms ease-out both',
            }}>
              {manches} mesures à reproduire, ta note est la moyenne
            </div>
          </div>

          {/* Étiquette de phase : trois messages au même endroit, l'un
              remplaçant l'autre — c'est le basculement du jeu. */}
          <div style={{ position: 'relative', height: 20, width: 360 }}>
            <div className="etiquette-mono" style={{
              position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--lin)',
              animation: 'rqEntree 300ms ' + D2_ECOUTE + 'ms ease-out both, '
                + 'rqEtiquetteSort 240ms ' + (D2_PREP - 120) + 'ms ease-in forwards',
            }}>
              écoute la mesure
            </div>
            <div className="etiquette-mono" style={{
              position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--or)',
              opacity: 0,
              animation: 'rqEntree 300ms ' + D2_PREP + 'ms ease-out both, '
                + 'rqEtiquetteSort 240ms ' + (D2_ATOI - 120) + 'ms ease-in forwards',
            }}>
              mesure de préparation — n&apos;appuie pas
            </div>
            <div className="etiquette-mono" style={{
              position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--jade)',
              opacity: 0,
              animation: 'rqEntree 300ms ' + D2_ATOI + 'ms ease-out both',
            }}>
              à toi, tape le même
            </div>
          </div>

          {/* Décompte de la mesure de préparation : quatre battements, un
              temps fort sur deux. Ils se posent l'un après l'autre — un compte
              se voit mieux qu'il ne se lit. */}
          <div style={{ display: 'flex', gap: 'var(--e3)', height: 12, alignItems: 'center' }}>
            {[0, 2, 4, 6].map((pas) => (
              <span key={pas} style={{
                width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box',
                border: '1px solid var(--filet-fort)', opacity: 0,
                animation: 'rqBattement 620ms ' + (D2_PREP_TETE + pas * PAS_DEMO) + 'ms ease-out both',
              }} />
            ))}
          </div>

          {/* La mesure. Les notes s'allument au passage de la tête de lecture,
              puis se rallument sous les frappes. */}
          <div style={{
            position: 'relative', width: GRILLE_L,
            animation: 'rqEntree 320ms ' + D2_GRILLE + 'ms ease-out both',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + DEMO_PAS + ', 1fr)', gap: 8 }}>
              {Array.from({ length: DEMO_PAS }, (_, i) => {
                const note = DEMO_MOTIF.includes(i);
                const surTemps = i % 2 === 0;
                return (
                  <div key={i} style={{
                    aspectRatio: '1 / 1.4', borderRadius: 'var(--rayon-controle)',
                    background: surTemps ? 'var(--onyx)' : 'transparent',
                    border: '0.5px solid ' + (surTemps ? 'var(--filet)' : 'rgba(242,236,224,0.07)'),
                    position: 'relative',
                    ...(note ? {
                      animation: 'rqCaseAllume 420ms ' + (D2_LECTURE + i * PAS_DEMO) + 'ms ease-out both, '
                        + 'rqCaseEteint 280ms ' + (D2_PREP - 160) + 'ms ease-in forwards, '
                        + 'rqCaseFrappe 420ms ' + (D2_FRAPPES + i * PAS_DEMO) + 'ms ease-out',
                    } : {}),
                  }}>
                    {note && (
                      <div style={{
                        position: 'absolute', inset: '26% 28%', borderRadius: '50%',
                        background: 'var(--or)', opacity: 0,
                        animation: 'rqNote 420ms ' + (D2_LECTURE + i * PAS_DEMO) + 'ms ease-out both, '
                          + 'rqNoteSort 280ms ' + (D2_PREP - 160) + 'ms ease-in forwards, '
                          + 'rqNoteFlash 420ms ' + (D2_FRAPPES + i * PAS_DEMO) + 'ms ease-out',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tête de lecture : elle traverse la mesure trois fois, à la même
                vitesse — la reprise doit se lire comme le même tempo. */}
            <div style={{
              position: 'absolute', top: -6, bottom: -6, left: 0, width: 2,
              background: 'var(--or)', opacity: 0,
              animation: 'rqTete ' + MESURE + 'ms ' + D2_LECTURE + 'ms linear both, '
                + 'rqTetePrep ' + MESURE + 'ms ' + D2_PREP_TETE + 'ms linear, '
                + 'rqTeteJade ' + MESURE + 'ms ' + D2_FRAPPES + 'ms linear, '
                + 'rqTeteSort 260ms ' + (D2_FRAPPES + MESURE) + 'ms ease-out forwards',
            }} />
          </div>

          {/* Zone de frappe : elle s'illumine à chaque temps du motif, au
              moment exact où la tête de lecture passe dessus. */}
          <div style={{
            position: 'relative', width: GRILLE_L, height: 84,
            borderRadius: 'var(--rayon-carte)',
            border: '0.5px solid var(--filet)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'rqEntree 320ms ' + (D2_GRILLE + 120) + 'ms ease-out both, '
              + 'rqAttente ' + (2 * PAS_DEMO) + 'ms ' + D2_PREP_TETE + 'ms ease-in-out ' + (DEMO_PAS / 2),
          }}>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>zone de frappe</span>

            {DEMO_MOTIF.map((pas) => (
              <span key={pas} style={{
                position: 'absolute', inset: 0, borderRadius: 'var(--rayon-carte)',
                border: '1px solid var(--jade)', opacity: 0,
                animation: 'rqImpact 320ms ' + (D2_FRAPPES + pas * PAS_DEMO) + 'ms ease-out both',
              }} />
            ))}

            {/* Curseur : il descend sur la zone et tape à chaque temps. Sans
                lui, on voit la zone s'allumer sans savoir que c'est NOUS qui
                devons la frapper. */}
            <div style={{
              position: 'absolute', left: 0, top: 0,
              animation: 'rqCurseur ' + (CURSEUR_FIN - CURSEUR_DEBUT) + 'ms '
                + CURSEUR_DEBUT + 'ms linear both',
            }}>
              {DEMO_MOTIF.map((pas) => (
                <span key={pas} style={{
                  position: 'absolute', left: -13, top: -13, width: 30, height: 30,
                  border: '1px solid var(--jade)', borderRadius: '50%', opacity: 0,
                  animation: 'rqOnde 420ms ' + (D2_FRAPPES + pas * PAS_DEMO) + 'ms ease-out both',
                }} />
              ))}
              <svg width="17" height="22" viewBox="0 0 16 21"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} aria-hidden="true">
                <path d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                  fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Ce que rapporte la mesure. Le mode libre fait rouler un niveau de
              1 à 2 ; ici la mesure ne fait pas monter, elle est NOTÉE — et
              c'est cette note qui entrera dans la moyenne. */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 'var(--e3)',
            opacity: 0,
            animation: 'rqEntree 340ms ' + D2_NOTE + 'ms ease-out both',
          }}>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
              manche 1 sur {manches}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500,
              color: 'var(--ivoire)', lineHeight: 1,
            }}>
              {virgule(notes[0])} <span style={{ fontSize: 15, color: 'var(--cendre)' }}>/ 10</span>
            </span>
          </div>
        </div>

        {/* ============ ACTE II — la moyenne ============
            Monté dès le départ mais tenu invisible par le `both` de ses
            animations retardées : rien n'entre dans le flux, donc aucun
            à-coup de mise en page quand l'acte I s'efface. */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)',
          pointerEvents: 'none',
          animation: 'rqActeSortie 340ms ' + tSortie + 'ms ease-in both',
        }}>
          <div className="etiquette-mono" style={{
            color: 'var(--cendre)', opacity: 0,
            animation: 'rqEntree 300ms ' + T_ACTE_II + 'ms ease-out both',
          }}>
            une note par manche
          </div>

          {/* Les tuiles se posent une par une : on voit la série se
              constituer, ce qu'un affichage d'un bloc ne montrerait pas. */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
            maxWidth: GRILLE_L,
          }}>
            {notes.map((n, i) => (
              <div key={i} style={{
                width: 66, padding: '10px 0', textAlign: 'center',
                borderRadius: 'var(--rayon-controle)',
                border: '0.5px solid var(--filet-fort)',
                background: 'var(--onyx)',
                opacity: 0,
                animation: 'rqTuile 380ms ' + (T_TUILES + i * PAS_TUILE)
                  + 'ms cubic-bezier(0.34, 1.4, 0.64, 1) both',
              }}>
                <div className="etiquette-mono" style={{ color: 'var(--cendre)', fontSize: 9 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 500,
                  color: 'var(--ivoire)', marginTop: 3,
                }}>
                  {virgule(n)}
                </div>
              </div>
            ))}
          </div>

          {/* Le trait se tire depuis le centre une fois la dernière tuile
              posée. C'est le geste d'un calcul, pas une décoration : il arrive
              après les opérandes. */}
          <div aria-hidden="true" style={{
            width: 230, height: 1, background: 'var(--filet-fort)',
            transform: 'scaleX(0)',
            animation: 'rqTrait 420ms ' + (tMoyenne - 260) + 'ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }} />

          <div style={{
            textAlign: 'center', opacity: 0,
            animation: 'rqEntree 380ms ' + tMoyenne + 'ms ease-out both',
          }}>
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
              note de l&apos;épreuve
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 500,
              color: 'var(--or)', marginTop: 'var(--e2)', lineHeight: 1.1,
            }}>
              {virgule(moyenne)} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
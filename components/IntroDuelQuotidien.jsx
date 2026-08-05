'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — DUEL, MODE DÉFI DU JOUR

   Surcouche `absolute` posée DANS le panneau du jeu, comme partout ailleurs.
   Le panneau parent doit porter position relative.

   POURQUOI ELLE REPREND LA SCÈNE DU MODE LIBRE

   Une première version dessinait sa propre mise en page : cadres neutres,
   colonnes resserrées, boutons en pastilles. Elle était lisible mais elle ne
   ressemblait pas au jeu, et une présentation qui ne montre pas l'écran qu'on
   va voir manque son objet. Celle-ci reprend donc la scène de démonstration
   du mode libre au détail près — mêmes tailles, mêmes filets, mêmes libellés,
   pochettes réelles — pour que le joueur reconnaisse le plateau à la seconde
   où le voile se lève.

   CE QUI CHANGE PAR RAPPORT À CELLE DU MODE LIBRE

   Elle s'arrête sur un compteur de NIVEAU qui passe de 1 à 2, et elle est
   précédée d'un acte sur les vies. Ni niveau ni vie n'existent dans le défi :
   le format y est fixe, une erreur n'arrête rien, et la note est sur dix.
   Les deux derniers actes sont donc remplacés :

     · le compteur devient « manche 1 sur N » ;
     · un acte final montre la série complète, une erreur comprise, puis le
       calcul de la note.

   Le nombre de duels est une prop et non une constante : il vit dans
   JeuDuelGame (NB_DUELS_QUOTIDIEN), et le barème en découle. Le figer ici
   ferait mentir la présentation au premier réglage changé.

   Préfixe des @keyframes : `dq`. Les dix épreuves sont montées simultanément
   dans le carrousel, des noms homonymes s'écraseraient silencieusement.
============================================================ */

/* ---------- Chronologie, en ms depuis l'ouverture ---------- */

/* Temps de pose : le fond s'installe avant que l'œil ait à lire. */
const DELAI_ENTREE = 300;

/* ---- Acte I — le plateau et le geste ---- */
const T_TITRE = DELAI_ENTREE;
const T_REGLE = DELAI_ENTREE + 340;
const T_CARTES = DELAI_ENTREE + 620;
const T_CHIFFRE = DELAI_ENTREE + 1140;
const T_QUESTION = DELAI_ENTREE + 1720;
const T_CURSEUR = DELAI_ENTREE + 2120;
const D_CURSEUR = 1500;
const T_CLIC = DELAI_ENTREE + 3220;
const T_REVEAL = DELAI_ENTREE + 3570;
const T_MANCHE = DELAI_ENTREE + 4220;   // « manche 1 sur N »
const T_SORTIE_I = T_MANCHE + 1250;

/* ---- Acte II — le format et le barème ---- */
const T_ACTE_II = T_SORTIE_I + 180;
const T_PASTILLES = T_ACTE_II + 420;
const PAS_PASTILLE = 300;

export function instantsDuel(manches) {
  const tCalcul = T_PASTILLES + manches * PAS_PASTILLE + 320;
  const tNote = tCalcul + 620;
  const tSortie = tNote + 1400;
  return { tCalcul, tNote, tSortie, total: tSortie + 420 };
}

export function dureeIntroDuel(manches = 5) {
  return instantsDuel(manches).total;
}

export const INTRO_DUEL_QUOTIDIEN_TOTAL = dureeIntroDuel(5);

/* ---------- Repères de la scène ----------
 *
 * DEUX géométries, et non une réduite.
 *
 * La scène large reprend la démonstration du mode libre au pixel près : deux
 * colonnes séparées par un filet vertical, le « vs » posé dessus. C'est ce
 * que montre le jeu sur un écran large, et toute la valeur d'une intro tient
 * à ce qu'elle ressemble à ce qui suit.
 *
 * Mais sur mobile, le jeu NE MONTRE PLUS ÇA. La règle .duel-grille de
 * globals.css y empile les deux morceaux et couche le « vs » en séparateur
 * horizontal. Continuer à réduire la scène large donnait donc une intro qui
 * annonçait un plateau que le joueur n'allait pas voir — et, à l'échelle
 * nécessaire pour la faire tenir, un texte de six pixels.
 *
 * La géométrie étroite reprend donc l'ordre du plateau mobile : pochette,
 * titre, artiste, bouton d'écoute, puis le chiffre pour le premier morceau et
 * la question pour le second.
 *
 * Toutes les ordonnées sont explicites plutôt que déduites d'un flux : le
 * curseur se déplace en coordonnées absolues, et il doit viser une touche
 * dont la position est connue à l'avance. */
const GEO_LARGE = {
  L: 620, H: 504,
  pochette: 132, col: 250,
  fsTitre: 26, fsRegle: 13, fsNom: 14, fsArtiste: 12.5, fsChiffre: 22,
  titre: 0, regle: 40, carteA: 74, vs: 126, carteB: 74,
  basA: 326, basB: 326, manche: 458,
  repos: { x: 520, y: 424 }, cible: { x: 372, y: 380 },
};

/* Les ordonnées ci-dessous sont VÉRIFIÉES, pas estimées : une carte occupe
   116 de pochette, 12 de marge, 16 de titre, 15 d'artiste, 12 de marge et 33
   de bouton, soit 204. Chaque bloc démarre après la fin du précédent, et le
   dernier s'arrête à 676 dans un cadre de 684. Un chevauchement ne se verrait
   qu'à l'écran, et seulement sur le morceau dont le titre est le plus long. */
const GEO_ETROITE = {
  L: 300, H: 684,
  pochette: 116, col: 300,
  fsTitre: 19, fsRegle: 11, fsNom: 13, fsArtiste: 11.5, fsChiffre: 21,
  titre: 0, regle: 26,
  carteA: 52,          // pochette du premier morceau        →  52-256
  basA: 264,           // son nombre de streams              → 264-308
  vs: 316,             // séparateur horizontal              → 316-336
  carteB: 344,         // pochette du second morceau         → 344-548
  basB: 556,           // question, réponse, deux touches    → 556-646
  manche: 654,         //                                    → 654-676
  /* La cible est le centre de la touche « plus » : les deux touches font
     104 de large avec 8 de gouttière, donc 216 centrés dans 300 — « plus »
     occupe 42 à 146, centre 94. Verticalement, les touches vont de 594 à
     646 ; la pointe du curseur vise un peu au-dessus du centre. */
  repos: { x: 244, y: 660 }, cible: { x: 94, y: 612 },
};

/* Les deux morceaux de démonstration, identiques à ceux du mode libre. Les
   pochettes viennent de Deezer comme en jeu : un aplat de couleur ne
   montrerait pas ce qu'on voit vraiment. Le morceau de droite fait plus que
   celui de gauche, la bonne réponse est donc « plus » — et c'est elle que le
   curseur joue. Une erreur d'entrée brouillerait le geste ; l'erreur est
   montrée plus loin, dans la série, là où elle a un sens. */
const DEMO_GAUCHE = { terme: 'The Weeknd Starboy', titre: 'Starboy', artiste: 'The Weeknd', streams: '2,27 Mds' };
const DEMO_DROITE = { terme: 'Ed Sheeran Shape of You', titre: 'Shape of You', artiste: 'Ed Sheeran', streams: '4,05 Mds' };

/* Trajet du curseur, généré à partir des mêmes instants que le clic : le
   geste ne peut donc pas se décaler de son effet. Concaténation de chaînes
   et non gabarit : un accent grave égaré fermerait le bloc CSS en plein
   milieu, ce qui ne se voit qu'au build. */
function keyframesCurseur(G) {
  const p = (t) => (((t - T_CURSEUR) / D_CURSEUR) * 100).toFixed(1);
  const pos = (c, dy) => 'translate(' + c.x + 'px, ' + (c.y + (dy || 0)) + 'px)';
  return [
    '0%   { transform: ' + pos(G.repos) + '; opacity: 0; }',
    '10%  { transform: ' + pos(G.repos) + '; opacity: 1; }',
    p(T_CLIC - 60) + '% { transform: ' + pos(G.cible) + '; }',
    p(T_CLIC) + '% { transform: ' + pos(G.cible, 4) + '; }',
    p(T_CLIC + 90) + '% { transform: ' + pos(G.cible) + '; }',
    '92%  { transform: ' + pos(G.cible) + '; opacity: 1; }',
    '100% { transform: ' + pos(G.cible) + '; opacity: 0; }',
  ].join('\n');
}

const virgule = (x) => String(x).replace('.', ',');

/* Une carte de morceau : pochette, titre, artiste, bouton d'écoute.
 *
 * Au niveau du module, et non dans le corps du composant. Un composant défini
 * à l'intérieur d'un autre est recréé à chaque rendu du parent : React le
 * traite comme un type neuf, démonte l'ancien sous-arbre et remonte le nouvel
 * — ce qui relancerait ici les animations d'entrée à chaque battement de la
 * chronologie.
 *
 * Une seule définition pour les deux dispositions : c'est ce qui garantit que
 * la version empilée et la version côte à côte ne divergeront pas. */
function CarteMorceau({ m, src, G }) {
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div style={{
        width: G.pochette, height: G.pochette, margin: '0 auto',
        borderRadius: 'var(--rayon-carte)', overflow: 'hidden',
        background: 'var(--onyx-haut)',
        border: '0.5px solid var(--filet)',
      }}>
        {src && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src} alt="" referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      <div style={{
        fontFamily: 'var(--sans)', fontSize: G.fsNom, fontWeight: 500,
        color: 'var(--ivoire)', marginTop: 'var(--e3)', lineHeight: 1.2,
      }}>
        {m.titre}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: G.fsArtiste, color: 'var(--lin)', marginTop: 2 }}>
        {m.artiste}
      </div>

      {/* Bouton d'écoute, comme en jeu : inerte ici, mais il doit être là —
          c'est par lui qu'on juge. */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        marginTop: 'var(--e3)', padding: '8px 14px',
        borderRadius: 'var(--rayon-controle)',
        border: '0.5px solid var(--filet-fort)',
        fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ivoire)',
      }}>
        <svg width="9" height="11" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
          <path d="M0 0v12l10-6z" />
        </svg>
        Écouter 15 s
      </div>
    </div>
  );
}

export default function IntroDuelQuotidien({ manches = 5, onFin }) {
  const { tCalcul, tNote, tSortie, total } = instantsDuel(manches);

  /* Barème : la note reste sur dix quel que soit le nombre de duels. Avec
     cinq manches, une bonne réponse vaut deux points. */
  const parBonne = Math.round((10 / manches) * 100) / 100;
  /* La série de démonstration se trompe UNE fois — c'est ce qui montre qu'une
     erreur ne coupe pas la série, contrairement au mode libre où elle est
     fatale. */
  const resultats = Array.from({ length: manches }, (_, i) => i !== 2);
  const bonnes = resultats.filter(Boolean).length;
  const note = Math.round(bonnes * parBonne * 10) / 10;

  /* Pochettes, chargées dès l'ouverture du voile. L'acte I laisse largement
     le temps à la requête d'aboutir ; si elle échoue, les cadres restent
     vides et le reste de la scène tient debout. Même route que le jeu. */
  const [pochettes, setPochettes] = useState({ gauche: null, droite: null });

  /* ---- Mise à l'échelle MESURÉE ----
   *
   * La scène a une largeur fixe de 620 : sur un panneau étroit, elle est
   * réduite plutôt que recomposée, sinon elle cesserait de ressembler au
   * plateau qu'elle annonce.
   *
   * Elle l'était par deux paliers en dur, 0,78 puis 0,56, décidés sur la
   * largeur de la FENÊTRE. Or ce qui compte est la largeur du PANNEAU, qui
   * est bien plus petite — la page a ses marges, le panneau son rembourrage.
   * Sur un téléphone de 390 px, le palier de 0,56 donnait une scène de
   * 347 px dans un panneau qui en offre 296 : elle débordait des deux côtés
   * et le voile, qui rogne ce qui dépasse, tranchait les deux pochettes.
   *
   * On mesure donc l'hôte, comme le font les sept autres intros. La hauteur
   * entre aussi dans le calcul : le panneau du duel change de hauteur selon
   * ce qu'il contient, et une scène rognée par le bas serait le même défaut
   * dans l'autre sens.
   *
   * Vingt-quatre pixels de retrait de chaque côté : sans eux, la scène
   * touche exactement le bord et n'a plus l'air posée dans le panneau. */
  const hote = useRef(null);
  const [echelle, setEchelle] = useState(1);
  /* La géométrie se choisit sur la largeur du PANNEAU, pas sur celle de la
     fenêtre : c'est la surface dont la scène dispose réellement. Le seuil est
     celui à partir duquel la scène large ne tient plus sans devenir illisible
     — deux colonnes de 250 plus leurs gouttières. */
  /* Valeur de départ décidée SANS ATTENDRE la mesure.
   *
   * L'état initial était `false`, donc la géométrie large, corrigée ensuite
   * par l'effet de mesure. Deux choses en dépendaient alors : que l'élément
   * ait déjà une largeur au moment où l'effet s'exécute, et que le repli
   * choisi quand il n'en a pas encore soit du bon côté. Ce repli valait la
   * largeur de la scène large, soit 620 — c'est-à-dire précisément la valeur
   * qui conclut « écran large ».
   *
   * matchMedia répond immédiatement et sans dépendre de la mise en page. La
   * mesure garde ensuite le dernier mot : elle seule connaît la largeur du
   * panneau, qui n'est pas celle de la fenêtre. */
  const [etroit, setEtroit] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  const G = etroit ? GEO_ETROITE : GEO_LARGE;

  useEffect(() => {
    const el = hote.current;
    if (!el) return;
    const calc = () => {
      /* Repli sur la fenêtre, et non sur la largeur de la scène large : un
         élément pas encore disposé rend zéro, et retomber sur 620 revenait à
         affirmer qu'on est sur grand écran au moment même où on ne sait rien. */
      const l = el.offsetWidth || window.innerWidth;
      const h = el.offsetHeight || window.innerHeight;
      const serre = l < 560;
      setEtroit(serre);
      const g = serre ? GEO_ETROITE : GEO_LARGE;
      setEchelle(Math.min(1, (l - 24) / g.L, (h - 24) / g.H));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let annule = false;
    const chercher = async (terme) => {
      try {
        const res = await fetch('/api/deezer?term=' + encodeURIComponent(terme) + '&limit=5');
        if (!res.ok) return null;
        const data = await res.json();
        const t = (data?.data ?? []).find((x) => x.album?.cover_big || x.album?.cover_xl);
        return t?.album?.cover_big ?? t?.album?.cover_xl ?? null;
      } catch {
        return null;
      }
    };
    (async () => {
      const [gauche, droite] = await Promise.all([
        chercher(DEMO_GAUCHE.terme),
        chercher(DEMO_DROITE.terme),
      ]);
      if (!annule) setPochettes({ gauche, droite });
    })();
    return () => { annule = true; };
  }, []);

  /* La surcouche se retire d'elle-même : le duel est déjà en place derrière,
     on ne bloque rien. Le parent n'a qu'un booléen à baisser. */
  useEffect(() => {
    if (typeof onFin !== 'function') return undefined;
    const t = setTimeout(onFin, total);
    return () => clearTimeout(t);
  }, [onFin, total]);

  const passer = typeof onFin === 'function' ? onFin : undefined;

  return (
    <div
      ref={hote}
      data-dq-surcouche
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
        animation: 'dqVoile ' + total + 'ms ease-out both',
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes dqVoile {
          0%   { opacity: 0; }
          3%   { opacity: 1; }
          ${((tSortie / total) * 100).toFixed(2)}% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes dqEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dqSort {
          to { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes dqActeSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.94); }
        }
        /* La touche choisie vire au jade, l'autre s'estompe : le verdict se
           lit sur le geste qu'on vient de faire, pas à côté. */
        @keyframes dqJuste {
          to { border-color: var(--jade); color: var(--jade); }
        }
        @keyframes dqEcarte {
          to { opacity: 0.28; }
        }
        @keyframes dqOnde {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @keyframes dqPastille {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes dqCurseur { ${keyframesCurseur(G)} }
        @media (prefers-reduced-motion: reduce) {
          [data-dq-surcouche], [data-dq-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div
        data-dq-scene
        style={{
          position: 'relative', width: G.L, height: G.H, flexShrink: 0,
          transform: `scale(${echelle})`, transformOrigin: 'center',
        }}
      >
        {/* ============ ACTE I — le plateau et le geste ============ */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: 'dqActeSortie 340ms ' + T_SORTIE_I + 'ms ease-in both',
        }}>
          {/* En-tête : le nom de l'épreuve, puis la règle en une ligne. La
              règle attend que le titre soit posé — les deux ensemble se lisent
              comme un pavé, l'un après l'autre comme une phrase. */}
          <div style={{
            position: 'absolute', top: G.titre, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: G.fsTitre, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: 'dqEntree 340ms ' + T_TITRE + 'ms ease-out both',
          }}>
            Duel de streams
          </div>

          <div style={{
            position: 'absolute', top: G.regle, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: G.fsRegle, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: 'dqEntree 320ms ' + T_REGLE + 'ms ease-out both',
          }}>
            Lequel des deux a été le plus écouté ?
          </div>

          {/* ---------- Les deux morceaux ----------
              Côte à côte quand la place le permet, empilés sinon — comme le
              plateau du jeu, dont la règle .duel-grille fait exactement ce
              basculement au même seuil. Les deux dispositions partagent la
              même carte, il n'y a donc qu'un seul rendu à maintenir. */}
          {etroit ? (
            <>
              <div style={{
                position: 'absolute', top: G.carteA, left: 0, right: 0,
                animation: 'dqEntree 340ms ' + T_CARTES + 'ms ease-out both',
              }}>
                <CarteMorceau m={DEMO_GAUCHE} src={pochettes.gauche} G={G} />
              </div>

              {/* Le « vs » couché : deux filets et le glyphe entre eux. Un
                  trait continu passant derrière le glyphe demanderait de lui
                  peindre un fond, et aucun aplat ne se confond avec le voile
                  translucide posé sur le panneau. */}
              <div style={{
                position: 'absolute', top: G.vs, left: 0, right: 0,
                display: 'flex', alignItems: 'center', gap: 'var(--e3)', padding: '0 24px',
                animation: 'dqEntree 340ms ' + (T_CARTES + 120) + 'ms ease-out both',
              }}>
                <span style={{ flex: 1, height: '0.5px', background: 'var(--filet)' }} />
                <span style={{
                  fontFamily: 'var(--serif, var(--mono))', fontSize: 20,
                  color: 'var(--cendre)', lineHeight: 1,
                }}>
                  vs
                </span>
                <span style={{ flex: 1, height: '0.5px', background: 'var(--filet)' }} />
              </div>

              <div style={{
                position: 'absolute', top: G.carteB, left: 0, right: 0,
                animation: 'dqEntree 340ms ' + T_CARTES + 'ms ease-out both',
              }}>
                <CarteMorceau m={DEMO_DROITE} src={pochettes.droite} G={G} />
              </div>
            </>
          ) : (
            <>
              <div style={{
                position: 'absolute', top: G.carteA, left: 0, right: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                animation: 'dqEntree 340ms ' + T_CARTES + 'ms ease-out both',
              }}>
                <div style={{ width: G.col, paddingRight: 'var(--e5)' }}>
                  <CarteMorceau m={DEMO_GAUCHE} src={pochettes.gauche} G={G} />
                </div>
                <div style={{
                  width: G.col, borderLeft: '0.5px solid var(--filet)', paddingLeft: 'var(--e5)',
                }}>
                  <CarteMorceau m={DEMO_DROITE} src={pochettes.droite} G={G} />
                </div>
              </div>

              {/* « vs » posé sur le filet central */}
              <div style={{
                position: 'absolute', top: G.vs, left: 0, right: 0, textAlign: 'center',
                fontFamily: 'var(--serif, var(--mono))', fontSize: 22, color: 'var(--cendre)',
                animation: 'dqEntree 340ms ' + (T_CARTES + 120) + 'ms ease-out both',
              }}>
                vs
              </div>
            </>
          )}

          {/* ---------- Le chiffre connu, sous le premier morceau ----------

              EN COLONNE LARGE, CE BLOC PARTAGE SA RANGÉE AVEC LA QUESTION
              (même `top`), et il doit donc se caler sur la COLONNE DE GAUCHE,
              pas sur le centre de la scène.

              Il était simplement centré : large de G.col dans une scène de
              G.L, il se posait à cheval sur le milieu — 185 à 435 quand la
              colonne de gauche va de 60 à 310. Il recouvrait donc la question
              et les deux touches, qui occupent 310 à 560. Le défaut ne se
              voyait qu'ici : le jeu libre, lui, réunit les deux blocs dans une
              seule rangée flex, où le problème ne peut pas se poser.

              La marge est calculée, pas écrite en dur : `50% - G.col` place le
              bord gauche du bloc exactement là où commence sa colonne, quelle
              que soit la géométrie. C'est le miroir exact du `marginRight` du
              bloc de droite, juste en dessous — les deux se lisent ensemble.

              En colonne étroite, les deux blocs sont sur des rangées
              distinctes et occupent toute la largeur : on reste centré. */}
          <div style={{
            position: 'absolute', top: G.basA, left: 0, right: 0,
            display: 'flex', justifyContent: etroit ? 'center' : 'flex-start',
          }}>
            <div style={{
              width: G.col, textAlign: 'center',
              paddingRight: etroit ? 0 : 'var(--e5)',
              marginLeft: etroit ? 0 : 'calc(50% - ' + G.col + 'px)',
              boxSizing: 'border-box', opacity: 0,
              animation: 'dqEntree 340ms ' + T_CHIFFRE + 'ms ease-out both',
            }}>
              <div style={{
                height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: G.fsChiffre, fontWeight: 500, lineHeight: 1,
                color: 'var(--or)',
              }}>
                {DEMO_GAUCHE.streams}
              </div>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginTop: 4 }}>
                streams Spotify
              </div>
            </div>
          </div>

          {/* ---------- La question, puis la réponse au même endroit ----------
              En colonne large, ce bloc partage sa rangée avec le chiffre : les
              deux nombres tombent alors sur la même ligne. En colonne étroite
              il vient plus bas, sous le second morceau, là où il porte. */}
          <div style={{
            position: 'absolute', top: G.basB, left: 0, right: 0,
            display: 'flex', justifyContent: etroit ? 'center' : 'flex-end',
          }}>
            <div style={{
              width: G.col, textAlign: 'center',
              paddingLeft: etroit ? 0 : 'var(--e5)',
              marginRight: etroit ? 0 : 'calc(50% - ' + G.col + 'px)',
              boxSizing: 'border-box',
            }}>
              <div style={{ position: 'relative', height: 26 }}>
                <div className="etiquette-mono" style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--lin)', opacity: 0,
                  animation: 'dqEntree 320ms ' + T_QUESTION + 'ms ease-out both, '
                    + 'dqSort 240ms ' + (T_REVEAL - 80) + 'ms ease-in forwards',
                }}>
                  plus ou moins qu&apos;à gauche ?
                </div>

                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--mono)', fontSize: G.fsChiffre, fontWeight: 500, lineHeight: 1,
                  color: 'var(--jade)', opacity: 0,
                  animation: 'dqEntree 340ms ' + T_REVEAL + 'ms ease-out both',
                }}>
                  {DEMO_DROITE.streams}
                </div>
              </div>

              <div style={{
                display: 'flex', gap: 'var(--e2)', justifyContent: 'center', marginTop: 'var(--e3)',
              }}>
                {[
                  { txt: 'plus', fleche: '↑', choisi: true },
                  { txt: 'moins', fleche: '↓', choisi: false },
                ].map((b) => (
                  <div key={b.txt} style={{
                    width: 104, height: 52, boxSizing: 'border-box',
                    display: 'inline-flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    borderRadius: 'var(--rayon-carte)',
                    background: 'var(--onyx-haut)',
                    border: '0.5px solid var(--filet-fort)',
                    opacity: 0,
                    animation: b.choisi
                      ? 'dqEntree 320ms ' + (T_QUESTION + 160) + 'ms ease-out both, '
                        + 'dqJuste 380ms ' + (T_CLIC + 120) + 'ms ease-out forwards'
                      : 'dqEntree 320ms ' + (T_QUESTION + 160) + 'ms ease-out both, '
                        + 'dqEcarte 380ms ' + (T_CLIC + 120) + 'ms ease-out forwards',
                  }}>
                    <span style={{ fontSize: 15, color: 'var(--or)' }}>{b.fleche}</span>
                    <span className="etiquette-mono" style={{ color: 'var(--ivoire)' }}>{b.txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Le compteur de manche ----------
              C'est ici que le mode libre affichait « niveau 1 » puis le
              faisait rouler sur 2. Dans le défi il n'y a pas de niveau : il y
              a une manche sur N, et le compte ne récompense rien, il situe. */}
          <div style={{
            position: 'absolute', top: G.manche, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--e2)',
            opacity: 0,
            animation: 'dqEntree 340ms ' + T_MANCHE + 'ms ease-out both',
          }}>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>manche</span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500,
              color: 'var(--or)', lineHeight: 1,
            }}>
              1
            </span>
            <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>sur {manches}</span>
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0, zIndex: 5,
            animation: 'dqCurseur ' + D_CURSEUR + 'ms ' + T_CURSEUR + 'ms cubic-bezier(0.5, 0, 0.2, 1) both',
          }}>
            <div aria-hidden="true" style={{
              position: 'absolute', left: -11, top: -11, width: 26, height: 26,
              border: '1px solid var(--or-clair)', borderRadius: '50%',
              opacity: 0,
              animation: 'dqOnde 560ms ' + (T_CLIC - 120) + 'ms ease-out both',
            }} />
            <svg width="16" height="21" viewBox="0 0 16 21"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }} aria-hidden="true">
              <path d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ============ ACTE II — le format et le barème ============
            Monté dès le départ mais tenu invisible par le `both` de ses
            animations retardées : rien n'apparaît dans le flux, donc aucun
            à-coup quand l'acte I s'efface. */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          animation: 'dqActeSortie 340ms ' + tSortie + 'ms ease-in both',
        }}>
          <div style={{
            position: 'absolute', top: 118, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            opacity: 0, animation: 'dqEntree 340ms ' + T_ACTE_II + 'ms ease-out both',
          }}>
            {manches} duels
          </div>

          <div className="etiquette-mono" style={{
            position: 'absolute', top: 156, left: 0, right: 0, textAlign: 'center',
            color: 'var(--lin)',
            opacity: 0, animation: 'dqEntree 320ms ' + (T_ACTE_II + 180) + 'ms ease-out both',
          }}>
            aucune vie — une erreur n&apos;arrête rien
          </div>

          {/* La série se remplit une pastille à la fois, avec un raté au
              milieu : c'est lui qui prouve que le run continue. */}
          <div style={{
            position: 'absolute', top: 208, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
            paddingLeft: 16, paddingRight: 16,
          }}>
            {resultats.map((ok, i) => (
              <div key={i} style={{
                width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid ' + (ok ? 'var(--or)' : 'var(--filet-fort)'),
                background: ok ? 'var(--or)' : 'transparent',
                color: ok ? 'var(--noir)' : 'var(--cendre)',
                opacity: 0,
                animation: 'dqPastille 320ms ' + (T_PASTILLES + i * PAS_PASTILLE)
                  + 'ms cubic-bezier(0.34, 1.4, 0.64, 1) both',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true">
                  {ok ? <path d="M3 8.5l3.5 3.5L13 5" /> : <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />}
                </svg>
              </div>
            ))}
          </div>

          {/* Le calcul, écrit une fois la série complète. */}
          <div style={{
            position: 'absolute', top: 274, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--lin)',
            opacity: 0, animation: 'dqEntree 340ms ' + tCalcul + 'ms ease-out both',
          }}>
            {bonnes} bonne{bonnes > 1 ? 's' : ''} réponse{bonnes > 1 ? 's' : ''}
            {' × '}{virgule(parBonne)} point{parBonne > 1 ? 's' : ''}
          </div>

          <div style={{
            position: 'absolute', top: 318, left: 0, right: 0, textAlign: 'center',
            opacity: 0, animation: 'dqEntree 380ms ' + tNote + 'ms ease-out both',
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
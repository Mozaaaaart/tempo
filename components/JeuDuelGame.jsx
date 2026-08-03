'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { panel, btn, seeded, ScoreBox, statusStyle } from '@/components/dailyGames';
import { freshPreviewUrl } from '@/utils/deezer';
import { useVolume } from '@/utils/volume';
import { useIntro } from '@/utils/intro';
import { useEpreuveVisible } from '@/components/ContexteEpreuveVisible';
import IntroDuelQuotidien from '@/components/IntroDuelQuotidien';
/* Surcouche de résultat partagée. Elle porte le nom de l'épreuve où elle est
   née, mais elle est générique — score et détail en props — et c'est déjà
   celle qu'utilise Humain ou IA. En recopier une seconde ici ferait diverger
   deux animations qui doivent rester identiques d'une épreuve à l'autre. */
import { ResultatIA, RES_IA_TOTAL } from '@/components/IntroIA';

/**
 * Épreuve « Duel » — face-à-face de popularité.
 *
 * Deux morceaux côte à côte. Celui de gauche (la RÉFÉRENCE) affiche son
 * nombre de streams Spotify ; celui de droite (le CHALLENGER) le cache. Le
 * candidat écoute puis déclare si le challenger a fait mieux ou moins bien.
 *
 * Bonne réponse : le challenger glisse à gauche et devient la référence — le
 * chiffre qu'on vient de découvrir sert donc de point de comparaison suivant.
 * Mauvaise réponse : la référence ne bouge pas, seul le challenger est
 * remplacé. Cinq duels, deux points par bonne réponse, note sur dix.
 *
 * Données : public/data/duels.json, produit hors ligne par
 * scripts/generer-duels.mjs. Chargé par fetch et non par import — 350 Ko
 * dans le bundle JS seraient téléchargés et parsés à chaque visite.
 */

/* ------------------------------------------------------------------
   CACHE DU POOL, au niveau du module

   duels.json pèse 636 Ko. Le fichier était récupéré et désérialisé à CHAQUE
   montage : dans le défi du jour, où l'épreuve est remontée à chaque arrivée
   tant qu'on ne l'a pas entamée, cela refaisait un aller-retour réseau et un
   JSON.parse de 636 Ko à chaque passage — une dizaine de millisecondes sur le
   fil principal, plus le filtrage.

   On retient la PROMESSE et non le résultat : deux montages simultanés — ce
   qui arrive au double montage de StrictMode en développement — partagent
   alors la même requête au lieu d'en lancer deux.

   Portée module et non composant : c'est justement d'un montage à l'autre
   qu'il faut se souvenir. Un rechargement de page la vide, ce qui est correct
   — le fichier est régénéré hors ligne par scripts/generer-duels.mjs.

   En cas d'échec, la promesse est oubliée : sans cela, une panne réseau
   passagère condamnerait l'épreuve pour toute la durée de la session. */
let poolPromesse = null;

function chargerPool() {
  if (poolPromesse) return poolPromesse;
  poolPromesse = (async () => {
    const rep = await fetch('/data/duels.json');
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    const data = await rep.json();
    const morceaux = (data?.morceaux ?? []).filter(
      (m) => m.deezerId && m.streams > 0 && m.pochette
    );
    if (morceaux.length < 30) throw new Error('pool insuffisant');
    return morceaux;
  })().catch((err) => {
    poolPromesse = null;
    throw err;
  });
  return poolPromesse;
}

/** Mode quotidien : format fixe, noté sur dix, une seule tentative. */
const NB_DUELS_QUOTIDIEN = 5;

/* La note reste sur dix quel que soit le nombre de duels : c'est le barème
   qui s'adapte, pas l'échelle. Sans cette conversion, passer de dix manches à
   cinq plafonnait le score à 5 sur 10 — le maximum devenait inatteignable
   sans qu'aucun message ne le dise. */
const POINTS_PAR_DUEL = 10 / NB_DUELS_QUOTIDIEN;

/** Note sur dix à partir du nombre de bonnes réponses. Une décimale, comme
    partout ailleurs sur le site. */
function noteQuotidienne(bonnes) {
  return Math.round(bonnes * POINTS_PAR_DUEL * 10) / 10;
}

/** Mode libre : survie à UNE seule vie. Aucune erreur permise — le score est
    le niveau atteint, comme dans l'épreuve « Humain ou IA ». */
const VIES = 1;

/**
 * Écart minimum entre les deux morceaux opposés, resserré à mesure que le
 * niveau monte — c'est là que réside la difficulté croissante du mode survie.
 * Au niveau 1 on oppose des titres qui vont du simple au double ; passé le
 * niveau 15, il faut trancher à 10 % près.
 */
function ecartMini(niveau) {
  return Math.max(1.1, 2 - niveau * 0.06);
}

/** Écart plancher, utilisé en repli quand le pool n'offre aucun candidat. */
const ECART_PLANCHER = 1.1;

const DUREE_EXTRAIT = 15000;   // ms d'extrait jouable
const PAUSE_REVELATION = 1700; // ms d'affichage du résultat avant le duel suivant

/* Temps de pose entre l'arrivée du voile et le début du contenu : le fond
   a le temps de s'installer avant que l'œil ait quelque chose à lire.
   Toutes les autres temporisations de la surcouche s'y ajoutent, si bien
   qu'il suffit de toucher cette valeur pour décaler l'ensemble. */
const DELAI_ENTREE = 500;

/* Durée d'une perte ordinaire, délai d'entrée compris. Une bonne réponse
   n'ouvre aucun voile : la série continue sans interruption. */
const DUREE_PERTE = DELAI_ENTREE + 1900;

/* Dernière vie : la perte se joue d'abord en entier — le joueur doit voir
   la pastille s'éteindre comme les fois précédentes — puis un second acte
   remplace le décompte par le verdict. Les deux actes vivent dans le même
   voile, l'un s'efface pendant que l'autre monte. */
const SORTIE_ACTE_PERTE = DELAI_ENTREE + 1900; // le décompte s'efface
const ENTREE_DEFAITE = DELAI_ENTREE + 2200;    // la croix se trace
const DUREE_DEFAITE = DELAI_ENTREE + 4000;     // durée totale du voile

/* Ouverture de run. Même grammaire que la défaite, jouée à l'envers : le
   titre pose le cadre, les trois vies se comptent une par une, puis le
   vœu remplace le tout avant que le voile se lève. */
const INTRO_TITRE = DELAI_ENTREE;              // « Mode survie »
const INTRO_VIES = DELAI_ENTREE + 480;         // première pastille
const INTRO_PAS_VIE = 200;                     // écart entre deux pastilles
/* La légende attend que la dernière pastille soit posée : nommer « 3 vies »
   avant qu'elles ne soient toutes là ferait mentir le compte. */
const INTRO_LEGENDE = INTRO_VIES + (VIES - 1) * INTRO_PAS_VIE + 300;
const SORTIE_ACTE_INTRO = DELAI_ENTREE + 1500; // le titre et la vie s'effacent

/* ---- Acte II : la démonstration ----
   Le vœu « Bonne chance » ne disait rien du jeu. À la place, on montre la
   question posée : deux morceaux, celui de gauche dont on connaît les
   streams, celui de droite qu'il faut situer au-dessus ou en dessous. Le
   curseur choisit, le chiffre caché se révèle, le niveau monte.

   L'acte II démarre pendant que l'acte I finit de s'effacer : attendre la
   fin complète créait un temps mort au milieu de l'intro. */
/* L'acte II ne peut pas commencer avant que l'acte I n'ait entamé sa sortie :
   à 1800 ms le titre entrait alors que « Mode survie » et la pastille étaient
   encore pleinement là, et les deux se lisaient ensemble. On démarre donc
   juste après le début du fondu — un léger recouvrement enchaîne les deux
   actes sans temps mort, mais l'ordre reste lisible. */
const D2 = SORTIE_ACTE_INTRO + 180;
const D2_TITRE = D2;                  // le nom de l'épreuve
const D2_REGLE = D2 + 340;            // la règle, une fois le titre posé
const D2_CARTES = D2 + 620;           // les deux pochettes se posent
const D2_CHIFFRE = D2 + 1140;          // le nombre de streams de gauche
const D2_QUESTION = D2 + 1720;        // « plus ou moins ? » et les deux choix
const D2_CURSEUR = D2 + 2120;
const D2_CURSEUR_DUREE = 1500;
const D2_CLIC = D2 + 3220;            // le curseur tranche
const D2_REVEAL = D2 + 3570;          // le chiffre caché apparaît
const D2_NIVEAU = D2 + 4220;          // le compteur se pose
const D2_MONTEE = D2_NIVEAU + 620;    // 1 roule sur 2
const D2_SORTIE = D2_MONTEE + 1300;
const DUREE_INTRO = D2_SORTIE + 420;  // durée totale du voile

/* Repère de la scène de démonstration, en pixels. Elle reprend la mise en
   page du vrai jeu : deux colonnes séparées par un filet et le « vs », la
   pochette, le titre, l'artiste, le bouton d'écoute — puis le chiffre à
   gauche et les deux réponses à droite. */
const DEMO_L = 620;
const DEMO_H = 504;
const DEMO_POCHETTE = 132;
const DEMO_COL = 250;

/* Les deux morceaux de démonstration. Les pochettes viennent de Deezer, comme
   en jeu : un aplat de couleur ne montrerait pas ce qu'on voit vraiment. */
const DEMO_GAUCHE = { terme: 'The Weeknd Starboy', titre: 'Starboy', artiste: 'The Weeknd', streams: '2,27 Mds' };
const DEMO_DROITE = { terme: 'Ed Sheeran Shape of You', titre: 'Shape of You', artiste: 'Ed Sheeran', streams: '4,05 Mds' };

const DEMO_REPOS = { x: 520, y: 424 };
const DEMO_CIBLE = { x: 372, y: 380 };   // le bouton « plus »

function keyframesCurseurDemo() {
  const p = (t) => (((t - D2_CURSEUR) / D2_CURSEUR_DUREE) * 100).toFixed(1);
  const pos = (c, dy = 0) => `translate(${c.x}px, ${c.y + dy}px)`;
  return `
    0%   { transform: ${pos(DEMO_REPOS)}; opacity: 0; }
    10%  { transform: ${pos(DEMO_REPOS)}; opacity: 1; }
    ${p(D2_CLIC - 60)}%  { transform: ${pos(DEMO_CIBLE)}; }
    ${p(D2_CLIC)}%       { transform: ${pos(DEMO_CIBLE, 4)}; }
    ${p(D2_CLIC + 90)}%  { transform: ${pos(DEMO_CIBLE)}; }
    92%  { transform: ${pos(DEMO_CIBLE)}; opacity: 1; }
    100% { transform: ${pos(DEMO_CIBLE)}; opacity: 0; }
  `;
}

/* ============================================================
   OUTILS
============================================================ */

/** 4 317 333 487 → « 4,32 Mds » ; 1 050 000 000 → « 1,05 Md » ; 885 143 258 → « 885 M » */
function formaterStreams(n) {
  if (n >= 1e9) {
    const milliards = n / 1e9;
    // Le pluriel se décide sur la valeur déjà arrondie à 2 décimales : sans
    // ça, 1 999 000 000 s'affichait « 2,00 Md » — le test sur la valeur
    // brute ne voyait pas encore le passage à 2.
    const pluriel = Math.round(milliards * 100) / 100 >= 2;
    return `${milliards.toFixed(2).replace('.', ',')} Md${pluriel ? 's' : ''}`;
  }
  return `${Math.round(n / 1e6).toLocaleString('fr-FR')} M`;
}

/** Mélange de Fisher-Yates, alimenté par le générateur fourni. */
function melanger(tableau, rng) {
  const t = [...tableau];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

const ecart = (a, b) => Math.max(a, b) / Math.min(a, b);

/* Une donnée du tableau de bord : étiquette mono en cendre, valeur en ivoire. */
function Donnee({ etiquette, valeur, accent = false }) {
  return (
    <div>
      <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>{etiquette}</div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 14, marginTop: 2,
        color: accent ? 'var(--or)' : 'var(--ivoire)',
      }}>
        {valeur}
      </div>
    </div>
  );
}

/* ============================================================
   PASTILLES DE VIE
   `perdue` = index de la pastille en train de s'éteindre, ou null hors
   animation. Les pastilles avant elle restent pleines, celles après sont
   déjà vides.
============================================================ */

function Pastilles({ restantes, perdue = null, taille = 18, delai = 0, echelonne = false }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--e3)',
        justifyContent: 'center',
        // En mode échelonné chaque pastille porte sa propre entrée : animer
        // aussi le conteneur ferait monter le groupe entier par-dessus, et
        // les arrivées individuelles se perdraient dans le mouvement.
        animation: echelonne ? undefined : `duelTexteEntree 320ms ${delai}ms ease-out both`,
      }}
    >
      {Array.from({ length: VIES }, (_, i) => {
        const pleine = i < restantes;
        const seteint = i === perdue;
        return (
          <span
            key={i}
            style={{
              width: taille,
              height: taille,
              borderRadius: '50%',
              boxSizing: 'border-box',
              border: '1.5px solid',
              borderColor: pleine ? 'var(--ivoire)' : 'var(--filet-fort)',
              backgroundColor: pleine ? 'var(--ivoire)' : 'transparent',
              // L'extinction attend que les pastilles soient posées : le
              // remplissage `both` maintient d'ici là l'état du keyframe 0 %,
              // soit une pastille pleine — la vie est donc bien visible avant
              // de disparaître.
              animation: seteint
                ? `duelPointPerdu 760ms ${delai + 400}ms ease-out both`
                : echelonne
                ? `duelPointArrivee 360ms ${delai + i * INTRO_PAS_VIE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   SURCOUCHE
   Voile posé sur le panneau plutôt qu'une bannière insérée au-dessus : la
   grille ne se décale pas et le regard reste au centre du plateau.
   Le voile s'ouvre et se referme dans la même animation, calée sur la durée
   passée en prop — pas d'état de sortie à gérer côté React.
============================================================ */

function Surcouche({ annonce, onPasser }) {
  const restantes = annonce.restantes ?? 0;
  const finale = Boolean(annonce.finale);
  const intro = annonce.type === 'intro';

  /* Seule la présentation se passe. Les annonces de perte et de défaite ne
     sont pas des explications mais des résultats : les rendre cliquables
     ferait sauter son verdict à un joueur qui cliquait encore sur « plus »
     ou « moins ». */
  const passable = intro && typeof onPasser === 'function';

  /* Pochettes de la démonstration, chargées dès l'ouverture du voile. L'acte I
     dure assez longtemps pour qu'elles soient là quand l'acte II arrive ; si
     la requête échoue, le cadre reste vide et le reste de la scène tient. */
  const [pochettes, setPochettes] = useState({ gauche: null, droite: null });

  useEffect(() => {
    if (!intro) return;
    let annule = false;
    const chercher = async (terme) => {
      try {
        const res = await fetch(`/api/deezer?term=${encodeURIComponent(terme)}&limit=5`);
        if (!res.ok) return null;
        const data = await res.json();
        const t = (data?.data ?? []).find((x) => x.album?.cover_big || x.album?.cover_xl);
        return t?.album?.cover_big ?? t?.album?.cover_xl ?? null;
      } catch { return null; }
    };
    (async () => {
      const [gauche, droite] = await Promise.all([
        chercher(DEMO_GAUCHE.terme),
        chercher(DEMO_DROITE.terme),
      ]);
      if (!annule) setPochettes({ gauche, droite });
    })();
    return () => { annule = true; };
  }, [intro]);

  return (
    <div
      data-duel-surcouche
      onClick={passable ? onPasser : undefined}
      role={passable ? 'button' : undefined}
      tabIndex={passable ? 0 : undefined}
      aria-label={passable ? 'Passer la présentation' : undefined}
      onKeyDown={passable ? (e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPasser();
        }
      } : undefined}
      style={{
        cursor: passable ? 'pointer' : 'default',
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--e4)',
        textAlign: 'center',
        padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: `duelVoile ${annonce.duree}ms ease-out both`,
      }}
      aria-live="polite"
    >
      {intro ? (
        <>
          {/* ---- Acte I : le cadre ----
              Le titre pose la règle, les pastilles la matérialisent. Elles
              arrivent une par une : compter trois vies est plus parlant que
              les voir apparaître d'un bloc. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e5)',
              animation: `duelActeSortie 300ms ${SORTIE_ACTE_INTRO}ms ease-in both`,
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--or)',
              animation: `duelTexteEntree 340ms ${INTRO_TITRE}ms ease-out both`,
            }}>
              Mode survie
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e4)',
            }}>
              <Pastilles restantes={VIES} taille={20} delai={INTRO_VIES} echelonne />

              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 22,
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: '0.02em',
                  // Ivoire plutôt que cendre : la légende nomme les pastilles
                  // juste au-dessus, elle doit peser autant qu'elles.
                  color: 'var(--ivoire)',
                  animation: `duelTexteEntree 320ms ${INTRO_LEGENDE}ms ease-out both`,
                }}
              >
                {VIES} vie{VIES > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* ---- Acte II : la démonstration ----
              Monté dès le départ mais tenu invisible par le `both` de ses
              animations retardées : rien n'entre dans le flux, donc aucun
              à-coup de mise en page quand l'acte I s'efface.

              La mise en page reprend celle du jeu — deux colonnes, filet
              central, « vs » — pour qu'il n'y ait rien à réapprendre entre la
              présentation et la première manche. */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            animation: `duelActeSortie 340ms ${D2_SORTIE}ms ease-in both`,
          }}>
            <div style={{ position: 'relative', width: DEMO_L, height: DEMO_H }}>

              {/* En-tête : le nom de l'épreuve, puis la règle en une ligne.
                 La règle attend que le titre soit posé — les deux ensemble se
                 lisent comme un pavé, l'un après l'autre comme une phrase. */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, lineHeight: 1,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
                animation: `duelTexteEntree 340ms ${D2_TITRE}ms ease-out both`,
              }}>
                Duel de streams
              </div>

              <div style={{
                position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
                letterSpacing: '0.02em', color: 'var(--lin)',
                animation: `duelTexteEntree 320ms ${D2_REGLE}ms ease-out both`,
              }}>
                Lequel des deux a été le plus écouté ?
              </div>

              {/* Les deux colonnes */}
              <div style={{
                position: 'absolute', top: 74, left: 0, right: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                animation: `duelTexteEntree 340ms ${D2_CARTES}ms ease-out both`,
              }}>
                {[
                  { d: DEMO_GAUCHE, src: pochettes.gauche, cote: 'gauche' },
                  { d: DEMO_DROITE, src: pochettes.droite, cote: 'droite' },
                ].map(({ d: m, src, cote }, i) => (
                  <div key={cote} style={{
                    width: DEMO_COL, textAlign: 'center',
                    borderLeft: i === 1 ? '0.5px solid var(--filet)' : undefined,
                    paddingLeft: i === 1 ? 'var(--e5)' : undefined,
                    paddingRight: i === 0 ? 'var(--e5)' : undefined,
                  }}>
                    <div style={{
                      width: DEMO_POCHETTE, height: DEMO_POCHETTE, margin: '0 auto',
                      borderRadius: 'var(--rayon-carte)', overflow: 'hidden',
                      background: 'var(--onyx-haut)',
                      border: '0.5px solid var(--filet)',
                    }}>
                      {src && (
                        <img
                          src={src} alt="" referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      )}
                    </div>

                    <div style={{
                      fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                      color: 'var(--ivoire)', marginTop: 'var(--e3)', lineHeight: 1.2,
                    }}>
                      {m.titre}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)', marginTop: 2 }}>
                      {m.artiste}
                    </div>

                    {/* Bouton d'écoute, comme en jeu : il n'est pas cliquable
                        ici, mais il doit être là — c'est par lui qu'on juge. */}
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
                ))}
              </div>

              {/* « vs » posé sur le filet central */}
              <div style={{
                position: 'absolute', top: 126, left: 0, right: 0, textAlign: 'center',
                fontFamily: 'var(--serif, var(--mono))', fontSize: 22, color: 'var(--cendre)',
                animation: `duelTexteEntree 340ms ${D2_CARTES + 120}ms ease-out both`,
              }}>
                vs
              </div>

              {/* Bas des deux colonnes.

                  Une seule rangée plutôt que deux blocs posés chacun sur une
                  moitié : `width: 50%` centrait sur la demi-scène et non sur
                  la colonne, qui est décalée par sa gouttière — d'où des
                  chiffres désaxés par rapport aux pochettes.

                  Les deux nombres partagent en prime un emplacement de même
                  hauteur, donc ils tombent sur la même ligne. */}
              <div style={{
                position: 'absolute', top: 326, left: 0, right: 0,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              }}>
                {/* Gauche : le chiffre connu */}
                <div style={{
                  width: DEMO_COL, textAlign: 'center', paddingRight: 'var(--e5)',
                  boxSizing: 'border-box',
                  opacity: 0,
                  animation: `duelTexteEntree 340ms ${D2_CHIFFRE}ms ease-out both`,
                }}>
                  <div style={{
                    height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
                    color: 'var(--or)',
                  }}>
                    {DEMO_GAUCHE.streams}
                  </div>
                  <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginTop: 4 }}>
                    streams Spotify
                  </div>
                </div>

                {/* Droite : la question, puis la réponse au même endroit */}
                <div style={{
                  width: DEMO_COL, textAlign: 'center', paddingLeft: 'var(--e5)',
                  boxSizing: 'border-box',
                }}>
                  <div style={{ position: 'relative', height: 26 }}>
                    <div className="etiquette-mono" style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--lin)', opacity: 0,
                      animation: `duelTexteEntree 320ms ${D2_QUESTION}ms ease-out both, demoSort 240ms ${D2_REVEAL - 80}ms ease-in forwards`,
                    }}>
                      plus ou moins qu&apos;à gauche ?
                    </div>

                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
                      color: 'var(--jade)', opacity: 0,
                      animation: `duelTexteEntree 340ms ${D2_REVEAL}ms ease-out both`,
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
                          ? `duelTexteEntree 320ms ${D2_QUESTION + 160}ms ease-out both, demoJuste 380ms ${D2_CLIC + 120}ms ease-out forwards`
                          : `duelTexteEntree 320ms ${D2_QUESTION + 160}ms ease-out both, demoEcarte 380ms ${D2_CLIC + 120}ms ease-out forwards`,
                      }}>
                        <span style={{ fontSize: 15, color: 'var(--or)' }}>{b.fleche}</span>
                        <span className="etiquette-mono" style={{ color: 'var(--ivoire)' }}>{b.txt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ce qu'on gagne : le niveau monte d'un cran.

                 Posé sous la rangée du bas, boutons compris : celle-ci
                 commence à 252 et descend jusqu'à 356 avec ses cartes de
                 52 px. Le compteur venait donc se loger dans leur ombre. */}
              <div style={{
                position: 'absolute', top: 458, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--e2)',
                opacity: 0,
                animation: `duelTexteEntree 340ms ${D2_NIVEAU}ms ease-out both`,
              }}>
                <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>niveau</span>
                <span style={{
                  position: 'relative', display: 'inline-block',
                  width: 20, height: 30, overflow: 'hidden',
                  fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 500, lineHeight: '30px',
                }}>
                  <span style={{
                    position: 'absolute', inset: 0, color: 'var(--lin)',
                    animation: `demoChiffreSort 560ms ${D2_MONTEE}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                  }}>1</span>
                  <span style={{
                    position: 'absolute', inset: 0, color: 'var(--or)',
                    animation: `demoChiffreEntre 560ms ${D2_MONTEE}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                  }}>2</span>
                </span>
              </div>

              {/* Curseur */}
              <div style={{
                position: 'absolute', left: 0, top: 0,
                animation: `demoCurseur ${D2_CURSEUR_DUREE}ms ${D2_CURSEUR}ms cubic-bezier(0.5, 0, 0.2, 1) both`,
              }}>
                <div style={{
                  position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                  border: '1px solid var(--or-clair)', borderRadius: '50%', opacity: 0,
                  animation: `demoOnde 460ms ${D2_CLIC - 40}ms ease-out both`,
                }} />
                <svg width="16" height="21" viewBox="0 0 16 21" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
                  <path
                    d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                    fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ---- Acte I : le décompte ----
              Sur la dernière vie, tout le bloc s'efface d'un coup pour
              laisser la place au verdict. Un seul wrapper animé plutôt que
              trois sorties à synchroniser. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--e4)',
              animation: finale
                ? `duelActeSortie 300ms ${SORTIE_ACTE_PERTE}ms ease-in both`
                : undefined,
            }}
          >
            <Pastilles restantes={restantes} perdue={restantes} taille={20} delai={DELAI_ENTREE} />

            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 34,
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--carmin)',
              animation: `duelTexteEntree 320ms ${DELAI_ENTREE + 1000}ms ease-out both`,
            }}>
              − 1 vie
            </div>

            <div
              className="etiquette-mono"
              style={{
                color: 'var(--cendre)',
                animation: `duelTexteEntree 320ms ${DELAI_ENTREE + 1180}ms ease-out both`,
              }}
            >
              {restantes === 0
                ? 'plus de vie'
                : `${restantes} vie${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`}
            </div>
          </div>

          {/* ---- Acte II : le verdict ----
              Monté dès le départ mais tenu invisible par le `both` de son
              animation retardée : la croix se trace au trait, sans à-coup
              de mise en page puisque rien n'apparaît dans le flux. */}
          {finale && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--e4)',
              pointerEvents: 'none',
            }}>
              <svg
                width="52" height="52" viewBox="0 0 52 52" fill="none"
                stroke="var(--carmin)" strokeWidth="5" strokeLinecap="round"
                aria-hidden="true"
                style={{ animation: `duelCroixCorps 380ms ${ENTREE_DEFAITE}ms cubic-bezier(0.34, 1.3, 0.64, 1) both` }}
              >
                <line x1="13" y1="13" x2="39" y2="39" pathLength="1"
                  style={{ strokeDasharray: 1, animation: `duelCroixTrait 240ms ${ENTREE_DEFAITE + 40}ms ease-out both` }} />
                <line x1="39" y1="13" x2="13" y2="39" pathLength="1"
                  style={{ strokeDasharray: 1, animation: `duelCroixTrait 240ms ${ENTREE_DEFAITE + 220}ms ease-out both` }} />
              </svg>

              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 42,
                fontWeight: 500,
                lineHeight: 1,
                color: 'var(--carmin)',
                animation: `duelTexteEntree 320ms ${ENTREE_DEFAITE + 380}ms ease-out both`,
              }}>
                Perdu
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   CARTE — définie au niveau module, et c'est essentiel.
   Déclarée dans le corps du composant parent, elle constituerait un TYPE
   différent à chaque rendu : React démonterait puis remonterait le
   sous-arbre, rejouant l'animation CSS à chaque changement d'état.
============================================================ */

function Carte({ morceau, cote, enLecture, enPause, chargementAudio, onEcouter }) {
  const charge = chargementAudio === cote;
  const joue = enLecture === cote;
  const pause = enPause === cote;

  const libelle = charge ? 'Chargement…' : joue ? 'Pause' : pause ? 'Reprendre' : 'Écouter 15 s';
  const intitule = charge
    ? `Chargement de l'extrait de ${morceau.titre}`
    : joue
    ? `Mettre en pause l'extrait de ${morceau.titre}`
    : pause
    ? `Reprendre la lecture de ${morceau.titre}`
    : `Écouter un extrait de ${morceau.titre}`;

  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={morceau.pochette}
        alt={`Pochette de ${morceau.titre}`}
        className="duel-pochette"
        draggable={false}
      />
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 'var(--e3)', lineHeight: 1.3 }}>
        {morceau.titre}
      </div>
      <div className="description" style={{ marginTop: 2 }}>{morceau.artiste}</div>

      <button
        onClick={() => onEcouter(cote)}
        disabled={charge}
        style={{
          ...btn(false, charge),
          marginTop: 'var(--e3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--e2)',
          borderColor: joue ? 'var(--or)' : 'var(--filet-fort)',
          color: joue ? 'var(--or)' : 'var(--ivoire)',
        }}
        aria-label={intitule}
      >
        {joue ? (
          // Pause : deux barres
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
            <rect x="0" y="0" width="3" height="12" />
            <rect x="7" y="0" width="3" height="12" />
          </svg>
        ) : (
          // Lecture / reprise : triangle
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
            <path d="M0 0v12l10-6z" />
          </svg>
        )}
        {libelle}
      </button>
    </div>
  );
}

/* ============================================================
   BOUTON DE CHOIX
   Contour neutre, flèche en or. Le vert et le rouge sont réservés à la
   révélation : deux boutons colorés en permanence feraient une seconde
   couleur d'accent à l'écran, ce que la direction de design interdit.
============================================================ */

function BoutonChoix({ sens, onClick }) {
  const monte = sens === 'plus';
  return (
    <button
      onClick={onClick}
      aria-label={monte ? 'Plus de streams que la référence' : 'Moins de streams que la référence'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--e1)',
        width: '100%',
        minHeight: 76,
        padding: 'var(--e3) var(--e2)',
        borderRadius: 'var(--rayon-controle)',
        background: 'transparent',
        border: '0.5px solid var(--filet-fort)',
        color: 'var(--ivoire)',
        cursor: 'pointer',
        transition: 'background var(--transition-courte), border-color var(--transition-courte), color var(--transition-courte)',
      }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.borderColor = 'var(--or)';
        ev.currentTarget.style.color = 'var(--or)';
        ev.currentTarget.style.background = 'var(--onyx-haut)';
      }}
      onMouseLeave={(ev) => {
        ev.currentTarget.style.borderColor = 'var(--filet-fort)';
        ev.currentTarget.style.color = 'var(--ivoire)';
        ev.currentTarget.style.background = 'transparent';
      }}
    >
      <svg width="22" height="22" viewBox="0 0 12 12" fill="none" stroke="var(--or)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {monte ? <path d="M6 10V2M2.5 5.5L6 2l3.5 3.5" /> : <path d="M6 2v8M2.5 6.5L6 10l3.5-3.5" />}
      </svg>
      <span className="etiquette-mono" style={{ color: 'inherit' }}>
        {monte ? 'Plus' : 'Moins'}
      </span>
    </button>
  );
}

/* ============================================================
   COMPOSANT PRINCIPAL
============================================================ */

export default function JeuDuelGame({ daily = false, onDone = () => {} }) {
  // Vraie seulement si l'on vient d'arriver sur l'épreuve : useIntro compare
  // le couple (épreuve, clé de relance) au montage précédent, ce qui sépare
  // une navigation d'un clic sur « Relancer l'épreuve ».
  const introAutorisee = useIntro('duel');

  /* Présentation propre au défi du jour.

     Celle du mode libre — montée par `demarrerRun`, et déjà coupée en
     quotidien par son test `!daily` — met en scène trois vies et un niveau
     qui monte. Ni l'un ni l'autre n'existe dans le défi : format fixe, aucune
     vie, note sur dix. Une seconde présentation vaut mieux qu'une seule
     tordue pour servir les deux modes.

     useIntro doit rester appelé à chaque rendu — le placer derrière le `&&`
     en ferait un appel conditionnel, ce que React interdit. */
  const [introQuotidien, setIntroQuotidien] = useState(() => daily && introAutorisee);
  const [phase, setPhase] = useState('chargement'); // chargement | jeu | revelation | fin | erreur
  const [reference, setReference] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [duel, setDuel] = useState(1);       // n° de manche (mode quotidien)
  const [niveau, setNiveau] = useState(0);   // duels remportés d'affilée dans ce run
  const [vies, setVies] = useState(VIES);
  const [record, setRecord] = useState(0);   // meilleur niveau de la session
  const [annonce, setAnnonce] = useState(null); // { type, restantes, niveau, duree }
  const [bonnes, setBonnes] = useState(0);
  const [juste, setJuste] = useState(null);
  const [promotion, setPromotion] = useState(false); // la référence vient-elle de la droite ?
  const [enLecture, setEnLecture] = useState(null);  // 'gauche' | 'droite' | null
  const [enPause, setEnPause] = useState(null);       // 'gauche' | 'droite' | null — chargé mais arrêté en cours
  const [chargementAudio, setChargementAudio] = useState(null);
  const [message, setMessage] = useState('');
  /* Cette épreuve n'utilise pas useLecteurAudio : elle gère son propre
     élément audio, pour pouvoir suivre le budget d'écoute côté par côté. Elle
     doit donc lire le contexte de visibilité elle-même. */
  const visible = useEpreuveVisible();
  /* Surcouche de fin, posée au dernier duel du défi puis retirée seule. */
  const [resultat, setResultat] = useState(null);
  /* Le relevé du bas attend que le voile soit levé : le même chiffre affiché
     deux fois au même instant, l'un par-dessus l'autre, se contredirait. */
  const [bilan, setBilan] = useState(false);
  const volume = useVolume();

  const poolRef = useRef([]);        // copie mélangée, consommée au fil du run
  const morceauxRef = useRef([]);    // liste complète, pour relancer un run
  const rngRef = useRef(Math.random);
  const bonnesRef = useRef(0);
  const niveauRef = useRef(0);
  const viesRef = useRef(VIES);
  const audioRef = useRef(null);
  const audioCoteRef = useRef(null);      // à quel côté appartient l'élément <audio> chargé
  const debutLectureRef = useRef(0);      // Date.now() du dernier (re)départ de lecture
  const dureeRestanteRef = useRef(DUREE_EXTRAIT); // budget d'écoute restant pour l'extrait chargé
  const minuteurAudioRef = useRef(null);
  const minuteurSuiteRef = useRef(null);
  const minuteurFinRef = useRef(null);    // laisse la surcouche finir avant l'écran de fin
  const minuteurBilanRef = useRef(null);  // laisse le voile de résultat se lever
  // Identifiant de la dernière demande d'écoute : freshPreviewUrl est
  // asynchrone, et sans ce garde un double clic rapide sur les deux cartes
  // laisserait la requête la plus lente démarrer par-dessus l'autre.
  const demandeRef = useRef(0);

  /* ---------- Audio ----------
     Trois états par côté : repos (rien de chargé), lecture, pause. Un clic
     sur le bouton du côté déjà chargé bascule lecture ↔ pause ; un clic sur
     l'autre côté (ou sur un extrait épuisé) repart de zéro avec une preview
     fraîche. Le budget de 15 s se fige pendant la pause : dureeRestanteRef
     est décrémenté à chaque mise en pause, jamais remis à DUREE_EXTRAIT
     tant que l'extrait n'est pas entièrement relancé. */

  const couperAudio = useCallback(() => {
    demandeRef.current += 1;
    clearTimeout(minuteurAudioRef.current);
    minuteurAudioRef.current = null;
    const a = audioRef.current;
    audioRef.current = null;
    audioCoteRef.current = null;
    dureeRestanteRef.current = DUREE_EXTRAIT;
    if (a) { a.pause(); a.src = ''; }
    setEnLecture(null);
    setEnPause(null);
    setChargementAudio(null);
  }, []);

  /** L'extrait a consommé tout son budget de 15 s : retour à l'état repos. */
  const extraitEpuise = useCallback((cote) => {
    audioRef.current?.pause();
    audioCoteRef.current = null;
    dureeRestanteRef.current = DUREE_EXTRAIT;
    setEnLecture((v) => (v === cote ? null : v));
    setEnPause((v) => (v === cote ? null : v));
  }, []);

  /** Démarre — ou relance depuis 0 — un extrait fraîchement récupéré. */
  const demarrerExtrait = useCallback(async (cote) => {
    const morceau = cote === 'gauche' ? reference : challenger;
    if (!morceau) return;

    couperAudio();
    const demande = demandeRef.current;
    setChargementAudio(cote);

    let url = null;
    try {
      url = await freshPreviewUrl(morceau.deezerId);
    } catch {
      url = null;
    }

    // Une autre écoute a été lancée entre-temps, ou le composant est démonté.
    if (demande !== demandeRef.current) return;

    setChargementAudio(null);

    if (!url) {
      setMessage('Extrait momentanément indisponible — réessaie dans un instant.');
      return;
    }

    const a = new Audio(url);
    a.volume = volume;
    audioRef.current = a;
    audioCoteRef.current = cote;
    dureeRestanteRef.current = DUREE_EXTRAIT;
    debutLectureRef.current = Date.now();

    a.play().catch(() => {
      if (demande !== demandeRef.current) return;
      setMessage('Lecture impossible — reclique sur le bouton d\'écoute.');
      setEnLecture(null);
    });
    setEnLecture(cote);
    setEnPause(null);
    setMessage('');

    minuteurAudioRef.current = setTimeout(() => extraitEpuise(cote), dureeRestanteRef.current);
  }, [reference, challenger, couperAudio, extraitEpuise, volume]);

  // Le curseur de volume peut être déplacé pendant qu'un extrait joue ou est
  // en pause : on répercute la valeur sur l'élément déjà chargé, sans
  // attendre le prochain démarrage.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  /** Bascule lecture/pause d'un extrait déjà chargé pour ce côté. */
  const basculerLecture = useCallback((cote) => {
    const a = audioRef.current;
    if (!a) return;

    if (enLecture === cote) {
      // → pause : on fige le budget restant à l'instant présent
      a.pause();
      clearTimeout(minuteurAudioRef.current);
      const ecoule = Date.now() - debutLectureRef.current;
      dureeRestanteRef.current = Math.max(0, dureeRestanteRef.current - ecoule);
      setEnLecture(null);
      setEnPause(cote);
    } else {
      // → reprise : on repart avec le budget restant, pas 15 s pleines
      debutLectureRef.current = Date.now();
      a.play().catch(() => setMessage('Lecture impossible — reclique sur le bouton d\'écoute.'));
      setEnPause(null);
      setEnLecture(cote);
      minuteurAudioRef.current = setTimeout(() => extraitEpuise(cote), dureeRestanteRef.current);
    }
  }, [enLecture, extraitEpuise]);

  /** Point d'entrée du bouton : choisit démarrage frais ou bascule lecture/pause. */
  const onEcouter = useCallback((cote) => {
    if (audioCoteRef.current === cote) {
      basculerLecture(cote);
    } else {
      demarrerExtrait(cote);
    }
  }, [basculerLecture, demarrerExtrait]);

  /* ---------- Tirage ---------- */

  /**
   * Sort du pool le premier morceau opposable à `ref` : artiste différent et
   * écart de streams suffisant. Le pool étant déjà mélangé, prendre le
   * premier candidat valide revient à tirer au hasard parmi eux.
   *
   * `seuil` se resserre avec le niveau. Si aucun candidat ne le respecte
   * (référence en haut ou en bas de l'échelle), on retente au plancher
   * plutôt que d'interrompre le run.
   */
  const tirerChallenger = useCallback((ref, seuil) => {
    const pool = poolRef.current;
    const essais = seuil > ECART_PLANCHER ? [seuil, ECART_PLANCHER] : [seuil];

    for (const cible of essais) {
      for (let i = 0; i < pool.length; i++) {
        const m = pool[i];
        if (m.artiste === ref.artiste) continue;
        if (ecart(m.streams, ref.streams) < cible) continue;
        pool.splice(i, 1);
        return m;
      }
    }
    return null;
  }, []);

  /* ---------- Démarrage d'un run ---------- */

  /**
   * (Re)mélange le pool complet et pose la première paire. Appelé au
   * chargement, puis à chaque « Recommencer » depuis l'écran de fin.
   */
  const demarrerRun = useCallback((avecIntro = false) => {
    couperAudio();
    clearTimeout(minuteurSuiteRef.current);
    clearTimeout(minuteurFinRef.current);

    poolRef.current = melanger(morceauxRef.current, rngRef.current);

    const premiere = poolRef.current.shift();
    const second = tirerChallenger(premiere, ecartMini(0));
    if (!second) { setPhase('erreur'); return; }

    bonnesRef.current = 0;
    niveauRef.current = 0;
    viesRef.current = VIES;
    setBonnes(0);
    setNiveau(0);
    setVies(VIES);
    setDuel(1);
    setJuste(null);
    setPromotion(false);
    /* L'intro n'a de sens qu'en mode libre : le quotidien n'a ni vies ni
       survie à annoncer, et son format court supporte mal la cérémonie.
       Elle ne se joue qu'à l'ARRIVÉE sur l'épreuve — pas sur « Recommencer »,
       qui passe pourtant par la même fonction, ni sur « Relancer l'épreuve »,
       que useIntro distingue d'une navigation. */
    setAnnonce(!daily && avecIntro ? { type: 'intro', duree: DUREE_INTRO } : null);
    setMessage('');
    setReference(premiere);
    setChallenger(second);
    setPhase('jeu');
  }, [couperAudio, tirerChallenger, daily]);

  /* ---------- Chargement ---------- */

  useEffect(() => {
    let vivant = true;

    (async () => {
      try {
        const morceaux = await chargerPool();
        if (!vivant) return;

        morceauxRef.current = morceaux;
        rngRef.current = daily ? seeded('duel') : Math.random;
        demarrerRun(introAutorisee);
      } catch (err) {
        if (!vivant) return;
        console.error('Duel — chargement:', err);
        setPhase('erreur');
      }
    })();

    return () => {
      vivant = false;
      couperAudio();
      clearTimeout(minuteurSuiteRef.current);
      clearTimeout(minuteurFinRef.current);
      clearTimeout(minuteurBilanRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Le voile de résultat se retire seul : le plateau est déjà figé derrière
     lui, on ne bloque rien. */
  useEffect(() => {
    if (resultat === null) return undefined;
    const t = setTimeout(() => setResultat(null), RES_IA_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  useEffect(() => () => clearTimeout(minuteurBilanRef.current), []);

  /* Sortie d'écran : on coupe l'extrait. Dans le défi, une épreuve entamée
     reste montée derrière celle qu'on regarde — le démontage, qui coupait le
     son jusqu'ici, n'a plus lieu. */
  useEffect(() => {
    /* Couper une lecture en cours EST un changement d'état : la règle
       set-state-in-effect vise les cascades de rendus, pas ce cas où
       l'effet ne se déclenche qu'à la sortie d'écran. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) couperAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /* ---------- Réponse ---------- */

  function repondre(choix) {
    if (phase !== 'jeu' || !reference || !challenger) return;
    couperAudio();

    const estPlus = challenger.streams > reference.streams;
    const ok = (choix === 'plus') === estPlus;

    setJuste(ok);
    setPhase('revelation');

    if (ok) {
      bonnesRef.current += 1;
      setBonnes(bonnesRef.current);
      if (!daily) {
        niveauRef.current += 1;
        setNiveau(niveauRef.current);
        setRecord((r) => Math.max(r, niveauRef.current));
      }
    } else if (!daily) {
      viesRef.current -= 1;
      setVies(viesRef.current);
    }

    minuteurSuiteRef.current = setTimeout(() => avancer(ok), PAUSE_REVELATION);
  }

  function terminer() {
    setAnnonce(null);
    setPhase('fin');
    if (!daily) return;

    const note = noteQuotidienne(bonnesRef.current);
    onDone(note);
    /* Même séquence que les autres épreuves : le voile occupe le panneau le
       temps que la note soit lue, puis se retire et laisse le relevé. */
    setResultat(note);
    minuteurBilanRef.current = setTimeout(() => setBilan(true), RES_IA_TOTAL);
  }

  function avancer(ok) {
    // Mode quotidien : format fixe, NB_DUELS_QUOTIDIEN manches, note sur dix.
    if (daily && duel >= NB_DUELS_QUOTIDIEN) { terminer(); return; }

    // Mode libre : seule la perte interrompt le rythme. Sur une bonne
    // réponse on enchaîne directement — le duel suivant est la récompense,
    // un voile de félicitations ne ferait que ralentir la série.
    const finale = !daily && viesRef.current <= 0;

    if (!daily && !ok) {
      setAnnonce({
        type: 'perte',
        restantes: Math.max(0, viesRef.current),
        finale,
        duree: finale ? DUREE_DEFAITE : DUREE_PERTE,
      });
    }

    // Le run s'arrête quand les trois vies sont épuisées : on laisse les
    // deux actes aller à leur terme avant de basculer sur le bilan.
    if (finale) {
      minuteurFinRef.current = setTimeout(terminer, DUREE_DEFAITE);
      return;
    }

    const nouvelleRef = ok ? challenger : reference;
    const seuil = daily ? 1.25 : ecartMini(niveauRef.current);
    const suivant = tirerChallenger(nouvelleRef, seuil);

    // Pool épuisé : on clôt proprement plutôt que d'afficher une carte vide.
    if (!suivant) { terminer(); return; }

    setPromotion(ok);
    setReference(nouvelleRef);
    setChallenger(suivant);
    setJuste(null);
    setDuel((d) => d + 1);
    setPhase('jeu');
  }

  // La surcouche se retire d'elle-même : le duel suivant est déjà en place
  // derrière elle, on ne bloque donc rien.
  useEffect(() => {
    if (!annonce) return;
    const t = setTimeout(() => setAnnonce(null), annonce.duree);
    // Échap passe aussi la présentation, sans avoir à viser le voile. Réservé
    // à l'intro, pour la même raison que le clic.
    const surTouche = (e) => {
      if (e.key === 'Escape' && annonce.type === 'intro') setAnnonce(null);
    };
    window.addEventListener('keydown', surTouche);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', surTouche);
    };
  }, [annonce]);

  /* ---------- Rendu ---------- */

  if (phase === 'chargement') {
    return (
      <div style={panel}>
        <p className="lin" style={{ fontSize: 13 }}>Chargement des morceaux…</p>
      </div>
    );
  }

  if (phase === 'erreur') {
    return (
      <div style={panel}>
        <h3 className="titre-section" style={{ marginBottom: 'var(--e2)' }}>Duel</h3>
        <p className="description">
          Les données de l&apos;épreuve n&apos;ont pas pu être chargées. Réessaie plus tard.
        </p>
      </div>
    );
  }

  const revele = phase === 'revelation' || phase === 'fin';
  const couleurRevelation = juste ? 'var(--jade)' : 'var(--carmin)';

  return (
    // position: relative — ancre la surcouche sur le panneau lui-même.
    <div style={{ ...panel, position: 'relative' }}>
      <style>{`
        @keyframes duelVoile {
          0%   { opacity: 0; }
          10%  { opacity: 1; }
          84%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes duelPointPerdu {
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
        @keyframes duelPointArrivee {
          from { opacity: 0; transform: scale(0.2); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes demoSort {
          to { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes demoJuste {
          to { border-color: var(--jade); color: var(--jade); }
        }
        @keyframes demoEcarte {
          to { opacity: 0.28; }
        }
        @keyframes demoOnde {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @keyframes demoChiffreSort {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-30px); }
        }
        @keyframes demoChiffreEntre {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoCurseur {${keyframesCurseurDemo()}}
        @keyframes duelVoeu {
          from { opacity: 0; transform: scale(0.9); letter-spacing: 0.18em; }
          to   { opacity: 1; transform: scale(1); letter-spacing: normal; }
        }
        @keyframes duelActeSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.94); }
        }
        @keyframes duelCroixCorps {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes duelCroixTrait {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes duelTexteEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes duelAnnonce {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-duel-surcouche], [data-duel-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      {/* Tableau de bord — même vocabulaire que l'épreuve Rythme */}
      <div style={{
        display: 'flex', gap: 'var(--e5)', flexWrap: 'wrap',
        alignItems: 'baseline', marginBottom: 'var(--e5)',
      }}>
        {daily ? (
          <Donnee etiquette="manche" valeur={`${Math.min(duel, NB_DUELS_QUOTIDIEN)} / ${NB_DUELS_QUOTIDIEN}`} accent />
        ) : (
          <>
            <Donnee etiquette="niveau" valeur={niveau} accent />
            {/* Les deux comptes sont bornés à [0, VIES] : repeat() lève un
               RangeError sur un nombre négatif, ce qui arrivait dès que
               `vies` et `VIES` divergeaient — au rechargement à chaud après
               un changement de la constante, par exemple. */}
            <Donnee
              etiquette={`vie${VIES > 1 ? 's' : ''}`}
              valeur={
                '●'.repeat(Math.max(0, Math.min(VIES, vies)))
                + '○'.repeat(Math.max(0, VIES - Math.max(0, Math.min(VIES, vies))))
              }
            />
            <Donnee etiquette="record" valeur={`niveau ${record}`} />
          </>
        )}
      </div>

      <div className="duel-grille">
        {/* ---- Référence ----
            La key ne change que lorsque le morceau change réellement : c'est
            elle qui déclenche l'animation, et non le rendu. Sans ça, chaque
            changement d'état (révélation, lecture audio) la rejouerait. */}
        <div
          key={`ref-${reference.deezerId}`}
          style={{
            textAlign: 'center',
            animation: promotion ? 'duelPromotion var(--transition-courte) both' : undefined,
          }}
        >
          <Carte
            morceau={reference}
            cote="gauche"
            enLecture={enLecture}
            enPause={enPause}
            chargementAudio={chargementAudio}
            onEcouter={onEcouter}
          />
          <div
            className="mono"
            style={{ fontSize: 24, fontWeight: 500, color: 'var(--or)', marginTop: 'var(--e3)' }}
          >
            {formaterStreams(reference.streams)}
          </div>
          <div className="description">streams Spotify</div>
        </div>

        {/* ---- Séparateur ---- */}
        <div className="duel-vs" aria-hidden="true">
          <span>VS</span>
        </div>

        {/* ---- Challenger ---- */}
        <div key={`chal-${challenger.deezerId}`} style={{ animation: 'duelArrivee var(--transition-courte) both' }}>
          <Carte
            morceau={challenger}
            cote="droite"
            enLecture={enLecture}
            enPause={enPause}
            chargementAudio={chargementAudio}
            onEcouter={onEcouter}
          />

          <div style={{ marginTop: 'var(--e3)', minHeight: 96, textAlign: 'center' }}>
            {revele ? (
              <>
                <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: couleurRevelation }}>
                  {formaterStreams(challenger.streams)}
                </div>
                <div className="description">{juste ? 'bonne réponse' : 'raté'}</div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--e2)' }}>
                <BoutonChoix sens="plus" onClick={() => repondre('plus')} />
                <BoutonChoix sens="moins" onClick={() => repondre('moins')} />
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={statusStyle} aria-live="polite">{message}</p>

      {phase === 'fin' && (
        daily ? (
          /* Centré : le panneau de cette épreuve n'aligne pas son contenu au
             milieu, contrairement à celui de Humain ou IA, et le relevé
             restait donc collé à gauche. `bilan` le retient tant que le voile
             n'a pas fini de présenter la note. */
          bilan && (
            <div style={{ textAlign: 'center' }}>
              <ScoreBox
                score={noteQuotidienne(bonnes)}
                detail={`${bonnes} bonne${bonnes > 1 ? 's' : ''} réponse${bonnes > 1 ? 's' : ''} sur ${NB_DUELS_QUOTIDIEN}.`}
                source="Chiffres provenant de kworb.net"
              />
            </div>
          )
        ) : (
          <div style={{
            marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
            borderTop: '1px solid var(--or)', textAlign: 'center',
            animation: 'duelAnnonce 260ms ease-out both',
          }}>
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>run terminé</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 500,
              color: 'var(--or)', marginTop: 'var(--e2)', lineHeight: 1.1,
            }}>
              niveau {niveau}
            </div>
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              {niveau >= record
                ? 'Meilleur niveau de la session.'
                : `Ton record de la session reste le niveau ${record}.`}
            </p>
            <button
              onClick={() => demarrerRun(false)}
              style={{ ...btn(true, false), marginTop: 'var(--e4)' }}
            >
              Recommencer
            </button>
          </div>
        )
      )}

      {/* ---- Surcouche : placée en dernier pour passer au-dessus de tout ---- */}
      {annonce && <Surcouche annonce={annonce} onPasser={() => setAnnonce(null)} />}

      {/* Voile de fin du défi : la note en grand, comme sur les autres
          épreuves. Posé après la surcouche pour passer au-dessus d'elle. */}
      {resultat !== null && (
        /* `bonnes` et non `bonnesRef.current` : lire une ref pendant le
           rendu est interdit, et l'état est tenu à jour à chaque bonne
           réponse — il vaut donc exactement la même chose ici. */
        <ResultatIA
          score={resultat}
          detail={`${bonnes} bonne${bonnes > 1 ? 's' : ''} réponse${bonnes > 1 ? 's' : ''} sur ${NB_DUELS_QUOTIDIEN}`}
        />
      )}

      {/* ---- Présentation du défi du jour ----
           Exclusive de la précédente : `demarrerRun` ne pose d'annonce de
           type intro qu'en mode libre, les deux voiles ne peuvent donc pas se
           superposer. */}
      {daily && introQuotidien && (
        <IntroDuelQuotidien
          manches={NB_DUELS_QUOTIDIEN}
          onFin={() => setIntroQuotidien(false)}
        />
      )}
    </div>
  );
}
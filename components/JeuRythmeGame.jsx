'use client';
import { useEffect, useRef, useState } from 'react';
import { panel, seeded } from '@/components/dailyGames';
import { useVolume } from '@/utils/volume';
import { useIntro } from '@/utils/intro';
import IntroRythmeQuotidien from '@/components/IntroRythmeQuotidien';
/* Surcouche de résultat partagée. Elle porte le nom de l'épreuve où elle est
   née, mais elle est générique — score et détail en props — et c'est déjà
   celle qu'utilisent Humain ou IA et Duel. En recopier une troisième ici
   ferait diverger des animations qui doivent rester identiques. */
import { ResultatIA, RES_IA_TOTAL } from '@/components/IntroIA';

/* Gains propres à chaque synthé, en dB. Le volume global de l'en-tête s'y
   AJOUTE au lieu de les remplacer : le clap doit rester plus fort que le
   métronome quel que soit le réglage, c'est ce rapport qui rend la grille
   lisible à l'oreille. */
const GAIN_CLICK = -14;
const GAIN_CLAP = 0;

/* useVolume rend un gain linéaire (0 à 1), Tone raisonne en décibels.
   Le zéro se traite à part : gainToDb(0) vaut -Infinity, mais l'addition
   d'un gain de base à -Infinity reste -Infinity par chance seulement — on
   l'écrit explicitement plutôt que de compter dessus. */
function dbPour(Tone, base, v) {
  return v > 0 ? base + Tone.gainToDb(v) : -Infinity;
}

/** Mode libre : survie. Trois vies, le niveau monte tant qu'on tient. */
const VIES = 3;

/* ------------------------------------------------------------
   CHRONOLOGIE DE LA SURCOUCHE
   Mêmes valeurs que l'épreuve Duel : les deux jeux de survie
   partagent volontairement la même grammaire d'animation, un
   joueur qui passe de l'un à l'autre reconnaît le vocabulaire.
------------------------------------------------------------ */

/* Temps de pose entre l'arrivée du voile et le début du contenu. Toutes les
   autres temporisations s'y ajoutent : une seule valeur à toucher pour
   décaler l'ensemble. */
const DELAI_ENTREE = 500;

/* Perte ordinaire. Une réussite n'ouvre aucun voile : la série continue. */
const DUREE_PERTE = DELAI_ENTREE + 1900;

/* Entre deux mesures, la grille se retire puis la suivante se pose. Sans ce
   battement, le voile de perte se levait sur une mesure déjà relancée : on
   passait de l'échec au pattern suivant sans transition, et l'œil ne voyait
   pas que la grille avait changé. */
const SORTIE_GRILLE = 260;
const BATTEMENT = 320;
/* Durée de l'entrée de la nouvelle grille. Le cycle audio l'attend : sinon la
   mesure démarrait sur une grille encore en train de se poser, et le premier
   temps tombait dans le vide. */
const ENTREE_GRILLE = 320;

/* Dernière vie : la perte se joue d'abord en entier — il faut voir la
   pastille s'éteindre comme les fois précédentes — puis un second acte
   remplace le décompte par le verdict. */
const SORTIE_ACTE_PERTE = DELAI_ENTREE + 1900; // le décompte s'efface
const ENTREE_DEFAITE = DELAI_ENTREE + 2200;    // la croix se trace
const DUREE_DEFAITE = DELAI_ENTREE + 4000;     // durée totale du voile

/* Ouverture de run, jouée à l'envers de la défaite : le titre pose le cadre,
   les vies se comptent une par une, puis le vœu remplace le tout. */
const INTRO_TITRE = DELAI_ENTREE;
const INTRO_VIES = DELAI_ENTREE + 480;
const INTRO_PAS_VIE = 200;
const INTRO_LEGENDE = INTRO_VIES + (VIES - 1) * INTRO_PAS_VIE + 300;
const SORTIE_ACTE_INTRO = DELAI_ENTREE + 1700;

/* ---- Acte II : la démonstration ----
   Le vœu « Bonne chance » ne disait rien du jeu. À la place, on montre les
   deux temps de l'épreuve : la mesure se joue toute seule, puis on la
   reproduit. Chaque frappe de démonstration est datée sur le même pas que la
   note qu'elle imite — c'est ce qui fait comprendre qu'on tape EN RYTHME et
   non n'importe quand.

   L'acte II démarre pendant que l'acte I finit de s'effacer : attendre la fin
   complète créait un temps mort au milieu de l'intro. */
const D2 = DELAI_ENTREE + 1900;
const PAS_DEMO = 180;                       // durée d'un pas de la mesure
const DEMO_MOTIF = [0, 2, 3, 5];            // les temps frappés, sur 8 pas
const DEMO_PAS = 8;
/* L'acte II s'ouvre sur le NOM DU JEU, puis sa règle, puis la démonstration.
   Même découpage que l'intro du Duel, et pour la même raison : l'acte I dit
   le cadre — mode survie, trois vies — mais ne nomme jamais le jeu. Un
   spectateur qui arrive sur la seconde d'après voyait une grille apparaître
   sans savoir de quelle épreuve il s'agit.

   Les trois temps sont espacés de 340 puis 280 ms : le titre se pose, la
   règle le complète, la démonstration démarre. Ensemble ils feraient un pavé
   à lire ; l'un après l'autre, ils se lisent comme une phrase. */
const D2_TITRE = D2;                        // le nom du jeu
const D2_REGLE = D2 + 340;                  // la règle, une fois le titre posé
const D2_DEMO = D2 + 620;                   // la démonstration prend le relais

const D2_ECOUTE = D2_DEMO;                  // étiquette « écoute »
const D2_GRILLE = D2_DEMO + 260;            // la grille apparaît
const D2_LECTURE = D2_DEMO + 620;           // la tête de lecture part
/* Entre l'écoute et la reprise, le jeu laisse passer UNE mesure à vide : le
   métronome bat, on ne tape pas encore. C'est le contretemps le plus courant
   chez un nouveau joueur — il frappe dès la fin de l'écoute et rate tout. La
   démonstration doit donc montrer cette attente, pas seulement les deux
   phases utiles. */
const D2_PREP = D2_LECTURE + DEMO_PAS * PAS_DEMO + 240;    // « mesure de préparation »
const D2_PREP_TETE = D2_PREP + 260;                            // le décompte bat
const D2_ATOI = D2_PREP_TETE + DEMO_PAS * PAS_DEMO + 240;  // « à toi »
const D2_FRAPPES = D2_ATOI + 340;                          // les frappes
const D2_REUSSI = D2_FRAPPES + DEMO_PAS * PAS_DEMO + 240;  // le compteur apparaît
/* Le « 1 » doit exister assez longtemps pour qu'on le voie AVANT qu'il ne
   change : sans ce palier, le roulement se lit comme une simple apparition
   du 2. */
const D2_MONTEE = D2_REUSSI + 700;                         // 1 roule sur 2
/* La sortie attend que le chiffre soit posé ET lu : couper juste après le
   roulement donnait l'impression d'un montage raté. */
const D2_SORTIE = D2_MONTEE + 1500;
const DUREE_INTRO = D2_SORTIE + 420;

/* Le curseur descend sur la zone de frappe et y tape à chaque temps du motif.
   Son trajet est GÉNÉRÉ à partir des mêmes instants que les impacts : le
   geste ne peut donc pas se décaler de son effet. Repère : la scène de
   démonstration, dont la zone de frappe est centrée. */
const CURSEUR_REPOS = { x: 210, y: 210 };
const CURSEUR_ZONE = { x: 40, y: 34 };
const CURSEUR_DEBUT = D2_PREP_TETE;
const CURSEUR_FIN = D2_FRAPPES + DEMO_PAS * PAS_DEMO + 200;

function trajetCurseur() {
  const duree = CURSEUR_FIN - CURSEUR_DEBUT;
  const p = (t) => (((t - CURSEUR_DEBUT) / duree) * 100).toFixed(1);
  const pos = (c, ecrase = 0) =>
    `translate(${c.x}px, ${c.y + ecrase}px)`;
  let etapes = `0% { transform: ${pos(CURSEUR_REPOS)}; opacity: 0; }\n`;
  etapes += `8% { transform: ${pos(CURSEUR_REPOS)}; opacity: 1; }\n`;
  etapes += `${p(D2_FRAPPES - 200)}% { transform: ${pos(CURSEUR_ZONE)}; opacity: 1; }\n`;
  // Une frappe = une descente brève de 5 px puis un retour : c'est le geste
  // qu'on reconnaît, plus que le déplacement lui-même.
  DEMO_MOTIF.forEach((pas) => {
    const t = D2_FRAPPES + pas * PAS_DEMO;
    etapes += `${p(t - 40)}% { transform: ${pos(CURSEUR_ZONE)}; }\n`;
    etapes += `${p(t)}% { transform: ${pos(CURSEUR_ZONE, 5)}; }\n`;
    etapes += `${p(t + 70)}% { transform: ${pos(CURSEUR_ZONE)}; }\n`;
  });
  etapes += `94% { transform: ${pos(CURSEUR_ZONE)}; opacity: 1; }\n`;
  etapes += `100% { transform: ${pos(CURSEUR_ZONE)}; opacity: 0; }\n`;
  return etapes;
}

const DAILY_ROUNDS = 5;
/* Un niveau par manche — le tableau doit avoir exactement DAILY_ROUNDS
   entrées, sinon DAILY_LEVELS[dailyRoundRef.current] renvoie undefined à la
   dernière manche et levelConfig repart sur une grille vide. La progression
   reste douce : 8, 10, 10, 12, 12 cases. */
const DAILY_LEVELS = [2, 3, 4, 5, 6];

// La grille s'agrandit avec le niveau → rythmes de plus en plus variés
const STEPS_BY_LEVEL = [8, 8, 10, 10, 12, 12, 16];

function levelConfig(level) {
  const steps = STEPS_BY_LEVEL[Math.min(level - 1, STEPS_BY_LEVEL.length - 1)];
  return {
    bpm: Math.min(80 + (level - 1) * 6, 150),
    steps,
    hits: Math.min(3 + Math.ceil(level / 2), Math.floor(steps * 0.6)),
  };
}

// Durée d'une mesure : la grille est en croches, donc steps/2 temps
const barOf = (cfg) => (60 / cfg.bpm) * (cfg.steps / 2);

// Jugements : jade réservé au parfait, carmin atténué à l'échec
const JUDGMENTS = [
  { max: 0.05, label: 'parfait', color: 'var(--jade)', pts: 1 },
  { max: 0.12, label: 'bien', color: 'var(--or-clair)', pts: 0.7 },
  { max: 0.2, label: 'limite', color: 'var(--or)', pts: 0.4 },
  { max: Infinity, label: 'hors temps', color: 'rgba(226, 75, 74, 0.75)', pts: 0 },
];

/* ============================================================
   PASTILLES DE VIE
   `perdue` = index de la pastille en train de s'éteindre. En mode
   `echelonne` chacune porte sa propre entrée décalée : animer aussi le
   conteneur ferait monter le groupe entier par-dessus et les arrivées
   individuelles se perdraient dans le mouvement d'ensemble.
============================================================ */

function Pastilles({ restantes, perdue = null, taille = 18, delai = 0, echelonne = false }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--e3)',
        justifyContent: 'center',
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
              // soit une pastille pleine — la vie est bien visible avant de
              // disparaître.
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
   grille rythmique ne se décale pas et le regard reste au centre.
   Le voile s'ouvre et se referme dans la même animation, calée sur la durée
   passée en prop — pas d'état de sortie à gérer côté React.
============================================================ */

function Surcouche({ annonce, onPasser }) {
  const restantes = annonce.restantes ?? 0;
  const finale = Boolean(annonce.finale);
  const intro = annonce.type === 'intro';

  /* Seule la présentation se passe. Les annonces de perte et de défaite ne
     sont pas des explications mais des résultats : les rendre cliquables
     ferait sauter le verdict d'un joueur qui cliquait encore. */
  const passable = intro && typeof onPasser === 'function';

  return (
    <div
      data-duel-surcouche
      onClick={passable ? onPasser : undefined}
      role={passable ? 'button' : undefined}
      tabIndex={passable ? 0 : undefined}
      aria-label={passable ? 'Passer la présentation' : undefined}
      onKeyDown={passable ? (e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPasser(); }
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
              Les pastilles arrivent une par une : compter trois vies est
              plus parlant que les voir apparaître d'un bloc. */}
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

              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '0.02em',
                // Ivoire plutôt que cendre : la légende nomme les pastilles
                // juste au-dessus, elle doit peser autant qu'elles.
                color: 'var(--ivoire)',
                animation: `duelTexteEntree 320ms ${INTRO_LEGENDE}ms ease-out both`,
              }}>
                {VIES} vies
              </div>
            </div>
          </div>

          {/* ---- Acte II : la démonstration ----
              Monté dès le départ mais tenu invisible par le `both` de ses
              animations retardées : rien n'entre dans le flux, donc aucun
              à-coup de mise en page quand l'acte I s'efface. */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 'var(--e5)',
            /* Sans ce rembourrage, les blocs de la démonstration touchent les
               bords du panneau dès que celui-ci descend sous leur largeur de
               référence. */
            padding: '0 var(--e4)',
            pointerEvents: 'none',
            animation: `duelActeSortie 340ms ${D2_SORTIE}ms ease-in both`,
          }}>
            {/* En-tête : le nom du jeu, puis la règle. Un seul enfant de la
                colonne pour les deux, avec leur propre écart interne : la
                démonstration garde ainsi la gouttière du conteneur, et
                l'ensemble ne coûte qu'un rang de plus en hauteur. */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 500, lineHeight: 1,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
                animation: `duelTexteEntree 340ms ${D2_TITRE}ms ease-out both`,
              }}>
                Reproduis le rythme
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
                letterSpacing: '0.02em', color: 'var(--lin)', marginTop: 10,
                animation: `duelTexteEntree 320ms ${D2_REGLE}ms ease-out both`,
              }}>
                Écoute une mesure, rejoue-la de mémoire
              </div>
            </div>

            {/* Étiquette de phase : « écoute » puis « à toi », au même endroit,
                l'une remplaçant l'autre — c'est le basculement du jeu. */}
            <div style={{ position: 'relative', height: 20, width: '100%', maxWidth: 320 }}>
              <div className="etiquette-mono" style={{
                position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--lin)',
                animation: `duelTexteEntree 300ms ${D2_ECOUTE}ms ease-out both, demoEtiquetteSort 240ms ${D2_PREP - 120}ms ease-in forwards`,
              }}>
                écoute la mesure
              </div>
              <div className="etiquette-mono" style={{
                position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--or)',
                opacity: 0,
                animation: `duelTexteEntree 300ms ${D2_PREP}ms ease-out both, demoEtiquetteSort 240ms ${D2_ATOI - 120}ms ease-in forwards`,
              }}>
                mesure de préparation — n&apos;appuie pas
              </div>
              <div className="etiquette-mono" style={{
                position: 'absolute', inset: 0, textAlign: 'center', color: 'var(--jade)',
                opacity: 0,
                animation: `duelTexteEntree 300ms ${D2_ATOI}ms ease-out both`,
              }}>
                à toi, tape le même
              </div>
            </div>

            {/* Le décompte de la mesure de préparation : quatre battements,
                un temps fort sur deux. Ils se posent l'un après l'autre — un
                compte se voit mieux qu'il ne se lit. */}
            <div style={{ display: 'flex', gap: 'var(--e3)', height: 12, alignItems: 'center' }}>
              {[0, 2, 4, 6].map((pas) => (
                <span key={pas} style={{
                  width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box',
                  border: '1px solid var(--filet-fort)', opacity: 0,
                  animation: `demoBattement 620ms ${D2_PREP_TETE + pas * PAS_DEMO}ms ease-out both`,
                }} />
              ))}
            </div>

            {/* La mesure. Les notes s'allument au passage de la tête de
                lecture, puis se rallument sous les frappes. */}
            <div style={{
              /* LARGEUR MAXIMALE, et non largeur fixe.

                 Quatre cents pixels était la largeur de référence de la
                 démonstration ; sur un panneau qui en fait 328, la grille
                 débordait des deux côtés et les cases des extrémités étaient
                 tranchées par le rognage. La démonstration montrait alors une
                 mesure incomplète, ce qui est le contraire de son propos.

                 Rien à changer à l'intérieur : la grille est en fractions,
                 elle se resserre d'elle-même. */
              position: 'relative', width: '100%', maxWidth: 400,
              animation: `duelTexteEntree 320ms ${D2_GRILLE}ms ease-out both`,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DEMO_PAS}, 1fr)`, gap: 8 }}>
                {Array.from({ length: DEMO_PAS }, (_, i) => {
                  const note = DEMO_MOTIF.includes(i);
                  const surTemps = i % 2 === 0;
                  return (
                    <div key={i} style={{
                      aspectRatio: '1 / 1.4', borderRadius: 'var(--rayon-controle)',
                      background: surTemps ? 'var(--onyx)' : 'transparent',
                      border: `0.5px solid ${surTemps ? 'var(--filet)' : 'rgba(242,236,224,0.07)'}`,
                      position: 'relative',
                      /* La case d'une note passe en filet or plein, comme dans
                         le vrai jeu — et s'éteint avec elle à la fin de la
                         mesure d'écoute, puis se rallume sous la frappe. */
                      ...(note ? {
                        animation: `demoCaseAllume 420ms ${D2_LECTURE + i * PAS_DEMO}ms ease-out both, demoCaseEteint 280ms ${D2_PREP - 160}ms ease-in forwards, demoCaseFrappe 420ms ${D2_FRAPPES + i * PAS_DEMO}ms ease-out`,
                      } : {}),
                    }}>
                      {note && (
                        <div style={{
                          position: 'absolute', inset: '26% 28%', borderRadius: '50%',
                          background: 'var(--or)', opacity: 0,
                          /* Trois temps, comme dans le vrai jeu : la note
                             s'allume à l'écoute, s'éteint dès la fin de la
                             mesure — on doit la reproduire de mémoire, pas la
                             recopier — puis reparaît en jade sous la frappe.
                             L'ordre de déclaration compte : la dernière
                             animation en cours l'emporte, et la sortie garde
                             la main entre deux flashes grâce à `forwards`. */
                          animation: `demoNote 420ms ${D2_LECTURE + i * PAS_DEMO}ms ease-out both, demoNoteSort 280ms ${D2_PREP - 160}ms ease-in forwards, demoNoteFlash 420ms ${D2_FRAPPES + i * PAS_DEMO}ms ease-out`,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tête de lecture : elle traverse la mesure deux fois, une par
                  phase, à la même vitesse — la reprise doit se lire comme le
                  même tempo. */}
              <div style={{
                position: 'absolute', top: -6, bottom: -6, left: 0, width: 2,
                background: 'var(--or)', opacity: 0,
                /* La tête traverse la mesure trois fois — écoute, préparation,
                   reprise — puis s'efface : une fois la dernière mesure jouée,
                   il n'y a plus rien à parcourir, et la laisser au bord droit
                   donnait une barre orpheline. Le `forwards` de la sortie garde
                   la main après la fin de toutes les autres. */
                animation: `demoTete ${DEMO_PAS * PAS_DEMO}ms ${D2_LECTURE}ms linear both, demoTetePrep ${DEMO_PAS * PAS_DEMO}ms ${D2_PREP_TETE}ms linear, demoTeteJade ${DEMO_PAS * PAS_DEMO}ms ${D2_FRAPPES}ms linear, demoTeteSort 260ms ${D2_FRAPPES + DEMO_PAS * PAS_DEMO}ms ease-out forwards`,
              }} />
            </div>

            {/* Zone de frappe : elle s'illumine à chaque temps du motif, au
                moment exact où la tête de lecture passe dessus. */}
            <div style={{
              position: 'relative', width: '100%', maxWidth: 400, height: 84,
              borderRadius: 'var(--rayon-carte)',
              border: '0.5px solid var(--filet)',
              /* Elle clignote pendant la préparation : l'endroit où frapper
                 est désigné AVANT qu'on ait le droit de le faire. */
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: `duelTexteEntree 320ms ${D2_GRILLE + 120}ms ease-out both, demoAttente ${2 * PAS_DEMO}ms ${D2_PREP_TETE}ms ease-in-out ${DEMO_PAS / 2}`,
            }}>
              <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>zone de frappe</span>
              {DEMO_MOTIF.map((pas) => (
                <span key={pas} style={{
                  position: 'absolute', inset: 0, borderRadius: 'var(--rayon-carte)',
                  border: '1px solid var(--jade)', opacity: 0,
                  animation: `demoImpact 320ms ${D2_FRAPPES + pas * PAS_DEMO}ms ease-out both`,
                }} />
              ))}

              {/* Curseur : il descend sur la zone et tape à chaque temps.
                  Sans lui, on voit la zone s'allumer sans savoir que c'est
                  NOUS qui devons la frapper. */}
              <div style={{
                position: 'absolute', left: 0, top: 0,
                animation: `demoCurseur ${CURSEUR_FIN - CURSEUR_DEBUT}ms ${CURSEUR_DEBUT}ms linear both`,
              }}>
                {DEMO_MOTIF.map((pas) => (
                  <span key={pas} style={{
                    position: 'absolute', left: -13, top: -13, width: 30, height: 30,
                    border: '1px solid var(--jade)', borderRadius: '50%', opacity: 0,
                    animation: `demoOnde 420ms ${D2_FRAPPES + pas * PAS_DEMO}ms ease-out both`,
                  }} />
                ))}
                <svg width="17" height="22" viewBox="0 0 16 21" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
                  <path
                    d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                    fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Ce qu'on gagne : le niveau monte. Le chiffre ne se pose pas
                déjà à 2 — le 1 sort par le haut pendant que le 2 entre par le
                bas. On voit la valeur CHANGER, ce qui dit la progression bien
                mieux qu'un nombre affiché d'un coup. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--e2)',
              opacity: 0,
              animation: `duelTexteEntree 340ms ${D2_REUSSI}ms ease-out both`,
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
                }}>
                  1
                </span>
                <span style={{
                  position: 'absolute', inset: 0, color: 'var(--or)',
                  animation: `demoChiffreEntre 560ms ${D2_MONTEE}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                }}>
                  2
                </span>
              </span>
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
                ? 'plus de vies'
                : `${restantes} vie${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`}
            </div>
          </div>

          {/* ---- Acte II : le verdict ----
              Monté dès le départ mais tenu invisible par le `both` de son
              animation retardée : la croix se trace au trait, sans à-coup de
              mise en page puisque rien n'apparaît dans le flux. */}
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
   ZONE DE FRAPPE
   La difficulté d'apprentissage de cette épreuve n'est pas le rythme, c'est
   de comprendre QUAND et OÙ taper. Trois choses s'en chargent, redondantes
   à dessein — un joueur qui n'en lit qu'une doit déjà s'en sortir :
   la couleur (cendre → or → jade), l'icône (inerte → ondes → ondes vives)
   et une phrase à l'impératif qui dit exactement quoi faire maintenant.
============================================================ */

/* Tout le site écrit ses notes à la française : 7,5 et non 7.5. La ligne
   d'état était le seul endroit qui laissait passer le point décimal. */
function note(valeur) {
  return Number(valeur).toFixed(1).replace('.', ',');
}

const ETATS_ZONE = {
  listen: {
    bordure: 'var(--filet)', accent: 'var(--cendre)', titre: 'var(--lin)',
    intitule: 'Écoute la mesure', aide: 'ne tape pas encore',
  },
  ready: {
    bordure: 'var(--or-clair)', accent: 'var(--or-clair)', titre: 'var(--or-clair)',
    intitule: 'Prépare-toi à frapper ici', aide: 'attends que la zone passe au vert',
  },
  play: {
    bordure: 'var(--jade)', accent: 'var(--jade)', titre: 'var(--jade)',
    intitule: 'Frappe le rythme ici', aide: 'au doigt ou avec la barre d\'espace',
  },
  repos: {
    bordure: 'var(--filet)', accent: 'var(--cendre)', titre: 'var(--lin)',
    /* « C'est ici que tu frapperas le rythme » mettait douze mots au futur à
       dire un seul lieu. L'intitulé nomme la zone, l'aide dit le geste et le
       moment — voir aideFrappe, qui la remplace selon l'appareil. Celle-ci
       reste le repli si la détection n'a pas encore eu lieu. */
    intitule: 'Ta zone de frappe', aide: 'barre d\'espace ou clic, quand elle s\'allume',
  },
};

/* ---- L'aide dépend de l'appareil, et le geste s'annonce AVANT ----
 *
 * Deux corrections dans la même fonction.
 *
 * 1. « Au doigt ou avec la barre d'espace » énonçait à chacun un geste qui
 *    n'est pas le sien : il n'y a pas de barre d'espace sur un téléphone, et
 *    pas de doigt sur un écran d'ordinateur. Une consigne à moitié fausse se
 *    lit deux fois avant d'être comprise, et celle-ci n'a qu'une mesure pour
 *    servir.
 *
 * 2. Le repos ne disait plus QUE le moment. C'était trop peu : le repos est
 *    le seul état que le joueur regarde sans être pressé — pendant l'écoute
 *    il mémorise, pendant la frappe il joue. C'est donc là, et nulle part
 *    ailleurs, qu'il a le temps d'apprendre le geste. La zone annonce les
 *    deux : ce qu'il faudra faire, et quand.
 *
 * LE MÊME GESTE SE DIT AVEC LES MÊMES MOTS aux deux états. Au repos on y
 * ajoute le moment, en jeu on le retire — le joueur reconnaît la phrase qu'il
 * a lue trente secondes plus tôt au lieu d'en déchiffrer une nouvelle au
 * moment précis où il doit regarder et non lire.
 */
function aideFrappe(phase, tactile) {
  const geste = tactile ? 'tape dans la zone' : 'barre d\'espace ou clic';
  if (phase === 'repos') return `${geste}, quand elle s'allume`;
  if (phase === 'play') return geste;
  return ETATS_ZONE[phase]?.aide ?? ETATS_ZONE.repos.aide;
}

/* Cible concentrique : un point de contact et deux ondes qui s'en échappent.
   Le glyphe se lit sans légende — c'est le symbole universel du « tape ici ».
   Les ondes ne tournent qu'en préparation et en jeu : au repos elles restent
   figées, sinon la zone appellerait la frappe alors que rien ne l'attend. */
function CibleFrappe({ couleur, anime }) {
  const onde = (delai) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: anime ? `ondeFrappe 1700ms ${delai}ms ease-out infinite` : 'none',
    opacity: anime ? 0 : 0.28,
  });

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="12" stroke={couleur} strokeWidth="1.5" style={onde(850)} />
      <circle cx="22" cy="22" r="12" stroke={couleur} strokeWidth="1.5" style={onde(0)} />
      <circle cx="22" cy="22" r="5.5" fill={couleur} />
    </svg>
  );
}

function ZoneFrappe({ phase, running, impulsion, onTap, tactile }) {
  const etat = ETATS_ZONE[phase] ?? ETATS_ZONE.repos;
  const aide = aideFrappe(phase, tactile);
  const enJeu = phase === 'play';
  const enAttente = phase === 'ready';

  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onTap(); }}
      role={running ? 'button' : undefined}
      aria-label={running ? etat.intitule : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--e3)',
        border: `${enJeu ? '1px' : '0.5px'} solid ${etat.bordure}`,
        background: enJeu ? 'var(--onyx-haut)' : 'transparent',
        boxShadow: enJeu ? '0 0 26px rgba(93, 202, 165, 0.2)' : 'none',
        borderRadius: 'var(--rayon-carte)',
        padding: 'var(--e6)',
        textAlign: 'center',
        cursor: running ? 'pointer' : 'default',
        userSelect: 'none',
        touchAction: 'manipulation',
        marginTop: 'var(--e4)',
        animation: enAttente ? 'pulseAttente 900ms ease-in-out infinite' : 'none',
        transition: 'border-color var(--transition-courte), background var(--transition-courte), box-shadow var(--transition-courte)',
      }}
    >
      <CibleFrappe couleur={etat.accent} anime={enJeu || enAttente} />

      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 17,
        fontWeight: 500,
        lineHeight: 1.2,
        color: etat.titre,
        transition: 'color var(--transition-courte)',
      }}>
        {etat.intitule}
      </div>

      <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
        {aide}
      </div>

      {/* Onde d'impact : la `key` change à chaque frappe, ce qui remonte le
          nœud et rejoue l'animation. Sans ça une frappe rapprochée de la
          précédente ne produirait aucun retour visuel. */}
      {impulsion > 0 && (
        <span
          key={impulsion}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
            borderRadius: '50%',
            border: `1px solid ${etat.accent}`,
            pointerEvents: 'none',
            animation: 'impactFrappe 460ms ease-out both',
          }}
        />
      )}
    </div>
  );
}

export default function JeuRythmeGame({ daily = false, onDone = () => {} }) {
  const [phase, setPhase] = useState('idle');
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(VIES);
  const [bestLevel, setBestLevel] = useState(1);
  const [pattern, setPattern] = useState(null);
  const [patternVisible, setPatternVisible] = useState(true);
  // Vraie pendant le retrait de la grille : elle s'efface et se replie.
  const [grilleSort, setGrilleSort] = useState(false);
  const cycleRef = useRef(0);
  /* Vraie du lancement du run jusqu'à sa fin, sans aucun trou.

     Se fier à la phase ne suffisait pas : entre deux mesures elle repasse par
     'idle' pendant l'annonce, le décompte et la transition de grille — soit
     près de trois secondes où `!running` faisait revenir le bouton de
     lancement. Le run, lui, ne s'interrompt pas : c'est donc lui qu'on suit. */
  const [runActif, setRunActif] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [stepFlash, setStepFlash] = useState({});
  const [floatingJudgment, setFloatingJudgment] = useState(null);
  // Compteur de frappes : sert uniquement de `key` à l'onde d'impact, pour
  // la faire rejouer même sur deux frappes très rapprochées.
  const [impulsion, setImpulsion] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const [dailyRound, setDailyRound] = useState(0);
  const [annonce, setAnnonce] = useState(null); // { type, restantes, finale, duree }
  /* Voile de fin du défi, posé à la dernière manche puis retiré seul. */
  const [resultat, setResultat] = useState(null);
  /* Le bilan du bas attend que le voile soit levé : le même chiffre affiché
     deux fois au même instant, l'un par-dessus l'autre, se contredirait. */
  const [bilan, setBilan] = useState(false);
  /* Moyenne et détail figés à la fin de la série. En état et non lus depuis
     dailyScoresRef au rendu : lire une ref pendant le rendu est interdit, et
     ces valeurs ne bougent plus une fois la série close. */
  const [bilanQuotidien, setBilanQuotidien] = useState(null);
  // Vraie pendant toute la présentation : le tableau de bord attend qu'elle
  // soit finie pour faire rouler son compteur.
  const introEnCours = annonce?.type === 'intro';
  /* Pointeur grossier = doigt. `pointer: coarse` plutôt qu'une largeur :
     c'est le geste qui nous intéresse, pas la taille de l'écran. */
  const [tactile, setTactile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const maj = () => setTactile(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  /* Vide au départ. Cette ligne s'affiche SOUS la zone de frappe, donc après
     le bouton et après la grille : elle y annonçait les règles à un joueur
     qui avait déjà tout lu et cliqué. Le cadrage remonte en tête de panneau,
     et la ligne d'état retrouve son seul métier — dire ce qui se passe. */
  const [status, setStatus] = useState('');

  const toneRef = useRef(null);
  const clickRef = useRef(null);
  const clapRef = useRef(null);
  const patternRef = useRef(null);
  const phaseRef = useRef('idle');
  const configRef = useRef(levelConfig(1));
  const cycleStartRef = useRef(0);
  const matchedRef = useRef([]);
  const tapsPtsRef = useRef([]);
  const extrasRef = useRef(0);
  const timersRef = useRef([]);
  const rafRef = useRef(null);
  const livesRef = useRef(VIES);
  const levelRef = useRef(1);
  const dailyRngRef = useRef(null);
  const dailyRoundRef = useRef(0);
  const dailyScoresRef = useRef([]);
  const dailyDoneRef = useRef(false);
  const minuteurBilanRef = useRef(null);   // laisse le voile de résultat se lever

  const volume = useVolume();
  const volumeRef = useRef(volume);
  const [tonePret, setTonePret] = useState(false);

  useEffect(() => {
    import('tone').then((Tone) => {
      toneRef.current = Tone;
      clickRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.005, octaves: 3,
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
      }).toDestination();
      clickRef.current.volume.value = dbPour(Tone, GAIN_CLICK, volumeRef.current);
      clapRef.current = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      clapRef.current.volume.value = dbPour(Tone, GAIN_CLAP, volumeRef.current);
      setTonePret(true);
    });

    function onKey(e) {
      // Ne pas capturer l'espace quand l'utilisateur saisit du texte ailleurs :
      // les dix épreuves sont montées simultanément dans le carrousel.
      const c = e.target;
      if (c && (c.tagName === 'INPUT' || c.tagName === 'TEXTAREA' || c.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); tap(); }
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      stopAll();
      // Les sons déjà programmés dans Tone survivent aux timers JS :
      // disposer les synthés coupe le métronome resté en attente.
      try { clickRef.current?.dispose(); clapRef.current?.dispose(); } catch {}
    };
  }, []);

  // Le curseur de volume doit agir sur les synthés DÉJÀ créés, pas seulement
  // sur les suivants : sans cet effet, le réglage n'avait aucun effet ici.
  useEffect(() => {
    volumeRef.current = volume;
    const Tone = toneRef.current;
    if (!Tone) return;
    if (clickRef.current) clickRef.current.volume.value = dbPour(Tone, GAIN_CLICK, volume);
    if (clapRef.current) clapRef.current.volume.value = dbPour(Tone, GAIN_CLAP, volume);
  }, [volume, tonePret]);

  // L'intro se joue à l'ARRIVÉE sur l'épreuve — depuis la page d'accueil ou
  // depuis l'onglet sous l'onde — mais pas sur « Relancer l'épreuve », qui
  // remonte pourtant le composant exactement pareil. useIntro tranche en
  // comparant le couple (épreuve, clé de relance) au montage précédent.
  // Purement visuelle, elle n'a besoin d'aucun geste utilisateur — l'audio,
  // lui, attend toujours le bouton de lancement.
  //
  // Coupée en mode quotidien : pas de vies à annoncer là-bas, et le format
  // court supporte mal la cérémonie.
  const introAutorisee = useIntro('rythme');
  useEffect(() => {
    if (daily || !introAutorisee) return;
    setAnnonce({ type: 'intro', duree: DUREE_INTRO });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Présentation propre au défi du jour.

     Celle du mode libre, juste au-dessus, montre des vies qui s'éteignent et
     un niveau qui monte : deux règles qui n'existent pas dans le défi, où le
     format est fixe et la note une moyenne. D'où deux présentations
     distinctes plutôt qu'une seule tordue pour servir les deux modes.

     useIntro doit rester appelé à chaque rendu — le placer derrière le `&&`
     en ferait un appel conditionnel, ce que React interdit. D'où la lecture
     de `introAutorisee`, déjà calculée ci-dessus, dans l'initialiseur. */
  const [introQuotidien, setIntroQuotidien] = useState(() => daily && introAutorisee);

  /* Le voile de résultat se retire seul : le plateau est déjà figé derrière
     lui, on ne bloque rien. */
  useEffect(() => {
    if (resultat === null) return undefined;
    const t = setTimeout(() => setResultat(null), RES_IA_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  useEffect(() => () => clearTimeout(minuteurBilanRef.current), []);

  function stopAll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }

  // La surcouche se retire d'elle-même au terme de son animation : le
  // pattern suivant est déjà relancé derrière elle, on ne bloque rien.
  // Échap la passe aussi, mais seulement s'il s'agit de la présentation.
  useEffect(() => {
    if (!annonce) return;
    const t = setTimeout(() => setAnnonce(null), annonce.duree);
    const surTouche = (e) => {
      if (e.key === 'Escape' && annonce.type === 'intro') setAnnonce(null);
    };
    window.addEventListener('keydown', surTouche);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', surTouche);
    };
  }, [annonce]);

  function schedule(fn, ms) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }

  function setPhaseBoth(p) {
    phaseRef.current = p;
    setPhase(p);
  }

  function makePattern(hits, steps, rng = Math.random) {
    const p = Array(steps).fill(false);
    p[0] = true;
    let n = 1;
    while (n < hits) {
      const i = 1 + Math.floor(rng() * (steps - 1));
      if (!p[i]) { p[i] = true; n++; }
    }
    return p;
  }

  function startRun() {
    stopAll();
    if (daily) {
      dailyRngRef.current = seeded('rythme');
      dailyRoundRef.current = 0;
      dailyScoresRef.current = [];
      setDailyRound(0);
    }
    livesRef.current = VIES;
    levelRef.current = daily ? DAILY_LEVELS[0] : 1;
    setLives(VIES);
    setLevel(levelRef.current);
    setLastScore(null);
    setRunActif(true);
    // Coupe une éventuelle intro encore à l'écran : « Recommencer » relance
    // le jeu, pas la présentation.
    setAnnonce(null);
    startCycle();
  }

  /* Retire la grille courante, laisse un battement, puis rend la main.
     Sauté au tout premier cycle : il n'y a encore rien à retirer. */
  function transitionGrille(suite) {
    if (!patternRef.current) { suite(); return; }
    setGrilleSort(true);
    schedule(() => {
      setPattern(null);
      patternRef.current = null;
      schedule(() => { setGrilleSort(false); suite(); }, BATTEMENT);
    }, SORTIE_GRILLE);
  }

  async function startCycle() {
    const Tone = toneRef.current;
    if (!Tone) return;
    await Tone.start();
    await new Promise((resoudre) => transitionGrille(resoudre));

    cycleRef.current += 1;
    const lvl = levelRef.current;
    const cfg = levelConfig(lvl);
    configRef.current = cfg;
    const p = makePattern(cfg.hits, cfg.steps, daily ? dailyRngRef.current : Math.random);
    patternRef.current = p;
    setPattern(p);
    setPatternVisible(true);
    setStepFlash({});
    setStatus(daily
      ? `Mesure ${dailyRoundRef.current + 1} sur ${DAILY_ROUNDS} · ${cfg.steps} cases — écoute et mémorise.`
      : `Niveau ${lvl} · ${cfg.bpm} BPM · ${cfg.steps} cases — écoute et mémorise.`);

    // La grille doit être POSÉE avant que la mesure ne parte : le premier
    // temps arrivait sinon pendant son animation d'entrée, donc à peine
    // visible.
    await new Promise((resoudre) => schedule(resoudre, ENTREE_GRILLE));

    const beat = 60 / cfg.bpm;
    const bar = barOf(cfg);
    const beats = cfg.steps / 2;
    const eighth = bar / cfg.steps;
    const t0 = Tone.now() + 0.2;

    // 1. CALL : métronome + pattern joué
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', t0 + b * beat);
    p.forEach((h, i) => { if (h) clapRef.current.triggerAttackRelease('16n', t0 + i * eighth); });

    setPhaseBoth('listen');
    animateCursor(t0, bar);

    // 2. PRÉPARATION : le pattern s'efface pendant que le métronome continue
    const prep0 = t0 + bar;
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', prep0 + b * beat);
    schedule(() => {
      setPhaseBoth('ready');
      setPatternVisible(false);
      setStatus('Le rythme s\'efface. Prépare-toi.');
      animateCursor(prep0, bar);
    }, (prep0 - Tone.now()) * 1000);

    // 3. RESPONSE
    const r0 = prep0 + bar;
    for (let b = 0; b < beats; b++) clickRef.current.triggerAttackRelease('E5', '32n', r0 + b * beat);
    cycleStartRef.current = r0;
    matchedRef.current = Array(cfg.steps).fill(false);
    tapsPtsRef.current = [];
    extrasRef.current = 0;

    // La frappe s'ouvre 250 ms AVANT la mesure : sans cette marge, le premier
    // temps est perdu (dérive du setTimeout + rendu React). Les frappes trop
    // précoces restent rejetées par le test de fenêtre dans tap().
    schedule(() => {
      setPhaseBoth('play');
      /* Le comment est déjà dit, en vert, dans la zone. Répéter le geste ici
         double la lecture au moment où il faut regarder et non lire. */
      setStatus('À toi. Rejoue la mesure.');
    }, Math.max(0, (r0 - Tone.now()) * 1000 - 250));

    schedule(() => animateCursor(r0, bar), Math.max(0, (r0 - Tone.now()) * 1000));

    schedule(() => endCycle(), (r0 + bar + 0.25 - Tone.now()) * 1000);
  }

  function animateCursor(startTime, duration) {
    const Tone = toneRef.current;
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const progress = (Tone.now() - startTime) / duration;
      if (progress >= 0 && progress <= 1) setCursor(progress);
      if (progress <= 1) rafRef.current = requestAnimationFrame(loop);
      else setCursor(-1);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function tap() {
    if (phaseRef.current !== 'play' || !toneRef.current) return;
    clapRef.current?.triggerAttackRelease('16n');
    setImpulsion((n) => n + 1);
    const cfg = configRef.current;
    const bar = barOf(cfg);
    const eighth = bar / cfg.steps;
    const t = toneRef.current.now() - cycleStartRef.current;
    if (t < -0.25 || t > bar + 0.25) return;

    const p = patternRef.current;
    let best = -1, bestErr = Infinity;
    p.forEach((h, i) => {
      if (h && !matchedRef.current[i]) {
        const err = Math.abs(t - i * eighth);
        if (err < bestErr) { bestErr = err; best = i; }
      }
    });

    let judgment;
    if (best >= 0 && bestErr < 0.25) {
      matchedRef.current[best] = true;
      judgment = JUDGMENTS.find((j) => bestErr <= j.max);
      tapsPtsRef.current.push(judgment.pts);
      flashStep(best, judgment.color);
    } else {
      extrasRef.current += 1;
      judgment = JUDGMENTS[3];
    }
    showJudgment(judgment);
  }

  function flashStep(i, color) {
    setStepFlash((f) => ({ ...f, [i]: color }));
    schedule(() => setStepFlash((f) => { const n = { ...f }; delete n[i]; return n; }), 400);
  }

  function showJudgment(j) {
    setFloatingJudgment({ ...j, key: Math.random() });
    schedule(() => setFloatingJudgment(null), 600);
  }

  function endCycle() {
    setPhaseBoth('idle');
    setCursor(-1);
    setPatternVisible(true);
    const p = patternRef.current;
    const targets = p.filter(Boolean).length;
    const pts = tapsPtsRef.current.reduce((a, b) => a + b, 0);
    const missed = targets - matchedRef.current.filter(Boolean).length;
    let s = (pts / targets) * 10 - extrasRef.current - missed * 0.5;
    s = Math.max(0, Math.min(10, Math.round(s * 10) / 10));
    setLastScore(s);

    if (daily) {
      dailyScoresRef.current.push(s);
      dailyRoundRef.current += 1;
      setDailyRound(dailyRoundRef.current);
      if (dailyRoundRef.current >= DAILY_ROUNDS) {
        const avg = Math.round((dailyScoresRef.current.reduce((a, b) => a + b, 0) / DAILY_ROUNDS) * 10) / 10;
        setPhaseBoth('gameover');
        setRunActif(false);
        setStatus(`Terminé : ${dailyScoresRef.current.map(note).join(' · ')} → moyenne ${note(avg)} sur 10.`);
        if (!dailyDoneRef.current) { dailyDoneRef.current = true; onDone(avg); }

        /* Même séquence que les autres épreuves : le voile occupe le panneau
           le temps que la note soit lue, puis se retire et laisse le bilan.
           Le détail est figé maintenant — la série est close, il ne bougera
           plus, et le rendu n'aura pas à relire une ref. */
        setBilanQuotidien({ moyenne: avg, notes: [...dailyScoresRef.current] });
        setResultat(avg);
        minuteurBilanRef.current = setTimeout(() => setBilan(true), RES_IA_TOTAL);
      } else {
        levelRef.current = DAILY_LEVELS[dailyRoundRef.current];
        setLevel(levelRef.current);
        setStatus(`${note(s)} sur 10. Mesure ${dailyRoundRef.current + 1} sur ${DAILY_ROUNDS} dans un instant.`);
        schedule(() => startCycle(), 1800);
      }
      return;
    }

    if (s >= 7) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setBestLevel((b) => Math.max(b, levelRef.current));
      // Réussite : aucun voile. Le pattern suivant est la récompense, une
      // cérémonie de félicitations ne ferait que casser la série.
      setStatus(`${note(s)} sur 10. Niveau ${levelRef.current}.`);
      schedule(() => startCycle(), 1600);
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);

      if (livesRef.current <= 0) {
        // Le voile joue la perte en entier puis le verdict ; l'écran de fin
        // n'arrive qu'une fois la croix tracée.
        setAnnonce({ type: 'perte', restantes: 0, finale: true, duree: DUREE_DEFAITE });
        setStatus(`${note(s)} sur 10.`);
        schedule(() => {
          setPhaseBoth('gameover');
          setRunActif(false);
          // Rien à écrire ici : la croix du voile a déjà annoncé la défaite,
          // et le bilan juste en dessous donne le niveau atteint. Le répéter
          // en ligne d'état faisait dire trois fois la même chose.
          setStatus('');
        }, DUREE_DEFAITE);
      } else {
        setAnnonce({
          type: 'perte',
          restantes: livesRef.current,
          finale: false,
          duree: DUREE_PERTE,
        });
        setStatus(`${note(s)} sur 10. Le niveau ${levelRef.current} est rejoué.`);
        // La transition attend que le voile soit parti. Le lancer pendant
        // l'annonce faisait jouer les deux mouvements ensemble : la grille
        // se retirait derrière la pastille qui s'éteignait, et les deux se
        // gênaient. Un temps après l'autre.
        schedule(() => startCycle(), DUREE_PERTE);
      }
    }
  }

  const running = phase === 'listen' || phase === 'ready' || phase === 'play';
  const phaseBadge = {
    listen: { txt: 'écoute', couleur: 'var(--lin)' },
    ready: { txt: 'préparation', couleur: 'var(--or)' },
    play: { txt: 'à toi', couleur: 'var(--jade)' },
  }[phase];
  const cursorColor = phase === 'listen' ? 'var(--or)' : phase === 'ready' ? 'var(--or-clair)' : 'var(--jade)';
  const dailyFini = daily && phase === 'gameover';
  const gridSteps = pattern?.length ?? 8;
  const gridGap = gridSteps > 12 ? 5 : 8;

  return (
    // Le fond du panneau manquait à cette épreuve : les neuf autres
    // l'utilisent, et `position: relative` ancre en prime la surcouche.
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes rytAttenteEntre {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rytGrilleEntre {
          from { opacity: 0; transform: translateY(-6px) scale(0.99); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rytChiffreEntre {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        @keyframes pulseAttente {
          0%, 100% {
            border-color: var(--filet);
            box-shadow: 0 0 0 rgba(250, 199, 117, 0);
          }
          50% {
            border-color: var(--or-clair);
            box-shadow: 0 0 24px rgba(250, 199, 117, 0.22);
          }
        }
        @keyframes ondeFrappe {
          from { transform: scale(0.5); opacity: 0.7; }
          to   { transform: scale(2); opacity: 0; }
        }
        @keyframes impactFrappe {
          from { transform: scale(0.35); opacity: 0.55; }
          to   { transform: scale(2.6); opacity: 0; }
        }
        @keyframes apparitionAnnonce {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Surcouche — définitions identiques à celles de l'épreuve Duel.
           Les dix épreuves sont montées simultanément dans le carrousel, donc
           ces règles coexistent dans le DOM : elles doivent rester rigoureusement
           les mêmes des deux côtés, sinon la dernière déclarée l'emporterait
           silencieusement sur l'autre. */
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
        @keyframes demoNote {
          0%   { opacity: 0; transform: scale(0.2); }
          40%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes demoTete {
          from { opacity: 1; left: 0; }
          to   { opacity: 1; left: 100%; }
        }
        @keyframes demoTeteJade {
          from { opacity: 1; left: 0; background: var(--jade); }
          to   { opacity: 1; left: 100%; background: var(--jade); }
        }
        @keyframes demoImpact {
          0%   { opacity: 0; transform: scale(0.94); }
          35%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.03); }
        }
        @keyframes demoTeteSort {
          to { opacity: 0; }
        }
        @keyframes demoCaseAllume {
          from { border-color: var(--filet); border-width: 0.5px; }
          to   { border-color: var(--or);   border-width: 1px; }
        }
        @keyframes demoCaseEteint {
          to { border-color: var(--filet); border-width: 0.5px; }
        }
        @keyframes demoCaseFrappe {
          0%   { border-color: var(--jade); border-width: 1px; }
          70%  { border-color: var(--jade); border-width: 1px; }
          100% { border-color: var(--filet); border-width: 0.5px; }
        }
        @keyframes demoChiffreSort {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-30px); }
        }
        @keyframes demoChiffreEntre {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoNoteSort {
          to { opacity: 0; transform: scale(0.35); }
        }
        @keyframes demoNoteFlash {
          0%   { opacity: 0; transform: scale(0.35); background-color: var(--jade); }
          35%  { opacity: 1; transform: scale(1.2);  background-color: var(--jade); }
          100% { opacity: 0; transform: scale(1);    background-color: var(--jade); }
        }
        @keyframes demoBattement {
          0%   { opacity: 0; transform: scale(0.4);
                 background-color: var(--or-clair); border-color: var(--or-clair); }
          30%  { opacity: 1; transform: scale(1.25);
                 background-color: var(--or-clair); border-color: var(--or-clair); }
          100% { opacity: 1; transform: scale(1);
                 background-color: transparent; border-color: var(--filet-fort); }
        }
        @keyframes demoTetePrep {
          from { opacity: 1; left: 0; background: var(--or-clair); }
          to   { opacity: 1; left: 100%; background: var(--or-clair); }
        }
        @keyframes demoAttente {
          0%, 100% { border-color: var(--filet); }
          50%      { border-color: var(--or-clair); }
        }
        @keyframes demoOnde {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.8; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.4); }
        }
        @keyframes demoCurseur {${trajetCurseur()}}
        @keyframes demoEtiquetteSort {
          to { opacity: 0; transform: translateY(-6px); }
        }
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
        @media (prefers-reduced-motion: reduce) {
          [data-duel-surcouche], [data-duel-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      {/* ---- Cartouche de tête ----
          Le panneau n'annonçait rien. Le joueur arrivait sur un tableau de
          bord — niveau, vies, record — sans qu'aucune ligne lui ait dit à
          quoi il joue. La seule phrase qui le disait était la ligne d'état,
          posée SOUS la zone de frappe, c'est-à-dire après le bouton et après
          la grille : lue, si elle l'était, une fois la partie commencée.

          Même structure que l'épreuve des accords : intitulé, consigne, puis
          l'enjeu en étiquette mono. Trois lignes, la même partout, et le
          joueur qui passe d'une épreuve à l'autre n'a jamais à chercher où
          se trouve la règle. */}
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Reproduis le rythme</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto', textWrap: 'balance' }}>
        Écoute une mesure, rejoue-la de mémoire au bon tempo.
      </p>
      <p style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 400,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: 'var(--lin)', margin: 'var(--e2) auto var(--e5)',
      }}>
        {daily
          ? `${DAILY_ROUNDS} mesures · ton score est la moyenne`
          : 'Le niveau monte tant que tu tiens'}
      </p>

      {/* ---- Tableau de bord, centré comme le reste ----
          Ce panneau était le seul des huit jeux à cartouche à ne pas porter
          `textAlign: center` sur sa racine : titre, consigne, barème et
          compteurs se calaient à gauche d'une carte large de mille pixels,
          au-dessus d'une grille et d'une zone de frappe qui, elles, sont
          centrées. Le bloc de tête flottait donc en haut à gauche, sans
          rapport avec ce qu'il annonçait.

          Le tableau de bord prend le même axe. C'est déjà ce que fait
          « Humain ou IA », qui a exactement la même structure : compteurs,
          bouton de départ, scène. */}
      <div style={{
        display: 'flex', gap: 'var(--e5)', flexWrap: 'wrap',
        alignItems: 'baseline', justifyContent: 'center', marginBottom: 'var(--e4)',
      }}>
        {daily ? (
          <Donnee etiquette="mesure" valeur={`${Math.min(dailyRound + 1, DAILY_ROUNDS)} / ${DAILY_ROUNDS}`} />
        ) : (
          <>
            {/* Pendant la présentation le compteur affiche 0 : quand le voile
                se lève, il roule sur 1 et le run commence sous les yeux du
                joueur — même geste que la dernière scène de l'intro. */}
            <div>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>niveau</div>
              <CompteurNiveau valeur={introEnCours ? 0 : level} actif={!introEnCours} />
            </div>
            <Donnee etiquette="vies" valeur={'●'.repeat(Math.max(0, lives)) + '○'.repeat(VIES - Math.max(0, lives))} />
            <Donnee etiquette="record" valeur={`niveau ${bestLevel}`} />
          </>
        )}
        {lastScore !== null && (
          <Donnee
            etiquette="dernier score"
            valeur={`${lastScore.toFixed(1).replace('.', ',')} / 10`}
          />
        )}
      </div>

      {/* Bouton de lancement ou badge de phase.
         Après un run libre, la relance descend dans le bloc de bilan, comme
         « Nouvel accord », « Nouvel artiste » et « Nouvelle pochette » : on
         redémarre là où on vient de lire son résultat, pas en haut de page.
         Le mode quotidien garde son bouton ici, puisqu'il n'y a rien à
         relancer et que l'état « terminé » doit rester visible d'emblée. */}
      {/* Même pastille que le badge de phase : entre deux mesures, l'état du
         jeu s'affiche au même endroit et dans la même forme — l'un remplace
         l'autre plutôt que de changer de langage. */}
      {runActif && !running && (
        <div className="etiquette-mono" style={{
          display: 'inline-block', padding: '6px 12px', marginBottom: 'var(--e4)',
          border: '1px solid var(--or)', borderRadius: 'var(--rayon-controle)',
          color: 'var(--or)',
          animation: 'rytAttenteEntre 300ms ease-out both',
        }}>
          prochaine mesure en préparation
        </div>
      )}

      {!runActif && !(phase === 'gameover' && !daily) && (
        <button onClick={startRun} disabled={dailyFini}
          style={{
            fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
            padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
            cursor: dailyFini ? 'not-allowed' : 'pointer',
            background: dailyFini ? 'transparent' : 'var(--or)',
            color: dailyFini ? 'var(--cendre)' : 'var(--noir)',
            border: `1px solid ${dailyFini ? 'var(--filet)' : 'var(--or)'}`,
            marginBottom: 'var(--e4)',
            transition: 'background var(--transition-courte)',
          }}>
          {dailyFini ? 'Terminé pour aujourd\'hui'
            : daily ? 'Commencer'
            : 'Commencer le jeu'}
        </button>
      )}

      {/* Badge de phase : uniquement pendant un run. phaseBadge n'est défini
         que pour listen / ready / play — le lire hors run plantait. */}
      {running && phaseBadge && (
        <div className="etiquette-mono" style={{
          display: 'inline-block', padding: '6px 12px', marginBottom: 'var(--e4)',
          border: `1px solid ${phaseBadge.couleur}`, borderRadius: 'var(--rayon-controle)',
          color: phaseBadge.couleur,
        }}>
          {phaseBadge.txt}
        </div>
      )}

      {/* Grille rythmique */}
      <div style={{
        position: 'relative', marginBottom: 'var(--e2)',
        opacity: grilleSort ? 0 : 1,
        transform: grilleSort ? 'translateY(6px) scale(0.985)' : 'none',
        transition: `opacity ${SORTIE_GRILLE}ms ease-in, transform ${SORTIE_GRILLE}ms ease-in`,
      }}>
        <div
          key={`grille-${pattern?.length ?? 0}-${cycleRef.current}`}
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${gridSteps}, 1fr)`, gap: gridGap,
            animation: `rytGrilleEntre ${ENTREE_GRILLE}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
          }}
        >
          {Array.from({ length: gridSteps }, (_, i) => {
            const actif = pattern?.[i] && patternVisible;
            const surTemps = i % 2 === 0; // temps forts : fond onyx, filet plus présent
            return (
              <div key={i} style={{
                aspectRatio: '1 / 1.4', borderRadius: 'var(--rayon-controle)',
                background: surTemps ? 'var(--onyx)' : 'transparent',
                border: `${actif ? '1px' : '0.5px'} solid ${actif ? 'var(--or)' : surTemps ? 'var(--filet)' : 'rgba(242,236,224,0.07)'}`,
                position: 'relative',
                transition: 'border-color 0.35s ease',
                transitionDelay: `${i * 0.035}s`,
              }}>
                {pattern?.[i] && (
                  <div style={{
                    position: 'absolute', inset: '26% 28%', borderRadius: '50%',
                    background: stepFlash[i] ?? 'var(--or)',
                    opacity: (patternVisible || stepFlash[i]) ? 1 : 0,
                    transform: (patternVisible || stepFlash[i]) ? 'scale(1)' : 'scale(0.15)',
                    transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(.34,1.3,.64,1), background 0.15s',
                    transitionDelay: `${i * 0.04}s`,
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Curseur qui parcourt la mesure */}
        {cursor >= 0 && (
          <div style={{
            position: 'absolute', top: -6, bottom: -6,
            left: `${cursor * 100}%`, width: 2,
            background: cursorColor,
            boxShadow: `0 0 10px ${cursorColor}`,
          }} />
        )}

        {/* Jugement flottant */}
        {floatingJudgment && (
          <div key={floatingJudgment.key} className="etiquette-mono" style={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            color: floatingJudgment.color,
            animation: 'floatUp 0.6s ease-out forwards',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {floatingJudgment.label}
          </div>
        )}
      </div>

      {/* Zone de frappe : le composant porte lui-même sa pédagogie */}
      <ZoneFrappe phase={phase} running={running} impulsion={impulsion} onTap={tap} tactile={tactile} />

      {/* La ligne d'état ne sert qu'en cours de partie : à la fin, le bilan
         porte tout ce qu'il y a à dire. Retirée plutôt que vidée, sinon sa
         hauteur minimale laisserait un blanc dans la mise en page. */}
      {status && (
        /* Centrée : elle commente la zone de frappe, qui l'est aussi. Alignée
           à gauche comme le tableau de bord, elle flottait toute seule sous
           un bloc centré, sans rattachement visible à quoi que ce soit. */
        <p className="lin" style={{
          fontSize: 13, minHeight: '1.5em', marginTop: 'var(--e3)', textAlign: 'center',
        }}>{status}</p>
      )}

      {/* Écran de fin. En quotidien il attend que le voile ait fini de
          présenter la note ; en mode libre il n'y a pas de voile, donc rien
          à attendre. */}
      {phase === 'gameover' && (!daily || bilan) && (
        <div style={{
          marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'apparitionAnnonce 260ms ease-out both',
        }}>
          {daily ? (
            <>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>score du jeu</div>
              <div className="score-affiche" style={{ fontSize: 38, marginTop: 'var(--e2)' }}>
                {(bilanQuotidien?.moyenne ?? 0).toFixed(1).replace('.', ',')}
                <span style={{ color: 'var(--cendre)' }}> / 10</span>
              </div>
              <p className="description" style={{ marginTop: 'var(--e2)' }}>
                Détail des {DAILY_ROUNDS} mesures :{' '}
                {(bilanQuotidien?.notes ?? []).map((x) => x.toFixed(1).replace('.', ',')).join(' · ')}
              </p>
            </>
          ) : (
            <>
              <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>run terminé</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 44, fontWeight: 500,
                color: 'var(--or)', marginTop: 'var(--e2)', lineHeight: 1.1,
              }}>
                niveau {level}
              </div>
              <p className="description" style={{ marginTop: 'var(--e2)' }}>
                {level >= bestLevel
                  ? 'Meilleur niveau de la session.'
                  : `Ton record de la session reste le niveau ${bestLevel}.`}
              </p>
            </>
          )}

          {/* Une seule tentative en quotidien : pas de relance là-bas. */}
          {!daily && (
            <button
              onClick={startRun}
              style={{
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
                padding: '9px 16px', borderRadius: 'var(--rayon-controle)',
                marginTop: 'var(--e4)',
                cursor: 'pointer',
                background: 'var(--or)',
                color: 'var(--noir)',
                border: '1px solid var(--or)',
                transition: 'background var(--transition-courte)',
              }}
            >
              Relancer un run
            </button>
          )}
        </div>
      )}

      {/* ---- Surcouche : placée en dernier pour passer au-dessus de tout ---- */}
      {annonce && <Surcouche annonce={annonce} onPasser={() => setAnnonce(null)} />}

      {/* Voile de fin du défi : la note en grand, comme sur les autres
          épreuves. Posé après la surcouche pour passer au-dessus d'elle. */}
      {resultat !== null && bilanQuotidien && (
        <ResultatIA
          score={resultat}
          detail={`Moyenne de ${DAILY_ROUNDS} mesures : ${bilanQuotidien.notes.map(note).join(' · ')}`}
        />
      )}

      {/* ---- Présentation du défi du jour ----
           Exclusive de la précédente : `annonce` de type intro n'est jamais
           posée en mode quotidien, les deux voiles ne peuvent donc pas se
           superposer. */}
      {daily && introQuotidien && (
        <IntroRythmeQuotidien
          manches={DAILY_ROUNDS}
          onFin={() => setIntroQuotidien(false)}
        />
      )}
    </div>
  );
}

/* Compteur roulant du tableau de bord.

   Le chiffre ne change pas d'un coup : l'ancien sort par le haut pendant que
   le nouveau entre par le bas. Le `key` sur la valeur est ce qui déclenche le
   remontage, donc l'animation — sans lui, React réutiliserait le même nœud et
   se contenterait d'y écrire un autre texte.

   Le premier rendu ne s'anime pas : le tableau de bord est monté DERRIÈRE la
   surcouche d'introduction, et sans ce garde-fou le roulement se jouerait
   pendant la présentation, hors de vue. */
const H_LIGNE_NIVEAU = 20;

function CompteurNiveau({ valeur, actif = true }) {
  const premierRendu = useRef(true);
  const precedent = useRef(valeur);
  const change = valeur !== precedent.current;

  useEffect(() => {
    precedent.current = valeur;
    premierRendu.current = false;
  }, [valeur]);

  const anime = actif && change && !premierRendu.current;

  return (
    <span style={{
      position: 'relative', display: 'block',
      height: H_LIGNE_NIVEAU, overflow: 'hidden',
      fontFamily: 'var(--mono)', fontSize: 14, lineHeight: `${H_LIGNE_NIVEAU}px`,
      color: 'var(--or)', marginTop: 2,
    }}>
      <span
        key={valeur}
        style={{
          display: 'block',
          animation: anime ? 'rytChiffreEntre 460ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
        }}
      >
        {valeur}
      </span>
    </span>
  );
}

/* Une donnée du tableau de bord : étiquette mono en cendre, valeur en ivoire */
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
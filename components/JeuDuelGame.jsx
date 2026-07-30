'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { panel, btn, seeded, ScoreBox, statusStyle } from '@/components/dailyGames';
import { freshPreviewUrl } from '@/utils/deezer';
import { useVolume } from '@/utils/volume';

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
 * remplacé. Dix duels, un point par bonne réponse, note sur dix.
 *
 * Données : public/data/duels.json, produit hors ligne par
 * scripts/generer-duels.mjs. Chargé par fetch et non par import — 350 Ko
 * dans le bundle JS seraient téléchargés et parsés à chaque visite.
 */

/** Mode quotidien : format fixe, noté sur dix, une seule tentative. */
const NB_DUELS_QUOTIDIEN = 10;

/** Mode libre : survie. Trois vies, le niveau monte tant qu'on tient. */
const VIES = 3;

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
const SORTIE_ACTE_INTRO = DELAI_ENTREE + 1900; // le titre et les vies s'effacent
const INTRO_VOEU = DELAI_ENTREE + 2200;        // « Bonne chance »
const DUREE_INTRO = DELAI_ENTREE + 3600;       // durée totale du voile

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

function Surcouche({ annonce }) {
  const restantes = annonce.restantes ?? 0;
  const finale = Boolean(annonce.finale);
  const intro = annonce.type === 'intro';

  return (
    <div
      data-duel-surcouche
      style={{
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
                {VIES} vies
              </div>
            </div>
          </div>

          {/* ---- Acte II : le vœu ---- */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 40,
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--or)',
              animation: `duelVoeu 480ms ${INTRO_VOEU}ms cubic-bezier(0.34, 1.3, 0.64, 1) both`,
            }}>
              Bonne chance
            </span>
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
   * chargement, puis à chaque « Nouveau run » depuis l'écran de fin.
   */
  const demarrerRun = useCallback(() => {
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
    // L'intro n'a de sens qu'en mode libre : le quotidien n'a ni vies ni
    // survie à annoncer, et son format court supporte mal quatre secondes
    // de cérémonie avant la première manche.
    setAnnonce(daily ? null : { type: 'intro', duree: DUREE_INTRO });
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
        const rep = await fetch('/data/duels.json');
        if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
        const data = await rep.json();
        if (!vivant) return;

        const morceaux = (data?.morceaux ?? []).filter(
          (m) => m.deezerId && m.streams > 0 && m.pochette
        );
        if (morceaux.length < 30) throw new Error('pool insuffisant');

        morceauxRef.current = morceaux;
        rngRef.current = daily ? seeded('duel') : Math.random;
        demarrerRun();
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (daily) onDone(bonnesRef.current);
  }

  function avancer(ok) {
    // Mode quotidien : format fixe, dix manches, puis note sur dix.
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
    return () => clearTimeout(t);
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
            <Donnee etiquette="vies" valeur={'●'.repeat(Math.max(0, vies)) + '○'.repeat(VIES - Math.max(0, vies))} />
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
          <ScoreBox
            score={bonnesRef.current}
            detail={`${bonnesRef.current} bonne${bonnesRef.current > 1 ? 's' : ''} réponse${bonnesRef.current > 1 ? 's' : ''} sur ${NB_DUELS_QUOTIDIEN}. Données kworb.net.`}
          />
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
              onClick={demarrerRun}
              style={{ ...btn(true, false), marginTop: 'var(--e4)' }}
            >
              Nouveau run
            </button>
          </div>
        )
      )}

      {/* ---- Surcouche : placée en dernier pour passer au-dessus de tout ---- */}
      {annonce && <Surcouche annonce={annonce} />}
    </div>
  );
}
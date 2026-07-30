'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { panel, btn, seeded, ScoreBox, statusStyle } from '@/components/dailyGames';
import { freshPreviewUrl } from '@/utils/deezer';

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

const NB_DUELS = 10;

/** Écart minimum entre deux morceaux opposés. En dessous, c'est un pile ou face. */
const ECART_MINI = 1.25;

const DUREE_EXTRAIT = 15000;   // ms d'extrait jouable
const PAUSE_REVELATION = 1700; // ms d'affichage du résultat avant le duel suivant

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
          borderColor: joue || pause ? 'var(--or)' : 'var(--filet-fort)',
          color: joue || pause ? 'var(--or)' : 'var(--ivoire)',
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
  const [duel, setDuel] = useState(1);
  const [bonnes, setBonnes] = useState(0);
  const [juste, setJuste] = useState(null);
  const [promotion, setPromotion] = useState(false); // la référence vient-elle de la droite ?
  const [enLecture, setEnLecture] = useState(null);  // 'gauche' | 'droite' | null
  const [enPause, setEnPause] = useState(null);       // 'gauche' | 'droite' | null — chargé mais arrêté en cours
  const [chargementAudio, setChargementAudio] = useState(null);
  const [message, setMessage] = useState('');

  const poolRef = useRef([]);
  const bonnesRef = useRef(0);
  const audioRef = useRef(null);
  const audioCoteRef = useRef(null);      // à quel côté appartient l'élément <audio> chargé
  const debutLectureRef = useRef(0);      // Date.now() du dernier (re)départ de lecture
  const dureeRestanteRef = useRef(DUREE_EXTRAIT); // budget d'écoute restant pour l'extrait chargé
  const minuteurAudioRef = useRef(null);
  const minuteurSuiteRef = useRef(null);
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
  }, [reference, challenger, couperAudio, extraitEpuise]);

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
   */
  const tirerChallenger = useCallback((ref) => {
    const pool = poolRef.current;
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      if (m.artiste === ref.artiste) continue;
      if (ecart(m.streams, ref.streams) < ECART_MINI) continue;
      pool.splice(i, 1);
      return m;
    }
    return null;
  }, []);

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

        const rng = daily ? seeded('duel') : Math.random;
        poolRef.current = melanger(morceaux, rng);

        const premiere = poolRef.current.shift();
        const second = tirerChallenger(premiere);
        if (!second) throw new Error('aucune paire jouable');

        setReference(premiere);
        setChallenger(second);
        setPhase('jeu');
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
    }

    minuteurSuiteRef.current = setTimeout(() => avancer(ok), PAUSE_REVELATION);
  }

  function avancer(ok) {
    if (duel >= NB_DUELS) {
      setPhase('fin');
      onDone(bonnesRef.current);
      return;
    }

    const nouvelleRef = ok ? challenger : reference;
    const suivant = tirerChallenger(nouvelleRef);

    // Pool épuisé : on clôt proprement plutôt que d'afficher une carte vide.
    if (!suivant) {
      setPhase('fin');
      onDone(bonnesRef.current);
      return;
    }

    setPromotion(ok);
    setReference(nouvelleRef);
    setChallenger(suivant);
    setJuste(null);
    setDuel((d) => d + 1);
    setPhase('jeu');
  }

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
    <div style={panel}>
      <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e5)' }}>
        duel {String(Math.min(duel, NB_DUELS)).padStart(2, '0')} / {NB_DUELS}
        {bonnes > 0 && (
          <span style={{ marginLeft: 'var(--e3)' }}>· {bonnes} juste{bonnes > 1 ? 's' : ''}</span>
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
        <ScoreBox
          score={bonnesRef.current}
          detail={`${bonnesRef.current} bonne${bonnesRef.current > 1 ? 's' : ''} réponse${bonnesRef.current > 1 ? 's' : ''} sur ${NB_DUELS}. Données kworb.net.`}
        />
      )}
    </div>
  );
}
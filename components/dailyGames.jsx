'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { searchTracks, trackDetails, freshPreviewUrl } from '@/utils/deezer';
import { useVolume } from '@/utils/volume';
import { useIntro } from '@/utils/intro';
import IntroArtiste, { ResultatArtiste, RES_ARTISTE_TOTAL } from './IntroArtiste';
import IntroPochette, { ResultatPochette, RES_POCHETTE_TOTAL } from './IntroPochette';

/* ============================================================
   UTILITAIRES SEED — même défi pour tous dans le Quotidien,
   tirage aléatoire dans les versions libres (via setSeedSalt)
============================================================ */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TODAY = new Date().toISOString().slice(0, 10);
let SEED_SALT = '';
export function setSeedSalt(salt) { SEED_SALT = salt; }
export const seeded = (name) => mulberry32(hashStr(TODAY + '|' + SEED_SALT + '|' + name));

export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

export function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// "Get Lucky (feat. Pharrell) - Radio Edit" → "getlucky"
export const normTitle = (s) => norm(String(s).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').split(' - ')[0]);

/* ============================================================
   STYLES PARTAGÉS — jetons du design system
============================================================ */
export const panel = {
  background: 'var(--onyx)',
  border: '0.5px solid var(--filet)',
  borderRadius: 'var(--rayon-carte)',
  padding: 'var(--e6)',
  marginBottom: 'var(--e4)',
};

export const btn = (primaire, disabled) => ({
  fontFamily: 'var(--sans)',
  fontSize: 14,
  fontWeight: 500,
  padding: '9px 16px',
  borderRadius: 'var(--rayon-controle)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: primaire ? 'var(--or)' : 'transparent',
  color: primaire ? 'var(--noir)' : 'var(--ivoire)',
  border: primaire ? '1px solid var(--or)' : '0.5px solid var(--filet-fort)',
  opacity: disabled ? 0.4 : 1,
  transition: 'background var(--transition-courte), border-color var(--transition-courte), color var(--transition-courte)',
});

/* Survol des boutons en contour : bordure et texte passent en or */
export const survolOr = (ev) => {
  if (ev.currentTarget.disabled) return;
  ev.currentTarget.style.borderColor = 'var(--or)';
  ev.currentTarget.style.color = 'var(--or)';
};
export const sortieOr = (ev) => {
  if (ev.currentTarget.disabled) return;
  ev.currentTarget.style.borderColor = 'var(--filet-fort)';
  ev.currentTarget.style.color = 'var(--ivoire)';
};

/* ============================================================
   LECTEUR AUDIO — une seule piste à la fois, coupée au démontage.

   Un useState ne convient pas pour la piste elle-même : la fonction de
   nettoyage du useEffect(..., []) capturerait la valeur initiale (null) et
   laisserait l'extrait tourner quand le jeu est relancé. D'où les refs.

   Deux corrections :
   · le volume global (curseur de l'en-tête) est appliqué au départ ET pendant
     la lecture — un <audio> neuf démarre à 1 quoi qu'affiche le curseur ;
   · pause / reprise, avec report du temps restant sur le minuteur de coupure,
     sans quoi reprendre après une pause tronquait l'extrait.
============================================================ */
export function useLecteurAudio() {
  const volume = useVolume();
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const finRef = useRef(null);
  const restantRef = useRef(0);   // ms restants avant coupure
  const departRef = useRef(0);    // horodatage du dernier démarrage
  const pauseRef = useRef(false);
  const [enLecture, setEnLecture] = useState(false);
  const [enPause, setEnPause] = useState(false);

  // Le curseur de volume doit agir sur la piste EN COURS, pas seulement sur
  // la suivante : on garde la valeur en ref pour les démarrages, et on la
  // pousse sur l'élément audio à chaque changement.
  const volumeRef = useRef(volume);
  useEffect(() => {
    const v = Math.max(0, Math.min(1, Number(volume) || 0));
    volumeRef.current = v;
    if (audioRef.current) audioRef.current.volume = v;
  }, [volume]);

  function arreter() {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    finRef.current = null;
    restantRef.current = 0;
    pauseRef.current = false;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setEnLecture(false);
    setEnPause(false);
  }

  // Coupe le son au démontage (changement d'épreuve, relance, navigation)
  useEffect(() => arreter, []);

  function terminer() {
    const onFin = finRef.current;
    arreter();
    onFin?.();
  }

  function jouer(url, secondes, { depart = 0, onFin } = {}) {
    arreter();
    const a = new Audio(url);
    a.volume = volumeRef.current;
    audioRef.current = a;
    finRef.current = onFin ?? null;
    if (depart) a.currentTime = depart;
    a.onended = () => terminer();
    a.play().catch((e) => console.error('Lecture impossible:', e));

    setEnLecture(true);
    setEnPause(false);
    pauseRef.current = false;

    if (secondes) {
      restantRef.current = secondes * 1000;
      departRef.current = Date.now();
      timerRef.current = setTimeout(terminer, restantRef.current);
    }
    return a;
  }

  function pause() {
    if (!audioRef.current || pauseRef.current) return;
    audioRef.current.pause();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      restantRef.current = Math.max(0, restantRef.current - (Date.now() - departRef.current));
    }
    pauseRef.current = true;
    setEnPause(true);
  }

  function reprendre() {
    if (!audioRef.current || !pauseRef.current) return;
    audioRef.current.volume = volumeRef.current;
    audioRef.current.play().catch((e) => console.error('Lecture impossible:', e));
    if (restantRef.current > 0) {
      departRef.current = Date.now();
      timerRef.current = setTimeout(terminer, restantRef.current);
    }
    pauseRef.current = false;
    setEnPause(false);
  }

  function basculer() {
    if (!audioRef.current) return;
    pauseRef.current ? reprendre() : pause();
  }

  return { jouer, arreter, pause, reprendre, basculer, enLecture, enPause };
}

export const inputStyle = {
  fontFamily: 'var(--sans)',
  fontSize: 14,
  background: 'var(--onyx-haut)',
  color: 'var(--ivoire)',
  border: '0.5px solid var(--filet-fort)',
  borderRadius: 'var(--rayon-controle)',
  padding: '9px 14px',
  minWidth: 220,
};

export const statusStyle = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--lin)',
  minHeight: '1.5em',
  marginTop: 'var(--e4)',
};

/* Score : jade réservé au parfait (≥ 9,5), carmin à l'échec (< 4) */
export function ScoreBox({ score, detail }) {
  if (score === null || score === undefined) return null;
  const n = Number(score);
  const couleur = n >= 9.5 ? 'var(--jade)' : n < 4 ? 'var(--carmin)' : 'var(--ivoire)';
  return (
    <div style={{ marginTop: 'var(--e4)', paddingTop: 'var(--e4)', borderTop: '0.5px solid var(--filet)' }}>
      <div className="score-affiche" style={{ color: couleur }}>
        {n.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
      </div>
      {detail && <p className="description" style={{ marginTop: 'var(--e2)' }}>{detail}</p>}
    </div>
  );
}

/* ============================================================
   AUTOCOMPLETE ARTISTES — liste scrollable, clavier ↑↓ + Entrée
============================================================ */
export function ArtistInput({ value, onChange, onSubmit, disabled, erreur = false, exclure = [], placeholder = 'Nom d\'artiste…' }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const q = norm(value);
  // Un nom déjà proposé et validé sort de la liste : le reproposer ne peut
  // qu'être une erreur de manipulation, autant qu'il ne soit plus cliquable.
  const dispo = exclure.length ? ARTISTS.filter((a) => !exclure.includes(a.nom)) : ARTISTS;
  const matches = q
    ? dispo.filter((a) => norm(a.nom).includes(q)).slice(0, 60)
    : [...dispo].sort((a, b) => a.nom.localeCompare(b.nom));

  function pick(nom) {
    onChange(nom);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[highlight] && norm(value) !== norm(matches[highlight].nom)) {
        e.preventDefault();
        pick(matches[highlight].nom);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...inputStyle,
          // Un contour carmin dit l'erreur sans texte à lire. Le parent le
          // rend au filet neutre au bout de quelques centaines de ms.
          border: erreur ? '1px solid var(--carmin)' : inputStyle.border,
          transition: 'border-color var(--transition-courte)',
        }}
      />
      {open && !disabled && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          width: '100%', minWidth: 220, maxHeight: 200, overflowY: 'auto',
          background: 'var(--onyx)', border: '0.5px solid var(--or)', borderRadius: 'var(--rayon-controle)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
        }}>
          {matches.map((a, i) => (
            <div key={a.nom}
              onMouseDown={(e) => { e.preventDefault(); pick(a.nom); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                background: i === highlight ? 'var(--onyx-haut)' : 'transparent',
                color: i === highlight ? 'var(--or)' : 'var(--ivoire)',
              }}>
              {a.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= 1 · TROUVE L'ARTISTE ================= */
const MAX_TRIES = 7;
const POINTS_ARTISTE = [10, 8.5, 7, 5.5, 4, 2.5, 1];
const CELL_DELAY = 0.25;   // secondes entre chaque colonne révélée
const FLOU_ARTISTE = 22;   // flou constant : il ne diminue jamais en cours de partie
const EXTRAIT_SEC = 10;

export function JeuArtiste({ onDone, daily = false }) {
  // Manche 0 : l'artiste du jour, tiré par la graine — identique pour tous.
  // Manches suivantes (bouton « Nouvel artiste ») : tirage libre.
  const [manche, setManche] = useState(0);
  const target = useMemo(
    () => (manche === 0
      ? ARTISTS[Math.floor(seeded('artiste')() * ARTISTS.length)]
      : ARTISTS[Math.floor(Math.random() * ARTISTS.length)]),
    [manche]
  );
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('artiste'));
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState(`Devine l'artiste du jour — ${MAX_TRIES} essais.`);
  const [score, setScore] = useState(null);
  const [animatingRow, setAnimatingRow] = useState(-1);

  // Surcouche de résultat, posée à la fin de la partie puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas et le dévoilement du portrait attendent que le voile soit
  // levé : deux fois le même chiffre au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);

  // Portrait + catalogue de l'artiste (Deezer), chargés en fond dès le montage
  const [photo, setPhoto] = useState(null);
  const [pistes, setPistes] = useState([]);
  const [chargementExtrait, setChargementExtrait] = useState(false);
  const { jouer, arreter, basculer, enLecture, enPause } = useLecteurAudio();

  const NB_COLS = 7;

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await fetch(`/api/deezer?term=${encodeURIComponent(target.nom)}&limit=25`);
        if (!res.ok) return;
        const data = await res.json();
        const tous = (data?.data ?? []).filter((t) => t?.preview);
        const exacts = tous.filter((t) => norm(t?.artist?.name) === norm(target.nom));
        const retenus = exacts.length ? exacts : tous;
        if (annule) return;
        const avecPortrait = retenus.find((t) => t.artist?.picture_xl || t.artist?.picture_big);
        setPhoto(avecPortrait?.artist?.picture_xl ?? avecPortrait?.artist?.picture_big ?? null);
        setPistes(retenus);
      } catch (err) {
        console.error('Artiste — chargement Deezer:', err);
      }
    })();
    return () => { annule = true; };
  }, [target.nom]);

  // Le voile de résultat se retire seul ; le minuteur suit si le composant part.
  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_ARTISTE_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);
  useEffect(() => () => clearTimeout(bilanTimer.current), []);

  // Pose le voile, puis le bilan une fois qu'il s'est levé.
  function terminerPartie(pts, phrase) {
    setStatus(phrase);
    setResultat(pts);
    onDone(pts);
    bilanTimer.current = setTimeout(() => {
      setScore(pts);
      setBilan(true);
    }, RES_ARTISTE_TOTAL);
  }

  // Nouvelle manche sans remonter le composant : l'intro ne rejoue donc pas.
  function relancer() {
    clearTimeout(bilanTimer.current);
    arreter();
    setManche((m) => m + 1);
    setInput('');
    setGuesses([]);
    setDone(false);
    setScore(null);
    setAnimatingRow(-1);
    setResultat(null);
    setBilan(false);
    setPhoto(null);
    setPistes([]);
    setStatus(`Devine l'artiste — ${MAX_TRIES} essais.`);
  }

  async function jouerExtrait() {
    if (!pistes.length || chargementExtrait) return;
    setChargementExtrait(true);
    try {
      const p = pistes[Math.floor(Math.random() * pistes.length)];
      const url = (await freshPreviewUrl(p.id)) ?? p.preview;
      jouer(url, EXTRAIT_SEC);
    } catch (err) {
      console.error('Artiste — extrait:', err);
    } finally {
      setChargementExtrait(false);
    }
  }

  function guess() {
    if (done) return;
    const g = ARTISTS.find((a) => norm(a.nom) === norm(input));
    // Le champ se vide dans TOUS les cas, y compris sur un refus.
    setInput('');
    if (!g) { setStatus('Artiste absent de la base — utilise l\'autocomplétion.'); return; }
    if (guesses.some((x) => x.nom === g.nom)) { setStatus(`${g.nom} a déjà été proposé.`); return; }
    const next = [...guesses, g];
    setGuesses(next);
    setAnimatingRow(next.length - 1);

    // Le verdict tombe APRÈS la révélation de la dernière colonne (suspense)
    const revealMs = (NB_COLS - 1) * CELL_DELAY * 1000 + 500;
    if (g.nom === target.nom) {
      setDone(true);
      setStatus('…');
      setTimeout(() => {
        terminerPartie(POINTS_ARTISTE[next.length - 1], `🎉 Trouvé en ${next.length} essai(s) !`);
      }, revealMs);
    } else if (next.length >= MAX_TRIES) {
      setDone(true);
      setStatus('…');
      setTimeout(() => {
        terminerPartie(0, `Perdu… c'était ${target.nom}.`);
      }, revealMs);
    } else {
      setStatus('…');
      setTimeout(() => {
        setStatus(
          next.length === MAX_TRIES - 1
            ? `Dernier essai — un extrait de ${EXTRAIT_SEC} secondes est débloqué.`
            : `Raté — ${MAX_TRIES - next.length} essai(s) restant(s).`
        );
      }, revealMs);
    }
  }

  const cell = (val, ok, col, animate, arrow = '') => (
    <div style={{
      background: 'var(--onyx-haut)',
      color: ok ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)',
      border: `0.5px solid ${ok ? 'var(--jade)' : 'rgba(226, 75, 74, 0.3)'}`,
      borderRadius: 'var(--rayon-controle)', padding: '8px 6px', fontSize: 12, textAlign: 'center',
      ...(animate ? {
        animation: `cellFlip 0.5s ease-out both`,
        animationDelay: `${col * CELL_DELAY}s`,
      } : {}),
    }}>
      {val}{arrow}
    </div>
  );

  // Pas de `!done` : l'extrait débloqué au dernier essai reste écoutable une
  // fois la partie finie — on vient d'apprendre qui c'était, l'entendre est
  // la récompense.
  const extraitDispo = guesses.length >= MAX_TRIES - 1 && pistes.length > 0;

  // Trois états, comme sur les cartes du Duel : repos, lecture, pause. L'or
  // n'est porté que pendant la lecture réelle ; en pause le bouton redevient
  // ivoire, ce qui rend l'état lisible sans rien lire.
  const joue = enLecture && !enPause;
  const libelleExtrait = chargementExtrait ? 'Chargement…'
    : joue ? 'Pause'
      : enPause ? 'Reprendre'
        : `Écouter ${EXTRAIT_SEC} s`;

  return (
    <div style={{ ...panel, overflow: 'visible', textAlign: 'center', position: 'relative' }}>
      <style>{`
        @keyframes cellFlip {
          0% { transform: rotateX(90deg); opacity: 0; background: var(--onyx-haut); color: transparent; }
          50% { transform: rotateX(90deg); opacity: 1; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
        @keyframes artApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroArtiste exclure={target.nom} onFin={() => setIntro(false)} />}
      {resultat !== null && <ResultatArtiste score={resultat} artiste={target.nom} />}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve l'artiste</h3>
      <p className="description" style={{ maxWidth: 460, margin: '0 auto var(--e3)' }}>
        Propose un artiste : chaque colonne le compare à l'artiste du jour.
      </p>

      {/* ---- Légende : reprend les couleurs exactes des cases ---- */}
      <div style={{
        display: 'flex', gap: 'var(--e4)', flexWrap: 'wrap', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
        marginBottom: 'var(--e5)',
      }}>
        <span><span style={{ color: 'var(--jade)' }}>■</span> identique</span>
        <span><span style={{ color: 'rgba(226,75,74,0.65)' }}>■</span> différent</span>
        <span>▲ plus grand</span>
        <span>▼ plus petit</span>
      </div>

      {/* ---- Portrait : le flou ne bouge pas, il se lève quand le voile se lève ---- */}
      <div style={{ marginBottom: 'var(--e5)' }}>
        <div style={{
          width: 190, height: 190, margin: '0 auto',
          overflow: 'hidden', borderRadius: 'var(--rayon-carte)',
          border: `${bilan ? '1px' : '0.5px'} solid ${bilan ? 'var(--or)' : 'var(--filet)'}`,
          background: 'var(--onyx-haut)',
          transition: 'border-color var(--transition-courte)',
        }}>
          {photo && (
            <img
              src={photo}
              alt="Portrait de l'artiste mystère"
              width={190} height={190}
              style={{
                filter: bilan ? 'none' : `blur(${FLOU_ARTISTE}px)`,
                transform: bilan ? 'scale(1)' : 'scale(1.18)',
                transition: 'filter 0.6s ease, transform 0.6s ease',
                display: 'block', width: '100%', height: '100%', objectFit: 'cover',
              }}
            />
          )}
        </div>
        <div style={{ marginTop: 'var(--e2)' }}>
          {/* Une fois le nom affiché en clair, l'étiquette ne dit plus rien
              qu'on ne lise déjà : elle disparaît. */}
          {!bilan && (
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
              Artiste mystère
            </div>
          )}
          {/* Le cendre ne porte jamais d'information nécessaire : une fois
              révélé, le nom passe en ivoire et en corps de lecture. */}
          {bilan && (
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 500,
              color: 'var(--ivoire)', marginTop: 4, lineHeight: 1.2,
              animation: 'artApparition 420ms 120ms ease-out both',
            }}>
              {target.nom}
            </div>
          )}
        </div>
      </div>

      {/* ---- Saisie ---- */}
      <div style={{ display: 'flex', gap: 'var(--e2)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <ArtistInput
          value={input} onChange={setInput} onSubmit={guess}
          disabled={done} exclure={guesses.map((g) => g.nom)}
        />
        <button onClick={guess} disabled={done} style={btn(true, done)}>Essayer</button>
      </div>

      {/* ---- Extrait audio : débloqué après le 6ᵉ essai raté ----
           Pas de survolOr/sortieOr ici : le survol écraserait l'or de l'état
           « en lecture » et le sortir le repasserait en ivoire. */}
      {extraitDispo && (
        <div style={{ marginTop: 'var(--e3)' }}>
          <button
            onClick={enLecture ? basculer : jouerExtrait}
            disabled={chargementExtrait}
            style={{
              ...btn(false, chargementExtrait),
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--e2)',
              borderColor: joue ? 'var(--or)' : 'var(--filet-fort)',
              color: joue ? 'var(--or)' : 'var(--ivoire)',
            }}
            aria-label={chargementExtrait ? 'Chargement de l\'extrait'
              : joue ? 'Mettre en pause l\'extrait'
                : enPause ? 'Reprendre la lecture de l\'extrait'
                  : 'Écouter un extrait de l\'artiste'}
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
            {libelleExtrait}
          </button>
        </div>
      )}

      {/* ---- Grille des tentatives ---- */}
      {guesses.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr',
          gap: 6, marginTop: 'var(--e5)', perspective: '600px', textAlign: 'left',
        }}>
          {['Artiste', 'Genre', 'Pays', 'Débuts', 'Format', 'Sexe', 'Streams'].map((h) => (
            <div key={h} className="etiquette-mono" style={{ color: 'var(--cendre)', textAlign: 'center', fontSize: 9.5 }}>{h}</div>
          ))}
          {guesses.map((g, rowIdx) => {
            const animate = rowIdx === animatingRow;
            const arrowDebut = g.debut === target.debut ? '' : target.debut > g.debut ? ' ▲' : ' ▼';
            const arrowStreams = g.streams === target.streams ? '' : target.streams > g.streams ? ' ▲' : ' ▼';
            return (
              <RowFragment key={g.nom}>
                {cell(g.nom, g.nom === target.nom, 0, animate)}
                {cell(g.genre, g.genre === target.genre, 1, animate)}
                {cell(g.pays, g.pays === target.pays, 2, animate)}
                {cell(g.debut + 's', g.debut === target.debut, 3, animate, arrowDebut)}
                {cell(g.type, g.type === target.type, 4, animate)}
                {cell(g.sexe, g.sexe === target.sexe, 5, animate)}
                {cell('~' + g.streams + ' Mds', g.streams === target.streams, 6, animate, arrowStreams)}
              </RowFragment>
            );
          })}
        </div>
      )}

      <p style={statusStyle}>{status}</p>

      {/* ---- Bilan : posé seulement quand le voile s'est levé ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'artApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            {score > 0
              ? <>Trouvé en {guesses.length} essai{guesses.length > 1 ? 's' : ''} sur {MAX_TRIES} — <span style={{ color: 'var(--or)' }}>{target.nom}</span></>
              : <>Non trouvé en {MAX_TRIES} essais — c'était <span style={{ color: 'var(--or)' }}>{target.nom}</span></>}
          </p>

          {/* Une seule tentative en quotidien : pas de relance là-bas. */}
          {!daily && (
            <button
              onClick={relancer}
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
              Nouvel artiste
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RowFragment({ children }) {
  return <>{children}</>;
}

/* ================= 2 · POCHETTE FLOUTÉE ================= */
const POCH_TRIES = 7;
/* Flou après 0, 1, 2… erreurs. Les pas sont larges au début et se resserrent
   ensuite : le flou perçu n'est pas linéaire, passer de 34 à 28 se remarque
   bien plus que de 13 à 10. La dernière valeur reste volontairement haute —
   au septième essai on distingue des formes et des couleurs, pas un titre,
   sinon l'épreuve se gagne à l'usure sans jamais rien reconnaître. */
const BLURS = [34, 28, 23, 19, 16, 13, 10];
const POINTS = [10, 8.5, 7, 5.5, 4, 2.5, 1];
const POCH_EXTRAIT_SEC = 10;

/* Mise en page de la colonne de réponses.
   La gouttière n'est pas choisie : elle est CALCULÉE pour que les sept jetons
   et leur compteur finissent exactement au bas de la pochette. Changer la
   taille des jetons ou de la pochette la réajuste toute seule.
   · POCH_COUVERTURE — côté de la pochette, en px
   · POCH_JETON_H    — hauteur d'un jeton
   · POCH_JETON_TXT  — corps du texte d'un jeton
   · POCH_ENTETE_H   — hauteur du compteur « 3/7 » au-dessus de la colonne */
const POCH_COUVERTURE = 260;
const POCH_JETON_H = 30;
const POCH_JETON_TXT = 12.5;
const POCH_ENTETE_H = 16;
const POCH_JETON_GAP =
  (POCH_COUVERTURE - POCH_ENTETE_H - POCH_TRIES * POCH_JETON_H) / (POCH_TRIES - 1);

export function JeuPochette({ onDone, daily = false }) {
  // Manche 0 : la pochette du jour, tirée par la graine — identique pour tous.
  // Manches suivantes (bouton « Nouvelle pochette ») : tirage libre.
  const [manche, setManche] = useState(0);
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('pochette'));

  const [track, setTrack] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState([]);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement de la pochette du jour…');
  const [score, setScore] = useState(null);

  // Contour carmin du champ pendant quelques centaines de ms après une erreur.
  const [erreur, setErreur] = useState(false);
  const erreurTimer = useRef(null);

  // Surcouche de résultat, posée à la fin de la partie puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas et le dévoilement de la pochette attendent que le voile
  // soit levé : deux fois le même chiffre au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);

  const [chargementExtrait, setChargementExtrait] = useState(false);
  const { jouer, arreter, basculer, enLecture, enPause } = useLecteurAudio();

  useEffect(() => { load(); }, [manche]);

  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_POCHETTE_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);
  useEffect(() => () => {
    clearTimeout(bilanTimer.current);
    clearTimeout(erreurTimer.current);
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement de la pochette du jour…');
    try {
      const rng = manche === 0 ? seeded('pochette') : Math.random;
      const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
      const tracks = await searchTracks(artist.nom, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');
      const t = tracks[Math.floor(rng() * tracks.length)];
      setTrack({ ...t, artisteNom: artist.nom });
      setStatus(`De quel artiste est cette pochette ? ${POCH_TRIES} essais.`);
    } catch (err) {
      console.error('Erreur pochette:', err);
      setLoadError(true);
      setStatus('Impossible de charger la pochette.');
    }
  }

  function signalerErreur() {
    clearTimeout(erreurTimer.current);
    setErreur(true);
    erreurTimer.current = setTimeout(() => setErreur(false), 700);
  }

  // Pose le voile, puis le bilan une fois qu'il s'est levé.
  function terminerPartie(pts, phrase) {
    setStatus(phrase);
    setDone(true);
    setResultat(pts);
    onDone(pts);
    bilanTimer.current = setTimeout(() => {
      setScore(pts);
      setBilan(true);
    }, RES_POCHETTE_TOTAL);
  }

  // Nouvelle manche sans remonter le composant : l'intro ne rejoue donc pas.
  function relancer() {
    clearTimeout(bilanTimer.current);
    arreter();
    setManche((m) => m + 1);
    setTrack(null);
    setInput('');
    setTries(0);
    setTried([]);
    setDone(false);
    setScore(null);
    setResultat(null);
    setBilan(false);
    setErreur(false);
  }

  async function jouerExtrait() {
    if (!track || chargementExtrait) return;
    setChargementExtrait(true);
    try {
      const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
      if (url) jouer(url, POCH_EXTRAIT_SEC);
    } catch (err) {
      console.error('Pochette — extrait:', err);
    } finally {
      setChargementExtrait(false);
    }
  }

  function guess() {
    if (done || !track) return;
    const g = ARTISTS.find((a) => norm(a.nom) === norm(input));
    // Le champ se vide dans TOUS les cas, y compris sur un refus : sinon le
    // nom rejeté reste sous les yeux et invite à revalider le même.
    setInput('');
    if (!g) { setStatus('Artiste absent de la base — utilise l\'autocomplétion.'); signalerErreur(); return; }
    // tried contient des objets { nom, bon } : un includes() sur le tableau
    // ne trouvait jamais rien, et les doublons passaient.
    if (tried.some((t) => t.nom === g.nom)) { setStatus(`${g.nom} a déjà été proposé.`); signalerErreur(); return; }
    if (norm(g.nom) === norm(track.artisteNom)) {
      setTried([...tried, { nom: g.nom, bon: true }]);
      terminerPartie(POINTS[tries], `🎉 Exact ! C'était ${track.artistName} — album « ${track.albumName} ».`);
    } else {
      setTried([...tried, { nom: g.nom, bon: false }]);
      signalerErreur();
      const next = tries + 1;
      setTries(next);
      if (next >= POCH_TRIES) {
        terminerPartie(0, `Perdu… c'était ${track.artistName} — « ${track.albumName} ».`);
      } else if (next === POCH_TRIES - 1) {
        setStatus(`Dernier essai — un extrait de ${POCH_EXTRAIT_SEC} secondes est débloqué.`);
      } else {
        setStatus(`Raté — le flou diminue. ${POCH_TRIES - next} essai(s) restant(s).`);
      }
    }
  }

  const blur = bilan ? 0 : BLURS[Math.min(tries, BLURS.length - 1)];
  const extraitDispo = tries >= POCH_TRIES - 1 && !done && !!track;
  const joue = enLecture && !enPause;
  const libelleExtrait = chargementExtrait ? 'Chargement…'
    : joue ? 'Pause'
      : enPause ? 'Reprendre'
        : `Écouter ${POCH_EXTRAIT_SEC} s`;

  return (
    <div style={{ ...panel, overflow: 'visible', position: 'relative' }}>
      <style>{`
        @keyframes pochApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pochJeton {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {intro && <IntroPochette exclure={track?.artisteNom} onFin={() => setIntro(false)} />}
      {resultat !== null && <ResultatPochette score={resultat} artiste={track?.artistName} />}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Pochette floutée</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Le flou diminue à chaque mauvaise réponse. Trouve l'artiste de cet album en {POCH_TRIES} essais.
      </p>

      {/* ---- Pochette centrée, réponses à sa droite ----
           Grille à trois colonnes plutôt qu'un flottant : les deux colonnes
           latérales ont la même souplesse, la pochette est donc centrée sur
           le panneau quel que soit le nombre de jetons, et la colonne de
           droite ne peut pas déborder puisqu'elle est bornée par la grille.
           Le cadre est rendu même sans pochette chargée : sinon le panneau
           n'a pas sa hauteur définitive et la surcouche d'intro s'y trouve
           rognée. */}
      <div style={{
        display: 'grid',
        // Colonnes latérales de LARGEUR ÉGALE et fixe, pas des 1fr : une
        // fraction se répartit selon la place restante, donc la colonne de
        // droite s'élargissait avec son contenu et décentrait la pochette.
        gridTemplateColumns: `minmax(0, 170px) minmax(0, ${POCH_COUVERTURE}px) minmax(0, 170px)`,
        justifyContent: 'center',
        gap: 'var(--e3)', alignItems: 'start',
        marginBottom: 'var(--e4)',
      }}>
        <div aria-hidden="true" />

        <div style={{
          width: '100%', aspectRatio: '1 / 1', overflow: 'hidden',
          borderRadius: 'var(--rayon-carte)',
          border: `${bilan ? '1px' : '0.5px'} solid ${bilan ? 'var(--or)' : 'var(--filet)'}`,
          background: 'var(--onyx-haut)',
          transition: 'border-color var(--transition-courte)',
        }}>
          {track && (
            <img
              src={track.artworkUrl100}
              alt="Pochette mystère"
              style={{
                filter: `blur(${blur}px)`,
                transform: bilan ? 'scale(1)' : 'scale(1.15)',
                transition: 'filter 0.5s ease, transform 0.5s ease',
                display: 'block', width: '100%', height: '100%', objectFit: 'cover',
              }}
            />
          )}
        </div>

        {/* Colonne des tentatives : chaque jeton entre par la gauche */}
        {/* alignItems: flex-start → chaque jeton fait la largeur de son nom,
            au lieu de s'étirer sur toute la colonne. */}
        <div style={{
          textAlign: 'left', display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', gap: POCH_JETON_GAP, minWidth: 0,
        }}>
          {tried.length > 0 && (
            <div className="etiquette-mono" style={{
              color: 'var(--cendre)', height: POCH_ENTETE_H, lineHeight: `${POCH_ENTETE_H}px`,
            }}>
              {tried.length}/{POCH_TRIES}
            </div>
          )}
          {tried.map((t, i) => (
            <div key={`${t.nom}-${i}`} style={{
              fontFamily: 'var(--sans)', fontSize: POCH_JETON_TXT,
              height: POCH_JETON_H, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center',
              padding: '0 11px', maxWidth: '100%',
              borderRadius: 'var(--rayon-controle)',
              background: 'var(--onyx-haut)',
              color: t.bon ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)',
              border: `0.5px solid ${t.bon ? 'var(--jade)' : 'rgba(226, 75, 74, 0.3)'}`,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              animation: 'pochJeton 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
            }}>
              {t.nom}
            </div>
          ))}
        </div>
      </div>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <ArtistInput
            value={input} onChange={setInput} onSubmit={guess}
            disabled={done || !track} erreur={erreur}
            exclure={tried.map((t) => t.nom)}
          />
          <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Essayer</button>
        </div>
      )}

      {/* ---- Extrait audio : débloqué au dernier essai ----
           Pas de survolOr/sortieOr : le survol écraserait l'or de l'état
           « en lecture » et le sortir le repasserait en ivoire. */}
      {extraitDispo && (
        <div style={{ marginTop: 'var(--e3)', textAlign: 'center' }}>
          <button
            onClick={enLecture ? basculer : jouerExtrait}
            disabled={chargementExtrait}
            style={{
              ...btn(false, chargementExtrait),
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--e2)',
              borderColor: joue ? 'var(--or)' : 'var(--filet-fort)',
              color: joue ? 'var(--or)' : 'var(--ivoire)',
            }}
            aria-label={chargementExtrait ? 'Chargement de l\'extrait'
              : joue ? 'Mettre en pause l\'extrait'
                : enPause ? 'Reprendre la lecture de l\'extrait'
                  : 'Écouter un extrait de l\'album'}
          >
            {joue ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                <rect x="0" y="0" width="3" height="12" />
                <rect x="7" y="0" width="3" height="12" />
              </svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                <path d="M0 0v12l10-6z" />
              </svg>
            )}
            {libelleExtrait}
          </button>
        </div>
      )}

      <p style={{ ...statusStyle, textAlign: 'center' }}>{status}</p>

      {/* ---- Bilan : posé seulement quand le voile s'est levé ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'pochApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            {score > 0
              ? <>Trouvé en {tried.length} essai{tried.length > 1 ? 's' : ''} sur {POCH_TRIES} — <span style={{ color: 'var(--or)' }}>{track?.artistName}</span>, « {track?.albumName} »</>
              : <>Non trouvé en {POCH_TRIES} essais — c'était <span style={{ color: 'var(--or)' }}>{track?.artistName}</span>, « {track?.albumName} »</>}
          </p>

          {/* Une seule tentative en quotidien : pas de relance là-bas. */}
          {!daily && (
            <button
              onClick={relancer}
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
              Nouvelle pochette
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= 3 · TROUVE LE BPM ================= */
const BPM_MIN = 60, BPM_MAX = 180;

export function JeuBPM({ onDone }) {
  const [track, setTrack] = useState(null);
  const [realBpm, setRealBpm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState(110);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const { jouer, arreter } = useLecteurAudio();

  useEffect(() => {
    import('tone').then(setTone);
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du morceau du jour…');
    try {
      const rng = seeded('bpm');
      // Essaie jusqu'à 5 artistes différents (certains n'ont aucun BPM chez Deezer)
      const artistStart = Math.floor(rng() * ARTISTS.length);
      let found = null;

      for (let a = 0; a < 5 && !found; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const d = await trackDetails(t.trackId);
          if (d.bpm && d.bpm > 0) { found = { ...t, bpm: Math.round(d.bpm) }; break; }
        }
      }

      if (!found) throw new Error('Aucun BPM trouvé après plusieurs artistes');

      setTrack(found);
      setRealBpm(found.bpm);
      setStatus('Écoute l\'extrait (7 s), règle le curseur, puis valide.');
    } catch (err) {
      console.error('Erreur BPM:', err);
      setLoadError(true);
      setStatus('Impossible de charger un morceau avec BPM.');
    }
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 7);
  }

  async function testMetro() {
    if (!tone) return;
    await tone.start();
    const synth = new tone.MembraneSynth({
      pitchDecay: 0.005, octaves: 3,
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    }).toDestination();
    synth.volume.value = 6;
    const t0 = tone.now() + 0.15;
    const spb = 60 / guess;
    for (let b = 0; b < 6; b++) {
      synth.triggerAttackRelease(b === 0 ? 'A5' : 'E5', '32n', t0 + b * spb);
    }
    setTimeout(() => synth.dispose(), (6 * spb + 1) * 1000);
  }

  function validate() {
    if (done || realBpm === null) return;
    setDone(true);
    arreter();
    const diff = Math.abs(guess - realBpm);
    const s = Math.round(Math.max(0, diff <= 2 ? 10 : 10 - (diff - 2) * 0.4) * 10) / 10;
    setScore(s);
    onDone(s);
    setStatus(diff === 0
      ? `Tempo exact. ${track.artistName} — ${track.trackName}.`
      : `${diff} BPM d'écart. ${track.artistName} — ${track.trackName}.`);
  }

  // Position d'une valeur sur la barre, en pourcentage
  const pos = (v) => ((Math.min(Math.max(v, BPM_MIN), BPM_MAX) - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
  const juste = done && Math.abs(guess - realBpm) <= 2;
  const couleurResultat = !done ? 'var(--or)' : juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.75)';

  return (
    <div style={panel}>
      <style>{`
        @keyframes reveleCible {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve le BPM</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Sept secondes d'écoute, puis règle le curseur. Le métronome est là pour comparer.
      </p>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            <button onClick={playClip} disabled={!track} style={btn(false, !track)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>Écouter l'extrait (7 s)</button>
            <button onClick={testMetro} disabled={!track} style={btn(false, !track)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>Tester mon métronome</button>
            <button onClick={validate} disabled={!track || done} style={btn(true, !track || done)}>Valider</button>
          </div>

          {/* Barre de réglage + repère de la bonne réponse après validation */}
          <div style={{ position: 'relative', marginTop: 'var(--e6)', paddingTop: done ? 'var(--e6)' : 0, transition: 'padding-top var(--transition-courte)' }}>

            {done && (
              <div style={{
                position: 'absolute', top: 0, left: `${pos(realBpm)}%`, bottom: -4,
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                animation: 'reveleCible 320ms ease-out both',
                pointerEvents: 'none', zIndex: 3,
              }}>
                <div className="etiquette-mono" style={{
                  color: 'var(--noir)', background: 'var(--jade)',
                  padding: '3px 8px', borderRadius: 'var(--rayon-controle)',
                  whiteSpace: 'nowrap', fontWeight: 500,
                }}>
                  {realBpm} bpm
                </div>
                <div style={{
                  width: 2, flex: 1, background: 'var(--jade)',
                  boxShadow: '0 0 10px var(--jade)', marginTop: 4,
                }} />
              </div>
            )}

            {/* Piste dessinée : l'apparence native de l'input est masquée en CSS */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: done ? 'calc(var(--e6) + 8px)' : 8, height: 4,
              borderRadius: 2, background: 'var(--filet)', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pos(guess)}%`, borderRadius: 2,
                background: couleurResultat,
                boxShadow: done ? `0 0 14px ${couleurResultat}` : 'none',
                transition: 'background var(--transition-courte), box-shadow var(--transition-courte)',
              }} />
            </div>

            <input
              className="curseur-nu"
              type="range" min={BPM_MIN} max={BPM_MAX} value={guess}
              onChange={(e) => setGuess(+e.target.value)}
              disabled={done}
              style={{ width: '100%', position: 'relative', zIndex: 2 }}
            />
          </div>

          <div style={{ marginTop: 'var(--e3)', fontSize: 14 }}>
            Ta proposition :{' '}
            <span style={{ fontFamily: 'var(--mono)', color: couleurResultat, transition: 'color var(--transition-courte)' }}>
              {guess} BPM
            </span>
            {done && (
              <span style={{ marginLeft: 'var(--e3)', color: juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.9)' }}>
                {guess === realBpm ? 'tempo exact'
                  : guess < realBpm ? `${realBpm - guess} BPM trop lent`
                  : `${guess - realBpm} BPM trop rapide`}
              </span>
            )}
          </div>
        </>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 4 · UNE SECONDE DE PLUS ================= */
const SEC_DURATIONS = [1, 2, 4, 7, 11, 16];
const SEC_POINTS = [10, 8, 6, 4, 2, 1];

export function JeuSeconde({ onDone }) {
  const [track, setTrack] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState([]);
  const [artistFound, setArtistFound] = useState(false);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const artistFoundAtRef = useRef(0);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du morceau du jour…');
    try {
      const rng = seeded('seconde');
      const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
      let tracks = await searchTracks(artist.nom, { limit: 25 });
      if (!tracks.length) throw new Error('Aucun résultat');
      // Ne garder que les morceaux populaires ; repli sur le top 8 de l'artiste
      const hits = tracks.filter((t) => t.rank >= 700000);
      tracks = hits.length >= 3 ? hits : [...tracks].sort((a, b) => b.rank - a.rank).slice(0, 8);
      const t = tracks[Math.floor(rng() * tracks.length)];
      setTrack(t);
      setStatus(`Devine le titre OU l'artiste. Tu entends ${SEC_DURATIONS[0]} seconde pour commencer.`);
    } catch (err) {
      console.error('Erreur seconde:', err);
      setLoadError(true);
      setStatus('Impossible de charger le morceau.');
    }
  }

  async function play() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    const dur = done ? 30 : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)];
    setPlaying(true);
    jouer(url, dur, { onFin: () => setPlaying(false) });
  }

  function finish(pts, msg) {
    setScore(pts); setDone(true); onDone(pts);
    setStatus(msg);
  }

  function fail(passed) {
    const next = tries + 1;
    setTries(next);
    if (next >= SEC_DURATIONS.length) {
      const half = artistFound ? Math.max(1, Math.round(SEC_POINTS[artistFoundAtRef.current] / 2)) : 0;
      finish(half, `Perdu… c'était « ${track.trackName} » de ${track.artistName}.${half ? ` (+${half} pts pour l'artiste)` : ''}`);
    } else {
      setStatus(`${passed ? 'Passé' : 'Raté'} — tu entends maintenant ${SEC_DURATIONS[next]} secondes. ${SEC_DURATIONS.length - next} essai(s) restant(s).`);
    }
  }

  function guess() {
    if (done || !track || !input.trim()) return;
    const g = input.trim();
    setInput('');
    setTried([...tried, g]);
    const a = normTitle(g);
    const titleOk = a === normTitle(track.trackName)
      || (a.length > 3 && normTitle(track.trackName).includes(a))
      || lev(a, normTitle(track.trackName)) <= 2;
    const artistOk = norm(g) === norm(track.artistName) || lev(norm(g), norm(track.artistName)) <= 2;

    if (titleOk) {
      finish(SEC_POINTS[tries], `🎉 Exact ! C'était « ${track.trackName} » de ${track.artistName}.`);
    } else if (artistOk && !artistFound) {
      setArtistFound(true);
      artistFoundAtRef.current = tries;
      setStatus(`👍 Artiste trouvé : ${track.artistName} ! Maintenant le titre pour le score plein — ou continue de rater, tu garderas la moitié.`);
    } else if (artistOk && artistFound) {
      setStatus('Tu as déjà trouvé l\'artiste — cherche le titre maintenant !');
    } else {
      fail(false);
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Une seconde de plus</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Devine le <strong>titre</strong> (score plein) ou l'<strong>artiste</strong> (moitié des points).
        Chaque erreur allonge l'extrait : {SEC_DURATIONS.join(' → ')} s.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SEC_DURATIONS.length}, 1fr)`, gap: 6, marginBottom: 'var(--e4)' }}>
        {SEC_DURATIONS.map((d, i) => (
          <div key={d} style={{
            height: 6, borderRadius: 3,
            background: i <= tries || done ? 'var(--or)' : 'var(--onyx-haut)',
            border: '0.5px solid var(--filet)',
            transition: 'background var(--transition-courte)',
          }} title={`${d} s`} />
        ))}
      </div>

      {artistFound && !done && (
        <p style={{ color: 'var(--jade)', fontSize: 13, marginBottom: 'var(--e3)' }}>
          Artiste trouvé : {track.artistName}
        </p>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', marginBottom: 'var(--e3)' }}>
            <button onClick={play} disabled={!track || playing} style={btn(false, !track || playing)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>
              Écouter ({done ? '30' : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)]} s)
            </button>
            <button onClick={() => fail(true)} disabled={!track || done || tries >= SEC_DURATIONS.length - 1}
              style={btn(false, !track || done || tries >= SEC_DURATIONS.length - 1)}
              onMouseEnter={survolOr} onMouseLeave={sortieOr}>
              Plus long
            </button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guess()}
              placeholder={artistFound ? 'Titre du morceau…' : 'Titre ou artiste…'}
              disabled={done || !track} style={inputStyle} />
            <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
          </div>
        </>
      )}

      {tried.length > 0 && !done && (
        <p className="description" style={{ marginTop: 'var(--e3)' }}>
          Déjà essayé : {tried.join(' · ')}
        </p>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 5 · TROUVE L'INSTRUMENT ================= */
const FAMILLES = {
  'Piano': 'Claviers', 'Orgue': 'Claviers', 'Harmonium': 'Claviers',
  'Violon': 'Cordes frottées', 'Violoncelle': 'Cordes frottées', 'Contrebasse': 'Cordes frottées',
  'Guitare acoustique': 'Cordes pincées', 'Guitare électrique': 'Cordes pincées',
  'Guitare classique': 'Cordes pincées', 'Harpe': 'Cordes pincées', 'Basse': 'Cordes pincées',
  'Flûte': 'Bois', 'Clarinette': 'Bois', 'Saxophone': 'Bois', 'Basson': 'Bois',
  'Trompette': 'Cuivres', 'Trombone': 'Cuivres', 'Tuba': 'Cuivres', 'Cor': 'Cuivres',
  'Xylophone': 'Percussions', 'Boîte à rythmes': 'Percussions',
};
const INSTRUMENTS = Object.keys(FAMILLES);

const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const SAMPLES = {
  'Piano':              { dir: 'piano',           candidates: ['C4', 'A4', 'C5', 'E4'], shift: 0 },
  'Orgue':              { dir: 'organ',           candidates: ['C4', 'A4', 'C5', 'F4'], shift: 0 },
  'Harmonium':          { dir: 'harmonium',       candidates: ['C4', 'A4', 'C5', 'D4'], shift: 0 },
  'Violon':             { dir: 'violin',          candidates: ['C4', 'A4', 'C5', 'G4', 'E4'], shift: 0 },
  'Violoncelle':        { dir: 'cello',           candidates: ['C3', 'A3', 'C4', 'E3', 'G3'], shift: -12 },
  'Contrebasse':        { dir: 'contrabass',      candidates: ['C2', 'A2', 'E2', 'G2', 'C3'], shift: -24 },
  'Guitare acoustique': { dir: 'guitar-acoustic', candidates: ['C4', 'E3', 'A3', 'G3'], shift: -12 },
  'Guitare électrique': { dir: 'guitar-electric', candidates: ['C4', 'E3', 'A3', 'D4'], shift: -12 },
  'Guitare classique':  { dir: 'guitar-nylon',    candidates: ['C4', 'E3', 'A3', 'G3'], shift: -12 },
  'Harpe':              { dir: 'harp',            candidates: ['C4', 'A4', 'C5', 'E4', 'G4'], shift: 0 },
  'Basse':              { dir: 'bass-electric',   candidates: ['E2', 'G2', 'A2', 'C2'], shift: -24 },
  'Flûte':              { dir: 'flute',           candidates: ['C4', 'C5', 'A4', 'E4'], shift: 12 },
  'Clarinette':         { dir: 'clarinet',        candidates: ['D4', 'F4', 'A4', 'D5'], shift: 0 },
  'Saxophone':          { dir: 'saxophone',       candidates: ['C4', 'A4', 'E4', 'G4', 'D4'], shift: 0 },
  'Basson':             { dir: 'bassoon',         candidates: ['C3', 'A2', 'E3', 'G2'], shift: -12 },
  'Trompette':          { dir: 'trumpet',         candidates: ['C4', 'A4', 'F4', 'G4', 'D5'], shift: 0 },
  'Trombone':           { dir: 'trombone',        candidates: ['C3', 'A2', 'F3', 'D3'], shift: -12 },
  'Tuba':               { dir: 'tuba',            candidates: ['C2', 'A2', 'F2', 'D2'], shift: -24 },
  'Cor':                { dir: 'french-horn',     candidates: ['C3', 'A2', 'F3', 'D3'], shift: -12 },
  'Xylophone':          { dir: 'xylophone',       candidates: ['C5', 'G4', 'C6', 'A4'], shift: 12 },
};

// 5 mélodies classiques (domaine public) — le timbre reste le seul mystère
const MELODIES_CLASSIQUES = [
  { nom: 'Ode à la joie (Beethoven)', notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'], gap: 0.35 },
  { nom: 'La Lettre à Élise (Beethoven)', notes: ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4'], gap: 0.3 },
  { nom: 'Petite musique de nuit (Mozart)', notes: ['G4', 'D4', 'G4', 'D4', 'G4', 'D4', 'G4', 'B4', 'D5'], gap: 0.28 },
  { nom: 'Dans l\'antre du roi de la montagne (Grieg)', notes: ['B3', 'C#4', 'D4', 'E4', 'F#4', 'D4', 'F#4'], gap: 0.32 },
  { nom: 'Frère Jacques (traditionnel)', notes: ['C4', 'D4', 'E4', 'C4', 'C4', 'D4', 'E4', 'C4'], gap: 0.35 },
];

export function JeuInstrument({ onDone }) {
  const target = useMemo(() => INSTRUMENTS[Math.floor(seeded('instrument')() * INSTRUMENTS.length)], []);
  const melodie = useMemo(() => MELODIES_CLASSIQUES[Math.floor(seeded('instrumentMelodie')() * MELODIES_CLASSIQUES.length)], []);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState(null);
  const [loadingSound, setLoadingSound] = useState(false);
  const [status, setStatus] = useState('Écoute le timbre mystère, puis choisis l\'instrument.');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const samplerRef = useRef(null);

  useEffect(() => {
    import('tone').then(setTone);
    return () => samplerRef.current?.dispose();
  }, []);

  // Ne garde que les échantillons réellement présents sur le serveur
  async function existingUrls(dir, candidates) {
    const urls = {};
    for (const note of candidates) {
      try {
        const res = await fetch(`${SAMPLE_BASE}${dir}/${note}.mp3`, { method: 'HEAD' });
        if (res.ok) urls[note] = `${note}.mp3`;
        if (Object.keys(urls).length >= 3) break;
      } catch { /* réseau : on tente le suivant */ }
    }
    if (!Object.keys(urls).length) urls[candidates[0]] = `${candidates[0]}.mp3`;
    return urls;
  }

  async function play() {
    if (!tone) return;
    await tone.start();

    // Cas particulier : la boîte à rythmes est électronique par nature → synthèse
    if (target === 'Boîte à rythmes') {
      const t0 = tone.now() + 0.15;
      const kick = new tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 2,
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination();
      const clap = new tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      clap.volume.value = -4;
      [0, 0.5, 1, 1.5].forEach((d) => kick.triggerAttackRelease('C2', '16n', t0 + d));
      [0.25, 0.75, 1.25, 1.75].forEach((d) => clap.triggerAttackRelease('16n', t0 + d));
      setTimeout(() => { kick.dispose(); clap.dispose(); }, 3500);
      return;
    }

    if (!samplerRef.current) {
      setLoadingSound(true);
      const cfg = SAMPLES[target];
      try {
        const urls = await existingUrls(cfg.dir, cfg.candidates);
        await new Promise((resolve, reject) => {
          const s = new tone.Sampler({
            urls,
            baseUrl: SAMPLE_BASE + cfg.dir + '/',
            release: 1,
            onload: () => { samplerRef.current = s; resolve(); },
            onerror: (e) => reject(e),
          }).toDestination();
        });
      } catch (e) {
        console.error('Échec chargement samples:', e);
        setLoadingSound(false);
        setStatus('Impossible de charger ce son — réessaie.');
        return;
      }
      setLoadingSound(false);
    }

    const cfg = SAMPLES[target];
    const t0 = tone.now() + 0.15;
    melodie.notes.forEach((n, i) => {
      const note = tone.Frequency(n).transpose(cfg.shift);
      samplerRef.current.triggerAttackRelease(note, '4n', t0 + i * melodie.gap);
    });
  }

  function pick(n) {
    if (done) return;
    setDone(true);
    setPicked(n);
    let s = 0, msg = 'Raté !';
    if (n === target) { s = 10; msg = '🎉 Exact !'; }
    else if (FAMILLES[n] === FAMILLES[target]) { s = 5; msg = `Presque — bonne famille (${FAMILLES[target]}) !`; }
    setScore(s);
    onDone(s);
    setStatus(`${msg} C'était : ${target}.`);
  }

  // Boutons groupés par famille pour rester lisibles
  const parFamille = INSTRUMENTS.reduce((acc, n) => {
    (acc[FAMILLES[n]] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve l'instrument</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Un instrument mystère joue « {melodie.nom} » — vrai son acoustique.
        Bonne famille mais mauvais instrument = 5 points.
      </p>

      <button onClick={play} disabled={!tone || loadingSound}
        style={{ ...btn(true, !tone || loadingSound), marginBottom: 'var(--e4)' }}>
        {loadingSound ? 'Chargement du son…' : 'Écouter le timbre'}
      </button>

      {Object.entries(parFamille).map(([fam, list]) => (
        <div key={fam} style={{ marginBottom: 'var(--e3)' }}>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e1)' }}>
            {fam}
          </div>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
            {list.map((n) => (
              <button key={n} onClick={() => pick(n)} disabled={done}
                style={{
                  ...btn(false, done),
                  padding: '8px 13px', fontSize: 13,
                  ...(done && n === target
                    ? { background: 'var(--onyx-haut)', color: 'var(--jade)', border: '1px solid var(--jade)', opacity: 1 }
                    : {}),
                  ...(done && n === picked && n !== target
                    ? { background: 'var(--onyx-haut)', color: 'rgba(226, 75, 74, 0.9)', border: '1px solid rgba(226, 75, 74, 0.6)', opacity: 1 }
                    : {}),
                }}
                onMouseEnter={(ev) => { if (!done) survolOr(ev); }}
                onMouseLeave={(ev) => { if (!done) sortieOr(ev); }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 6 · PAROLES MYSTÈRES ================= */
const PAROLES_POINTS = [10, 5, 2];
const PAROLES_LINES = 4; // nb de lignes affichées — rester court (droit de citation)

export function JeuParoles({ onDone }) {
  const [track, setTrack] = useState(null);
  const [excerpt, setExcerpt] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement des paroles du jour…');
  const [score, setScore] = useState(null);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement des paroles du jour…');
    try {
      const rng = seeded('paroles');
      const artistStart = Math.floor(rng() * ARTISTS.length);

      // Essaie jusqu'à 5 artistes (Lyrics.ovh ne couvre pas tout le monde)
      for (let a = 0; a < 5; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        let tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;
        const hits = tracks.filter((t) => t.rank >= 700000);
        tracks = hits.length >= 3 ? hits : [...tracks].sort((x, y) => y.rank - x.rank).slice(0, 8);

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const res = await fetch(`/api/lyrics?${new URLSearchParams({ artist: t.artistName, title: normTitle(t.trackName) })}`);
          if (!res.ok) continue;
          const data = await res.json();
          const ex = extractExcerpt(data.lyrics, t.trackName);
          if (ex) {
            setTrack(t);
            setExcerpt(ex);
            setStatus('De quel morceau viennent ces paroles ? 3 essais (10 → 5 → 2 pts).');
            return;
          }
        }
      }
      throw new Error('Aucune parole disponible après plusieurs artistes');
    } catch (err) {
      console.error('Erreur paroles:', err);
      setLoadError(true);
      setStatus('Impossible de charger des paroles aujourd\'hui.');
    }
  }

  // Extrait PAROLES_LINES lignes consécutives qui ne contiennent PAS le titre
  function extractExcerpt(lyrics, title) {
    if (!lyrics) return null;
    const titleWords = normTitle(title);
    const lines = lyrics.split('\n').map((l) => l.trim())
      .filter((l) => l.length > 15 && l.length < 80)
      .filter((l) => !norm(l).includes(titleWords));
    if (lines.length < PAROLES_LINES) return null;
    const start = Math.min(Math.floor(lines.length / 3), lines.length - PAROLES_LINES);
    return lines.slice(start, start + PAROLES_LINES).join('\n');
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 10);
  }

  function guess() {
    if (done || !track || !input.trim()) return;
    const g = normTitle(input);
    const b = normTitle(track.trackName);
    setInput('');
    const ok = g === b || (g.length > 3 && b.includes(g)) || lev(g, b) <= 2;
    if (ok) {
      const pts = PAROLES_POINTS[tries];
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Exact ! C'était « ${track.trackName} » de ${track.artistName}.`);
    } else if (tries >= PAROLES_POINTS.length - 1) {
      setScore(0); setDone(true); onDone(0);
      setStatus(`Perdu… c'était « ${track.trackName} » de ${track.artistName}.`);
    } else {
      const next = tries + 1;
      setTries(next);
      if (next === 1) {
        setStatus(`Raté — 2ᵉ essai (5 pts max). Indice : c'est un morceau de ${track.artistName}.`);
      } else {
        setStatus('Raté — dernier essai (2 pts max). Écoute l\'extrait pour t\'aider !');
      }
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Paroles mystères</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Retrouve le titre à partir des paroles. Essai 2 : l'artiste est donné. Essai 3 : l'extrait audio se débloque.
      </p>

      {excerpt && (
        <blockquote style={{
          borderLeft: '1px solid var(--or)', background: 'var(--onyx-haut)', borderRadius: 0,
          padding: 'var(--e3) var(--e5)', whiteSpace: 'pre-line',
          marginBottom: 'var(--e4)', color: 'var(--ivoire)',
        }}>
          « {excerpt} »
        </blockquote>
      )}

      {tries >= 1 && !done && (
        <p style={{ color: 'var(--jade)', fontSize: 13, marginBottom: 'var(--e3)' }}>
          Artiste : {track?.artistName}
        </p>
      )}

      {(tries >= 2 || done) && track && (
        <div style={{ marginBottom: 'var(--e4)' }}>
          <button onClick={playClip} style={btn(false, false)}
            onMouseEnter={survolOr} onMouseLeave={sortieOr}>
            Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
            placeholder="Titre du morceau…" disabled={done || !track} style={inputStyle} />
          <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}

/* ================= 7 · COMPLÈTE LE REFRAIN ================= */
export function JeuRefrain({ onDone }) {
  const [track, setTrack] = useState(null);
  const [context, setContext] = useState([]);
  const [answer, setAnswer] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du refrain du jour…');
  const [score, setScore] = useState(null);
  const { jouer } = useLecteurAudio();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du refrain du jour…');
    try {
      const rng = seeded('refrain');
      const artistStart = Math.floor(rng() * ARTISTS.length);

      for (let a = 0; a < 5; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 6); i++) {
          const t = tracks[(start + i) % tracks.length];
          const res = await fetch(`/api/lyrics?${new URLSearchParams({ artist: t.artistName, title: normTitle(t.trackName) })}`);
          if (!res.ok) continue;
          const data = await res.json();
          const seq = extractSequence(data.lyrics, rng);
          if (seq) {
            setTrack(t);
            setContext(seq.context);
            setAnswer(seq.answer);
            setStatus(`« ${t.trackName} » de ${t.artistName} — tape la ligne qui suit. 2 essais (10 puis 5 pts).`);
            return;
          }
        }
      }
      throw new Error('Aucune parole exploitable après plusieurs artistes');
    } catch (err) {
      console.error('Erreur refrain:', err);
      setLoadError(true);
      setStatus('Impossible de charger un refrain aujourd\'hui.');
    }
  }

  // Cherche 4 lignes consécutives valides : 3 de contexte + 1 à deviner
  function extractSequence(lyrics, rng) {
    if (!lyrics) return null;
    const lines = lyrics.split('\n').map((l) => l.trim());
    const validAt = (i) => lines[i] && lines[i].length > 10 && lines[i].length < 80;
    const candidates = [];
    for (let i = 0; i + 3 < lines.length; i++) {
      if (validAt(i) && validAt(i + 1) && validAt(i + 2) && validAt(i + 3)) {
        candidates.push(i);
      }
    }
    if (!candidates.length) return null;
    const i = candidates[Math.floor(rng() * candidates.length)];
    return { context: [lines[i], lines[i + 1], lines[i + 2]], answer: lines[i + 3] };
  }

  // Indice du 2e essai : la moitié des mots révélée
  function hint() {
    const words = answer.split(/\s+/);
    return words.map((w, i) => (i < Math.ceil(words.length / 2) ? w : '_'.repeat(Math.max(3, w.length)))).join(' ');
  }

  async function playClip() {
    if (!track) return;
    const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
    jouer(url, 10);
  }

  function guess() {
    if (done || !answer || !input.trim()) return;
    const a = norm(input);
    const b = norm(answer);
    setInput('');
    const tolerance = Math.max(2, Math.floor(b.length / 5)); // ~20% d'erreurs tolérées
    const ok = a === b || lev(a, b) <= tolerance;
    if (ok) {
      const pts = tries === 0 ? 10 : 5;
      setScore(pts); setDone(true); onDone(pts);
      setStatus(`🎉 Exact ! La ligne était : « ${answer} »`);
    } else if (tries >= 1) {
      setScore(0); setDone(true); onDone(0);
      setStatus(`Perdu… la ligne était : « ${answer} »`);
    } else {
      setTries(1);
      setStatus('Raté — dernier essai (5 pts max) : moitié des mots révélée + extrait audio débloqué.');
    }
  }

  return (
    <div style={panel}>
      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Complète le refrain</h3>
      <p className="description" style={{ marginBottom: 'var(--e4)' }}>
        Trois lignes du morceau te sont données — tape la ligne suivante. Fautes et accents tolérés.
      </p>

      {context.length > 0 && (
        <blockquote style={{
          borderLeft: '1px solid var(--or)', background: 'var(--onyx-haut)', borderRadius: 0,
          padding: 'var(--e3) var(--e5)', whiteSpace: 'pre-line',
          marginBottom: 'var(--e4)', color: 'var(--ivoire)',
        }}>
          {context.join('\n')}
          {'\n'}
          <span style={{ color: 'var(--or)' }}>{done ? answer : tries >= 1 ? hint() : '␣␣␣␣␣␣␣␣␣␣␣␣ ?'}</span>
        </blockquote>
      )}

      {(tries >= 1 || done) && track && (
        <div style={{ marginBottom: 'var(--e4)' }}>
          <button onClick={playClip} style={btn(false, false)}
            onMouseEnter={survolOr} onMouseLeave={sortieOr}>
            Écouter l'extrait (10 s)
          </button>
        </div>
      )}

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
            placeholder="La ligne suivante…" disabled={done || !answer}
            style={{ ...inputStyle, minWidth: 320 }} />
          <button onClick={guess} disabled={done || !answer} style={btn(true, done || !answer)}>Valider</button>
        </div>
      )}

      <p style={statusStyle}>{status}</p>
      <ScoreBox score={score} />
    </div>
  );
}
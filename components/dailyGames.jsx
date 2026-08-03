'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { searchTracks, trackDetails, freshPreviewUrl } from '@/utils/deezer';
import { useVolume } from '@/utils/volume';
import { useIntro } from '@/utils/intro';
import { useEpreuveVisible } from '@/components/ContexteEpreuveVisible';
import IntroArtiste, { ResultatArtiste, RES_ARTISTE_TOTAL } from './IntroArtiste';
import IntroPochette, { ResultatPochette, RES_POCHETTE_TOTAL } from './IntroPochette';
import IntroSeconde, { ResultatSeconde, RES_SECONDE_TOTAL } from './IntroSeconde';
import IntroBPM, { ResultatBPM, RES_BPM_TOTAL } from './IntroBPM';
import IntroInstrument, { ResultatInstrument, RES_INSTRUMENT_TOTAL } from './IntroInstrument';
import IntroRefrain, { ResultatRefrain, RES_REFRAIN_TOTAL } from './IntroRefrain';

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

/**
 * Date du jour au format AAAA-MM-JJ, dans le fuseau du JOUEUR.
 *
 * L'ancienne version passait par toISOString(), qui renvoie toujours de l'UTC.
 * Le décompte de la page, lui, vise minuit LOCAL : les deux se contredisaient
 * partout ailleurs qu'à Greenwich. À 00 h 16 à Paris le 3 août, il était
 * encore 22 h 16 UTC le 2, et le tirage restait celui de la veille pendant que
 * le compteur annonçait le nouveau défi.
 *
 * Découper la date locale à la main plutôt que d'utiliser toLocaleDateString :
 * ce dernier dépend de la locale installée et peut renvoyer un ordre de champs
 * différent d'une machine à l'autre. Ici la chaîne est la même partout, et
 * c'est elle qui sert de graine — elle ne peut pas varier.
 *
 * Conséquence assumée : le défi bascule à minuit dans CHAQUE fuseau. Deux
 * joueurs éloignés ne jouent donc pas la même épreuve au même instant, mais
 * ils jouent la même à la même DATE, ce qui est la promesse faite à l'écran.
 */
export function jourLocal(quand = new Date()) {
  const a = quand.getFullYear();
  const m = String(quand.getMonth() + 1).padStart(2, '0');
  const j = String(quand.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

/* Figé au chargement du module : c'est ce qui garantit qu'une même session
   tire toujours la même graine. La page surveille le passage de minuit et
   invite à recharger — voir app/quotidien/page.jsx. */
export const TODAY = jourLocal();
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
  /* Vraie hors du défi du jour, où il n'y a pas de fournisseur. Dans le défi,
     une épreuve entamée reste montée quand on en regarde une autre — sans quoi
     sa progression serait perdue et la tentative unique contournable. Il faut
     donc lui couper le son quand elle quitte l'écran. */
  const visible = useEpreuveVisible();
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
  /* Atténuation ponctuelle, indépendante du curseur global : elle permet à un
     jeu de faire de la place à un autre son — le métronome de l'épreuve BPM,
     qui doit rester audible par-dessus l'extrait. Vaut 1 partout ailleurs. */
  const attenuationRef = useRef(1);
  /* Rappel d'échec fourni par l'appelant, valable pour la lecture en cours. */
  const erreurRef = useRef(null);

  function appliquerVolume() {
    if (audioRef.current) audioRef.current.volume = volumeRef.current * attenuationRef.current;
  }

  useEffect(() => {
    volumeRef.current = Math.max(0, Math.min(1, Number(volume) || 0));
    appliquerVolume();
  }, [volume]);

  function attenuer(coef) {
    attenuationRef.current = Math.max(0, Math.min(1, Number(coef) || 0));
    appliquerVolume();
  }

  function arreter() {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    finRef.current = null;
    erreurRef.current = null;
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

  /* Et à la sortie d'écran, pour les épreuves qui restent montées derrière
     celle qu'on regarde. Le démontage ne suffit plus : il n'a plus lieu. */
  useEffect(() => {
    /* Couper une lecture en cours EST un changement d'état : la règle
       set-state-in-effect vise les cascades de rendus, pas ce cas où
       l'effet ne se déclenche qu'à la sortie d'écran. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!visible) arreter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function terminer() {
    const onFin = finRef.current;
    arreter();
    onFin?.();
  }

  /* Échec de lecture.

     Trois causes courantes, aucune n'est un bug du code : une URL d'extrait
     Deezer périmée — leur jeton a une durée de vie limitée —, une lecture
     refusée faute de geste utilisateur, ou un format non gelé par le
     navigateur. Les remonter en console.error faisait clignoter l'indicateur
     de développement de Next comme s'il s'agissait d'une panne.

     Surtout, l'état « en lecture » restait vrai : le bouton affichait Pause
     alors que rien ne jouait, et le joueur attendait un son qui ne viendrait
     pas. On coupe donc proprement et on prévient l'appelant, à lui de
     rafraîchir l'URL ou d'afficher un message. */
  function echecLecture(e) {
    if (e?.name === 'AbortError') return; // arrêt volontaire, pas un échec
    console.warn('Extrait indisponible :', e?.name ?? e);
    const signaler = erreurRef.current;
    arreter();
    signaler?.(e);
  }

  function jouer(url, secondes, { depart = 0, onFin, onErreur } = {}) {
    arreter();
    erreurRef.current = onErreur ?? null;
    const a = new Audio(url);
    a.volume = volumeRef.current * attenuationRef.current;
    audioRef.current = a;
    finRef.current = onFin ?? null;
    if (depart) a.currentTime = depart;
    a.onended = () => terminer();
    /* Deux chemins d'échec distincts : la promesse de play() couvre le refus
       de lecture, l'événement error couvre la source illisible. L'un
       n'implique pas l'autre. */
    a.onerror = () => echecLecture(new Error('source illisible'));
    a.play().catch(echecLecture);

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
    audioRef.current.volume = volumeRef.current * attenuationRef.current;
    audioRef.current.play().catch(echecLecture);
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

  return { jouer, arreter, pause, reprendre, basculer, attenuer, enLecture, enPause };
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
/**
 * `source` : mention de provenance des données, sur sa PROPRE ligne.
 *
 * Elle était collée au détail du score, dans la même phrase — « 4 bonnes
 * réponses sur 5. Données kworb.net. » Deux informations de nature
 * différente, l'une sur la partie, l'autre sur l'origine des chiffres, se
 * lisaient comme une seule. Séparée et en retrait, elle cesse de disputer
 * l'attention au résultat.
 *
 * Prop facultative : les épreuves qui n'en ont pas restent inchangées.
 */
export function ScoreBox({ score, detail, source }) {
  if (score === null || score === undefined) return null;
  const n = Number(score);
  const couleur = n >= 9.5 ? 'var(--jade)' : n < 4 ? 'var(--carmin)' : 'var(--ivoire)';
  return (
    <div style={{ marginTop: 'var(--e4)', paddingTop: 'var(--e4)', borderTop: '0.5px solid var(--filet)' }}>
      <div className="score-affiche" style={{ color: couleur }}>
        {n.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
      </div>
      {detail && <p className="description" style={{ marginTop: 'var(--e2)' }}>{detail}</p>}
      {source && (
        <p style={{ fontSize: 11, color: 'var(--cendre)', marginTop: 'var(--e2)' }}>
          {source}
        </p>
      )}
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
    /* Le conteneur se HISSE quand la liste est ouverte.

       La liste porte déjà un z-index de 100, mais un z-index ne classe que
       des frères à l'intérieur d'un même contexte d'empilement. Depuis
       l'intérieur de ce conteneur, elle ne peut pas passer devant un élément
       qui est frère du conteneur lui-même — le bouton « Essayer », par
       exemple, ou tout ce qui vient après dans le panneau.

       Élever le conteneur règle ce niveau-là. Il reste à zéro au repos : un
       élément durablement au-dessus des autres finit toujours par gêner
       quelque chose. */
    <div style={{ position: 'relative', zIndex: open ? 50 : undefined }}>
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

export function JeuArtiste({ onDone, daily = false, revelation = true }) {
  /* Le joueur a-t-il trouvé ? Détermine, en mode quotidien, s'il a le droit
     de voir la réponse.

     `revelation` vaut faux pendant le défi du jour : la correction y est
     différée au lendemain, pour qu'un joueur d'un fuseau en avance ne puisse
     pas renseigner les autres. Mais celui qui a trouvé connaît déjà le nom —
     le lui masquer ne protégerait rien et le priverait de son résultat. */
  const [trouve, setTrouve] = useState(false);

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
  /* Droit de dévoiler : hors défi toujours, dans le défi seulement si le
     joueur a trouvé. Une seule expression, utilisée partout où le nom
     apparaît — flou du portrait, étiquette, nom en clair, voile de résultat.
     Les disperser aurait garanti d'en oublier un. */
  const devoile = revelation || trouve;

  /* La réponse part avec le score : la page l'archive et la rendra demain,
     une fois le tirage clos. Sans cet envoi, elle serait perdue — le
     lendemain la graine a changé et rien ne permet de la retrouver. */
  function terminerPartie(pts, phrase) {
    setStatus(phrase);
    setResultat(pts);
    onDone(pts, target.nom);
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
      setTrouve(true);
      setStatus('…');
      setTimeout(() => {
        terminerPartie(POINTS_ARTISTE[next.length - 1], `🎉 Trouvé en ${next.length} essai(s) !`);
      }, revealMs);
    } else if (next.length >= MAX_TRIES) {
      setDone(true);
      setStatus('…');
      setTimeout(() => {
        terminerPartie(
          0,
          revelation
            ? `Perdu… c'était ${target.nom}.`
            : 'Perdu.'
        );
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

  /* ---- Une cellule d'indice ----
     Le style vit dans globals.css, sous .art-cellule. Seule l'animation
     reste ici : elle dépend du numéro de colonne, qu'une feuille ne connaît
     pas.

     Ce qui change par rapport à la version en pastilles : la cellule n'a
     plus de fond, plus de contour, plus de rayon. Un attribut trouvé se dit
     par un FILET SUPÉRIEUR accentué, comme partout ailleurs sur le site —
     c'est la grammaire de la grille des cinq épreuves et de la bande des
     dix. En jade plutôt qu'en or, parce qu'ici le filet annonce un résultat
     et non une position.

     Et l'attribut manqué ne dit plus rien. Six pastilles carmin par rangée
     faisaient un mur rouge où l'œil ne trouvait plus les rares trouvailles,
     alors que ce sont elles qu'on cherche. L'absence suffit à dire l'échec ;
     la couleur est réservée à ce qui a marché. */
  const cell = (val, ok, col, animate, arrow = '') => (
    <div
      className={
        'art-cellule'
        + (ok ? ' art-juste' : '')
        + (col === 0 ? ' art-ancre' : '')
        + (animate ? ' art-anime' : '')
      }
      /* Le retard passe par une PROPRIÉTÉ PERSONNALISÉE et non par
         animationDelay.

         Deux choses doivent partir ensemble : la valeur et le filet posé
         au-dessus d'elle. Le filet est un pseudo-élément — c'est ce qui
         permet de le TRACER de gauche à droite, ce qu'une bordure ne sait
         pas faire — et un pseudo-élément n'accepte pas de style en ligne.

         Il hérite en revanche des propriétés personnalisées de son hôte. La
         feuille peut donc lire var(--retard) pour la cellule comme pour son
         trait, et les deux se déclenchent à la même milliseconde. */
      style={animate ? { '--retard': `${col * CELL_DELAY}s` } : undefined}
    >
      <span className="art-valeur">{val}{arrow}</span>
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
        @keyframes artApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroArtiste exclure={target.nom} onFin={() => setIntro(false)} />}
      {/* Le voile de résultat nomme l'artiste : il ne le fait que si la
          révélation est permise. Le score, lui, s'affiche toujours. */}
      {resultat !== null && (
        <ResultatArtiste score={resultat} artiste={devoile ? target.nom : null} />
      )}

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
              /* Glissement interdit.

                 Le navigateur construit l'aperçu de glisser-déposer à partir
                 du BITMAP SOURCE, en ignorant les filtres CSS : il suffisait
                 de saisir l'image et de la sortir du cadre pour voir le
                 portrait net. Le flou n'existe qu'à l'affichage, l'original
                 reste intact dans le document.

                 pointerEvents: none ferme la même porte côté souris et tactile
                 — l'image est purement décorative, aucun geste n'a de sens
                 dessus. userDrag couvre les moteurs WebKit, qui ignorent
                 l'attribut draggable sur les images. */
              draggable={false}
              onDragStart={(ev) => ev.preventDefault()}
              onContextMenu={(ev) => ev.preventDefault()}
              style={{
                filter: bilan && devoile ? 'none' : `blur(${FLOU_ARTISTE}px)`,
                transform: bilan && devoile ? 'scale(1)' : 'scale(1.18)',
                transition: 'filter 0.6s ease, transform 0.6s ease',
                display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
              }}
            />
          )}
        </div>
        <div style={{ marginTop: 'var(--e2)' }}>
          {/* Une fois le nom affiché en clair, l'étiquette ne dit plus rien
              qu'on ne lise déjà : elle disparaît. */}
          {!(bilan && devoile) && (
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
              Artiste mystère
            </div>
          )}
          {/* Le cendre ne porte jamais d'information nécessaire : une fois
              révélé, le nom passe en ivoire et en corps de lecture. */}
          {bilan && devoile && (
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 500,
              color: 'var(--ivoire)', marginTop: 4, lineHeight: 1.2,
              animation: 'artApparition 420ms 120ms ease-out both',
            }}>
              {target.nom}
            </div>
          )}
          {/* Réponse tue : on dit POURQUOI, sinon le joueur croit à une
              panne. La promesse d'une correction demain est aussi ce qui le
              fait revenir. */}
          {bilan && !devoile && (
            <div className="description" style={{
              marginTop: 4, maxWidth: 280, marginInline: 'auto',
              animation: 'artApparition 420ms 120ms ease-out both',
            }}>
              Réponse donnée demain, avec le prochain défi.
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
              /* justifyContent center dès qu'un bouton peut être étiré :
                 sans elle, un inline-flex laisse son icône et son texte au
                 début de la ligne. Sans effet tant qu'il prend la largeur de
                 son contenu, indispensable dès qu'il ne la prend plus. */
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
        <div className="artiste-grille" style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 0.9fr 0.8fr 0.9fr',
          /* Gouttière NULLE : les filets supérieurs des cellules se touchent
             et forment une ligne continue par rangée. Avec six pixels
             d'écart, ils redevenaient sept tirets séparés — le contraire d'un
             tableau. La respiration vient du rembourrage des cellules.

             Plus de perspective : elle ne servait qu'au basculement en trois
             dimensions de l'ancienne révélation. */
          /* Plus de textAlign left ici : chaque cellule décide de son
             alignement, et elles sont toutes centrées sous leur en-tête. */
          gap: 0, marginTop: 'var(--e5)',
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
          {/* Le décompte des essais est toujours dit ; le NOM ne l'est que si
              la révélation est permise. Ces deux informations vivaient dans la
              même phrase, ce qui avait suffi à faire fuir la réponse malgré
              tout le reste du masquage. */}
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            {score > 0
              ? <>Trouvé en {guesses.length} essai{guesses.length > 1 ? 's' : ''} sur {MAX_TRIES}{devoile && <> — <span style={{ color: 'var(--or)' }}>{target.nom}</span></>}</>
              : <>Non trouvé en {MAX_TRIES} essais{devoile
                  ? <> — c&apos;était <span style={{ color: 'var(--or)' }}>{target.nom}</span></>
                  : <> — réponse donnée demain, avec le prochain défi</>}</>}
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
/* Tolérance du tempo : en deçà, la note est maximale.

   La valeur vivait en double — dans le calcul du score et dans la couleur du
   verdict. Le message de fin en dépend maintenant lui aussi ; à trois copies,
   la désynchronisation n'était plus qu'une question de temps. */
const BPM_TOLERANCE = 2;

const POCH_TRIES = 7;

/* Tirages tentés avant d'abandonner. Un artiste dont Deezer ne renvoie aucune
   correspondance exacte est simplement écarté au profit du suivant. */
const POCH_TIRAGES_MAX = 6;
/* Flou après 0, 1, 2… erreurs. Les pas sont larges au début et se resserrent
   ensuite : le flou perçu n'est pas linéaire, passer de 34 à 28 se remarque
   bien plus que de 13 à 10. La dernière valeur reste volontairement haute —
   au septième essai on distingue des formes et des couleurs, pas un titre,
   sinon l'épreuve se gagne à l'usure sans jamais rien reconnaître. */
/* Échelle de flou GÉOMÉTRIQUE, et non arithmétique.

   L'ancienne — 34, 28, 23, 19, 16, 13, 10 — retirait environ cinq pixels par
   essai. Or le détail perçu varie comme l'INVERSE du rayon : à 34 pixels, en
   retirer cinq ne se voit pas ; à 10, cela change tout. Les trois premiers
   essais paraissaient donc identiques, et le joueur ne voyait pas que le flou
   diminuait — alors que c'est la récompense de chaque tentative ratée.

   Ici chaque palier vaut environ 67 % du précédent. Le rapport étant
   constant, chaque essai découvre autant que le précédent, du premier au
   dernier.

   Le dernier palier descend à 3,2 pixels contre 10 : à dix pixels sur une
   pochette de deux cent trente, on ne distinguait toujours rien, et le
   septième essai n'apportait aucune aide. Une décimale est conservée — CSS
   l'accepte, et arrondir à l'entier romprait la régularité en bas d'échelle,
   là où elle se voit le plus. */
const BLURS = [34, 24.6, 17.8, 12.9, 9.3, 6.7, 4.9];
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

export function JeuPochette({ onDone, daily = false, revelation = true }) {
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
  /* Trouvé ? Conditionne le droit de voir la réponse pendant le défi : celui
     qui a trouvé la connaît déjà, la lui masquer ne protégerait rien. */
  const [trouve, setTrouve] = useState(false);

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

      /* La recherche Deezer est APPROXIMATIVE : interroger un artiste renvoie
         aussi les morceaux où il est invité, les reprises et les
         compilations. Le code prenait un résultat au hasard et l'étiquetait
         d'autorité avec l'artiste CHERCHÉ, sans vérifier à qui il appartient.

         D'où deux défauts qui n'en faisaient qu'un. La pochette affichée était
         celle du véritable propriétaire du morceau — parfois un artiste absent
         de la liste, donc impossible à proposer. Et quand ce propriétaire
         figurait bien dans la liste, le joueur qui le reconnaissait et le
         sélectionnait était compté faux, puisque la réponse attendue restait
         l'artiste de la requête.

         On ne retient donc que les morceaux dont l'artiste RÉEL correspond, et
         `artisteNom` devient une vérité vérifiée plutôt qu'une étiquette.

         La boucle est bornée : un artiste dont Deezer ne renvoie aucune
         correspondance exacte ferait sinon tourner le chargement sans fin. */
      let artist = null;
      let t = null;
      for (let essai = 0; essai < POCH_TIRAGES_MAX && !t; essai += 1) {
        artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
        const tracks = (await searchTracks(artist.nom, { limit: 25 }))
          .filter((x) => norm(x.artistName) === norm(artist.nom))
          .filter((x) => x.artworkUrl100);
        if (tracks.length) t = tracks[Math.floor(rng() * tracks.length)];
      }
      if (!t) throw new Error('Aucune pochette exploitable');

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
  /* La réponse part avec le score : la page l'archive et la rendra demain,
     une fois le tirage clos. Sans cet envoi elle serait perdue — le lendemain
     la graine a changé et rien ne permet de la retrouver.

     Elle est envoyée même quand le joueur a échoué : c'est justement à lui
     qu'elle servira. */
  function terminerPartie(pts, phrase) {
    setStatus(phrase);
    setDone(true);
    setResultat(pts);
    onDone(pts, track ? `${track.artistName} — ${track.albumName}` : undefined);
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

  /* Droit de dévoiler : hors défi toujours, dans le défi seulement si le
     joueur a trouvé. Une seule expression pour le flou, le cadre et le nom —
     les disperser aurait garanti d'en oublier un. */
  const devoile = revelation || trouve;

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
      setTrouve(true);
      terminerPartie(POINTS[tries], `🎉 Exact ! C'était ${track.artistName} — album « ${track.albumName} ».`);
    } else {
      setTried([...tried, { nom: g.nom, bon: false }]);
      signalerErreur();
      const next = tries + 1;
      setTries(next);
      if (next >= POCH_TRIES) {
        terminerPartie(
          0,
          revelation
            ? `Perdu… c'était ${track.artistName} — « ${track.albumName} ».`
            : 'Perdu.'
        );
      } else if (next === POCH_TRIES - 1) {
        setStatus(`Dernier essai — un extrait de ${POCH_EXTRAIT_SEC} secondes est débloqué.`);
      } else {
        setStatus(`Raté — le flou diminue. ${POCH_TRIES - next} essai(s) restant(s).`);
      }
    }
  }

  /* Le flou ne tombe qu'avec le droit de voir : sur une pochette, l'image
     EST la réponse, la dé-flouter reviendrait à la donner en clair. */
  const blur = bilan && devoile ? 0 : BLURS[Math.min(tries, BLURS.length - 1)];
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
      {/* Le voile de résultat nomme l'artiste : il ne le fait que si la
          révélation est permise. Le score, lui, s'affiche toujours. */}
      {resultat !== null && (
        <ResultatPochette score={resultat} artiste={devoile ? track?.artistName : null} />
      )}

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
      <div className="poch-scene" style={{
        display: 'grid',
        // Colonnes latérales de LARGEUR ÉGALE et fixe, pas des 1fr : une
        // fraction se répartit selon la place restante, donc la colonne de
        // droite s'élargissait avec son contenu et décentrait la pochette.
        gridTemplateColumns: `minmax(0, 170px) minmax(0, ${POCH_COUVERTURE}px) minmax(0, 170px)`,
        justifyContent: 'center',
        gap: 'var(--e3)', alignItems: 'start',
        marginBottom: 'var(--e4)',
      }}>
        <div className="poch-vide" aria-hidden="true" />

        <div className="poch-cadre" style={{
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
              /* Même verrou que sur le portrait de l'épreuve Artiste : l'aperçu
                 de glissement montrerait la pochette nette, le filtre CSS
                 n'étant appliqué qu'au rendu. */
              draggable={false}
              onDragStart={(ev) => ev.preventDefault()}
              onContextMenu={(ev) => ev.preventDefault()}
              style={{
                filter: `blur(${blur}px)`,
                transform: bilan && devoile ? 'scale(1)' : 'scale(1.15)',
                transition: 'filter 0.5s ease, transform 0.5s ease',
                display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
              }}
            />
          )}
        </div>

        {/* Colonne des tentatives : chaque jeton entre par la gauche */}
        {/* alignItems: flex-start → chaque jeton fait la largeur de son nom,
            au lieu de s'étirer sur toute la colonne. */}
        <div className="poch-essais" style={{
          textAlign: 'left', display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', gap: POCH_JETON_GAP, minWidth: 0,
        }}>
          {tried.length > 0 && (
            <div className="etiquette-mono poch-compteur" style={{
              color: 'var(--cendre)', height: POCH_ENTETE_H, lineHeight: `${POCH_ENTETE_H}px`,
            }}>
              {tried.length}/{POCH_TRIES}
            </div>
          )}
          {tried.map((t, i) => (
            <div key={`${t.nom}-${i}`} className="poch-jeton" style={{
              fontFamily: 'var(--sans)', fontSize: POCH_JETON_TXT,
              height: POCH_JETON_H, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center',
              padding: '0 11px', maxWidth: '100%',
              borderRadius: 'var(--rayon-controle)',
              color: t.bon ? 'var(--jade)' : 'var(--carmin)',
              border: `0.5px solid ${t.bon ? 'var(--jade)' : 'rgba(168, 83, 81, 0.45)'}`,
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
        <div className="poch-actions" style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center' }}>
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
              /* justifyContent center dès qu'un bouton peut être étiré :
                 sans elle, un inline-flex laisse son icône et son texte au
                 début de la ligne. Sans effet tant qu'il prend la largeur de
                 son contenu, indispensable dès qu'il ne la prend plus. */
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
          {/* Même précaution que pour Artiste : le décompte reste, le nom et
              l'album ne sortent que si la révélation est permise. */}
          <p className="description" style={{ marginTop: 'var(--e2)' }}>
            {score > 0
              ? <>Trouvé en {tried.length} essai{tried.length > 1 ? 's' : ''} sur {POCH_TRIES}{devoile && <> — <span style={{ color: 'var(--or)' }}>{track?.artistName}</span>, « {track?.albumName} »</>}</>
              : <>Non trouvé en {POCH_TRIES} essais{devoile
                  ? <> — c&apos;était <span style={{ color: 'var(--or)' }}>{track?.artistName}</span>, « {track?.albumName} »</>
                  : <> — réponse donnée demain, avec le prochain défi</>}</>}
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
const BPM_EXTRAIT_SEC = 15;
/* Le métronome tourne en boucle jusqu'à nouveau clic, et se programme UN
   BATTEMENT À LA FOIS. Par tranches de huit, bouger le curseur ne changeait
   rien avant la tranche suivante — jusqu'à quatre secondes d'attente. Chaque
   battement relit le tempo courant : le réglage s'entend au coup d'après. */
const BPM_AVANCE = 0.06;    // secondes de marge pour programmer le battement suivant

export function JeuBPM({ onDone, daily = false, revelation = true }) {
  /* Score CONTINU : pas de notion de « trouvé ».

     On obtient 6,6 sur 10 en tombant à huit battements près. Il n'existe donc
     aucun seuil au-delà duquel le joueur « connaîtrait déjà la réponse » et
     pourrait la voir sans risque : dévoiler le tempo réel, même à quelqu'un
     qui a bien joué, le met en mesure de le donner à un joueur d'un fuseau en
     retard. La règle est donc plus stricte que pour les épreuves à réponse
     unique — pendant le défi, jamais de révélation.

     Le morceau est logé à la même enseigne : le nommer permet d'aller
     chercher son tempo ailleurs en dix secondes. */
  const devoile = revelation;
  // Manche 0 : le morceau du jour, tiré par la graine — identique pour tous.
  const [manche, setManche] = useState(0);
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('tempo'));
  // Surcouche de résultat, posée à la validation puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas attend que le voile soit levé : deux fois le même chiffre
  // au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);

  const [track, setTrack] = useState(null);
  const [realBpm, setRealBpm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [guess, setGuess] = useState(110);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const [metroActif, setMetroActif] = useState(false);
  const [chargementAudio, setChargementAudio] = useState(false);
  const metroTimer = useRef(null);
  const clickRef = useRef(null);     // voix unique du métronome
  const filtreRef = useRef(null);    // passe-bande qui le resserre
  const limiteurRef = useRef(null);  // garde-fou contre l'écrêtage
  const metroActifRef = useRef(false);
  const guessRef = useRef(110);
  const dernierBeatRef = useRef(0);   // date du dernier battement joué
  const indexBeatRef = useRef(0);
  const volume = useVolume();
  const { jouer, arreter, basculer, attenuer, enLecture, enPause } = useLecteurAudio();

  /* Voix du métronome : toujours un MembraneSynth — donc une percussion, dans
     la famille de l'épreuve Rythme — mais adouci pour qu'on puisse le laisser
     tourner sous l'extrait sans fatigue.

     C'est exactement la frappe de l'épreuve Rythme : un NoiseSynth en bruit
     blanc, mêmes réglages d'enveloppe. Le joueur qui a réglé son oreille sur
     cette épreuve retrouve le même repère ici — c'est tout l'intérêt de ne pas
     inventer un troisième timbre.

     Trois réglages, parce qu'ici le métronome peut tourner en continu alors
     que dans le Rythme il ne dure qu'une mesure :

     · bruit ROSE plutôt que blanc — même famille, mais son énergie décroît
       avec la fréquence au lieu d'être plate, ce qui retire le sifflement
       aigu qui fatigue à la longue ;
     · déclin court (60 ms) et PASSE-BANDE plutôt que passe-bas : ne garder
       qu'une tranche autour de 1,6 kHz transforme le « chhh » en tic net.
       Un passe-bas laissait tout le grave passer, d'où un son sale ;
     · LIMITEUR en sortie. C'était la vraie cause du grain : pousser le gain
       de +9 dB sur un bruit à large bande écrêtait les crêtes, et un
       écrêtage numérique s'entend comme de la distorsion granuleuse. Le
       limiteur tient le niveau sans jamais dépasser, donc on peut viser fort
       proprement.

     Une seule voix, sans temps fort : ici on ne cherche pas le début de la
     mesure, seulement la vitesse. */
  useEffect(() => {
    let annule = false;
    import('tone').then((T) => {
      if (annule) return;
      setTone(T);
      // Limiteur au ras du maximum : il ne sert plus qu'à empêcher
      // l'écrêtage, tout le niveau utile passe.
      const limiteur = new T.Limiter(-0.5).toDestination();
      // Passe-bande élargi : un Q de 1,1 ne laissait qu'une tranche étroite
      // du spectre, ce qui bridait le niveau perçu. Plus ouvert, la frappe
      // porte davantage à réglage égal, sans redevenir stridente.
      const adoucisseur = new T.Filter({
        type: 'bandpass', frequency: 1800, rolloff: -12, Q: 0.6,
      }).connect(limiteur);
      clickRef.current = new T.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
      }).connect(adoucisseur);
      filtreRef.current = adoucisseur;
      limiteurRef.current = limiteur;
    });
    return () => {
      annule = true;
      metroActifRef.current = false;
      clearTimeout(metroTimer.current);
      try { clickRef.current?.dispose(); filtreRef.current?.dispose(); limiteurRef.current?.dispose(); } catch {}
    };
  }, []);

  // Le curseur de volume agit sur le synthé DÉJÀ créé, pas seulement sur les
  // suivants : sans cet effet, le réglage resterait sans effet en cours de
  // lecture.
  function appliquerGainMetro(actif = true) {
    if (!tone || !clickRef.current) return;
    clickRef.current.volume.value = actif && volume > 0
      ? 20 + tone.gainToDb(volume)
      : -Infinity;
  }

  useEffect(() => {
    appliquerGainMetro(metroActifRef.current);
  }, [tone, volume]);

  /* Déplacer le curseur pendant que le métronome tourne doit s'entendre tout
     de suite. Relire le tempo au battement suivant suffisait en théorie, mais
     à 60 BPM cela laissait jusqu'à une seconde d'attente : on croyait devoir
     relâcher la souris. On replanifie donc le prochain battement à partir du
     dernier joué, avec le nouvel intervalle. */
  useEffect(() => {
    guessRef.current = guess;
    if (!metroActifRef.current || !tone) return;
    clearTimeout(metroTimer.current);
    const spb = 60 / guess;
    // On repart du dernier battement pour ne pas casser la pulsation ; si ce
    // point est déjà passé, on prend le prochain instant utile.
    const suivant = Math.max(dernierBeatRef.current + spb, tone.now() + 0.04);
    metroTimer.current = setTimeout(
      () => programmerBattement(suivant, indexBeatRef.current + 1),
      Math.max(0, (suivant - tone.now() - BPM_AVANCE) * 1000)
    );
  }, [guess, tone]);
  useEffect(() => { load(); }, [manche]);
  useEffect(() => () => {
    clearTimeout(metroTimer.current);
    clearTimeout(bilanTimer.current);
  }, []);

  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_BPM_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  async function load() {
    setLoadError(false);
    setStatus('Chargement du morceau…');
    try {
      const rng = manche === 0 ? seeded('bpm') : Math.random;
      // Essaie jusqu'à 5 artistes différents (certains n'ont aucun BPM chez Deezer)
      const artistStart = Math.floor(rng() * ARTISTS.length);
      let found = null;

      for (let a = 0; a < 8 && !found; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        for (let i = 0; i < Math.min(tracks.length, 10); i++) {
          const t = tracks[(start + i) % tracks.length];
          const d = await trackDetails(t.trackId);
          const bpm = d.bpm ? Math.round(d.bpm) : 0;
          // Le morceau doit être ATTEIGNABLE avec le curseur, dont l'échelle
          // s'arrête à BPM_MIN et BPM_MAX. Un tempo hors bornes rendait la
          // partie injouable — le repère de la bonne réponse se collait au
          // bord et le score plafonnait sans qu'on puisse mieux faire.
          if (bpm >= BPM_MIN && bpm <= BPM_MAX) { found = { ...t, bpm }; break; }
        }
      }

      if (!found) throw new Error(`Aucun morceau entre ${BPM_MIN} et ${BPM_MAX} BPM après plusieurs artistes`);

      setTrack(found);
      setRealBpm(found.bpm);
      setStatus(`Écoute l'extrait, règle le tempo, puis valide.`);
    } catch (err) {
      console.error('Erreur BPM:', err);
      setLoadError(true);
      setStatus('Impossible de charger un morceau avec BPM.');
    }
  }

  async function playClip() {
    if (!track || chargementAudio) return;
    if (enLecture) { basculer(); return; }
    setChargementAudio(true);
    try {
      const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
      if (url) jouer(url, BPM_EXTRAIT_SEC);
    } catch (err) {
      console.error('BPM — lecture:', err);
    } finally {
      setChargementAudio(false);
    }
  }

  /* Bascule : un clic lance, un autre arrête. Le métronome ne s'interrompt
     pas tout seul — on règle un tempo en l'écoutant tourner, pas en le
     relançant toutes les huit mesures. */
  async function testMetro() {
    if (!tone || !clickRef.current) return;
    if (metroActifRef.current) { stopMetro(); return; }

    await tone.start();
    metroActifRef.current = true;
    setMetroActif(true);
    appliquerGainMetro(true);
    dernierBeatRef.current = 0;
    indexBeatRef.current = 0;
    // L'extrait recule pendant que le métronome bat : les deux occupent la
    // même bande de fréquences, monter le métronome seul ne l'aurait pas
    // rendu plus lisible.
    attenuer(0.18);
    programmerBattement(tone.now() + 0.15, 0);
  }

  function stopMetro() {
    metroActifRef.current = false;
    clearTimeout(metroTimer.current);
    setMetroActif(false);
    attenuer(1);
    /* Le minuteur n'annule que les battements PAS ENCORE programmés. Tone
       planifie le suivant jusqu'à 60 ms à l'avance, et un son déjà posé sur
       sa timeline sonnera quoi qu'il arrive : on coupe donc le gain, seul
       moyen de le faire taire. Il est rétabli au prochain démarrage. */
    appliquerGainMetro(false);
  }

  /* Programme UN battement, puis se rappelle juste avant le suivant.
     `t` est daté sur l'horloge de Tone, pas sur celle du navigateur : c'est
     ce qui garde le tempo régulier même si le fil principal est occupé. Le
     setTimeout ne sert qu'à revenir à temps pour programmer la suite. */
  function programmerBattement(t, index) {
    if (!metroActifRef.current || !tone) return;
    dernierBeatRef.current = t;
    indexBeatRef.current = index;

    // Toutes les pulsations sonnent pareil : même note, même durée. Un temps
    // fort dessinerait une mesure là où l'épreuve ne demande qu'une vitesse.
    clickRef.current?.triggerAttackRelease('16n', t);

    // Le tempo est relu ICI, à chaque battement : déplacer le curseur pendant
    // que le métronome tourne s'entend dès la pulsation suivante.
    const spb = 60 / guessRef.current;
    const suivant = t + spb;
    metroTimer.current = setTimeout(
      () => programmerBattement(suivant, index + 1),
      Math.max(20, (suivant - tone.now() - BPM_AVANCE) * 1000)
    );
  }

  function validate() {
    if (done || realBpm === null) return;
    setDone(true);
    // Couper les DEUX sources : l'extrait et le métronome. Sans stopMetro, le
    // métronome continuait de battre sous le voile de score.
    arreter();
    stopMetro();
    const diff = Math.abs(guess - realBpm);
    const s = Math.round(Math.max(0, diff <= BPM_TOLERANCE ? 10 : 10 - (diff - BPM_TOLERANCE) * 0.4) * 10) / 10;
    /* La réponse part avec le score : la page l'archive et la rendra demain.
       Le lendemain la graine a changé, rien ne permettrait de la retrouver. */
    onDone(s, track ? `${realBpm} BPM — ${track.trackName}, ${track.artistName}` : `${realBpm} BPM`);
    setResultat(s);
    bilanTimer.current = setTimeout(() => {
      setScore(s);
      setBilan(true);
    }, RES_BPM_TOTAL);
    // Rien à dire ici : l'écart s'affiche juste au-dessus en couleur, le
    // morceau et le BPM réel dans le bilan. La ligne d'état se tait plutôt
    // que de répéter l'un ou l'autre.
    setStatus('');
  }

  function relancer() {
    arreter();
    stopMetro();
    clearTimeout(bilanTimer.current);
    setResultat(null);
    setBilan(false);
    setManche((m) => m + 1);
    setTrack(null);
    setRealBpm(null);
    setGuess(110);
    setDone(false);
    setScore(null);
    setMetroActif(false);
  }

  // Position d'une valeur sur la barre, en pourcentage
  const pos = (v) => ((Math.min(Math.max(v, BPM_MIN), BPM_MAX) - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
  const juste = done && Math.abs(guess - realBpm) <= BPM_TOLERANCE;
  const couleurResultat = !done ? 'var(--or)' : juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.75)';
  /* Le disque ne prend l'or que pendant qu'il bat : au repos il reste ivoire,
     comme le disque d'écoute de « Une seconde de plus ». La barre de réglage,
     elle, garde `couleurResultat` — c'est elle qui porte le verdict. */
  const couleurDisque = done ? couleurResultat : metroActif ? 'var(--or)' : 'var(--ivoire)';
  const joue = enLecture && !enPause;

  return (
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes reveleCible {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes bpmHalo {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes bpmBattement {
          0%   { transform: scale(1);    opacity: 1; }
          22%  { transform: scale(1.07); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes bpmApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroBPM onFin={() => setIntro(false)} />}
      {resultat !== null && (
        /* Le voile nomme le morceau ET son tempo : les deux sont la réponse,
           il ne les donne donc que si la révélation est permise. Le score,
           lui, s'affiche toujours. */
        <ResultatBPM
          score={resultat}
          detail={devoile && track ? `${track.trackName} — ${track.artistName}, ${realBpm} BPM` : null}
        />
      )}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve le BPM</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto var(--e5)' }}>
        Le BPM est le nombre de battements par minute. Écoute l&apos;extrait, règle le tempo,
        et compare-le au métronome.
      </p>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          {/* ---- Le tempo choisi : élément central, et métronome d'essai ----
               Le disque bat à la vitesse réglée : c'est la définition même du
               BPM, montrée plutôt qu'écrite. */}
          <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto var(--e4)' }}>
            {/* Halo qui s'échappe pendant que le métronome tourne, repris de
                l'épreuve « Une seconde de plus » : il dit que le son sort,
                le battement du disque dit à quelle vitesse. Sa durée suit le
                tempo, donc une onde par pulsation. */}
            {metroActif && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid var(--or)', pointerEvents: 'none',
                animation: `bpmHalo ${(60 / guess).toFixed(3)}s ease-out infinite`,
              }} />
            )}
            <button
              onClick={testMetro}
              disabled={!tone || done}
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
                background: 'var(--onyx-haut)',
                border: `1px solid ${metroActif ? 'var(--or)' : 'var(--filet-fort)'}`,
                color: couleurDisque,
                cursor: !track || !tone || done ? 'default' : 'pointer',
                transition: 'border-color var(--transition-courte)',
                animation: metroActif
                  ? `bpmBattement ${(60 / guess).toFixed(3)}s ease-out infinite`
                  : 'none',
              }}
              aria-label={metroActif
                ? 'Arrêter le métronome'
                : `Écouter un métronome à ${guess} battements par minute`}
            >
              {/* Même bascule de glyphe que sur le disque d'écoute : c'est lui
                  qui dit sans ambiguïté que le métronome tourne. */}
              {metroActif ? (
                <svg width="13" height="16" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="13" height="16" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 0v12l10-6z" />
                </svg>
              )}
              <span style={{ display: 'block', lineHeight: 1 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 34, fontWeight: 500 }}>
                  {guess}
                </span>
                <span className="etiquette-mono" style={{ display: 'block', color: 'var(--cendre)', marginTop: 7 }}>
                  bpm
                </span>
              </span>
            </button>
          </div>

          <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e5)' }}>
            {done ? 'tempo validé'
              : metroActif ? 'clique pour arrêter le métronome'
                : 'clique pour entendre ce tempo'}
          </div>

          {/* ---- Réglage ---- */}
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div style={{
              position: 'relative',
              paddingTop: done ? 'var(--e6)' : 0,
              transition: 'padding-top var(--transition-courte)',
            }}>
              {/* Le repère planté sur la réglette porte le tempo réel en
                  chiffres ET sa position : deux façons de donner la réponse.
                  Il ne se pose donc que si la révélation est permise. */}
              {done && devoile && (
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
                onChange={(e) => {
                  const v = +e.target.value;
                  // Ref d'abord : le planificateur lit celle-ci, pas l'état,
                  // et un effet peut être différé par React.
                  guessRef.current = v;
                  setGuess(v);
                }}
                disabled={done}
                aria-label="Tempo proposé, en battements par minute"
                style={{ width: '100%', position: 'relative', zIndex: 2 }}
              />
            </div>

            {/* Bornes de l'échelle : sans elles, on ne sait pas ce qu'on règle. */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em',
              color: 'var(--cendre)', marginTop: 6,
            }}>
              <span>{BPM_MIN} lent</span>
              <span>{BPM_MAX} rapide</span>
            </div>
          </div>

          {/* ---- Commandes ---- */}
          <div style={{
            display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap',
            justifyContent: 'center', marginTop: 'var(--e5)',
          }}>
            <button
              onClick={playClip}
              disabled={!track || chargementAudio}
              style={{
                ...btn(false, !track || chargementAudio),
                display: 'inline-flex', alignItems: 'center', gap: 'var(--e2)',
                borderColor: joue ? 'var(--or)' : 'var(--filet-fort)',
                color: joue ? 'var(--or)' : 'var(--ivoire)',
              }}
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
              {chargementAudio ? 'Chargement…'
                : joue ? 'Pause'
                  : enPause ? 'Reprendre'
                    : `Écouter l'extrait (${BPM_EXTRAIT_SEC} s)`}
            </button>

            <button onClick={validate} disabled={!track || done} style={btn(true, !track || done)}>
              Valider
            </button>
          </div>

          {done && (
            <div style={{
              marginTop: 'var(--e3)', fontFamily: 'var(--sans)', fontSize: 13,
              color: juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.9)',
            }}>
              {/* L'écart chiffré est la réponse déguisée : le joueur connaît
                  sa propre proposition, une soustraction suffit. En défi, on
                  ne garde que le SENS de l'erreur, qui situe sans livrer. */}
              {/* Trois paliers, et non deux.

                  « Trop lent » s'affichait dès que la proposition n'était pas
                  exacte — y compris à un battement d'écart, c'est-à-dire avec
                  la note maximale et le verdict en jade. Le texte contredisait
                  alors à la fois le score et la couleur.

                  `juste` porte déjà la même condition que le barème : les deux
                  ne peuvent pas diverger. */}
              {guess === realBpm ? 'Tempo exact.'
                : juste ? 'Tempo juste, à un battement ou deux près.'
                  : devoile
                    ? (guess < realBpm ? `${realBpm - guess} BPM trop lent.` : `${guess - realBpm} BPM trop rapide.`)
                    : (guess < realBpm ? 'Trop lent.' : 'Trop rapide.')}
            </div>
          )}
        </>
      )}

      {/* La ligne d'état ne sert qu'en cours de partie : après validation,
         tout ce qu'elle pourrait dire est déjà affiché ailleurs. */}
      {!done && <p style={statusStyle}>{status}</p>}

      {/* ---- Bilan ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'bpmApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          {devoile ? (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              <span style={{ color: 'var(--ivoire)' }}>{track?.trackName}</span> — {track?.artistName},
              {' '}<span style={{ color: 'var(--or)' }}>{realBpm} BPM</span>
            </p>
          ) : (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              Réponse donnée demain, avec le prochain défi.
            </p>
          )}

          {!daily && (
            <button onClick={relancer} style={{ ...btn(true, false), marginTop: 'var(--e4)' }}>
              Nouveau morceau
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= 4 · UNE SECONDE DE PLUS ================= */

/* Comparaison tolérante aux fautes de frappe — mais proportionnée.

   Une distance de Levenshtein plafonnée à 2 quelle que soit la longueur
   acceptait n'importe quoi de court : après normalisation, « 6и6 » devient
   « 66 », et deux corrections suffisent à rejoindre un nom bref. D'où trois
   garde-fous : une longueur minimale, une tolérance qui croît avec la taille
   du mot, et un écart de longueur borné par cette même tolérance. */
function proche(saisie, cible) {
  if (!saisie || !cible) return false;
  if (saisie === cible) return true;
  if (saisie.length < 4 || cible.length < 4) return false;
  const tolerance = Math.min(2, Math.floor(Math.min(saisie.length, cible.length) / 5));
  if (tolerance === 0) return false;
  if (Math.abs(saisie.length - cible.length) > tolerance) return false;
  return lev(saisie, cible) <= tolerance;
}

/* Tirages tentés avant d'abandonner, comme à l'épreuve Pochette. */
const SEC_TIRAGES_MAX = 6;

const SEC_DURATIONS = [1, 2, 4, 7, 11, 16];
/* Plafond de saisie. Assez large pour les titres à rallonge — « Everything I
   Wanted », « We Don't Talk About Bruno », les versions « (feat. …) » — mais
   assez bas pour qu'une ligne de bruit ne puisse pas déformer la mise en page.
   80 caractères couvrent la quasi-totalité du catalogue. */
const SEC_MAX_SAISIE = 80;
const SEC_POINTS = [10, 8, 6, 4, 2, 1];

export function JeuSeconde({ onDone, daily = false, revelation = true }) {
  // Manche 0 : le morceau du jour, tiré par la graine — identique pour tous.
  // Manches suivantes (bouton « Nouveau morceau ») : tirage libre.
  const [manche, setManche] = useState(0);
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('une-seconde'));
  // Surcouche de résultat, posée à la fin de la partie puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas attend que le voile soit levé : deux fois le même chiffre
  // au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);

  const [track, setTrack] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [tried, setTried] = useState([]);          // { texte, verdict }
  const [artistFound, setArtistFound] = useState(false);
  /* Titre trouvé ? Conditionne le droit de voir la réponse pendant le défi.
     L'artiste seul ne suffit pas : c'est le TITRE qui est la réponse, et le
     joueur qui n'a que l'artiste ne l'a pas encore. */
  const [titreTrouve, setTitreTrouve] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Chargement du morceau du jour…');
  const [score, setScore] = useState(null);
  const [erreur, setErreur] = useState(false);
  const erreurTimer = useRef(null);
  const artistFoundAtRef = useRef(0);
  /* Vraie le temps qu'un nouveau morceau se charge. Sans elle, « Nouveau
     morceau » vidait l'écran d'un coup et le remplissait tout aussi sec :
     rien ne disait qu'un tirage avait eu lieu. */
  const [rechargement, setRechargement] = useState(false);
  const [chargementAudio, setChargementAudio] = useState(false);
  const { jouer, arreter, basculer, enLecture, enPause } = useLecteurAudio();

  useEffect(() => { load(); }, [manche]);
  useEffect(() => () => {
    clearTimeout(erreurTimer.current);
    clearTimeout(bilanTimer.current);
  }, []);

  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_SECONDE_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  async function load() {
    setLoadError(false);
    setRechargement(true);
    setStatus('Chargement du morceau…');
    try {
      const rng = manche === 0 ? seeded('seconde') : Math.random;

      /* La recherche Deezer est APPROXIMATIVE : interroger un artiste renvoie
         aussi les morceaux où il est invité, les reprises et les
         compilations. Rien ne vérifiait à qui appartenait le résultat retenu.

         L'effet est moins visible qu'à l'épreuve Pochette — ici la réponse
         attendue est bien l'artiste RÉEL du morceau, donc rien n'est compté
         faux à tort. Mais le tirage s'éloignait de son intention : on visait
         un titre connu d'un artiste connu, et l'on pouvait tomber sur une
         reprise obscure ou un featuring, sur lesquels le classement de
         popularité ne veut plus rien dire.

         La boucle est bornée : un artiste sans correspondance exacte est
         écarté au profit du suivant plutôt que de bloquer le chargement. */
      let t = null;
      for (let essai = 0; essai < SEC_TIRAGES_MAX && !t; essai += 1) {
        const artist = ARTISTS[Math.floor(rng() * ARTISTS.length)];
        let tracks = (await searchTracks(artist.nom, { limit: 25 }))
          .filter((x) => norm(x.artistName) === norm(artist.nom));
        if (!tracks.length) continue;
        // Ne garder que les morceaux populaires ; repli sur le top 8 de l'artiste
        const hits = tracks.filter((x) => x.rank >= 700000);
        tracks = hits.length >= 3 ? hits : [...tracks].sort((a, b) => b.rank - a.rank).slice(0, 8);
        t = tracks[Math.floor(rng() * tracks.length)];
      }
      if (!t) throw new Error('Aucun morceau exploitable');

      setTrack(t);
      setStatus(`Écoute ${SEC_DURATIONS[0]} seconde, puis propose un titre ou un artiste.`);
      // Un court battement avant de rendre la main : un tirage instantané ne
      // se voit pas, et l'écran semblerait n'avoir pas bougé. Juste de quoi
      // laisser la sortie se jouer, pas de quoi faire attendre.
      await new Promise((r) => setTimeout(r, 180));
      setRechargement(false);
    } catch (err) {
      console.error('Erreur seconde:', err);
      setLoadError(true);
      setRechargement(false);
      setStatus('Impossible de charger le morceau.');
    }
  }

  function signalerErreur() {
    clearTimeout(erreurTimer.current);
    setErreur(true);
    erreurTimer.current = setTimeout(() => setErreur(false), 700);
  }

  const dureeCourante = done ? 30 : SEC_DURATIONS[Math.min(tries, SEC_DURATIONS.length - 1)];

  async function play() {
    if (!track || chargementAudio) return;
    if (enLecture) { basculer(); return; }
    setChargementAudio(true);
    try {
      const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
      if (url) jouer(url, dureeCourante);
    } catch (err) {
      console.error('Seconde — lecture:', err);
    } finally {
      setChargementAudio(false);
    }
  }

  function finish(pts, msg) {
    arreter();
    setDone(true);
    /* La réponse part avec le score : la page l'archive et la rendra demain,
       une fois le tirage clos. Le lendemain la graine a changé, rien ne
       permettrait de la retrouver. */
    onDone(pts, track ? `${track.trackName} — ${track.artistName}` : undefined);
    setStatus(msg);
    setResultat(pts);
    bilanTimer.current = setTimeout(() => {
      setScore(pts);
      setBilan(true);
    }, RES_SECONDE_TOTAL);
  }

  /* Droit de dévoiler : hors défi toujours, dans le défi seulement si le
     titre a été trouvé. Une seule expression pour le voile de résultat et le
     bilan — les disperser aurait garanti d'en oublier un. */
  const devoile = revelation || titreTrouve;

  function relancer() {
    arreter();
    clearTimeout(bilanTimer.current);
    setResultat(null);
    setBilan(false);
    setManche((m) => m + 1);
    setTrack(null);
    setInput('');
    setTries(0);
    setTried([]);
    setArtistFound(false);
    setDone(false);
    setScore(null);
    setErreur(false);
  }

  function fail(passed) {
    const next = tries + 1;
    setTries(next);
    arreter();
    if (next >= SEC_DURATIONS.length) {
      const half = artistFound ? Math.max(1, Math.round(SEC_POINTS[artistFoundAtRef.current] / 2)) : 0;
      finish(half, revelation
        ? `Perdu — c'était « ${track.trackName} » de ${track.artistName}.`
        : 'Perdu.');
    } else {
      setStatus(`${passed ? 'Extrait allongé' : 'Raté'} — tu entends maintenant ${SEC_DURATIONS[next]} secondes.`);
    }
  }

  function guess() {
    if (done || !track || !input.trim()) return;
    const g = input.trim().slice(0, SEC_MAX_SAISIE);
    setInput('');
    const a = normTitle(g);
    const cibleTitre = normTitle(track.trackName);
    const cibleArtiste = norm(track.artistName);
    const saisieArtiste = norm(g);

    // Une saisie qui ne contient aucun caractère exploitable n'est pas une
    // proposition : elle ne consomme pas d'essai.
    if (!a && !saisieArtiste) {
      setStatus('Saisie vide — écris un titre ou un artiste.');
      signalerErreur();
      return;
    }

    const titleOk = a === cibleTitre
      || (a.length >= 4 && cibleTitre.includes(a))
      || proche(a, cibleTitre);
    const artistOk = saisieArtiste === cibleArtiste || proche(saisieArtiste, cibleArtiste);

    if (titleOk) {
      setTried([...tried, { texte: g, verdict: 'titre' }]);
      setTitreTrouve(true);
      finish(SEC_POINTS[tries], `🎉 Exact — « ${track.trackName} » de ${track.artistName}.`);
    } else if (artistOk && !artistFound) {
      setTried([...tried, { texte: g, verdict: 'artiste' }]);
      setArtistFound(true);
      artistFoundAtRef.current = tries;
      setStatus(`Artiste trouvé. Le titre vaut encore le score plein.`);
    } else if (artistOk && artistFound) {
      signalerErreur();
      setStatus('Artiste déjà trouvé — cherche le titre.');
    } else {
      setTried([...tried, { texte: g, verdict: 'faux' }]);
      signalerErreur();
      fail(false);
    }
  }

  const joue = enLecture && !enPause;
  const restants = SEC_DURATIONS.length - tries;

  return (
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes secJeton {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes secOnde {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes secApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroSeconde onFin={() => setIntro(false)} />}
      {resultat !== null && (
        <ResultatSeconde
          score={resultat}
          detail={devoile && track ? `${track.trackName} — ${track.artistName}` : null}
        />
      )}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Une seconde de plus</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto var(--e5)' }}>
        Trouve le titre pour le score plein, l&apos;artiste pour la moitié.
        Chaque erreur allonge l&apos;extrait.
      </p>

      {/* ---- Bloc de jeu ----
           Il s'efface pendant le tirage puis remonte : le mouvement dit qu'un
           nouveau morceau est arrivé, ce qu'un simple changement de contenu
           ne montrerait pas. La `key` sur la manche force le remontage, sans
           quoi React réutiliserait les mêmes nœuds et l'entrée ne se
           déclencherait pas. */}
      <div
        key={`manche-${manche}`}
        style={{
          opacity: rechargement ? 0 : 1,
          transform: rechargement ? 'translateY(6px)' : 'none',
          transition: 'opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          animation: rechargement ? 'none' : 'secApparition 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >

      {/* ---- Bouton d'écoute : le geste central de l'épreuve ---- */}
      <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto var(--e4)' }}>
        {/* Onde de lecture, en fond : elle dit que le son tourne sans rien
            ajouter à lire. */}
        {joue && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1px solid var(--or)', pointerEvents: 'none',
            animation: 'secOnde 1600ms ease-out infinite',
          }} />
        )}
        <button
          onClick={play}
          disabled={!track || chargementAudio}
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
            background: 'var(--onyx-haut)',
            border: `1px solid ${joue ? 'var(--or)' : 'var(--filet-fort)'}`,
            color: joue ? 'var(--or)' : 'var(--ivoire)',
            cursor: !track || chargementAudio ? 'default' : 'pointer',
            opacity: !track || chargementAudio ? 0.5 : 1,
            transition: 'border-color var(--transition-courte), color var(--transition-courte)',
          }}
          aria-label={joue ? 'Mettre en pause' : `Écouter ${dureeCourante} secondes`}
        >
          {joue ? (
            <svg width="16" height="19" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="3" height="12" />
              <rect x="7" y="0" width="3" height="12" />
            </svg>
          ) : (
            <svg width="16" height="19" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
              <path d="M0 0v12l10-6z" />
            </svg>
          )}
          <span style={{ display: 'block', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500 }}>
              {dureeCourante}
            </span>
            {/* L'unité vit sous le nombre, en cendre : elle se lit une fois
                puis s'oublie, alors que le chiffre change à chaque palier. */}
            <span className="etiquette-mono" style={{ display: 'block', color: 'var(--cendre)', marginTop: 7 }}>
              seconde{dureeCourante > 1 ? 's' : ''}
            </span>
          </span>
        </button>
      </div>

      {/* ---- Palier d'écoute : on voit ce qu'on a déjà dépensé et ce qu'il reste ---- */}
      <div style={{
        display: 'flex', gap: 6, justifyContent: 'center',
        marginBottom: 'var(--e3)', flexWrap: 'wrap',
      }}>
        {SEC_DURATIONS.map((d, i) => {
          const passe = i < tries || done;
          const actuel = i === tries && !done;
          return (
            <span key={d} style={{
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em',
              padding: '4px 9px', borderRadius: 'var(--rayon-controle)',
              background: actuel ? 'var(--onyx-haut)' : 'transparent',
              border: `${actuel ? '1px' : '0.5px'} solid ${actuel ? 'var(--or)' : 'var(--filet)'}`,
              color: actuel ? 'var(--or)' : passe ? 'var(--cendre)' : 'var(--lin)',
              transition: 'border-color var(--transition-courte), color var(--transition-courte)',
            }}>
              {d} s
            </span>
          );
        })}
      </div>

      <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e5)' }}>
        {done ? 'partie terminée' : `${restants} essai${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}`}
      </div>

      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guess()}
              placeholder={artistFound ? 'Titre du morceau…' : 'Titre ou artiste…'}
              disabled={done || !track}
              maxLength={SEC_MAX_SAISIE}
              style={{
                ...inputStyle,
                border: erreur ? '1px solid var(--carmin)' : inputStyle.border,
                transition: 'border-color var(--transition-courte)',
              }}
            />
            <button onClick={guess} disabled={done || !track} style={btn(true, done || !track)}>Valider</button>
          </div>

          {/* Passer coûte un palier : c'est une décision, pas une commande de
              lecture — d'où le retrait à l'écart du bouton principal. */}
          {!done && (
            <div style={{ marginTop: 'var(--e3)' }}>
              <button
                onClick={() => fail(true)}
                disabled={!track || tries >= SEC_DURATIONS.length - 1}
                onMouseEnter={survolOr} onMouseLeave={sortieOr}
                style={btn(false, !track || tries >= SEC_DURATIONS.length - 1)}
              >
                Allonger l&apos;extrait
              </button>
            </div>
          )}
        </>
      )}

      {/* ---- Propositions déjà faites ---- */}
      {tried.length > 0 && (
        <div style={{
          display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap',
          maxWidth: 460, margin: 'var(--e4) auto 0',
        }}>
          {tried.map((t, i) => {
            const teinte = t.verdict === 'faux' ? 'rgba(226, 75, 74, 0.65)' : 'var(--jade)';
            const filet = t.verdict === 'faux' ? 'rgba(226, 75, 74, 0.3)' : 'var(--jade)';
            return (
              <span key={`${t.texte}-${i}`} title={t.texte} style={{
                fontFamily: 'var(--sans)', fontSize: 12,
                padding: '4px 9px', borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                color: teinte, border: `0.5px solid ${filet}`,
                // Un jeton ne dépasse jamais sa rangée : le texte complet
                // reste accessible au survol.
                maxWidth: 220, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                animation: 'secJeton 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}>
                {t.texte}
              </span>
            );
          })}
        </div>
      )}

      </div>

      <p style={statusStyle}>{status}</p>

      {/* ---- Bilan ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'secApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          {/* Le morceau n'est nommé que si la révélation est permise. Sinon
              on dit pourquoi : sans explication, le joueur croit à une panne,
              et la promesse d'une correction demain est ce qui le fait
              revenir. */}
          {devoile ? (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              <span style={{ color: 'var(--ivoire)' }}>{track?.trackName}</span> — {track?.artistName}
            </p>
          ) : (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              Réponse donnée demain, avec le prochain défi.
            </p>
          )}

          {!daily && (
            <button
              onClick={relancer}
              disabled={rechargement}
              style={{ ...btn(true, rechargement), marginTop: 'var(--e4)' }}
            >
              {rechargement ? 'Chargement…' : 'Nouveau morceau'}
            </button>
          )}
        </div>
      )}
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

/* Échantillons dont on a VÉRIFIÉ l'existence, par répertoire d'instrument.

   Au niveau du module, donc conservé d'une manche à l'autre et d'une épreuve
   à l'autre — mais pas d'une visite à l'autre, ce qui est exactement la durée
   de vie souhaitée : assez longue pour ne sonder qu'une fois, assez courte
   pour qu'un ajout dans la banque soit pris en compte au rechargement. */
const ECHANTILLONS_CONNUS = new Map();
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

export function JeuInstrument({ onDone, daily = false, revelation = true }) {
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('instrument'));
  // Manche 0 : l'instrument du jour, tiré par la graine — identique pour tous.
  // Manches suivantes (bouton « Nouvel instrument ») : tirage libre.
  const [manche, setManche] = useState(0);
  const target = useMemo(
    () => (manche === 0
      ? INSTRUMENTS[Math.floor(seeded('instrument')() * INSTRUMENTS.length)]
      : INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)]),
    [manche]
  );
  const melodie = useMemo(
    () => (manche === 0
      ? MELODIES_CLASSIQUES[Math.floor(seeded('instrumentMelodie')() * MELODIES_CLASSIQUES.length)]
      : MELODIES_CLASSIQUES[Math.floor(Math.random() * MELODIES_CLASSIQUES.length)]),
    [manche]
  );

  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState(null);
  const [famille, setFamille] = useState(null);   // famille en cours de choix
  /* Vraie le temps du changement d'instrument. Sans elle, « Nouvel instrument »
     remplaçait le contenu d'un coup : rien ne disait qu'un tirage avait eu
     lieu, puisque l'écran de choix est le même à chaque manche. */
  const [rechargement, setRechargement] = useState(false);
  // Surcouche de résultat, posée au choix puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas attend que le voile soit levé : deux fois le même chiffre
  // au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);
  const [loadingSound, setLoadingSound] = useState(false);
  const [joue, setJoue] = useState(false);
  const [status, setStatus] = useState('Écoute l\'instrument mystère, puis retrouve-le.');
  const [score, setScore] = useState(null);
  const [tone, setTone] = useState(null);
  const samplerRef = useRef(null);
  const finTimer = useRef(null);
  const rythmeRef = useRef(null);
  const noteTimer = useRef(null);        // prochaine note de la mélodie
  const transitionTimer = useRef(null);  // changement d'instrument
  const volume = useVolume();

  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_INSTRUMENT_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  useEffect(() => {
    import('tone').then(setTone);
    return () => {
      clearTimeout(finTimer.current);
      clearTimeout(noteTimer.current);
      clearTimeout(transitionTimer.current);
      clearTimeout(bilanTimer.current);
      samplerRef.current?.dispose();
      rythmeRef.current?.forEach((v) => { try { v.dispose(); } catch {} });
    };
  }, []);

  // Un nouvel instrument demande un nouveau sampler : celui en mémoire joue
  // encore l'ancien timbre.
  useEffect(() => {
    samplerRef.current?.dispose();
    samplerRef.current = null;
  }, [target]);

  // Le curseur de volume agit sur le sampler DÉJÀ chargé : sans cet effet, il
  // n'avait aucun effet sur cette épreuve.
  function appliquerGain() {
    if (!tone || !samplerRef.current) return;
    samplerRef.current.volume.value = volume > 0 ? tone.gainToDb(volume) : -Infinity;
  }

  // Le curseur de volume agit sur le sampler DÉJÀ chargé : sans cet effet, il
  // n'aurait aucun effet sur cette épreuve.
  useEffect(() => {
    appliquerGain();
  }, [tone, volume, loadingSound]);

  /* Ne garde que les échantillons réellement présents sur le serveur.

     La banque d'échantillons ne publie pas la liste de ses fichiers : la
     seule façon de savoir si une note existe est de la demander. Les 404 qui
     s'affichent en console sont donc attendus, pas des pannes — mais ils
     avaient deux vrais défauts.

     LE SONDAGE ÉTAIT REFAIT À CHAQUE MANCHE. Le même instrument redemandait
     les mêmes fichiers absents à chaque nouvelle mélodie, indéfiniment. Le
     résultat est pourtant invariable : ce qui n'existe pas ce tour-ci
     n'existera pas au suivant. Il est désormais retenu pour la session, dans
     une table au niveau du module — donc partagée par toutes les instances
     de l'épreuve, accès libre et défi du jour compris.

     ET IL ÉTAIT SÉQUENTIEL. Cinq allers-retours l'un après l'autre avant la
     première note, là où ils ne dépendent pas les uns des autres. Ils
     partent maintenant ensemble ; la sélection des trois premiers se fait
     après, dans l'ordre des candidats — cet ordre porte une intention, les
     notes les plus centrales d'abord, et il ne doit pas dépendre de qui
     répond le plus vite. */
  async function existingUrls(dir, candidates) {
    const connu = ECHANTILLONS_CONNUS.get(dir);
    if (connu) return connu;

    const reponses = await Promise.all(
      candidates.map(async (note) => {
        try {
          const res = await fetch(`${SAMPLE_BASE}${dir}/${note}.mp3`, { method: 'HEAD' });
          return res.ok ? note : null;
        } catch { return null; }
      })
    );

    const urls = {};
    for (const note of reponses) {
      if (!note) continue;
      urls[note] = `${note}.mp3`;
      if (Object.keys(urls).length >= 3) break;
    }
    /* Aucune réponse exploitable — serveur muet, hors ligne : on tente quand
       même le premier candidat plutôt que de renoncer au son. Ce cas-là n'est
       PAS mémorisé, il tient à l'état du réseau et non à celui du dépôt. */
    if (!Object.keys(urls).length) {
      urls[candidates[0]] = `${candidates[0]}.mp3`;
      return urls;
    }

    ECHANTILLONS_CONNUS.set(dir, urls);
    return urls;
  }

  function marquerFin(secondes) {
    clearTimeout(finTimer.current);
    setJoue(true);
    finTimer.current = setTimeout(() => setJoue(false), secondes * 1000);
  }

  /* Arrêt de la mélodie en cours.

     Il suffit d'annuler le minuteur de la note suivante et de relâcher celle
     qui sonne : rien d'autre n'est programmé. C'est tout l'intérêt de poser
     les notes une par une — les couper au gain les laissait sur la timeline
     de Tone, et elles ressortaient par-dessus la mélodie suivante. */
  function stopSon() {
    clearTimeout(finTimer.current);
    clearTimeout(noteTimer.current);
    setJoue(false);
    try {
      samplerRef.current?.releaseAll?.();
      /* Fondu de 40 ms par-dessus le relâchement : la coupe est perçue comme
         immédiate, sans le clic d'une interruption brutale.

         Le gain N'EST PAS rétabli après coup. Le déclenchement d'une note est
         posé quelques millisecondes à l'avance ; si la pause tombe dans cet
         intervalle, la note attaque quand même et dure une demi-seconde.
         Rétablir le gain à 140 ms la rendait audible — c'était la note unique
         qui repartait après la pause. Le silence tient donc jusqu'au prochain
         départ, qui remet le gain lui-même. */
      samplerRef.current?.volume?.rampTo(-60, 0.04);
    } catch {}
    rythmeRef.current?.forEach((v) => { try { v.dispose(); } catch {} });
    rythmeRef.current = null;
  }

  /* Joue la note d'indice `i`, puis programme la suivante. Le déclenchement
     lui-même reste daté sur l'horloge de Tone — le minuteur ne sert qu'à
     revenir à temps, l'imprécision de setTimeout ne s'entend donc pas. */
  function jouerNote(i) {
    if (!tone || !samplerRef.current || i >= melodie.notes.length) return;
    const cfg = SAMPLES[target];
    const note = tone.Frequency(melodie.notes[i]).transpose(cfg.shift);
    samplerRef.current.triggerAttackRelease(note, '4n', tone.now() + 0.02);
    if (i + 1 < melodie.notes.length) {
      noteTimer.current = setTimeout(() => jouerNote(i + 1), melodie.gap * 1000);
    }
  }

  async function play() {
    if (!tone || loadingSound) return;
    // Bascule : un clic lance, un autre arrête.
    if (joue) { stopSon(); return; }
    await tone.start();
    // Le fondu d'un arrêt précédent laisse le gain au plancher : on annule sa
    // rampe puis on rétablit le niveau avant la première note.
    try { samplerRef.current?.volume?.cancelScheduledValues?.(tone.now()); } catch {}
    appliquerGain();

    // Cas particulier : la boîte à rythmes est électronique par nature → synthèse
    if (target === 'Boîte à rythmes') {
      const t0 = tone.now() + 0.15;
      const gain = volume > 0 ? tone.gainToDb(volume) : -Infinity;
      const kick = new tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 2,
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
      }).toDestination();
      const clap = new tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
      kick.volume.value = gain;
      clap.volume.value = volume > 0 ? -4 + tone.gainToDb(volume) : -Infinity;
      [0, 0.5, 1, 1.5].forEach((d) => kick.triggerAttackRelease('C2', '16n', t0 + d));
      [0.25, 0.75, 1.25, 1.75].forEach((d) => clap.triggerAttackRelease('16n', t0 + d));
      rythmeRef.current = [kick, clap];
      marquerFin(2.1);
      setTimeout(() => { kick.dispose(); clap.dispose(); rythmeRef.current = null; }, 3500);
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
            // Une seconde d'extinction rendait l'arrêt mou : releaseAll ne
            // fait que déclencher cette descente. Un tiers de seconde reste
            // naturel pour un instrument acoustique et coupe franchement.
            release: 0.3,
            onload: () => { samplerRef.current = s; resolve(); },
            onerror: (e) => reject(e),
          }).toDestination();
        });
        if (samplerRef.current) {
          samplerRef.current.volume.value = volume > 0 ? tone.gainToDb(volume) : -Infinity;
        }
      } catch (e) {
        console.error('Échec chargement samples:', e);
        setLoadingSound(false);
        setStatus('Impossible de charger ce son — réessaie.');
        return;
      }
      setLoadingSound(false);
    }

    jouerNote(0);
    marquerFin(melodie.notes.length * melodie.gap + 0.6);
  }

  /* Fixé au moment du choix plutôt que recalculé au rendu : `picked` suffit à
     le déduire, mais le stocker garde la décision au même endroit que le
     verdict, où la règle se lit. */
  const [devoile, setDevoile] = useState(true);

  function pick(n) {
    if (done) return;
    stopSon();
    setDone(true);
    setPicked(n);
    const exact = n === target;
    const bonneFamille = FAMILLES[n] === FAMILLES[target];

    /* Droit de dévoiler : hors défi toujours, dans le défi seulement si
       l'instrument exact a été trouvé. La bonne famille ne suffit pas — elle
       vaut la moitié des points, pas la réponse. */
    const montrer = revelation || exact;

    let s = 0;
    if (exact) s = 10;
    else if (bonneFamille) s = 5;

    let msg;
    if (exact) msg = `🎉 Exact — c'était bien ${target}.`;
    else if (montrer) {
      msg = bonneFamille
        ? `Bonne famille, mauvais instrument — c'était ${target}.`
        : `C'était ${target}.`;
    } else {
      msg = bonneFamille
        ? 'Bonne famille, mauvais instrument.'
        : 'Raté.';
    }

    setDevoile(montrer);
    /* La réponse part avec le score : la page l'archive et la rendra demain,
       une fois le tirage clos. */
    onDone(s, `${target} — famille ${FAMILLES[target].toLowerCase()}`);
    setStatus(msg);
    setResultat(s);
    bilanTimer.current = setTimeout(() => {
      setScore(s);
      setBilan(true);
    }, RES_INSTRUMENT_TOTAL);
  }

  function relancer() {
    stopSon();
    clearTimeout(bilanTimer.current);
    clearTimeout(transitionTimer.current);
    setRechargement(true);

    /* Le contenu ne change qu'une fois la sortie jouée : remplacer pendant le
       fondu ferait apparaître le nouvel écran à moitié effacé. */
    transitionTimer.current = setTimeout(() => {
      setResultat(null);
      setBilan(false);
      setManche((m) => m + 1);
      setDone(false);
      setPicked(null);
      setFamille(null);
      setScore(null);
      setJoue(false);
      setStatus('Écoute l\'instrument mystère, puis retrouve-le.');
      setRechargement(false);
    }, 200);
  }

  // Boutons groupés par famille pour rester lisibles
  const parFamille = INSTRUMENTS.reduce((acc, n) => {
    (acc[FAMILLES[n]] ??= []).push(n);
    return acc;
  }, {});

  const familleCible = FAMILLES[target];

  return (
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes instHalo {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes instApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroInstrument onFin={() => setIntro(false)} />}
      {resultat !== null && (
        /* Le voile de résultat nomme l'instrument : il ne le fait que si la
           révélation est permise. Le score, lui, s'affiche toujours. */
        <ResultatInstrument
          score={resultat}
          detail={devoile ? `${target} — groupe ${FAMILLES[target].toLowerCase()}` : null}
        />
      )}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Trouve l&apos;instrument</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto var(--e5)' }}>
        Un instrument joue une mélodie connue. Le bon groupe vaut cinq points,
        le bon instrument en vaut dix.
      </p>

      {/* ---- Corps de l'épreuve ----
           Il s'efface pendant le tirage puis remonte : le mouvement dit qu'un
           nouvel instrument est arrivé, ce qu'un simple changement de contenu
           ne montrerait pas — l'écran de choix, lui, ne bouge pas d'une manche
           à l'autre. La `key` sur la manche force le remontage, sans quoi React
           réutiliserait les mêmes nœuds et l'entrée ne se déclencherait pas. */}
      <div
        key={`manche-${manche}`}
        style={{
          opacity: rechargement ? 0 : 1,
          transform: rechargement ? 'translateY(6px)' : 'none',
          transition: 'opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          animation: rechargement ? 'none' : 'instApparition 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >

      {/* ---- Le timbre : élément central de l'épreuve ---- */}
      <div style={{ position: 'relative', width: 132, height: 132, margin: '0 auto var(--e3)' }}>
        {joue && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1px solid var(--or)', pointerEvents: 'none',
            animation: 'instHalo 1600ms ease-out infinite',
          }} />
        )}
        <button
          onClick={play}
          disabled={!tone || loadingSound}
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
            background: 'var(--onyx-haut)',
            border: `1px solid ${joue ? 'var(--or)' : 'var(--filet-fort)'}`,
            color: joue ? 'var(--or)' : 'var(--ivoire)',
            cursor: !tone || loadingSound ? 'default' : 'pointer',
            opacity: !tone || loadingSound ? 0.5 : 1,
            transition: 'border-color var(--transition-courte), color var(--transition-courte)',
          }}
          aria-label={joue ? 'Arrêter le timbre' : 'Écouter le timbre mystère'}
        >
          {joue ? (
            <svg width="15" height="18" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="3" height="12" />
              <rect x="7" y="0" width="3" height="12" />
            </svg>
          ) : (
            <svg width="15" height="18" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
              <path d="M0 0v12l10-6z" />
            </svg>
          )}
          <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
            {loadingSound ? 'chargement' : joue ? 'pause' : 'instrument mystère'}
          </span>
        </button>
      </div>

      {/* La mélodie n'est pas la réponse : la nommer retire une inconnue et
          concentre l'écoute sur le timbre, qui est l'objet de l'épreuve. */}
      <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginBottom: 'var(--e5)' }}>
        {melodie.nom}
      </div>

      {/* ---- Choix en deux temps ----
           La famille d'abord, l'instrument ensuite. Vingt-et-un boutons posés
           d'un coup font un mur qu'on parcourt sans lire ; six familles se
           choisissent d'un regard. La hiérarchie existait déjà dans le
           barème — la bonne famille vaut cinq points — elle devient ici la
           mécanique du jeu au lieu d'une note de bas de page. */}
      {!famille && !done && (
        <>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--ivoire)',
            marginBottom: 'var(--e3)',
          }}>
            Quel groupe d&apos;instruments entends-tu ?
          </div>
          {/* Grille plutôt que flex : trois colonnes fixes garantissent deux
             lignes de trois, là où le retour à la ligne automatique dépendait
             de la largeur des noms. Deux colonnes sous 640 px.

             La disposition vit dans globals.css, sous .choix-familles : un
             style en ligne ne peut pas porter de point de rupture, et c'est
             la raison pour laquelle les deux colonnes annoncées ici n'ont
             jamais existé. */}
          <div className="choix-familles">
          {Object.entries(parFamille).map(([fam, list]) => (
            <button
              key={fam}
              onClick={() => setFamille(fam)}
              onMouseEnter={survolOr}
              onMouseLeave={sortieOr}
              style={{
                ...btn(false, false),
                // Plus large et plus basse : la hauteur venait des exemples
                // qui repassaient à la ligne, pas du remplissage. Élargir les
                // cartes règle donc le problème mieux que rogner le padding.
                width: '100%', height: 58, boxSizing: 'border-box',
                padding: '0 var(--e2)',
                display: 'inline-flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>{fam}</span>
              {/* Deux exemples plutôt qu'un décompte : « Cordes frottées » ne
                  dit rien à qui ne fait pas de musique, « violon, violoncelle »
                  se comprend sans rien connaître. */}
              <span style={{
                fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--lin)',
                maxWidth: '100%', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {list.slice(0, 2).map((x) => x.toLowerCase()).join(', ')}
                {list.length > 2 ? '…' : ''}
              </span>
            </button>
          ))}
          </div>
        </>
      )}

      {famille && !done && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--e3)', marginBottom: 'var(--e4)',
          }}>
            <button
              onClick={() => setFamille(null)}
              onMouseEnter={survolOr}
              onMouseLeave={sortieOr}
              aria-label="Revenir au choix du groupe d'instruments"
              style={{ ...btn(false, false), padding: '5px 11px', fontSize: 12.5 }}
            >
              ← Retour
            </button>
            {/* Le groupe choisi reste sous les yeux : c'est le contexte du
                choix en cours, et il justifie la liste réduite. */}
            <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 500, color: 'var(--ivoire)' }}>
              {famille}
            </span>
          </div>

          <div style={{
            fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--lin)',
            marginBottom: 'var(--e3)',
          }}>
            Lequel de ces instruments est-ce ?
          </div>

          {/* Une seule ligne sur écran large : les boutons se resserrent
             d'eux-mêmes et une « Basse » esseulée ne passe pas en dessous.
             Sous 640 px la ligne devient une colonne — cinq noms de guitares
             ne tiennent pas sur 328 px, quoi qu'on resserre.

             Voir .choix-instruments dans globals.css. */}
          <div className="choix-instruments">
            {parFamille[famille].map((n) => (
              <button
                key={n} onClick={() => pick(n)}
                onMouseEnter={survolOr} onMouseLeave={sortieOr}
                style={{
                  ...btn(false, false),
                  padding: '9px 12px', fontSize: 13.5,
                  minWidth: 0, whiteSpace: 'nowrap',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Révélation : la bonne famille et le bon instrument ---- */}
      {done && !devoile && (
        <p className="description" style={{ maxWidth: 380, margin: '0 auto' }}>
          Réponse donnée demain, avec le prochain défi.
        </p>
      )}

      {done && devoile && (
        <div>
          <div className="etiquette-mono" style={{ color: 'var(--lin)', marginBottom: 'var(--e2)' }}>
            {familleCible}
          </div>
          {/* Même disposition qu'à la sélection, et c'est tout l'intérêt de
             partager la classe : la révélation ressemble à l'écran qu'on
             vient de quitter, en colonne comme en ligne. */}
          <div className="choix-instruments">
            {parFamille[familleCible].map((n) => {
              const juste = n === target;
              const rate = n === picked && n !== target;
              return (
                <span key={n} style={{
                  fontFamily: 'var(--sans)', fontSize: 13.5,
                  padding: '9px 12px', borderRadius: 'var(--rayon-controle)',
                  minWidth: 0, whiteSpace: 'nowrap',
                  background: 'var(--onyx-haut)',
                  color: juste ? 'var(--jade)' : rate ? 'rgba(226, 75, 74, 0.9)' : 'var(--cendre)',
                  border: `${juste || rate ? '1px' : '0.5px'} solid ${
                    juste ? 'var(--jade)' : rate ? 'rgba(226, 75, 74, 0.6)' : 'var(--filet)'}`,
                }}>
                  {n}
                </span>
              );
            })}
          </div>

          {/* Si la réponse venait d'une autre famille, on la montre aussi :
              sans elle, on ne voit pas ce qu'on a joué. */}
          {picked && FAMILLES[picked] !== familleCible && (
            <>
              <div className="etiquette-mono" style={{
                color: 'var(--lin)', margin: 'var(--e4) 0 var(--e2)',
              }}>
                ton choix · {FAMILLES[picked]}
              </div>
              {/* Même rangée flex que la famille de la réponse : un span
                  inline posé seul ne se calait pas sur le rythme du dessus. */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{
                  fontFamily: 'var(--sans)', fontSize: 13.5,
                  padding: '9px 14px', borderRadius: 'var(--rayon-controle)',
                  background: 'var(--onyx-haut)',
                  color: 'rgba(226, 75, 74, 0.9)',
                  border: '1px solid rgba(226, 75, 74, 0.6)',
                }}>
                  {picked}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      </div>

      {/* La ligne d'état ne sert qu'avant la réponse : après, la révélation
         montre les instruments et le bilan donne le nom et le groupe. */}
      {!done && <p style={statusStyle}>{status}</p>}

      {/* ---- Bilan ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'instApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          {devoile ? (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              <span style={{ color: 'var(--or)' }}>{target}</span> — famille {familleCible.toLowerCase()}
            </p>
          ) : (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              Réponse donnée demain, avec le prochain défi.
            </p>
          )}

          {!daily && (
            <button
              onClick={relancer}
              disabled={rechargement}
              style={{ ...btn(true, rechargement), marginTop: 'var(--e4)' }}
            >
              {rechargement ? 'Tirage…' : 'Nouvel instrument'}
            </button>
          )}
        </div>
      )}
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
const REFRAIN_EXTRAIT_SEC = 10;
const REFRAIN_ESSAIS = 5;
/* Un cinquième des mots révélé par essai raté : après quatre erreurs, quatre
   cinquièmes de la ligne sont visibles et le dernier essai reste jouable. */
const REFRAIN_POINTS = [10, 8, 6, 4, 2];
/* L'extrait se débloque après le troisième essai raté — assez tard pour que
   l'écoute reste une aide et non la solution. */
const REFRAIN_AUDIO_DES = 3;

/* Indices d'identification, donnés dans l'ordre du plus large au plus précis :
   l'artiste réduit le champ, le titre le referme presque. Les révéler à
   contretemps — le titre avant l'artiste — n'apporterait rien, puisque le
   titre suffit à retrouver les paroles. */
const REFRAIN_ARTISTE_DES = 2;
const REFRAIN_TITRE_DES = 4;

/* Ligne masquée : un trait par lettre, les mots séparés par un vrai espace.
   Compter les lettres donne une prise réelle — on voit qu'un mot fait trois
   caractères ou onze, ce qu'une suite de tirets identiques ne disait pas.
   La ponctuation reste visible : elle ne se devine pas et structure la phrase. */
function LigneMasquee({ texte, motsReveles = 0, tout = false }) {
  const mots = texte.split(/\s+/).filter(Boolean);

  /* On retient combien de mots étaient déjà visibles au rendu précédent :
     seuls les NOUVEAUX s'animent. Sans cette mémoire, toute la ligne
     rejouerait son apparition à chaque essai, et on ne verrait plus ce qui
     vient de se dévoiler. */
  const precedent = useRef(0);
  const seuil = precedent.current;
  useEffect(() => { precedent.current = tout ? mots.length : motsReveles; }, [motsReveles, tout, mots.length]);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0 10px',
      justifyContent: 'center', alignItems: 'flex-end',
      minHeight: 26,
    }}>
      {mots.map((mot, i) => {
        const revele = tout || i < motsReveles;
        if (revele) {
          const nouveau = i >= seuil;
          return (
            <span key={i} style={{
              fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--or)', lineHeight: 1.4,
              // Les mots arrivent en cascade, dans l'ordre de lecture : un
              // bloc qui apparaît d'un coup ne se lit pas, une cascade si.
              animation: nouveau
                ? `refMot 420ms ${(i - seuil) * 70}ms cubic-bezier(0.22, 1, 0.36, 1) both`
                : 'none',
            }}>
              {mot}
            </span>
          );
        }
        return (
          <span key={i} style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end' }}>
            {mot.split('').map((c, j) => (
              /[a-zA-ZÀ-ÿ0-9]/.test(c) ? (
                <span key={j} style={{
                  display: 'inline-block', width: 9, height: 14,
                  borderBottom: '1.5px solid var(--or)',
                  // Les traits pâlissent doucement à l'arrivée d'un mot : le
                  // regard suit le remplacement au lieu de subir un saut.
                  animation: 'refTrait 320ms ease-out both',
                }} />
              ) : (
                <span key={j} style={{
                  fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--cendre)', lineHeight: 1.4,
                }}>
                  {c}
                </span>
              )
            ))}
          </span>
        );
      })}
    </div>
  );
}

export function JeuRefrain({ onDone, daily = false, revelation = true }) {
  // Manche 0 : le refrain du jour, tiré par la graine — identique pour tous.
  const [manche, setManche] = useState(0);
  // L'intro ne se joue qu'à l'arrivée sur l'épreuve, pas sur une relance.
  const [intro, setIntro] = useState(useIntro('refrain'));
  // Surcouche de résultat, posée à la fin de la partie puis retirée seule.
  const [resultat, setResultat] = useState(null);
  // Le bilan du bas attend que le voile soit levé : deux fois le même chiffre
  // au même instant se contrediraient.
  const [bilan, setBilan] = useState(false);
  /* Ligne trouvée ? Conditionne le droit de voir la réponse pendant le
     défi : qui a trouvé la connaît déjà. */
  const [trouve, setTrouve] = useState(false);
  const bilanTimer = useRef(null);

  const [track, setTrack] = useState(null);
  const [context, setContext] = useState([]);
  const [answer, setAnswer] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('Recherche de paroles…');
  const [score, setScore] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [chargementAudio, setChargementAudio] = useState(false);
  // Vraie tant que la recherche de paroles n'a pas abouti. Elle peut durer
  // plusieurs secondes : sans marque visible, le panneau vide passe pour une
  // panne.
  const [chargement, setChargement] = useState(true);
  const erreurTimer = useRef(null);
  const { jouer, arreter, basculer, enLecture, enPause } = useLecteurAudio();

  useEffect(() => { load(); }, [manche]);
  useEffect(() => () => {
    clearTimeout(erreurTimer.current);
    clearTimeout(bilanTimer.current);
  }, []);

  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_REFRAIN_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  /* Droit de dévoiler : hors défi toujours, dans le défi seulement si le
     joueur a trouvé la ligne. Une seule expression pour la ligne masquée et
     pour le bilan. */
  const devoile = revelation || trouve;

  // Pose le voile, puis le bilan une fois qu'il s'est levé.
  function terminerPartie(pts, phrase) {
    arreter();
    setDone(true);
    /* La réponse archivée est le MORCEAU, pas la ligne de paroles : c'est
       elle qui identifie le refrain, elle tient sur une ligne, et le relevé
       de la veille n'a pas à conserver un fragment de texte protégé. */
    onDone(pts, track ? `${track.trackName} — ${track.artistName}` : undefined);
    setStatus(phrase);
    setResultat(pts);
    bilanTimer.current = setTimeout(() => {
      setScore(pts);
      setBilan(true);
    }, RES_REFRAIN_TOTAL);
  }

  async function load() {
    setLoadError(false);
    setChargement(true);
    setStatus('Recherche de paroles…');
    try {
      const rng = manche === 0 ? seeded('refrain') : Math.random;
      const artistStart = Math.floor(rng() * ARTISTS.length);

      /* Les paroles sont interrogées EN PARALLÈLE.

         La version séquentielle enchaînait jusqu'à trente appels l'un après
         l'autre en attendant chaque réponse : avec une API de paroles qui
         répond en 300 à 800 ms et un taux de réussite faible, l'attente se
         comptait en dizaines de secondes. Ici les six candidats d'un artiste
         partent ensemble, et on ne paie que la plus lente des six.

         L'ordre reste celui du tirage : on retient le premier candidat VALIDE
         de la liste, pas le premier arrivé — sinon le morceau dépendrait de la
         latence réseau, et le défi quotidien ne serait plus identique pour
         tous les joueurs. */
      /* Deux formes de titre sont tentées : la version normalisée — sans
         « (feat. …) » ni « - Remaster » — puis le titre brut. Les bases de
         paroles indexent tantôt l'une, tantôt l'autre, et n'essayer que la
         première faisait échouer des morceaux pourtant présents. */
      const chercherParoles = async (t) => {
        /* Générateur PROPRE à ce candidat, dérivé de son identifiant.

           `rng` est une SUITE, et celle-ci était consommée ici, à l'intérieur
           d'un Promise.all : les six candidats tiraient leurs numéros dans
           l'ordre où le réseau répondait, pas dans l'ordre du tirage. La ligne
           retenue changeait donc d'une exécution à l'autre — et, les tirages
           suivants se trouvant décalés, le morceau lui-même finissait par
           changer. Le défi du jour n'était identique pour tous que par chance,
           et deux passages sur l'épreuve donnaient deux paroles différentes.

           Le tri des candidats était déjà protégé — on retient le premier
           VALIDE de la liste, pas le premier arrivé — mais pas la
           consommation du générateur.

           Une graine par trackId règle les deux : elle ne dépend d'aucun
           ordre, seulement du candidat, et reste la même à chaque montage. */
        const rngLigne = manche === 0 ? seeded(`refrain:${t.trackId}`) : Math.random;

        const titres = [normTitle(t.trackName), t.trackName]
          .filter((v, i, arr) => v && arr.indexOf(v) === i);

        for (const title of titres) {
          try {
            const res = await fetch(
              `/api/lyrics?${new URLSearchParams({ artist: t.artistName, title })}`
            );
            if (!res.ok) continue;
            const data = await res.json();
            const seq = extractSequence(data.lyrics, rngLigne);
            if (seq) return seq;
          } catch {
            /* réseau : on tente la forme suivante */
          }
        }
        return null;
      };

      /* Dix artistes au lieu de cinq. La base est passée de 108 à 199 noms,
         dont beaucoup de scène francophone et de niche que l'API de paroles
         ne couvre pas : le taux d'échec par artiste a monté, et cinq essais
         ne suffisaient plus à trouver une séquence exploitable. */
      for (let a = 0; a < 10; a++) {
        const artist = ARTISTS[(artistStart + a * 17) % ARTISTS.length];
        // Le point de suspension progresse à chaque artiste : sans ça, une
        // recherche longue ressemble à un écran figé.
        setStatus(`Recherche de paroles${'.'.repeat((a % 3) + 1)}`);

        const tracks = await searchTracks(artist.nom, { limit: 25 });
        if (!tracks.length) continue;

        const start = Math.floor(rng() * tracks.length);
        const candidats = Array.from(
          { length: Math.min(tracks.length, 6) },
          (_, i) => tracks[(start + i) % tracks.length]
        );

        const sequences = await Promise.all(candidats.map(chercherParoles));
        const idx = sequences.findIndex(Boolean);

        if (idx !== -1) {
          setTrack(candidats[idx]);
          setContext(sequences[idx].context);
          setAnswer(sequences[idx].answer);
          setStatus('Tape la ligne qui manque.');
          setChargement(false);
          return;
        }
      }
      throw new Error('Aucune parole exploitable après plusieurs artistes');
    } catch (err) {
      console.error('Erreur refrain:', err);
      setLoadError(true);
      setChargement(false);
      setStatus('Impossible de charger des paroles aujourd\'hui.');
    }
  }

  // Cherche 4 lignes consécutives valides : 3 de contexte + 1 à deviner
  function extractSequence(lyrics, rng) {
    if (!lyrics) return null;
    const lines = lyrics.split('\n').map((l) => l.trim());
    /* Bornes élargies : entre 10 et 80 caractères, on écartait les refrains
       courts — très fréquents en pop — et les vers longs. Les lignes de
       structure entre crochets, « [Refrain] » ou « [Verse 2] », sont en
       revanche exclues : ce ne sont pas des paroles. */
    const validAt = (i) => lines[i]
      && lines[i].length > 6
      && lines[i].length < 100
      && !/^[[(]/.test(lines[i]);
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

  function signalerErreur() {
    clearTimeout(erreurTimer.current);
    setErreur(true);
    erreurTimer.current = setTimeout(() => setErreur(false), 700);
  }

  async function playClip() {
    if (!track || chargementAudio) return;
    if (enLecture) { basculer(); return; }
    setChargementAudio(true);
    try {
      const url = (await freshPreviewUrl(track.trackId)) ?? track.previewUrl;
      if (url) jouer(url, REFRAIN_EXTRAIT_SEC);
    } catch (err) {
      console.error('Refrain — lecture:', err);
    } finally {
      setChargementAudio(false);
    }
  }

  function relancer() {
    arreter();
    clearTimeout(bilanTimer.current);
    setResultat(null);
    setBilan(false);
    setChargement(true);
    setManche((m) => m + 1);
    setTrack(null);
    setContext([]);
    setAnswer('');
    setInput('');
    setTries(0);
    setDone(false);
    setScore(null);
    setErreur(false);
  }

  function guess() {
    if (done || !answer || !input.trim()) return;
    const a = norm(input);
    const b = norm(answer);
    setInput('');
    const tolerance = Math.max(2, Math.floor(b.length / 5)); // ~20% d'erreurs tolérées
    const ok = a === b || lev(a, b) <= tolerance;
    if (ok) {
      setTrouve(true);
      terminerPartie(REFRAIN_POINTS[Math.min(tries, REFRAIN_POINTS.length - 1)], 'Exact.');
      return;
    }

    const suivant = tries + 1;
    signalerErreur();
    if (suivant >= REFRAIN_ESSAIS) {
      setTries(suivant);
      terminerPartie(0, revelation
        ? 'Perdu.'
        : 'Perdu.');
      return;
    }

    setTries(suivant);
    /* Le message nomme ce qui vient d'apparaître : un indice qui surgit sans
       être annoncé passe inaperçu quand le regard est sur la ligne de mots. */
    const gain = suivant === REFRAIN_ARTISTE_DES ? ' L\'artiste est révélé.'
      : suivant === REFRAIN_AUDIO_DES ? ' L\'extrait se débloque.'
        : suivant === REFRAIN_TITRE_DES ? ' Le titre est révélé.'
          : '';
    const restants = REFRAIN_ESSAIS - suivant;
    setStatus(`Raté — d'autres mots apparaissent.${gain} `
      + `${restants} essai${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}.`);
  }

  /* Un cinquième des mots par essai raté. On arrondit vers le haut pour
     qu'une ligne courte révèle quand même quelque chose dès le premier raté ;
     le dernier mot n'est jamais donné avant la fin. */
  const nbMots = answer ? answer.split(/\s+/).filter(Boolean).length : 0;
  /* En fin de partie la ligne s'ouvre en entier — sauf si la révélation est
     différée : elle reste alors à l'état où les essais l'avaient laissée.
     Les mots déjà dévoilés au fil des ratés sont conservés, ils ont été
     gagnés ; ce sont les derniers, ceux qui donnent la réponse, qui
     attendent demain. */
  const motsReveles = done && devoile ? nbMots
    : Math.min(nbMots - 1, Math.ceil((nbMots * tries) / REFRAIN_ESSAIS));
  const joue = enLecture && !enPause;
  const audioDispo = (tries >= REFRAIN_AUDIO_DES || done) && !!track;

  return (
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes refOnde {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
        @keyframes refAttente {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 0.75; }
        }
        @keyframes refMot {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes refTrait {
          from { opacity: 0.35; }
          to   { opacity: 1; }
        }
        @keyframes refApparition {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {intro && <IntroRefrain onFin={() => setIntro(false)} />}
      {resultat !== null && (
        /* Le voile portait la ligne complète ET le morceau : deux réponses
           pour le prix d'une, alors que le reste de l'épreuve les retenait.
           Le score, lui, s'affiche toujours. */
        <ResultatRefrain
          score={resultat}
          ligne={devoile ? answer : null}
          detail={devoile && track ? `${track.trackName} — ${track.artistName}` : null}
        />
      )}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Complète le refrain</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto var(--e5)' }}>
        Trois lignes du morceau, puis la tienne. Chaque erreur dévoile des mots
        et coûte deux points.
      </p>

      {/* ---- Attente ----
           Un squelette aux dimensions du vrai bloc plutôt qu'une simple ligne
           de texte : la mise en page ne saute pas à l'arrivée des paroles, et
           l'ondulation dit que quelque chose travaille — un panneau figé, non. */}
      {chargement && (
        <div style={{
          maxWidth: 560, margin: '0 auto var(--e5)',
          padding: 'var(--e5) var(--e4)',
          background: 'var(--onyx-haut)',
          borderRadius: 'var(--rayon-carte)',
          border: '0.5px solid var(--filet)',
        }}>
          {[86, 74, 62].map((largeur, i) => (
            <div key={i} style={{
              height: 13, width: `${largeur}%`, margin: '0 auto var(--e3)',
              borderRadius: 3,
              background: 'linear-gradient(90deg, var(--filet) 25%, var(--filet-fort) 50%, var(--filet) 75%)',
              backgroundSize: '200% 100%',
              animation: `refOnde 1500ms ${i * 140}ms linear infinite`,
            }} />
          ))}

          {/* Les traits de la ligne à trouver sont déjà là, en attente : le
              joueur voit ce qui l'attend avant même que le texte arrive. */}
          <div style={{
            marginTop: 'var(--e4)', paddingTop: 'var(--e3)',
            borderTop: '0.5px solid var(--filet)',
            display: 'flex', gap: 10, justifyContent: 'center',
          }}>
            {[3, 5, 4, 6].map((lettres, i) => (
              <span key={i} style={{ display: 'inline-flex', gap: 3 }}>
                {Array.from({ length: lettres }, (_, j) => (
                  <span key={j} style={{
                    display: 'inline-block', width: 9, height: 14,
                    borderBottom: '1.5px solid var(--or)',
                    opacity: 0.25,
                    animation: `refAttente 1400ms ${(i * 5 + j) * 60}ms ease-in-out infinite`,
                  }} />
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- Les paroles ---- */}
      {!chargement && context.length > 0 && (
        <div style={{
          maxWidth: 560, margin: '0 auto var(--e5)',
          padding: 'var(--e5) var(--e4)',
          background: 'var(--onyx-haut)',
          borderRadius: 'var(--rayon-carte)',
          border: '0.5px solid var(--filet)',
        }}>
          {context.map((l, i) => (
            <div key={i} style={{
              fontFamily: 'var(--sans)', fontSize: 15, lineHeight: 1.7,
              // Les lignes données s'éteignent en remontant : la dernière est
              // celle qui précède la réponse, c'est elle qu'on relit.
              color: i === context.length - 1 ? 'var(--ivoire)' : 'var(--lin)',
            }}>
              {l}
            </div>
          ))}

          <div style={{
            marginTop: 'var(--e3)', paddingTop: 'var(--e3)',
            borderTop: '0.5px solid var(--filet)',
          }}>
            <LigneMasquee texte={answer} motsReveles={motsReveles} tout={done && devoile} />
          </div>
        </div>
      )}

      {/* ---- Indices ----
           Chaque étiquette occupe une place réservée dès le départ : sans
           hauteur fixe, l'arrivée du second indice décalerait tout le bas du
           panneau, et le champ de saisie sauterait sous le curseur. */}
      {!chargement && !loadError && track && (
        <div style={{
          display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
          minHeight: 30, marginBottom: 'var(--e4)',
        }}>
          {[
            /* Les indices se débloquent au fil des essais — ils sont gagnés,
               ils restent. Mais `|| done` les faisait tous tomber à la fin de
               la partie, y compris ceux que le joueur n'avait pas atteints :
               le titre du morceau apparaissait ainsi même à qui avait échoué
               dès le premier essai. En défi, la fin ne débloque plus rien. */
            { visible: tries >= REFRAIN_ARTISTE_DES || (done && devoile), etiquette: 'artiste', valeur: track.artistName },
            { visible: tries >= REFRAIN_TITRE_DES || (done && devoile), etiquette: 'titre', valeur: track.trackName },
          ].map(({ visible, etiquette, valeur }) => (
            <span
              key={etiquette}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '5px 12px', borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                border: '0.5px solid var(--filet-fort)',
                maxWidth: 260, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(6px)',
                transition: 'opacity 380ms ease, transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: visible ? 'auto' : 'none',
              }}
            >
              <span className="etiquette-mono" style={{ color: 'var(--cendre)' }}>{etiquette}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ivoire)' }}>
                {valeur}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ---- Saisie ---- */}
      {loadError ? (
        <button onClick={load} style={btn(true, false)}>Réessayer le chargement</button>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guess()}
            placeholder="La ligne suivante…" disabled={done || !answer}
            maxLength={120}
            style={{
              ...inputStyle, minWidth: 320,
              border: erreur ? '1px solid var(--carmin)' : inputStyle.border,
              transition: 'border-color var(--transition-courte)',
            }}
          />
          <button onClick={guess} disabled={done || !answer} style={btn(true, done || !answer)}>Valider</button>
        </div>
      )}

      {/* ---- Extrait, débloqué au second essai ----
           Pas de survolOr/sortieOr : le survol écraserait l'or de l'état
           « en lecture » et le sortir le repasserait en ivoire. */}
      {audioDispo && (
        <div style={{ marginTop: 'var(--e3)' }}>
          <button
            onClick={playClip}
            disabled={chargementAudio}
            style={{
              ...btn(false, chargementAudio),
              display: 'inline-flex', alignItems: 'center', gap: 'var(--e2)',
              borderColor: joue ? 'var(--or)' : 'var(--filet-fort)',
              color: joue ? 'var(--or)' : 'var(--ivoire)',
            }}
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
            {chargementAudio ? 'Chargement…'
              : joue ? 'Pause'
                : enPause ? 'Reprendre'
                  : `Écouter l'extrait (${REFRAIN_EXTRAIT_SEC} s)`}
          </button>
        </div>
      )}

      {/* ---- Essais restants ---- */}
      {!done && answer && (
        <div className="etiquette-mono" style={{ color: 'var(--cendre)', marginTop: 'var(--e4)' }}>
          {tries === REFRAIN_ESSAIS - 1
            ? `dernier essai · ${REFRAIN_POINTS[tries]} points`
            : `${REFRAIN_ESSAIS - tries} essais · ${REFRAIN_POINTS[tries]} points`}
        </div>
      )}

      {!done && <p style={statusStyle}>{status}</p>}

      {/* ---- Bilan ---- */}
      {score !== null && bilan && (
        <div style={{
          marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
          borderTop: '1px solid var(--or)', textAlign: 'center',
          animation: 'refApparition 340ms ease-out both',
        }}>
          <div className="score-affiche" style={{
            color: score >= 9.5 ? 'var(--jade)' : score < 4 ? 'var(--carmin)' : 'var(--ivoire)',
          }}>
            {score.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ 10</span>
          </div>
          {devoile ? (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              <span style={{ color: 'var(--ivoire)' }}>{track?.trackName}</span> — {track?.artistName}
            </p>
          ) : (
            <p className="description" style={{ marginTop: 'var(--e2)' }}>
              Réponse donnée demain, avec le prochain défi.
            </p>
          )}

          {!daily && (
            <button onClick={relancer} style={{ ...btn(true, false), marginTop: 'var(--e4)' }}>
              Nouveau refrain
            </button>
          )}
        </div>
      )}
    </div>
  );
}
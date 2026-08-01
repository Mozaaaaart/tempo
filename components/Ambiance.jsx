'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ecrireVolume, ecrireActif } from '@/utils/volume';

/**
 * Ambiance sonore — nappe d'accords, voix soliste et chœur.
 *
 * ------------------------------------------------------------------ cadrage
 *
 * À N'UTILISER QUE SUR LES PAGES SANS ÉPREUVE.
 * Le site mesure l'oreille. Une musique de fond impose un centre tonal et
 * masque les intervalles à juger. D'où `couperSi`, qui rend la coupure
 * explicite plutôt que laissée à l'oubli.
 *
 * ------------------------------------------------------- démarrage automatique
 *
 * Le son est ACTIF par défaut, mais aucun navigateur ne laisse un site
 * produire du son avant que l'utilisateur ait agi : un AudioContext créé sans
 * geste préalable naît à l'état `suspended` et reste muet. Ce n'est pas
 * contournable, c'est une politique délibérée de Chrome, Safari et Firefox.
 *
 * La stratégie est donc : construire toute la chaîne au chargement, puis la
 * réveiller au PREMIER geste venu — clic, touche, toucher — où qu'il tombe
 * sur la page. En pratique l'ambiance démarre dès que le visiteur bouge, sans
 * qu'il ait à trouver le bouton.
 *
 * ------------------------------------------------------------------ couches
 *
 *   1. NAPPE     cinq voix tenues, immobiles. C'est le socle : elle ne doit
 *                PAS bouger, c'est sa fonction.
 *   2. SOLISTE   une note à la fois, par degrés conjoints. C'est elle qui
 *                porte la variation mélodique.
 *   3. CHŒUR     trois voix filtrées par formants, en retrait, qui vont et
 *                viennent lentement.
 *
 *   nappe ───┐
 *   soliste ─┼──▶ passe-bas ──┬── direct ──────────────┐
 *   chœur ───┘                └── passe-bas ─ réverb ──┴──▶ maître ──▶ sortie
 *
 * ------------------------------------------------- pourquoi ça ne sonne pas synthé
 *
 * TIMBRE SUR MESURE plutôt que dent de scie. Le spectre d'une dent de scie
 * décroît en 1/n : tous les harmoniques présents, l'aigu très chargé. C'est
 * LE timbre de synthétiseur, et aucun filtre ne le rachète.
 *
 * DÉRIVE DE HAUTEUR par oscillateur. Chaque oscillateur flotte de quelques
 * centièmes de ton, lentement, à un rythme qui lui est propre.
 *
 * FORMANTS pour le chœur. Ce qui fait entendre une voix humaine, ce n'est pas
 * le timbre de la source mais trois résonances FIXES dans le spectre,
 * indépendantes de la note chantée.
 *
 * MARCHE CONJOINTE pour la soliste. Trois fois sur quatre elle se déplace
 * d'un degré. Une mélodie qui saute au hasard s'entend comme du hasard ; une
 * mélodie qui procède par degrés s'entend comme une intention.
 */

// ---------------------------------------------------------------- réglages

const VOLUME_DEFAUT = 0.5;
const ACTIF_DEFAUT = true;
const CLE_VOLUME = 'mb:ambiance:volume';
const CLE_ACTIF = 'mb:ambiance:actif';


/**
 * Amplitude de chaque harmonique de la nappe, à partir du fondamental.
 * Décroissance rapide : à peine plus riche qu'une sinusoïde, d'où le côté
 * flûte ou verre frotté. Au-delà de 0,5 et 0,3 sur les deux premiers, le
 * caractère synthétique revient.
 */
const PARTIELS = [1, 0.38, 0.16, 0.055, 0.026, 0.012, 0.006];

/**
 * Timbre du chœur, plus riche : les formants ont besoin de matière à filtrer.
 * Un spectre pauvre donnerait des voyelles creuses.
 */
const PARTIELS_CHOEUR = [1, 0.62, 0.44, 0.30, 0.21, 0.15, 0.10, 0.07, 0.05];

/**
 * Progression d'accords, en hertz, une ligne par accord et une colonne par
 * voix. La conduite des voix est volontairement serrée :
 *
 *   voix 1  basse       A2 → F2 → D3     seule à faire de vrais sauts
 *   voix 2  pédale      E3 → E3 → E3     tenue du début à la fin
 *   voix 3  interne     G3 → A3 → A3
 *   voix 4  interne     B3 → C4 → C4     un demi-ton
 *   voix 5  sommet      E4 → E4 → F4
 *
 * Trois notes sur cinq ne bougent pas d'un accord à l'autre : c'est ce qui
 * rend l'enchaînement inaudible.
 */
const ACCORDS = [
  [110.00, 164.81, 196.00, 246.94, 329.63], // Am9
  [ 87.31, 164.81, 220.00, 261.63, 329.63], // Fmaj9
  [146.83, 164.81, 220.00, 261.63, 349.23], // Dm9
];

const DUREE_ACCORD = 22000;        // ms passées sur chaque accord
const DECALAGE_VOIX = 0.70;        // s entre deux voix lors du changement
const EFFACEMENT = 2.8;            // s pour éteindre une voix avant qu'elle bouge

const DESACCORD = 5;               // centièmes de ton entre oscillateurs
const DERIVE_AMPLEUR = 4.5;        // centièmes de ton de flottement lent
const DERIVE_BASE = 0.055;         // Hz — un cycle de ~18 s
const DERIVE_ECART = 0.013;        // écart entre oscillateurs, sans rapport simple

const COUPURE_BASE = 1050;         // Hz, passe-bas général
const COUPURE_AMPLEUR = 70;        // Hz, de combien il respire
const COUPURE_PERIODE = 0.03;      // Hz, soit un cycle de 33 s

const REVERB_COUPURE = 1500;       // Hz — assombrit la queue de réverbération
const REVERB_DUREE = 5.2;          // s
const REVERB_DECROISSANCE = 2.2;   // plus haut = extinction plus rapide

const GAIN_NAPPE = 0.17;           // avant pondération par la hauteur
const MIX_DIRECT = 0.42;
const MIX_REVERB = 0.95;           // les couches doivent être posées loin

const FONDU_ENTREE = 2.4;          // s pour monter le son
const FONDU_SORTIE = 0.9;          // s pour le couper

// ------------------------------------------------------------------ soliste

const GAIN_SOLO = 0.085;

// Degrés de l'accord utilisés par la soliste, à l'octave simple puis double.
// Six notes : assez pour dessiner une ligne, trop peu pour partir au hasard.
const SOLO_DEGRES = [2, 3, 4];

const SOLO_ATTAQUE = 1.3;          // s — jamais d'attaque franche
const SOLO_EXTINCTION = 2.6;       // s — la traîne fait se chevaucher les notes
const SOLO_DUREE = [2800, 4400];   // ms entre deux notes
const SOLO_SILENCE = [3200, 5600]; // ms de respiration
const SOLO_PROBA_SILENCE = 0.33;   // une fois sur trois
const SOLO_PROBA_DEGRE = 0.75;     // sinon saut de deux degrés

// -------------------------------------------------------------------- chœur

const GAIN_CHOEUR = 0.055;         // très léger : il doit se deviner

// Degrés de l'accord chantés par le chœur, transposés à l'octave supérieure.
const CHOEUR_DEGRES = [2, 3, 4];
const CHOEUR_OCTAVE = 2;

/**
 * Formants — trois résonances fixes qui font entendre une voyelle.
 * Ces valeurs sont entre le « o » fermé et le « ou », la couleur la plus
 * neutre pour un fond. Un « a » ouvert (730 / 1090 / 2440) serait bien plus
 * présent, donc plus envahissant.
 */
const FORMANTS = [
  { f: 450,  q: 5.5, gain: 1.00 },
  { f: 900,  q: 7.0, gain: 0.45 },
  { f: 2400, q: 9.0, gain: 0.16 },
];

const CHOEUR_VIBRATO = [4.9, 5.3, 5.7];  // Hz — jamais la même valeur
const CHOEUR_VIBRATO_AMPLEUR = 16;       // centièmes de ton
const CHOEUR_DESACCORD = [-7, 3, 8];     // centièmes, chanteurs pas tout à fait d'accord
const CHOEUR_SOUFFLE = [0.021, 0.029, 0.037]; // Hz — le chœur va et vient

// Gestes que les navigateurs reconnaissent comme activation utilisateur.
// Le défilement n'en fait PAS partie : inutile de l'ajouter.
const GESTES = ['pointerdown', 'keydown', 'touchstart'];

// ------------------------------------------------------------- fabrication

/**
 * Timbre construit harmonique par harmonique.
 *
 * createPeriodicWave prend les composantes en cosinus (real) et en sinus
 * (imag). On laisse les cosinus à zéro — la phase est inaudible sur un son
 * tenu — et on pose les amplitudes dans les sinus. Un seul oscillateur porte
 * alors tout le spectre, sans surcoût.
 */
function fabriquerTimbre(ctx, partiels) {
  const n = partiels.length + 1;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  partiels.forEach((a, k) => { imag[k + 1] = a; });
  return ctx.createPeriodicWave(real, imag);
}

/** Bruit à décroissance exponentielle, en stéréo : les deux canaux étant
 *  indépendants, la nappe s'élargit naturellement. */
function fabriquerReverb(ctx) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * REVERB_DUREE);
  const ir = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, REVERB_DECROISSANCE);
    }
  }
  return ir;
}

const entre = ([min, max]) => min + Math.random() * (max - min);

/**
 * Lecture tolérante de la préférence d'activation.
 *
 * Les premières versions du composant écrivaient String(booléen), soit
 * "true" / "false" ; la suivante attendait "1" / "0". Un visiteur ayant
 * cliqué le bouton sous l'ancienne version gardait donc une clé illisible,
 * interprétée comme « coupé ». On n'éteint désormais que sur une valeur
 * négative EXPLICITE : tout le reste, y compris une clé absente ou
 * corrompue, retombe sur le défaut.
 */
function lireActif(brut) {
  if (brut === null || brut === undefined) return ACTIF_DEFAUT;
  if (brut === '0' || brut === 'false') return false;
  if (brut === '1' || brut === 'true') return true;
  return ACTIF_DEFAUT;
}

/**
 * @param couperSi  passer `true` pendant une épreuve : le son s'éteint en
 *                  douceur et le bouton se grise, sans perdre le réglage.
 * @param compact   variante réduite, pour une barre de navigation dense.
 */
export default function Ambiance({ couperSi = false, compact = false }) {
  const [pret, setPret] = useState(false);
  const [actif, setActif] = useState(false);   // vrai état posé après montage
  const [volume, setVolume] = useState(VOLUME_DEFAUT);
  const [ouvert, setOuvert] = useState(false);
  const [enAttente, setEnAttente] = useState(false); // actif mais bloqué par le navigateur

  const ctxRef = useRef(null);
  const maitreRef = useRef(null);
  const nappeRef = useRef([]);
  const choeurRef = useRef([]);
  const soloRef = useRef([]);
  const noeudsRef = useRef([]);
  const minuterieRef = useRef(null);
  const attenteSoloRef = useRef(null);
  const accordRef = useRef(0);
  const degreSoloRef = useRef(1);
  const tourSoloRef = useRef(0);

  /** Réservoir de notes de la soliste, dérivé de l'accord en cours. */
  const notesSolo = useCallback(() => {
    const accord = ACCORDS[accordRef.current];
    const bas = SOLO_DEGRES.map((d) => accord[d]);
    return [...bas, ...bas.map((f) => f * 2)];
  }, []);

  /** Programme la note suivante de la soliste, puis se rappelle. */
  const jouerSolo = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    const notes = notesSolo();

    // Marche conjointe : un degré la plupart du temps, deux parfois. C'est ce
    // qui distingue une ligne mélodique d'une suite de notes tirées au sort.
    const pas = (Math.random() < SOLO_PROBA_DEGRE ? 1 : 2) * (Math.random() < 0.5 ? -1 : 1);
    let d = degreSoloRef.current + pas;
    // Rebond aux extrémités du réservoir plutôt que blocage : la ligne
    // repart dans l'autre sens au lieu de s'accrocher au bord.
    if (d < 0) d = -d;
    if (d > notes.length - 1) d = 2 * (notes.length - 1) - d;
    degreSoloRef.current = d;

    const silence = Math.random() < SOLO_PROBA_SILENCE;

    if (!silence && soloRef.current.length) {
      // Deux voix en alternance : la nouvelle note peut entrer pendant que la
      // précédente s'éteint encore. Sans ça, la ligne serait hachée.
      const voix = soloRef.current[tourSoloRef.current % soloRef.current.length];
      tourSoloRef.current++;

      const t = ctx.currentTime;
      voix.osc.frequency.setValueAtTime(notes[d], t);
      voix.gain.gain.cancelScheduledValues(t);
      voix.gain.gain.setTargetAtTime(GAIN_SOLO, t, SOLO_ATTAQUE / 3);
      voix.gain.gain.setTargetAtTime(0, t + SOLO_ATTAQUE + 0.4, SOLO_EXTINCTION / 3);
    }

    attenteSoloRef.current = setTimeout(
      jouerSolo,
      silence ? entre(SOLO_SILENCE) : entre(SOLO_DUREE)
    );
  }, [notesSolo]);

  /** Fait passer nappe et chœur à l'accord suivant. */
  const enchainer = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;

    accordRef.current = (accordRef.current + 1) % ACCORDS.length;
    const cible = ACCORDS[accordRef.current];
    const maintenant = ctx.currentTime;

    nappeRef.current.forEach((v, i) => {
      const f = cible[i];
      // Décalage entre voix : l'accord se recompose note à note plutôt que
      // d'un bloc, ce qui rend le changement bien plus discret.
      const t0 = maintenant + i * DECALAGE_VOIX;

      // La voix s'efface, change de note en silence, puis revient. Changer la
      // fréquence à gain non nul produirait un glissando très audible.
      v.gain.gain.cancelScheduledValues(t0);
      v.gain.gain.setTargetAtTime(0, t0, 0.7);
      v.oscillateurs.forEach((o, k) => {
        o.frequency.setValueAtTime(
          f * Math.pow(2, ((k - 1) * DESACCORD) / 1200),
          t0 + EFFACEMENT
        );
      });
      v.gain.gain.setTargetAtTime(v.niveau, t0 + EFFACEMENT + 0.3, 1.5);
    });

    // Le chœur suit, décalé d'une seconde : il arrive après la nappe, comme
    // des chanteurs qui prennent leur respiration.
    choeurRef.current.forEach((v, i) => {
      const f = cible[CHOEUR_DEGRES[i]] * CHOEUR_OCTAVE;
      const t0 = maintenant + 1.0 + i * DECALAGE_VOIX;
      v.gain.gain.cancelScheduledValues(t0);
      v.gain.gain.setTargetAtTime(0, t0, 0.8);
      v.osc.frequency.setValueAtTime(f, t0 + EFFACEMENT);
      v.gain.gain.setTargetAtTime(GAIN_CHOEUR, t0 + EFFACEMENT + 0.4, 1.8);
    });
  }, []);

  /** Construit la chaîne audio. Sans effet si elle existe déjà et tient debout. */
  const demarrer = useCallback(() => {
    // Un contexte fermé ne se rouvre pas : on repart de zéro plutôt que de
    // sortir en croyant la chaîne encore vivante.
    if (ctxRef.current && ctxRef.current.state !== 'closed') return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    // Créé sans geste utilisateur, ce contexte naît `suspended`. Il ne
    // consomme rien tant qu'il n'est pas repris, on peut donc le préparer
    // dès le montage : le réveil ne coûtera plus que le resume().
    const ctx = new Ctx();
    ctxRef.current = ctx;

    const timbre = fabriquerTimbre(ctx, PARTIELS);
    const timbreChoeur = fabriquerTimbre(ctx, PARTIELS_CHOEUR);

    const maitre = ctx.createGain();
    maitre.gain.value = 0;
    maitre.connect(ctx.destination);
    maitreRef.current = maitre;

    // Réverbération, en parallèle du signal direct. Le passe-bas est AVANT le
    // convolueur : il assombrit la queue sans toucher au son direct, ce qui
    // donne une pièce plutôt qu'un effet.
    const reverb = ctx.createConvolver();
    reverb.buffer = fabriquerReverb(ctx);
    const filtreReverb = ctx.createBiquadFilter();
    filtreReverb.type = 'lowpass';
    filtreReverb.frequency.value = REVERB_COUPURE;
    filtreReverb.Q.value = 0.5;

    const gainDirect = ctx.createGain();
    gainDirect.gain.value = MIX_DIRECT;
    const gainReverb = ctx.createGain();
    gainReverb.gain.value = MIX_REVERB;
    gainDirect.connect(maitre);
    filtreReverb.connect(reverb).connect(gainReverb).connect(maitre);

    // Passe-bas général, commun aux trois couches
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = COUPURE_BASE;
    filtre.Q.value = 0.5;
    filtre.connect(gainDirect);
    filtre.connect(filtreReverb);

    const lfoFiltre = ctx.createOscillator();
    lfoFiltre.frequency.value = COUPURE_PERIODE;
    const lfoFiltreGain = ctx.createGain();
    lfoFiltreGain.gain.value = COUPURE_AMPLEUR;
    lfoFiltre.connect(lfoFiltreGain).connect(filtre.frequency);

    const demarrables = [lfoFiltre];

    // ------------------------------------------------------------- nappe
    const nappe = [];
    ACCORDS[0].forEach((f, i) => {
      // Les aigus percent davantage : on les rentre pour équilibrer l'accord.
      const niveau = GAIN_NAPPE / Math.sqrt(f / 110);

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(filtre);

      // Trémolo sur un étage séparé : s'il partageait le paramètre du gain
      // d'accord, ses oscillations s'ajouteraient à l'automation et la voix
      // ne s'éteindrait jamais complètement pendant un changement d'accord.
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.84;
      tremolo.connect(gain);

      const lfoTrem = ctx.createOscillator();
      lfoTrem.frequency.value = 0.043 + i * 0.017;
      const lfoTremGain = ctx.createGain();
      lfoTremGain.gain.value = 0.16;
      lfoTrem.connect(lfoTremGain).connect(tremolo.gain);
      demarrables.push(lfoTrem);

      const oscillateurs = [0, 1, 2].map((k) => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(timbre);
        o.frequency.value = f * Math.pow(2, ((k - 1) * DESACCORD) / 1200);

        // Dérive propre à cet oscillateur, branchée sur `detune` : la note
        // flotte de quelques centièmes de ton, jamais en phase avec ses voisines.
        const derive = ctx.createOscillator();
        derive.frequency.value = DERIVE_BASE + (i * 3 + k) * DERIVE_ECART;
        const deriveGain = ctx.createGain();
        deriveGain.gain.value = DERIVE_AMPLEUR;
        derive.connect(deriveGain).connect(o.detune);
        demarrables.push(derive);

        const part = ctx.createGain();
        part.gain.value = k === 1 ? 0.5 : 0.32;
        o.connect(part).connect(tremolo);
        demarrables.push(o);
        return o;
      });

      nappe.push({ gain, oscillateurs, niveau });
    });
    nappeRef.current = nappe;

    // ------------------------------------------------------------- chœur
    // Bus de formants : trois passe-bande en parallèle. C'est eux qui font
    // entendre une voyelle, indépendamment de la note chantée.
    const busChoeur = ctx.createGain();
    busChoeur.gain.value = 1;
    FORMANTS.forEach((fo) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fo.f;
      bp.Q.value = fo.q;
      const g = ctx.createGain();
      g.gain.value = fo.gain;
      busChoeur.connect(bp).connect(g).connect(filtre);
    });

    const choeur = CHOEUR_DEGRES.map((degre, i) => {
      const f = ACCORDS[0][degre] * CHOEUR_OCTAVE;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(busChoeur);

      // Le chœur va et vient : chaque voix enfle et s'efface à son rythme,
      // si bien qu'il n'est jamais tout à fait là ni tout à fait absent.
      const souffle = ctx.createGain();
      souffle.gain.value = 0.55;
      souffle.connect(gain);
      const lfoSouffle = ctx.createOscillator();
      lfoSouffle.frequency.value = CHOEUR_SOUFFLE[i];
      const lfoSouffleGain = ctx.createGain();
      lfoSouffleGain.gain.value = 0.45;
      lfoSouffle.connect(lfoSouffleGain).connect(souffle.gain);
      demarrables.push(lfoSouffle);

      const osc = ctx.createOscillator();
      osc.setPeriodicWave(timbreChoeur);
      osc.frequency.value = f;
      osc.detune.value = CHOEUR_DESACCORD[i];
      osc.connect(souffle);
      demarrables.push(osc);

      // Vibrato : un chœur, ce sont des chanteurs qui ne sont jamais tout à
      // fait d'accord. Trois fréquences distinctes, jamais synchrones.
      const vib = ctx.createOscillator();
      vib.frequency.value = CHOEUR_VIBRATO[i];
      const vibGain = ctx.createGain();
      vibGain.gain.value = CHOEUR_VIBRATO_AMPLEUR;
      vib.connect(vibGain).connect(osc.detune);
      demarrables.push(vib);

      return { gain, osc };
    });
    choeurRef.current = choeur;

    // ----------------------------------------------------------- soliste
    const solo = [0, 1].map(() => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(filtre);

      const osc = ctx.createOscillator();
      osc.setPeriodicWave(timbre);
      osc.frequency.value = ACCORDS[0][SOLO_DEGRES[0]];

      // Léger vibrato, plus lent que celui du chœur
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.2;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 7;
      vib.connect(vibGain).connect(osc.detune);
      demarrables.push(vib);

      osc.connect(gain);
      demarrables.push(osc);
      return { gain, osc };
    });
    soloRef.current = solo;

    demarrables.forEach((n) => n.start());
    noeudsRef.current = demarrables;

    // Les couches montent à leur niveau ; le gain maître, lui, reste à 0
    // jusqu'au fondu d'entrée piloté par l'effet plus bas.
    const t = ctx.currentTime;
    nappe.forEach((v) => v.gain.gain.setTargetAtTime(v.niveau, t, 1.0));
    choeur.forEach((v) => v.gain.gain.setTargetAtTime(GAIN_CHOEUR, t + 2, 2.0));

    minuterieRef.current = setInterval(enchainer, DUREE_ACCORD);
    // La soliste entre après la nappe, jamais en même temps.
    attenteSoloRef.current = setTimeout(jouerSolo, 6000);
  }, [enchainer, jouerSolo]);

  /**
   * Démonte toute la chaîne ET remet les références à zéro.
   *
   * Cette remise à zéro est indispensable. En développement, React monte les
   * composants deux fois : sans elle, le second montage trouvait ctxRef
   * rempli d'un contexte déjà fermé, sortait de demarrer() sans rien faire,
   * et le son ne repartait plus — pas même en cliquant le bouton, qui fait la
   * même vérification.
   */
  const arreter = useCallback(() => {
    if (minuterieRef.current) { clearInterval(minuterieRef.current); minuterieRef.current = null; }
    if (attenteSoloRef.current) { clearTimeout(attenteSoloRef.current); attenteSoloRef.current = null; }
    noeudsRef.current.forEach((n) => {
      try { n.stop(); } catch { /* déjà arrêté */ }
    });
    noeudsRef.current = [];
    nappeRef.current = [];
    choeurRef.current = [];
    soloRef.current = [];
    maitreRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    ctx?.close().catch(() => {});
  }, []);

  // Préférences et démarrage. localStorage n'existant pas au rendu serveur,
  // tout se joue après montage — d'où `pret`, qui évite l'écart d'hydratation.
  useEffect(() => {
    let vol = VOLUME_DEFAUT;
    let on = ACTIF_DEFAUT;
    try {
      const v = localStorage.getItem(CLE_VOLUME);
      if (v !== null) {
        const n = parseFloat(v);
        if (!Number.isNaN(n)) vol = Math.min(1, Math.max(0, n));
      }
      on = lireActif(localStorage.getItem(CLE_ACTIF));
    } catch {
      // Mode privé, stockage refusé : valeurs par défaut.
    }
    setVolume(vol);
    setActif(on);
    setPret(true);
    if (on) demarrer();

    return arreter;
  }, [demarrer, arreter]);

  /* Les réglages peuvent être modifiés ailleurs — par le curseur des pages
     d'épreuve, qui écrit sous les mêmes clés. Sans cette écoute, Ambiance
     gardait son état de montage et se retrouvait en désaccord avec le reste
     du site dès qu'on revenait sur l'accueil. */
  useEffect(() => {
    const surVolume = (ev) => setVolume(ev.detail);
    const surActif = (ev) => {
      setActif(ev.detail);
      if (ev.detail) demarrer();
    };
    window.addEventListener('mb:volume-change', surVolume);
    window.addEventListener('mb:actif-change', surActif);
    return () => {
      window.removeEventListener('mb:volume-change', surVolume);
      window.removeEventListener('mb:actif-change', surActif);
    };
  }, [demarrer]);

  /** Rampe douce du gain maître. setTargetAtTime évite tout claquement. */
  const viser = useCallback((cible, duree) => {
    const ctx = ctxRef.current;
    const maitre = maitreRef.current;
    if (!ctx || !maitre || ctx.state === 'closed') return;
    maitre.gain.cancelScheduledValues(ctx.currentTime);
    maitre.gain.setTargetAtTime(cible, ctx.currentTime, duree / 3);
  }, []);

  // Application de l'état : actif, volume, coupure imposée
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const doitSonner = actif && !couperSi;
    if (doitSonner && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    viser(doitSonner ? volume : 0, doitSonner ? FONDU_ENTREE : FONDU_SORTIE);
  }, [actif, volume, couperSi, viser, pret]);

  // Réveil au premier geste. Tant que le navigateur n'a pas vu d'activation
  // utilisateur, resume() laisse le contexte suspendu sans lever d'erreur :
  // il faut donc guetter le geste plutôt que de réessayer en boucle.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed' || !actif || couperSi) {
      setEnAttente(false);
      return;
    }
    if (ctx.state === 'running') {
      setEnAttente(false);
      return;
    }

    setEnAttente(true);
    let vivant = true;

    const reveiller = () => {
      ctx.resume().then(() => {
        if (!vivant) return;
        setEnAttente(false);
        retirer();
      }).catch(() => {});
    };
    const retirer = () => GESTES.forEach((e) => document.removeEventListener(e, reveiller));

    GESTES.forEach((e) => document.addEventListener(e, reveiller, { passive: true }));

    // Le contexte peut aussi repartir de lui-même (onglet réactivé, score
    // d'engagement suffisant) : on suit son état plutôt que de le supposer.
    const surEtat = () => { if (ctx.state === 'running') { setEnAttente(false); retirer(); } };
    ctx.addEventListener('statechange', surEtat);

    return () => {
      vivant = false;
      retirer();
      ctx.removeEventListener('statechange', surEtat);
    };
  }, [actif, couperSi, pret]);

  /* L'écriture passe par le module partagé plutôt que par localStorage en
     direct : lui seul prévient les autres composants montés. Écrire la clé
     à la main mettait le stockage à jour sans que personne l'apprenne. */
  function basculer() {
    demarrer();                 // reconstruit la chaîne si elle a été fermée
    const suivant = !actif;
    setActif(suivant);
    setOuvert(suivant);
    ecrireActif(suivant);
  }

  function changerVolume(v) {
    setVolume(v);
    ecrireVolume(v);
  }

  const taille = compact ? 28 : 34;
  const sonne = actif && !couperSi;
  // APRÈS — l'or dans les deux cas, seule l'icône distingue les états
    const teinte = couperSi ? 'var(--cendre)' : 'var(--or)';
    const bordure = couperSi ? 'var(--filet)' : teinte;

  const styleBouton = {
    width: taille,
    height: taille,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: couperSi ? 'not-allowed' : 'pointer',
    background: 'transparent',
    color: teinte,
    border: `1px solid ${bordure}`,
    // En attente d'un geste, le bouton est légèrement voilé : il annonce
    // « actif » sans prétendre qu'on entend déjà quelque chose.
    opacity: enAttente ? 0.55 : 1,
    padding: 0,
    transition: 'color var(--transition-courte), border-color var(--transition-courte), opacity var(--transition-courte)',
  };

  const intitule = couperSi ? 'Ambiance coupée pendant l\'épreuve'
    : enAttente ? 'Le son démarre au premier clic sur la page'
    : sonne ? 'Couper l\'ambiance sonore'
    : 'Activer l\'ambiance sonore';

  return (
    <div
      onMouseEnter={() => !couperSi && setOuvert(true)}
      onMouseLeave={() => !actif && setOuvert(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}
    >
      <style>{`
        /* Le remplissage est piloté par --remplissage, posée en style inline
           depuis React. Les pseudo-éléments héritent des propriétés
           personnalisées de leur hôte : c'est ce qui permet à la piste de
           connaître la position du curseur sans JavaScript supplémentaire. */
        .mb-volume {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 14px;       /* zone de clic confortable, piste bien plus fine */
          background: transparent;
          cursor: pointer;
          outline: none;
          margin: 0;
        }

        /* WebKit et Gecko exigent des règles SÉPARÉES : un sélecteur inconnu
           invalide toute la règle qui le contient. Les regrouper ferait
           tomber les deux. */
        .mb-volume::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            var(--or) 0 var(--remplissage),
            var(--filet) var(--remplissage) 100%
          );
          transition: background 60ms linear;
        }
        .mb-volume::-moz-range-track {
          height: 3px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            var(--or) 0 var(--remplissage),
            var(--filet) var(--remplissage) 100%
          );
        }

        .mb-volume::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: var(--or);
          border: none;
          margin-top: -4px;   /* centrage sur une piste de 3 px : (3 - 11) / 2 */
          box-shadow: 0 0 0 rgba(239, 159, 39, 0);
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .mb-volume::-moz-range-thumb {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: var(--or);
          border: none;
          box-shadow: 0 0 0 rgba(239, 159, 39, 0);
          transition: transform 140ms ease, box-shadow 140ms ease;
        }

        /* La pastille grossit et s'auréole au survol */
        .mb-volume:hover::-webkit-slider-thumb,
        .mb-volume:active::-webkit-slider-thumb {
          transform: scale(1.3);
          box-shadow: 0 0 9px rgba(239, 159, 39, 0.75);
        }
        .mb-volume:hover::-moz-range-thumb,
        .mb-volume:active::-moz-range-thumb {
          transform: scale(1.3);
          box-shadow: 0 0 9px rgba(239, 159, 39, 0.75);
        }

        /* Anneau de focus au clavier uniquement : :focus-visible ne se
           déclenche pas au clic, on évite l'anneau parasite après un glisser. */
        .mb-volume:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(239, 159, 39, 0.28);
        }
        .mb-volume:focus-visible::-moz-range-thumb {
          box-shadow: 0 0 0 4px rgba(239, 159, 39, 0.28);
        }

        @media (prefers-reduced-motion: reduce) {
          .mb-volume::-webkit-slider-thumb,
          .mb-volume::-moz-range-thumb { transition: none }
        }
      `}</style>

      <button
        type="button"
        onClick={basculer}
        disabled={couperSi}
        style={styleBouton}
        aria-pressed={sonne}
        aria-label={intitule}
        title={intitule}
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8v4h3l4 3V5L7 8H4z" />
          {sonne ? (
            <>
              <path d="M14 7.5a3.6 3.6 0 0 1 0 5" />
              <path d="M16.2 5.2a7 7 0 0 1 0 9.6" />
            </>
          ) : (
            <path d="M14 8l4 4M18 8l-4 4" />
          )}
        </svg>
      </button>

      {/* Le curseur n'apparaît qu'au survol ou quand le son tourne : il
          n'encombre pas la barre au repos. Largeur animée plutôt que montage
          conditionnel, pour que l'ouverture soit continue. */}
      <div
        style={{
          width: ouvert && !couperSi ? (compact ? 64 : 84) : 0,
          opacity: ouvert && !couperSi ? 1 : 0,
          overflow: 'hidden',
          transition: 'width var(--transition-courte), opacity var(--transition-courte)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => changerVolume(parseFloat(e.target.value))}
          aria-label="Volume de l'ambiance"
          aria-valuetext={`${Math.round(volume * 100)} %`}
          tabIndex={ouvert && !couperSi ? 0 : -1}
          className="mb-volume"
          style={{
            // La piste ne connaît la position du curseur que par cette variable.
            '--remplissage': `${volume * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
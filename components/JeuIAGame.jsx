'use client';
import { useEffect, useRef, useState } from 'react';
import { ARTISTS } from '@/data/artists';
import { AI_ARTISTS } from '@/data/ai-tracks';
import { searchTracks, trackDetails, freshPreviewUrl } from '@/utils/deezer';
import { seeded, panel, btn, statusStyle, useLecteurAudio } from '@/components/dailyGames';
import { useIntro } from '@/utils/intro';
import IntroIA, { ResultatIA, RES_IA_TOTAL, DefaiteIA, DEFAITE_IA_TOTAL } from '@/components/IntroIA';
import IntroIAQuotidien from '@/components/IntroIAQuotidien';

const normName = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/* Mode libre : survie à UNE seule vie. Aucune erreur permise — le score est
   le nombre d'extraits enchaînés. Le mode quotidien garde son format fixe et
   sa note sur dix, comme les épreuves Rythme et Duel. */
const DAILY_ROUNDS = 3;
const EXTRAIT_SEC = 12;

const NICHE_TERMS = [
  'rain', 'nuit', 'road', 'lumière', 'garden', 'hiver', 'fever', 'silence',
  'mercredi', 'horizon', 'papier', 'sable', 'echo', 'valley', 'brume', 'sunday',
];
const NICHE_MAX_RANK = 150000;
const HUMAN_CUTOFF = '2023-01-01';

/* ---------- Compteur de niveau ----------
   Le chiffre ne change pas d'un coup : l'ancien sort par le haut pendant que
   le nouveau entre par le bas. Le `key` sur la valeur est ce qui déclenche le
   remontage, donc l'animation — sans lui, React réutiliserait le même nœud et
   se contenterait d'y écrire un autre texte.

   La hauteur de la boîte est fixe et vaut la ligne du chiffre : c'est elle qui
   masque le nœud sortant, et qui aligne le compteur sur les autres données du
   bandeau. */
const H_LIGNE = 22;

function CompteurNiveau({ valeur, actif = true }) {
  // Le premier rendu ne s'anime pas. Le panneau est monté DERRIÈRE la
  // surcouche d'introduction : sans ce garde-fou, le chiffre roulait pendant
  // la présentation, et le joueur découvrait un compteur déjà joué.
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
      height: H_LIGNE, overflow: 'hidden',
      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500,
      lineHeight: `${H_LIGNE}px`, color: 'var(--or)',
      marginTop: 2,
    }}>
      <span
        key={valeur}
        style={{
          display: 'block',
          animation: anime ? 'iaChiffreEntre 420ms cubic-bezier(0.22, 1, 0.36, 1) both' : 'none',
        }}
      >
        {valeur}
      </span>
    </span>
  );
}

/* ---------- Carte de réponse ----------
   Les deux réponses sont le geste central de l'épreuve : elles occupent
   l'espace au lieu d'être deux petits boutons alignés à gauche. Pas d'emoji
   dans les libellés — un glyphe dessiné tient la charte typographique. */
function CarteReponse({ libelle, onClick, disabled, etat, icone }) {
  const bordure = etat === 'juste' ? 'var(--jade)' : etat === 'faux' ? 'var(--carmin)' : 'var(--filet-fort)';
  const teinte = etat === 'juste' ? 'var(--jade)' : etat === 'faux' ? 'var(--carmin)' : 'var(--ivoire)';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        // Icône et libellé sur UNE ligne : empilés, ils imposaient une hauteur
        // que rien ne remplissait. Deux contrôles larges et plats se lisent
        // comme un choix binaire, pas comme deux panneaux.
        flex: '0 1 172px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e2)',
        height: 46, padding: '0 var(--e4)', boxSizing: 'border-box',
        borderRadius: 'var(--rayon-controle)',
        background: 'var(--onyx-haut)',
        border: `${etat === 'repos' ? '0.5px' : '1px'} solid ${bordure}`,
        color: teinte,
        fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        opacity: etat === 'estompe' ? 0.3 : 1,
        transition: 'border-color var(--transition-courte), color var(--transition-courte), opacity var(--transition-courte)',
      }}
      onMouseEnter={(e) => {
        if (disabled || etat !== 'repos') return;
        e.currentTarget.style.borderColor = 'var(--or)';
        e.currentTarget.style.color = 'var(--or)';
      }}
      onMouseLeave={(e) => {
        if (etat !== 'repos') return;
        e.currentTarget.style.borderColor = 'var(--filet-fort)';
        e.currentTarget.style.color = 'var(--ivoire)';
      }}
    >
      {icone}
      {libelle}
    </button>
  );
}

/* Glyphes dessinés plutôt qu'emoji : ils héritent de `currentColor`, donc ils
   passent en jade ou en carmin avec le reste de la carte au moment du verdict.
   Un emoji garderait sa propre palette et resterait en dehors du signal. */
const IconeHumain = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <circle cx="10" cy="6.4" r="3.4" />
    <path d="M3.4 17.2c0-3.6 3-6 6.6-6s6.6 2.4 6.6 6" strokeLinecap="round" />
  </svg>
);

const IconeIA = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="3.6" y="6.4" width="12.8" height="10" rx="2.4" />
    <path d="M10 3v3.4M7.2 10.6v1.6M12.8 10.6v1.6" strokeLinecap="round" />
  </svg>
);

export default function JeuIAGame({ daily = false, onDone = () => {} }) {
  const [intro, setIntro] = useState(useIntro('humain-ou-ia'));
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState(true);
  const [choix, setChoix] = useState(null);          // 'humain' | 'ia'
  const [result, setResult] = useState(null);

  /* Survie : le niveau est le nombre d'extraits enchaînés sans erreur. */
  const [enCours, setEnCours] = useState(false);
  const [niveau, setNiveau] = useState(1);
  const [record, setRecord] = useState(0);
  const [gameover, setGameover] = useState(false);
  // Le bilan n'est posé qu'une fois le voile de défaite levé : afficher les
  // deux ensemble ferait lire le niveau avant même l'annonce, et le voile
  // n'annoncerait plus rien.
  const [bilan, setBilan] = useState(false);
  const bilanTimer = useRef(null);

  const [dailyCount, setDailyCount] = useState(0);
  const [resultat, setResultat] = useState(null);    // surcouche de fin (quotidien)
  const [defaite, setDefaite] = useState(false);     // surcouche de fin de run (libre)
  const [status, setStatus] = useState(daily
    ? `${DAILY_ROUNDS} extraits à démasquer.`
    : 'Une seule vie. Va le plus loin possible.');

  const { jouer, arreter, basculer, enLecture, enPause } = useLecteurAudio();
  const niveauRef = useRef(1);
  const dailyRngRef = useRef(null);
  const dailyCountRef = useRef(0);
  const dailyGoodRef = useRef(0);
  const dailyDoneRef = useRef(false);

  useEffect(() => {
    if (daily) dailyRngRef.current = seeded('ia');
  }, []);

  // Les voiles de fin se retirent d'eux-mêmes.
  useEffect(() => {
    if (resultat === null) return;
    const t = setTimeout(() => setResultat(null), RES_IA_TOTAL);
    return () => clearTimeout(t);
  }, [resultat]);

  useEffect(() => {
    if (!defaite) return;
    const t = setTimeout(() => setDefaite(false), DEFAITE_IA_TOTAL);
    return () => clearTimeout(t);
  }, [defaite]);

  useEffect(() => () => clearTimeout(bilanTimer.current), []);

  async function pickNicheHuman(rnd) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const term = NICHE_TERMS[Math.floor(rnd() * NICHE_TERMS.length)];
      const tracks = (await searchTracks(term, { limit: 50 }))
        .filter((t) => t.rank > 0 && t.rank < NICHE_MAX_RANK);
      const shuffled = tracks.sort(() => rnd() - 0.5).slice(0, 5);
      for (const t of shuffled) {
        const d = await trackDetails(t.trackId);
        if (d.release_date && d.release_date < HUMAN_CUTOFF && d.preview) {
          return { trackId: t.trackId, isAI: false, artiste: t.artistName, titre: t.trackName, url: d.preview };
        }
      }
    }
    return null;
  }

  async function newRound() {
    if (daily && dailyCountRef.current >= DAILY_ROUNDS) return;
    arreter();
    setLoading(true);
    setResult(null);
    setChoix(null);
    setStatus('Chargement d\'un extrait…');

    try {
      const rnd = daily ? dailyRngRef.current : Math.random;
      const isAI = rnd() < 0.5;
      let r;
      if (isAI) {
        const shuffledAI = [...AI_ARTISTS].sort(() => rnd() - 0.5);
        let t = null;
        for (const name of shuffledAI) {
          const tracks = (await searchTracks(name, { limit: 25 }))
            .filter((x) => normName(x.artistName) === normName(name));
          if (tracks.length) { t = tracks[Math.floor(rnd() * tracks.length)]; break; }
        }
        if (!t) throw new Error('Aucun artiste IA disponible sur Deezer');
        r = { trackId: t.trackId, isAI: true, artiste: t.artistName, titre: t.trackName };
      } else {
        r = await pickNicheHuman(rnd);
        if (!r) {
          const artist = ARTISTS[Math.floor(rnd() * ARTISTS.length)];
          const tracks = await searchTracks(artist.nom, { limit: 25 });
          if (!tracks.length) throw new Error('Aucun résultat');
          const t = tracks[Math.floor(rnd() * tracks.length)];
          r = { trackId: t.trackId, isAI: false, artiste: t.artistName, titre: t.trackName };
        }
      }

      if (!r.url) {
        const url = await freshPreviewUrl(r.trackId);
        if (!url) throw new Error('Preview indisponible pour ce morceau');
        r.url = url;
      }

      setRound(r);
      setAnswered(false);
      setLoading(false);
      setStatus('Écoute bien — humain ou IA ?');
      jouer(r.url, EXTRAIT_SEC);
    } catch (err) {
      console.error('Erreur IA:', err);
      setLoading(false);
      setStatus(`Erreur de chargement : ${err?.message ?? err} — réessaie.`);
    }
  }

  // Démarre un run de survie : le niveau repart de zéro, le record reste.
  function demarrerRun() {
    clearTimeout(bilanTimer.current);
    // Le run démarre au niveau 1 : on est déjà en jeu, pas encore à zéro.
    niveauRef.current = 1;
    setNiveau(1);
    setGameover(false);
    setDefaite(false);
    setBilan(false);
    setEnCours(true);
    setResult(null);
    newRound();
  }

  function relire() {
    if (!round?.url) return;
    if (enLecture) { basculer(); return; }
    jouer(round.url, EXTRAIT_SEC);
  }

  function answer(saysAI) {
    if (answered || !round) return;
    setAnswered(true);
    setChoix(saysAI ? 'ia' : 'humain');
    arreter();

    const correct = saysAI === round.isAI;
    setResult({ correct, isAI: round.isAI, artiste: round.artiste, titre: round.titre });

    /* ---- Mode quotidien : format fixe, trois manches, note sur dix ---- */
    if (daily) {
      dailyCountRef.current += 1;
      if (correct) dailyGoodRef.current += 1;
      setDailyCount(dailyCountRef.current);
      if (dailyCountRef.current >= DAILY_ROUNDS && !dailyDoneRef.current) {
        dailyDoneRef.current = true;
        const s = Math.round((dailyGoodRef.current / DAILY_ROUNDS) * 10 * 10) / 10;
        onDone(s);
        setResultat(s);
        setStatus(`Terminé : ${dailyGoodRef.current} sur ${DAILY_ROUNDS}.`);
        return;
      }
      setStatus(`Manche ${dailyCountRef.current + 1} sur ${DAILY_ROUNDS}.`);
      return;
    }

    /* ---- Mode libre : une seule vie ---- */
    if (correct) {
      niveauRef.current += 1;
      setNiveau(niveauRef.current);
      setRecord((r) => Math.max(r, niveauRef.current));
      setStatus(`Niveau ${niveauRef.current}. Enchaîne.`);
    } else {
      setEnCours(false);
      setGameover(true);
      setDefaite(true);
      setStatus('Une seule vie — le run s\'arrête ici.');
      bilanTimer.current = setTimeout(() => setBilan(true), DEFAITE_IA_TOTAL);
    }
  }

  const dailyFini = daily && dailyCount >= DAILY_ROUNDS;
  const joue = enLecture && !enPause;
  const attenteDepart = !daily && !enCours && !gameover;
  const peutEnchainer = !daily && enCours && result?.correct;

  const etatCarte = (cote) => {
    if (!result) return 'repos';
    if (choix !== cote) return 'estompe';
    return result.correct ? 'juste' : 'faux';
  };

  return (
    <div style={{ ...panel, position: 'relative', textAlign: 'center' }}>
      <style>{`
        @keyframes iaChiffreEntre {
          from { opacity: 0; transform: translateY(${H_LIGNE}px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes iaBilanEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Deux présentations, jamais ensemble. Celle du mode libre ouvre sur
          « Mode survie » et une vie qui bat ; le défi n'a ni survie ni vie,
          son format est fixe et une erreur ne coûte que ses points. Le même
          booléen pilote les deux, si bien que le compteur de niveau reste
          gelé pendant l'une comme pendant l'autre. */}
      {intro && (daily
        ? (
          <IntroIAQuotidien
            manches={DAILY_ROUNDS}
            secondes={EXTRAIT_SEC}
            onFin={() => setIntro(false)}
          />
        )
        : <IntroIA onFin={() => setIntro(false)} />
      )}
      {resultat !== null && (
        <ResultatIA score={resultat} detail={`${dailyGoodRef.current} bonne(s) réponse(s) sur ${DAILY_ROUNDS}`} />
      )}
      {defaite && <DefaiteIA niveau={niveau} />}

      <h3 className="titre-section" style={{ marginBottom: 'var(--e1)' }}>Humain ou IA</h3>
      <p className="description" style={{ maxWidth: 470, margin: '0 auto var(--e4)' }}>
        {daily
          ? `${DAILY_ROUNDS} extraits. Certains sont de vrais morceaux, d'autres sont entièrement générés par une machine.`
          : 'Certains extraits sont de vrais morceaux, souvent obscurs. D\'autres sont entièrement générés par une machine. Une seule erreur et le run s\'arrête.'}
      </p>

      {/* ---- Bandeau de compteurs, sur le modèle des épreuves Rythme et Duel ---- */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
        paddingBottom: 'var(--e3)', marginBottom: 'var(--e4)',
        borderBottom: '0.5px solid var(--filet)',
      }}>
        {(daily
          ? [['manche', `${Math.min(dailyCount + 1, DAILY_ROUNDS)}/${DAILY_ROUNDS}`, 'var(--or)']]
          : [
            ['niveau', 'niveau', 'var(--or)'],
            ['vie', 'vie', null],
            ['record', String(record), 'var(--ivoire)'],
          ]
        ).map(([label, valeur, couleur]) => (
          <div
            key={label}
            style={{
              textAlign: 'center',
              marginLeft: 'var(--e4)', marginRight: 'var(--e4)',
              /* La colonne « vie » se replie une fois l'annonce de défaite
                 jouée : le run est fini, une pastille éteinte laissée là ne
                 dit plus rien. On anime la largeur ET les marges — sinon la
                 place resterait prise et les deux autres colonnes ne se
                 recentreraient pas. */
              ...(label === 'vie' ? {
                overflow: 'hidden',
                maxWidth: bilan ? 0 : 60,
                marginLeft: bilan ? 0 : 'var(--e4)',
                marginRight: bilan ? 0 : 'var(--e4)',
                opacity: bilan ? 0 : 1,
                transition: 'max-width 380ms cubic-bezier(0.4, 0, 0.2, 1), margin 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease',
              } : {}),
            }}
          >
            <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>{label}</div>

            {/* Les trois valeurs partagent la même hauteur de ligne : la
                pastille est plus petite que les chiffres, sans boîte commune
                elle flottait plus haut qu'eux. */}
            {valeur === 'niveau' ? (
              /* Pendant la présentation le compteur affiche 0 : quand le
                 voile se lève, il roule sur 1 et le run commence sous les
                 yeux du joueur. C'est le même geste que la dernière scène
                 de l'intro, tenu jusqu'au vrai départ. */
              <CompteurNiveau valeur={intro ? 0 : niveau} actif={!intro} />
            ) : valeur === 'vie' ? (
              <div style={{
                height: H_LIGNE, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Pastille plutôt que chiffre, comme dans l'épreuve Duel :
                    une vie se compte à l'œil. Éteinte, elle garde son contour
                    — on doit voir la place vide, pas rien du tout. */}
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', boxSizing: 'border-box',
                  border: '1.5px solid',
                  borderColor: gameover ? 'var(--filet-fort)' : 'var(--ivoire)',
                  backgroundColor: gameover ? 'transparent' : 'var(--ivoire)',
                  transition: 'background-color var(--transition-courte), border-color var(--transition-courte)',
                }} />
              </div>
            ) : (
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500,
                lineHeight: `${H_LIGNE}px`, height: H_LIGNE,
                color: couleur, marginTop: 2,
              }}>
                {valeur}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ---- Transport ---- */}
      {!gameover && (
        <div style={{
          display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap',
          justifyContent: 'center', marginBottom: 'var(--e4)',
        }}>
          {(daily || attenteDepart || peutEnchainer) && (
            <button
              onClick={attenteDepart ? demarrerRun : newRound}
              disabled={loading || dailyFini}
              style={btn(true, loading || dailyFini)}
            >
              {loading ? 'Chargement…'
                : dailyFini ? 'Terminé pour aujourd\'hui'
                  : attenteDepart ? 'Commencer le run'
                    : daily ? 'Nouvel extrait' : 'Extrait suivant'}
            </button>
          )}

          {/* Pas de survolOr/sortieOr : le survol écraserait l'or de l'état
              « en lecture » et le sortir le repasserait en ivoire. */}
          {round && (
            <button
              onClick={relire}
              disabled={loading}
              style={{
                ...btn(false, loading),
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
              {joue ? 'Pause' : enPause ? 'Reprendre' : `Réécouter (${EXTRAIT_SEC} s)`}
            </button>
          )}
        </div>
      )}

      {/* ---- Les deux réponses ---- */}
      {!gameover && (
        <div style={{
          display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap',
          justifyContent: 'center', maxWidth: 380, margin: '0 auto',
        }}>
          <CarteReponse
            libelle="Humain" icone={IconeHumain}
            onClick={() => answer(false)} disabled={answered}
            etat={etatCarte('humain')}
          />
          <CarteReponse
            libelle="IA" icone={IconeIA}
            onClick={() => answer(true)} disabled={answered}
            etat={etatCarte('ia')}
          />
        </div>
      )}

      <p style={statusStyle}>{status}</p>

      {/* ---- Révélation en cours de run : ce qu'on vient d'écouter ---- */}
      {result && !gameover && (
        <div style={{
          marginTop: 'var(--e4)', paddingTop: 'var(--e4)',
          borderTop: `1px solid ${result.correct ? 'var(--jade)' : 'var(--carmin)'}`,
          textAlign: 'center',
        }}>
          <div className="etiquette-mono" style={{ color: 'var(--cendre)' }}>
            {result.isAI ? 'généré par une machine' : 'composé par un humain'}
          </div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 500,
            color: 'var(--ivoire)', marginTop: 4,
          }}>
            {result.titre}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--lin)', marginTop: 2 }}>
            {result.artiste}
          </div>
        </div>
      )}

      {/* ---- Bilan de fin de run, sur le modèle du Duel ---- */}
      {gameover && bilan && (
        <div style={{
          marginTop: 'var(--e5)', paddingTop: 'var(--e5)',
          animation: 'iaBilanEntree 340ms ease-out both',
          borderTop: '1px solid var(--or)', textAlign: 'center',
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

          {/* L'extrait fatal : on dit ce que c'était, sinon l'erreur n'apprend rien. */}
          {result && (
            <p className="description" style={{ marginTop: 'var(--e3)' }}>
              {result.isAI ? 'C\'était une IA' : 'C\'était humain'} —{' '}
              <span style={{ color: 'var(--ivoire)' }}>{result.titre}</span>, {result.artiste}
            </p>
          )}

          <button onClick={demarrerRun} style={{ ...btn(true, false), marginTop: 'var(--e4)' }}>
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
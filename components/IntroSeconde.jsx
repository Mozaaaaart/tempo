'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « UNE SECONDE DE PLUS »

   Même dispositif que les autres épreuves : une surcouche `absolute` posée
   DANS le panneau du jeu, pas un voile plein écran, pour que le jeu reste
   visible en transparence derrière. Le panneau parent doit donc porter
   `position: 'relative'`.

   La règle de cette épreuve n'est pas « devine », c'est « chaque erreur
   allonge l'extrait ». Une seule tentative ne la montrerait pas : la
   démonstration se trompe donc deux fois — le disque passe de 1 à 2 puis à
   4 secondes — avant de trouver au troisième essai.

   Trois cycles identiques à valeurs différentes ne se scénarisent pas
   proprement en @keyframes, qui ne savent pas boucler en changeant de contenu
   à chaque tour. Le scénario est donc une table d'instants jouée par des
   minuteurs ; les entrées et le voile restent en @keyframes préfixées `sec`.
============================================================ */

const T_TITRE = 240;
const T_ACCROCHE = 620;
const T_DISQUE = 960;   // le disque d'écoute apparaît
const T_PALIERS = 1300;  // la file des durées
const T_CHAMP = 1600;  // le champ de saisie
const T_CURSEUR = 1900;

/* Un cycle : le curseur REJOINT le disque, puis clique — et c'est seulement
   là que l'extrait part. Sans ce temps d'approche, le son démarrait pendant
   que le curseur était encore en route, et le geste ne semblait causer rien.
   Ensuite il va au champ, tape, valide.
   Trois cycles : deux erreurs, puis la bonne réponse. */
const CYCLES = [2100, 4720, 7340];
const C_APPROCHE = 0;     // le curseur part vers le disque
const C_ECOUTE = 420;   // clic : l'extrait démarre
const C_VERS_CHAMP = 960;   // le curseur quitte le disque
const C_SAISIE = 1400;  // il est arrivé : clic, puis la frappe commence
const C_VALIDE = 2120;  // clic sur « Valider »
const C_VERDICT = 2320;  // le jeton tombe

/* Chaque déplacement dure 420 ms — la valeur de la transition du curseur.
   Les instants de clic sont donc toujours postérieurs d'au moins autant à
   l'instant de départ correspondant : le geste arrive avant son effet. */

const PAS_LETTRE = 45;    // écart entre deux caractères frappés

const T_SORTIE = CYCLES[2] + C_VERDICT + 1200;
export const INTRO_SECONDE_TOTAL = T_SORTIE + 420;

/* Ce que la démonstration tape, dans l'ordre. Les deux premières réponses
   sont fausses — c'est ce qui fait monter la durée. */
const DEMO_SAISIES = [
  { texte: 'Coldplay', juste: false },
  { texte: 'Yellow', juste: false },
  { texte: 'Viva la Vida', juste: true },
];
const DEMO_PALIERS = [1, 2, 4, 7, 11, 16];

const SCENE_L = 520;
const SCENE_H = 400;
const H_CONTRAINTE = SCENE_H + 40;

const REPOS = { x: 430, y: 360 };
const DISQUE = { x: 268, y: 150 };
const CHAMP = { x: 210, y: 316 };
const VALIDER = { x: 372, y: 316 };

export default function IntroSeconde({ onFin }) {
  const [echelle, setEchelle] = useState(1);
  const [etape, setEtape] = useState(-1);
  const hote = useRef(null);
  const fini = useRef(false);
  const minuteurs = useRef([]);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    minuteurs.current.forEach(clearTimeout);
    onFin?.();
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }

    CYCLES.forEach((base, i) => {
      [C_APPROCHE, C_ECOUTE, C_VERS_CHAMP, C_SAISIE, C_VALIDE, C_VERDICT].forEach((offset, j) => {
        minuteurs.current.push(setTimeout(() => setEtape(i * 6 + j), base + offset));
      });
    });
    minuteurs.current.push(setTimeout(terminer, INTRO_SECONDE_TOTAL));

    const surTouche = (e) => { if (e.key === 'Escape') terminer(); };
    window.addEventListener('keydown', surTouche);
    return () => {
      minuteurs.current.forEach(clearTimeout);
      window.removeEventListener('keydown', surTouche);
    };
  }, []);

  useEffect(() => {
    const calc = () => {
      const l = hote.current?.offsetWidth ?? SCENE_L;
      const h = hote.current?.offsetHeight ?? SCENE_H;
      setEchelle(Math.min(1, (l - 24) / SCENE_L, (h - 40) / H_CONTRAINTE));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  /* ---- États dérivés du numéro d'étape ---- */
  const cycle = etape < 0 ? 0 : Math.floor(etape / 6);
  // 0 approche · 1 écoute · 2 vers le champ · 3 saisie · 4 valide · 5 verdict
  const phase = etape < 0 ? -1 : etape % 6;
  const rendus = etape < 0 ? 0 : cycle + (phase === 5 ? 1 : 0);  // réponses données
  const palier = Math.min(rendus, DEMO_PALIERS.length - 1);
  const duree = DEMO_PALIERS[palier];
  const joue = phase === 1;   // le disque ne s'allume qu'au clic
  const trouve = rendus >= DEMO_SAISIES.length;
  const jetons = DEMO_SAISIES.slice(0, rendus);

  const curseur = etape < 0 ? REPOS
    : phase <= 1 ? DISQUE
      : phase <= 3 ? CHAMP
        : VALIDER;

  return (
    <div
      ref={hote}
      data-sec-surcouche
      onClick={terminer}
      role="button"
      tabIndex={0}
      aria-label="Passer la présentation"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); terminer(); }
      }}
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `secVoile ${INTRO_SECONDE_TOTAL}ms ease-out both`,
      }}
    >
      <style>{`
        @keyframes secVoile {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes secEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes secSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes secPulse {
          0%   { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.45); }
        }
        @keyframes secClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @keyframes secLettre {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes secCaret {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes secJetonIntro {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-sec-surcouche], [data-sec-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>

      <div style={{
        width: SCENE_L, height: SCENE_H, position: 'relative',
        transform: `scale(${echelle})`, transformOrigin: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, animation: `secSortie 340ms ${T_SORTIE}ms ease-in both` }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `secEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Une seconde de plus
          </div>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 38, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `secEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            Chaque erreur allonge l&apos;extrait
          </div>

          {/* ---------- Disque d'écoute ---------- */}
          <div style={{
            position: 'absolute', top: 76, left: '50%', marginLeft: -56,
            width: 112, height: 112,
            animation: `secEntree 340ms ${T_DISQUE}ms ease-out both`,
          }}>
            {joue && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid var(--or)',
                animation: 'secPulse 1400ms ease-out infinite',
              }} />
            )}
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 'var(--e3)',
              background: 'var(--onyx-haut)',
              border: `1px solid ${joue ? 'var(--or)' : 'var(--filet-fort)'}`,
              color: joue ? 'var(--or)' : 'var(--ivoire)',
              transition: 'border-color 250ms ease, color 250ms ease',
            }}>
              {/* Le glyphe bascule en pause pendant la lecture, comme sur le
                  vrai bouton : c'est lui qui dit que l'extrait tourne, le halo
                  ne fait que l'accompagner. */}
              {joue ? (
                <svg width="14" height="17" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="0" width="3" height="12" />
                  <rect x="7" y="0" width="3" height="12" />
                </svg>
              ) : (
                <svg width="14" height="17" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 0v12l10-6z" />
                </svg>
              )}
              <span style={{ display: 'block', lineHeight: 1 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500 }}>{duree}</span>
                <span className="etiquette-mono" style={{ display: 'block', color: 'var(--cendre)', marginTop: 6 }}>
                  seconde{duree > 1 ? 's' : ''}
                </span>
              </span>
            </div>
          </div>

          {/* ---------- Paliers ---------- */}
          <div style={{
            position: 'absolute', top: 204, left: 0, right: 0,
            display: 'flex', gap: 5, justifyContent: 'center',
            animation: `secEntree 320ms ${T_PALIERS}ms ease-out both`,
          }}>
            {DEMO_PALIERS.map((d, i) => {
              const actuel = i === palier;
              const passe = i < palier;
              return (
                <span key={d} style={{
                  fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.04em',
                  padding: '4px 8px', borderRadius: 'var(--rayon-controle)',
                  background: actuel ? 'var(--onyx-haut)' : 'transparent',
                  border: `${actuel ? '1px' : '0.5px'} solid ${actuel ? 'var(--or)' : 'var(--filet)'}`,
                  color: actuel ? 'var(--or)' : passe ? 'var(--cendre)' : 'var(--lin)',
                  transition: 'border-color 300ms ease, color 300ms ease, background 300ms ease',
                }}>
                  {d} s
                </span>
              );
            })}
          </div>

          {/* ---------- Saisie ---------- */}
          <div style={{
            position: 'absolute', top: 296, left: '50%', marginLeft: -190,
            width: 380, display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
            animation: `secEntree 320ms ${T_CHAMP}ms ease-out both`,
          }}>
            <div style={{
              flex: 1, height: 40, boxSizing: 'border-box', padding: '0 14px',
              display: 'flex', alignItems: 'center',
              background: 'var(--onyx-haut)',
              /* Au verdict, le filet dit la réponse : carmin si c'est raté,
                 jade si c'est trouvé. Pendant la frappe il reste or, comme un
                 champ actif ordinaire. */
              border: phase === 5
                ? `1px solid ${DEMO_SAISIES[cycle].juste ? 'var(--jade)' : 'var(--carmin)'}`
                : `0.5px solid ${phase === 3 || phase === 4 ? 'var(--or)' : 'var(--filet-fort)'}`,
              borderRadius: 'var(--rayon-controle)',
              fontFamily: 'var(--sans)', fontSize: 14,
              color: 'var(--ivoire)',
              transition: 'border-color 200ms ease',
            }}>
              {/* Frappe au clavier : une animation par lettre, décalée de
                  PAS_LETTRE. Le délai est RELATIF au montage — le bloc
                  n'apparaît qu'à l'entrée en phase de saisie, donc l'horloge
                  des animations démarre à cet instant. Un délai absolu, calé
                  sur le début de l'intro, aurait repoussé les lettres bien
                  après la fin du cycle. */}
              {phase >= 3 ? (
                <span>
                  {DEMO_SAISIES[cycle].texte.split('').map((c, i) => (
                    <span
                      key={i}
                      style={{
                        opacity: 0,
                        animation: `secLettre 90ms ${i * PAS_LETTRE}ms ease-out both`,
                      }}
                    >
                      {c === ' ' ? '\u00a0' : c}
                    </span>
                  ))}
                  {/* Curseur de saisie : il clignote pendant la frappe puis
                      disparaît à la validation. */}
                  {/* Le curseur de saisie disparaît à la validation : on ne
                      tape plus, on lit le verdict. */}
                  {phase < 5 && (
                    <span style={{
                      display: 'inline-block', width: 1, height: 15,
                      background: 'var(--or)', marginLeft: 1,
                      verticalAlign: 'text-bottom',
                      animation: 'secCaret 620ms step-end infinite',
                    }} />
                  )}
                </span>
              ) : (
                <span style={{ color: 'var(--cendre)' }}>Titre ou artiste…</span>
              )}
            </div>

            <div style={{
              height: 40, padding: '0 16px', display: 'flex', alignItems: 'center',
              borderRadius: 'var(--rayon-controle)',
              background: 'var(--or)', color: 'var(--noir)',
              border: '1px solid var(--or)',
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500,
            }}>
              Valider
            </div>
          </div>

          {/* ---------- Jetons de réponse ---------- */}
          <div style={{
            position: 'absolute', top: 350, left: 0, right: 0,
            display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {jetons.map((j, i) => (
              <span key={`${j.texte}-${i}`} style={{
                fontFamily: 'var(--sans)', fontSize: 11.5,
                padding: '4px 9px', borderRadius: 'var(--rayon-controle)',
                background: 'var(--onyx-haut)',
                color: j.juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.65)',
                border: `0.5px solid ${j.juste ? 'var(--jade)' : 'rgba(226, 75, 74, 0.3)'}`,
                animation: 'secJetonIntro 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}>
                {j.texte}
              </span>
            ))}
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${curseur.x}px, ${curseur.y}px)`,
            transition: 'transform 420ms cubic-bezier(0.5, 0, 0.2, 1)',
            opacity: etape < 0 ? 0 : 1,
          }}>
            {CYCLES.flatMap((base) => [base + C_ECOUTE, base + C_SAISIE, base + C_VALIDE]).map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%', opacity: 0,
                animation: `secClic 460ms ${t - 40}ms ease-out both`,
              }} />
            ))}
            <svg width="16" height="21" viewBox="0 0 16 21" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
              <path
                d="M0 0 L0 17 L4.6 12.9 L7.4 18.6 L10.2 17.3 L7.5 11.8 L13.4 11.8 Z"
                fill="var(--ivoire)" stroke="var(--noir)" strokeWidth={1} strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SURCOUCHE DE RÉSULTAT
   Même dispositif que les autres épreuves : la note occupe le panneau le
   temps d'être lue, sa couleur dit le verdict avant le chiffre, la jauge la
   situe sur dix.
============================================================ */

function paletteScore(valeur) {
  const n = +valeur;
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'perdu' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'en une seconde' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bien vu' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'trouvé' };
  return { couleur: 'var(--ivoire)', mention: 'de justesse' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_SECONDE_TOTAL = 2900;

export function ResultatSeconde({ score, detail = null }) {
  const { couleur, mention } = paletteScore(score);
  // La jauge se remplit par transition plutôt que par @keyframes : sa valeur
  // d'arrivée dépend du score, et une keyframe est une règle statique qu'on
  // ne peut pas paramétrer par instance.
  const [remplie, setRemplie] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRemplie(true), RES_BARRE);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      data-sec-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e3)', textAlign: 'center', padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `secVoile ${RES_SECONDE_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes secVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes secEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes secSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes secNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-sec-surcouche], [data-sec-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e3)',
        animation: `secSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `secEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
        }}>
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 62, fontWeight: 500, lineHeight: 1,
          color: couleur,
          animation: `secNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
        }}>
          {(+score).toFixed(1).replace('.', ',')}
          <span style={{ color: 'var(--cendre)', fontSize: 30 }}> / 10</span>
        </div>

        <div style={{
          width: 200, height: 3, borderRadius: 2,
          background: 'var(--filet-fort)', overflow: 'hidden', marginTop: 'var(--e2)',
        }}>
          <div style={{
            height: '100%', width: '100%', borderRadius: 2, background: couleur,
            transformOrigin: 'left center',
            transform: `scaleX(${remplie ? Math.max(0, Math.min(1, +score / 10)) : 0})`,
            transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 500, lineHeight: 1,
          letterSpacing: '0.06em', textTransform: 'uppercase', color: couleur,
          marginTop: 'var(--e2)',
          animation: `secEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {detail && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
            maxWidth: 320,
            animation: `secEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
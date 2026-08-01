'use client';
import { useEffect, useRef, useState } from 'react';

/* ============================================================
   SURCOUCHE D'INTRODUCTION — ÉPREUVE « COMPLÈTE LE REFRAIN »

   Même dispositif que les autres épreuves : une surcouche `absolute` posée
   DANS le panneau du jeu, pas un voile plein écran, pour que le jeu reste
   visible en transparence derrière. Le panneau parent doit donc porter
   `position: 'relative'`.

   La règle de cette épreuve n'est pas « tape la ligne », c'est « chaque
   erreur dévoile des mots ». Une seule tentative ne la montrerait pas : la
   démonstration se trompe donc deux fois — des mots apparaissent à chaque
   raté — avant de taper la bonne ligne en entier.

   Le scénario est une table d'instants jouée par des minuteurs : trois
   cycles de saisie à contenus différents ne se scénarisent pas en
   @keyframes, qui ne savent pas boucler en changeant de texte.
============================================================ */

const T_TITRE = 240;
const T_ACCROCHE = 620;
const T_PAROLES = 980;   // le bloc de contexte se pose
const T_LIGNE = 1340;  // la ligne masquée apparaît
const T_CHAMP = 1660;  // le champ de saisie
const T_CURSEUR = 1960;

/* Un cycle : le curseur rejoint le champ, clique, tape, valide.
   Trois cycles — deux erreurs, puis la bonne réponse. */
const CYCLES = [2250, 4900, 7550];
const C_VERS_CHAMP = 0;
const C_CLIC = 440;    // il est arrivé : clic, la frappe commence
const C_VERS_BOUTON = 1300;
const C_VALIDE = 1740;   // clic sur « Valider »
const C_VERDICT = 1960;   // les mots se dévoilent, ou la ligne est juste

const PAS_LETTRE = 32;     // écart entre deux caractères frappés

const T_SORTIE = CYCLES[2] + C_VERDICT + 1500;
export const INTRO_REFRAIN_TOTAL = T_SORTIE + 420;

/* Paroles de démonstration : « Amazing Grace », John Newton, 1779 — DOMAINE
   PUBLIC, comme les mélodies de l'épreuve Instrument.

   Un tube récent aurait été plus parlant, mais ses paroles sont protégées :
   les reproduire, même sur quatre lignes dans une présentation, sort du cadre
   que le projet s'est fixé — n'utiliser que ce qu'on a le droit de diffuser.
   Ce cantique a l'avantage d'être reconnu partout dans le monde, et sa
   dernière ligne est l'une des plus célèbres de la langue anglaise. */
const LIGNE = 'was blind but now I see';
const SAISIES = ['was blind but now im free', 'I once was blind and now I see', LIGNE];
const CONTEXTE = [
  'Amazing grace, how sweet the sound',
  'That saved a wretch like me',
  'I once was lost, but now am found',
];

/* Mots révélés après 0, 1 puis 2 erreurs — un cinquième de la ligne à chaque
   raté, comme dans le jeu. */
const MOTS = LIGNE.split(' ');
const REVELES = [0, Math.ceil(MOTS.length / 5), Math.ceil((MOTS.length * 2) / 5)];

const SCENE_L = 520;
const SCENE_H = 400;
const H_CONTRAINTE = SCENE_H + 40;

/* Cibles du curseur, calculées sur la rangée de saisie : elle fait 430 px de
   large, centrée sur une scène de 520 — donc son bord gauche est à 45. Le
   bouton « Valider » occupe les ~77 px de droite, son centre tombe donc vers
   436, pas 372 : le clic atterrissait dans le champ. */
const RANGEE_X = (SCENE_L - 430) / 2;
const RANGEE_Y = 292 + 19;              // haut de la rangée + demi-hauteur
const BOUTON_L = 77;

const REPOS = { x: 430, y: 372 };
const CHAMP = { x: RANGEE_X + 160, y: RANGEE_Y };
const BOUTON = { x: RANGEE_X + 430 - BOUTON_L / 2, y: RANGEE_Y };

export default function IntroRefrain({ onFin }) {
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
      [C_VERS_CHAMP, C_CLIC, C_VERS_BOUTON, C_VALIDE, C_VERDICT].forEach((offset, j) => {
        minuteurs.current.push(setTimeout(() => setEtape(i * 5 + j), base + offset));
      });
    });
    minuteurs.current.push(setTimeout(terminer, INTRO_REFRAIN_TOTAL));

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
  const cycle = etape < 0 ? 0 : Math.floor(etape / 5);
  // 0 vers le champ · 1 frappe · 2 vers le bouton · 3 validation · 4 verdict
  const phase = etape < 0 ? -1 : etape % 5;
  const rendus = etape < 0 ? 0 : cycle + (phase === 4 ? 1 : 0);   // réponses données
  const trouve = rendus >= SAISIES.length;

  const motsReveles = trouve ? MOTS.length : REVELES[Math.min(rendus, REVELES.length - 1)];
  const saisieVisible = phase === 1 || phase === 2 || phase === 3;
  const rate = phase === 4 && !trouve;

  const main = etape < 0 ? REPOS
    : phase <= 1 ? CHAMP
      : BOUTON;

  return (
    <div
      ref={hote}
      data-ref-surcouche
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
        animation: `refVoile ${INTRO_REFRAIN_TOTAL}ms ease-out both`,
      }}
    >
      <style>{`
        @keyframes refVoile {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes refIntroEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes refIntroSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes refIntroMot {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes refIntroLettre {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes refIntroCaret {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes refIntroClic {
          0%   { opacity: 0; transform: scale(0.3); }
          25%  { opacity: 0.75; transform: scale(0.3); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ref-surcouche], [data-ref-surcouche] * {
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
        <div style={{ position: 'absolute', inset: 0, animation: `refIntroSortie 340ms ${T_SORTIE}ms ease-in both` }}>

          {/* ---------- Titre ---------- */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 500, lineHeight: 1,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--or)',
            animation: `refIntroEntree 340ms ${T_TITRE}ms ease-out both`,
          }}>
            Complète le refrain
          </div>

          {/* ---------- Accroche ---------- */}
          <div style={{
            position: 'absolute', top: 38, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--lin)',
            animation: `refIntroEntree 320ms ${T_ACCROCHE}ms ease-out both`,
          }}>
            Chaque erreur dévoile des mots
          </div>

          {/* ---------- Le bloc de paroles ---------- */}
          <div style={{
            position: 'absolute', top: 78, left: '50%', marginLeft: -230, width: 460,
            boxSizing: 'border-box',
            padding: 'var(--e4) var(--e4)',
            background: 'var(--onyx-haut)',
            borderRadius: 'var(--rayon-carte)',
            border: '0.5px solid var(--filet)',
            textAlign: 'center',
            animation: `refIntroEntree 340ms ${T_PAROLES}ms ease-out both`,
          }}>
            {CONTEXTE.map((l, i) => (
              <div key={i} style={{
                fontFamily: 'var(--sans)', fontSize: 13.5, lineHeight: 1.6,
                color: i === CONTEXTE.length - 1 ? 'var(--ivoire)' : 'var(--lin)',
              }}>
                {l}
              </div>
            ))}

            {/* La ligne masquée : un trait par lettre, les mots dévoilés en or. */}
            <div style={{
              marginTop: 'var(--e3)', paddingTop: 'var(--e3)',
              borderTop: '0.5px solid var(--filet)',
              display: 'flex', flexWrap: 'wrap', gap: '0 9px',
              justifyContent: 'center', alignItems: 'flex-end', minHeight: 22,
              opacity: 0,
              animation: `refIntroEntree 320ms ${T_LIGNE}ms ease-out both`,
            }}>
              {MOTS.map((mot, i) => {
                if (i < motsReveles) {
                  return (
                    <span key={i} style={{
                      fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--or)', lineHeight: 1.4,
                      // Seuls les mots qui viennent d'arriver s'animent : sinon
                      // toute la ligne rejouerait son apparition à chaque raté.
                      animation: `refIntroMot 420ms ${(i - REVELES[Math.max(0, rendus - 1)]) * 70}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                    }}>
                      {mot}
                    </span>
                  );
                }
                return (
                  <span key={i} style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end' }}>
                    {mot.split('').map((_, j) => (
                      <span key={j} style={{
                        display: 'inline-block', width: 8, height: 13,
                        borderBottom: '1.5px solid var(--or)',
                      }} />
                    ))}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ---------- Saisie ---------- */}
          <div style={{
            position: 'absolute', top: 292, left: '50%', marginLeft: -215,
            width: 430, display: 'flex', gap: 'var(--e2)', justifyContent: 'center',
            animation: `refIntroEntree 320ms ${T_CHAMP}ms ease-out both`,
          }}>
            <div style={{
              flex: 1, height: 38, boxSizing: 'border-box', padding: '0 13px',
              display: 'flex', alignItems: 'center',
              background: 'var(--onyx-haut)',
              border: rate
                ? '1px solid var(--carmin)'
                : phase === 4 && trouve
                  ? '1px solid var(--jade)'
                  : `0.5px solid ${saisieVisible ? 'var(--or)' : 'var(--filet-fort)'}`,
              borderRadius: 'var(--rayon-controle)',
              fontFamily: 'var(--sans)', fontSize: 13.5,
              color: 'var(--ivoire)',
              transition: 'border-color 200ms ease',
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}>
              {saisieVisible || phase === 4 ? (
                <span>
                  {/* Frappe au clavier : le délai de chaque lettre est RELATIF
                      au montage du bloc, qui a lieu à l'entrée en phase de
                      saisie. Un délai absolu repousserait les lettres bien
                      après la fin du cycle. */}
                  {SAISIES[cycle].split('').map((c, i) => (
                    <span key={i} style={{
                      opacity: 0,
                      animation: `refIntroLettre 80ms ${i * PAS_LETTRE}ms ease-out both`,
                    }}>
                      {c === ' ' ? '\u00a0' : c}
                    </span>
                  ))}
                  {phase < 4 && (
                    <span style={{
                      display: 'inline-block', width: 1, height: 14,
                      background: 'var(--or)', marginLeft: 1,
                      verticalAlign: 'text-bottom',
                      animation: 'refIntroCaret 620ms step-end infinite',
                    }} />
                  )}
                </span>
              ) : (
                <span style={{ color: 'var(--cendre)' }}>La ligne suivante…</span>
              )}
            </div>

            <div style={{
              height: 38, padding: '0 16px', display: 'flex', alignItems: 'center',
              borderRadius: 'var(--rayon-controle)',
              background: 'var(--or)', color: 'var(--noir)',
              border: '1px solid var(--or)',
              fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500,
            }}>
              Valider
            </div>
          </div>

          {/* ---------- Compteur d'essais ---------- */}
          <div className="etiquette-mono" style={{
            position: 'absolute', top: 344, left: 0, right: 0, textAlign: 'center',
            color: trouve ? 'var(--jade)' : 'var(--cendre)',
            transition: 'color 250ms ease',
            animation: `refIntroEntree 320ms ${T_CHAMP + 140}ms ease-out both`,
          }}>
            {trouve
              ? 'ligne trouvée'
              : `${5 - rendus} essais · ${[10, 8, 6, 4, 2][Math.min(rendus, 4)]} points`}
          </div>

          {/* ---------- Curseur ---------- */}
          <div style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${main.x}px, ${main.y}px)`,
            transition: 'transform 400ms cubic-bezier(0.5, 0, 0.2, 1)',
            opacity: etape < 0 ? 0 : 1,
          }}>
            {CYCLES.flatMap((base) => [base + C_CLIC, base + C_VALIDE]).map((t) => (
              <div key={t} style={{
                position: 'absolute', left: -9, top: -9, width: 22, height: 22,
                border: '1px solid var(--or-clair)', borderRadius: '50%', opacity: 0,
                animation: `refIntroClic 460ms ${t - 40}ms ease-out both`,
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
  if (n <= 0) return { couleur: 'var(--carmin)', mention: 'ligne manquée' };
  if (n >= 9.5) return { couleur: 'var(--jade)', mention: 'du premier coup' };
  if (n >= 7) return { couleur: 'var(--or)', mention: 'bien vu' };
  if (n >= 4) return { couleur: 'var(--ivoire)', mention: 'trouvé' };
  return { couleur: 'var(--ivoire)', mention: 'de justesse' };
}

const RES_ETIQUETTE = 280;
const RES_NOTE = 460;
const RES_BARRE = 900;
const RES_MENTION = 1150;
const RES_SORTIE = 2700;
export const RES_REFRAIN_TOTAL = 2900;

export function ResultatRefrain({ score, detail = null, ligne = null }) {
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
      data-ref-surcouche
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 'var(--e3)', textAlign: 'center', padding: 'var(--e4)',
        background: 'rgba(6, 6, 7, 0.86)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `refVoile ${RES_REFRAIN_TOTAL}ms ease-out both`,
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes refVoile {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes refIntroEntree {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes refIntroSortie {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        @keyframes refNote {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ref-surcouche], [data-ref-surcouche] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e3)',
        animation: `refIntroSortie 320ms ${RES_SORTIE}ms ease-in both`,
      }}>
        <div className="etiquette-mono" style={{
          color: 'var(--cendre)',
          animation: `refIntroEntree 300ms ${RES_ETIQUETTE}ms ease-out both`,
        }}>
          ton score
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 62, fontWeight: 500, lineHeight: 1,
          color: couleur,
          animation: `refNote 420ms ${RES_NOTE}ms cubic-bezier(0.34, 1.4, 0.64, 1) both`,
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
          animation: `refIntroEntree 320ms ${RES_MENTION}ms ease-out both`,
        }}>
          {mention}
        </div>

        {/* La ligne cherchée est rappelée ici : c'est la réponse, et elle a
            plus de sens sur le voile qu'au milieu du bloc de paroles qu'on
            vient de quitter. */}
        {ligne && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--or)',
            maxWidth: 380, lineHeight: 1.4,
            animation: `refIntroEntree 320ms ${RES_MENTION + 160}ms ease-out both`,
          }}>
            « {ligne} »
          </div>
        )}

        {detail && (
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--lin)',
            maxWidth: 320,
            animation: `refIntroEntree 320ms ${RES_MENTION + 280}ms ease-out both`,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
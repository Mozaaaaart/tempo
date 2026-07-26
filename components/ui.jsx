'use client';

/**
 * Composants de base — Mozart Benchmark.
 * Tous les styles viennent des jetons de globals.css : aucune couleur en dur ici.
 */

/* ---------- Panneau : surface surélevée (onyx, rayon 12, filet 0,5) ---------- */
export function Panneau({ children, actif = false, style, ...props }) {
  return (
    <section
      style={{
        background: 'var(--onyx)',
        border: `${actif ? '1px' : '0.5px'} solid ${actif ? 'var(--or)' : 'var(--filet)'}`,
        borderRadius: 'var(--rayon-carte)',
        padding: 'var(--e6)',
        marginBottom: 'var(--e4)',
        transition: `border-color var(--transition-courte)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </section>
  );
}

/* ---------- Bouton : primaire (fond or) ou secondaire (filet) ---------- */
export function Bouton({ children, primaire = false, disabled = false, style, ...props }) {
  return (
    <button
      disabled={disabled}
      style={{
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
        transition: `background var(--transition-courte), border-color var(--transition-courte), color var(--transition-courte)`,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (!primaire) e.currentTarget.style.background = 'var(--onyx-haut)';
        else e.currentTarget.style.background = 'var(--or-clair)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = primaire ? 'var(--or)' : 'transparent';
      }}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Rangée de boutons ---------- */
export function Actions({ children, style }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--e2)', flexWrap: 'wrap', ...style }}>
      {children}
    </div>
  );
}

/* ---------- Étiquette mono en capitales ---------- */
export function Etiquette({ children, couleur = 'var(--or)', style }) {
  return (
    <div
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: couleur,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Titre d'épreuve + description ---------- */
export function EnTeteEpreuve({ numero, titre, description }) {
  return (
    <header style={{ marginBottom: 'var(--e4)' }}>
      {numero && <Etiquette couleur="var(--cendre)">Épreuve {numero}</Etiquette>}
      <h3 className="titre-section" style={{ marginTop: numero ? 'var(--e1)' : 0 }}>{titre}</h3>
      {description && (
        <p className="description" style={{ marginTop: 'var(--e1)' }}>{description}</p>
      )}
    </header>
  );
}

/* ---------- Ligne d'état (mono, hauteur fixe pour éviter les sauts) ---------- */
export function Etat({ children }) {
  return (
    <p
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--lin)',
        minHeight: '1.5em',
        marginTop: 'var(--e4)',
      }}
    >
      {children}
    </p>
  );
}

/* ---------- Score : jade réservé au parfait (≥ 9,5), carmin à l'échec (< 4) ---------- */
export function Score({ valeur, sur = 10, detail }) {
  if (valeur === null || valeur === undefined) return null;
  const n = Number(valeur);
  const couleur = n >= 9.5 ? 'var(--jade)' : n < 4 ? 'var(--carmin)' : 'var(--ivoire)';
  return (
    <div
      style={{
        marginTop: 'var(--e4)',
        paddingTop: 'var(--e4)',
        borderTop: '0.5px solid var(--filet)',
      }}
    >
      <div className="score-affiche" style={{ color: couleur }}>
        {n.toFixed(1).replace('.', ',')} <span style={{ color: 'var(--cendre)' }}>/ {sur}</span>
      </div>
      {detail && <p className="description" style={{ marginTop: 'var(--e2)' }}>{detail}</p>}
    </div>
  );
}

/* ---------- Champ de saisie ---------- */
export function Champ({ style, ...props }) {
  return (
    <input
      style={{
        fontFamily: 'var(--sans)',
        fontSize: 14,
        background: 'var(--onyx-haut)',
        color: 'var(--ivoire)',
        border: '0.5px solid var(--filet-fort)',
        borderRadius: 'var(--rayon-controle)',
        padding: '9px 14px',
        minWidth: 220,
        transition: `border-color var(--transition-courte)`,
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--or)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--filet-fort)'; }}
      {...props}
    />
  );
}

/* ---------- Curseur (jeu BPM) ---------- */
export function Curseur({ style, ...props }) {
  return (
    <input
      type="range"
      style={{ width: '100%', accentColor: 'var(--or)', margin: 'var(--e4) 0 var(--e2)', ...style }}
      {...props}
    />
  );
}

/* ---------- Citation (paroles) : filet unilatéral ⇒ rayon 0 ---------- */
export function Citation({ children }) {
  return (
    <blockquote
      style={{
        borderLeft: '1px solid var(--or)',
        borderRadius: 0,
        background: 'var(--onyx-haut)',
        padding: 'var(--e3) var(--e5)',
        whiteSpace: 'pre-line',
        color: 'var(--ivoire)',
        margin: 'var(--e4) 0',
      }}
    >
      {children}
    </blockquote>
  );
}

/* ---------- Page d'épreuve : en-tête minimal + contenu 728 px ---------- */
export function PageEpreuve({ titre, description, children }) {
  return (
    <main className="contenu">
      <a href="/" style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        ← retour
      </a>
      <h1 className="titre-page" style={{ marginTop: 'var(--e4)' }}>{titre}</h1>
      {description && (
        <p className="lin" style={{ marginTop: 'var(--e2)', marginBottom: 'var(--e6)', maxWidth: 470 }}>
          {description}
        </p>
      )}
      {children}
    </main>
  );
}
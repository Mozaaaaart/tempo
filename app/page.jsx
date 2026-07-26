'use client';

const JEUX_LIBRES = [
  { href: '/jeux/accords', titre: 'Retrouve l\'accord', desc: 'Écoute et reproduis un accord sur la portée.' },
  { href: '/jeux/rythme', titre: 'Reproduis le rythme', desc: 'Un run de patterns : le niveau monte tant que tu tiens.' },
  { href: '/jeux/ia', titre: 'Humain ou IA ?', desc: 'Vrai morceau ou musique générée par IA ?' },
  { href: '/jeux/artiste', titre: 'Trouve l\'artiste', desc: 'Indices comparés façon Loldle.' },
  { href: '/jeux/pochette', titre: 'Pochette floutée', desc: 'Le flou diminue à chaque erreur.' },
  { href: '/jeux/seconde', titre: 'Une seconde de plus', desc: 'Chaque erreur allonge l\'extrait.' },
  { href: '/jeux/bpm', titre: 'Trouve le BPM', desc: 'Retrouve le tempo au métronome.' },
  { href: '/jeux/instrument', titre: 'Trouve l\'instrument', desc: 'Un timbre acoustique mystère.' },
  { href: '/jeux/paroles', titre: 'Paroles mystères', desc: 'Retrouve le morceau via ses paroles.' },
  { href: '/jeux/refrain', titre: 'Complète le refrain', desc: 'Tape la ligne qui suit.' },
];

export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', background: '#0c0e15', minHeight: '100vh', color: '#e9e7de' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: 8 }}>tem<span style={{ color: '#f2c14e' }}>po</span>.</h1>
      <p style={{ color: '#9aa0b4', marginBottom: 32 }}>Des mini-jeux musicaux courts et rejouables.</p>

      {/* Défi du jour — mis en avant */}
      <a href="/quotidien" style={{
        display: 'block', textDecoration: 'none', color: '#1a1405',
        background: 'linear-gradient(135deg, #f2c14e, #e8a933)',
        borderRadius: 14, padding: '26px 24px', marginBottom: 36,
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 4 }}>⭐ Le Quotidien</h2>
        <p style={{ fontSize: '0.95rem', opacity: 0.85 }}>
          10 défis, les mêmes pour tout le monde aujourd'hui. Fais ton score et partage-le !
        </p>
      </a>

      <h2 style={{ fontSize: '1.2rem', color: '#9aa0b4', marginBottom: 16, fontWeight: 600 }}>Jeux libres — rejouables à volonté</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {JEUX_LIBRES.map((j) => (
          <a key={j.href} href={j.href} style={{
            background: '#151826', border: '1px solid #2a2f45', borderRadius: 14,
            padding: 22, textDecoration: 'none', color: '#e9e7de', display: 'block',
          }}>
            <h3 style={{ marginBottom: 6 }}>{j.titre}</h3>
            <p style={{ color: '#9aa0b4', fontSize: '0.9rem' }}>{j.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
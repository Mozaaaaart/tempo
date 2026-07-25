'use client';

export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', background: '#0c0e15', minHeight: '100vh', color: '#e9e7de' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: 8 }}>tem<span style={{ color: '#f2c14e' }}>po</span>.</h1>
      <p style={{ color: '#9aa0b4', marginBottom: 40 }}>Des mini-jeux musicaux courts et rejouables.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { href: '/jeux/accords', titre: 'Retrouve l\'accord', desc: 'Écoute et reproduis un accord sur la portée.' },
          { href: '/jeux/rythme', titre: 'Reproduis le rythme', desc: 'Tape le pattern de percussion en rythme.' },
          { href: '/jeux/octave', titre: 'Octave ou pas ?', desc: 'Original ou décalé d\'une octave ?' },
          { href: '/quotidien', titre: 'Le Quotidien', desc: '7 mini-défis, les mêmes pour tout le monde.' },
        ].map((j) => (
          <a key={j.href} href={j.href} style={{
            background: '#151826', border: '1px solid #2a2f45', borderRadius: 14,
            padding: 22, textDecoration: 'none', color: '#e9e7de', display: 'block'
          }}>
            <h3 style={{ marginBottom: 6 }}>{j.titre}</h3>
            <p style={{ color: '#9aa0b4', fontSize: '0.9rem' }}>{j.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
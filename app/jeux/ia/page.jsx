'use client';
import JeuIAGame from '@/components/JeuIAGame';

export default function Page() {
  return (
    <main style={{ padding: 40, background: '#0c0e15', minHeight: '100vh', color: '#e9e7de', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ color: '#9aa0b4', fontSize: '0.85rem' }}>← Accueil</a>
      <h2 style={{ fontSize: '2rem', margin: '12px 0 16px' }}>Humain ou IA ?</h2>
      <JeuIAGame />
    </main>
  );
}
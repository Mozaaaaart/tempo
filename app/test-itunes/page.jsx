'use client';
import { useState } from 'react';
import { searchTracks, highResArtwork } from '@/utils/itunes';

export default function TestItunes() {
  const [tracks, setTracks] = useState([]);
  const [query, setQuery] = useState('');

  async function handleSearch() {
    setTracks(await searchTracks(query, { limit: 5 }));
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Test API iTunes</h1>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Artiste ou titre…"
      />
      <button onClick={handleSearch}>Chercher</button>
      {tracks.map((t) => (
        <div key={t.trackId} style={{ margin: '16px 0' }}>
          <img src={highResArtwork(t.artworkUrl100, 150)} alt="" width={150} />
          <p>{t.artistName} — {t.trackName}</p>
          <audio controls src={t.previewUrl} />
        </div>
      ))}
    </main>
  );
}
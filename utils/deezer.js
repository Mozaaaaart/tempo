/**
 * Helper front — API Deezer via /api/deezer
 * Normalise les résultats au format iTunes (artistName, trackName,
 * previewUrl, artworkUrl100) pour que les jeux soient interchangeables.
 */

export async function searchTracks(query, { limit = 25 } = {}) {
  const params = new URLSearchParams({ term: query, limit });
  const res = await fetch(`/api/deezer?${params}`);

  if (!res.ok) {
    throw new Error(`Erreur API interne : ${res.status}`);
  }

  const data = await res.json();

  return (data.data ?? [])
    .filter((t) => t.preview)
    .map((t) => ({
      trackId: t.id,
      artistName: t.artist?.name ?? '',
      trackName: t.title ?? '',
      albumName: t.album?.title ?? '',
      previewUrl: t.preview,
      artworkUrl100: t.album?.cover_medium ?? t.album?.cover_big ?? null,
    }));
}

export function highResArtwork(url) {
  // Deezer fournit déjà des tailles fixes ; cover_medium = 250px, suffisant
  return url;
}

/**
 * Détail d'un morceau (dont le BPM). Attention : bpm peut valoir 0
 * quand Deezer ne le connaît pas → à vérifier côté appelant.
 */
export async function trackDetails(trackId) {
  const res = await fetch(`/api/deezer/track?${new URLSearchParams({ id: trackId })}`);
  if (!res.ok) throw new Error(`Erreur API interne : ${res.status}`);
  return res.json();
}
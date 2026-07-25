/**
 * Helpers front — consommation de la route proxy /api/itunes
 * À utiliser dans tous les jeux (Octave, Pochette floutée, Quotidien…).
 * Ne jamais appeler itunes.apple.com directement depuis le client.
 */

/**
 * Recherche de morceaux par mot-clé.
 * Filtre automatiquement les résultats sans previewUrl (peut être null).
 *
 * @param {string} query - artiste, titre, etc.
 * @param {{limit?: number, country?: string}} opts
 * @returns {Promise<Array>} morceaux avec previewUrl garanti non nul
 */
export async function searchTracks(query, { limit = 20, country = 'FR' } = {}) {
  const params = new URLSearchParams({ term: query, limit, country });
  const res = await fetch(`/api/itunes?${params}`);

  if (!res.ok) {
    throw new Error(`Erreur API interne : ${res.status}`);
  }

  const data = await res.json();

  // previewUrl peut être null, et les previews ".plus.aac" (xHE-AAC)
  // ne sont pas décodables par Chrome desktop → on les exclut
  return (data.results ?? []).filter(
    (t) => t.previewUrl && !t.previewUrl.includes('.plus.aac')
  );
}

/**
 * Récupère un morceau précis par son trackId iTunes.
 * Usage : le morceau du jour (liste interne d'IDs vérifiés).
 *
 * @param {number|string} trackId
 * @returns {Promise<Object|null>} le morceau, ou null si introuvable / sans preview
 */
export async function lookupTrack(trackId) {
  const res = await fetch(`/api/itunes/lookup?id=${trackId}`);

  if (!res.ok) {
    throw new Error(`Erreur API interne : ${res.status}`);
  }

  const data = await res.json();
  const track = (data.results ?? []).find((t) => t.previewUrl);
  return track ?? null;
}

/**
 * Convertit une pochette 100x100 en haute résolution.
 * @param {string} artworkUrl100 - champ artworkUrl100 de l'API
 * @param {number} size - taille souhaitée (ex. 600)
 */
export function highResArtwork(artworkUrl100, size = 600) {
  return artworkUrl100?.replace('100x100', `${size}x${size}`) ?? null;
}

/**
 * Sélection déterministe du "morceau du jour" à partir d'une liste
 * de trackId vérifiés — même morceau pour tous les joueurs le même jour.
 *
 * @param {Array<number>} trackIds - liste interne d'IDs iTunes (previewUrl vérifié)
 * @param {Date} [date] - par défaut aujourd'hui
 * @returns {number} le trackId du jour
 */
export function trackIdOfTheDay(trackIds, date = new Date()) {
  const today = date.toISOString().slice(0, 10); // ex. "2026-07-24"
  const seed = today.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0);
  return trackIds[seed % trackIds.length];
}

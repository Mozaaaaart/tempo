/**
 * Artistes IA publiquement confirmés (presse : Billboard, Forbes, NME, Euronews…),
 * générés via Suno & co. Orthographe EXACTE des noms (filtrage strict dans le jeu).
 *
 * Nuance assumée : certains sont "IA-assistés" (ex. Xania Monet : paroles humaines,
 * voix et musique générées) — le SON reste généré par IA, ce qui est l'objet du jeu.
 *
 * AVANT d'ajouter un nom : vérifier qu'il existe sur Deezer via
 * http://localhost:3000/api/deezer?term=nom+artiste
 */
export const AI_ARTISTS = [
  'The Velvet Sundown', // folk/rock psyché — confirmé Suno (Rolling Stone)
  'Xania Monet',        // R&B — voix Suno, classée Billboard (Forbes, Wikipédia)
  'Breaking Rust',      // country — classé Billboard (Billboard, NME)
  'Juno Skye',          // chrétien — classé Billboard
  'Enlly Blue',         // rock — classé Billboard
];
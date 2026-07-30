/**
 * generer-duels.mjs — génération du pool de morceaux de l'épreuve « Duel ».
 *
 * Étape A : résout les identifiants Spotify des artistes de data/artists.js via kworb.
 * Étape B : extrait les meilleurs titres de chaque artiste (streams cumulés exacts).
 * Étape C : apparie chaque titre à Deezer pour obtenir une preview et une pochette.
 * Étape D : écrit public/data/duels.json.
 *
 * Script HORS LIGNE. Ne jamais l'appeler depuis une route Next.js.
 * À relancer tous les 2-3 mois, puis committer le JSON produit.
 *
 * Prérequis : Node 20+ (fetch global), et `npm install --save-dev cheerio`.
 *
 * Usage :
 *   node scripts/generer-duels.mjs
 *   node scripts/generer-duels.mjs --limite=5          (test rapide sur 5 artistes)
 *   node scripts/generer-duels.mjs --titres=20         (20 titres par artiste au lieu de 15)
 *   node scripts/generer-duels.mjs --sans-cache        (ignore le cache HTML local)
 */

import { load } from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============================================================
   CONFIGURATION
============================================================ */

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');

const CHEMIN_ARTISTES = path.join(RACINE, 'data', 'artists.js');
const CHEMIN_SORTIE = path.join(RACINE, 'public', 'data', 'duels.json');
const CHEMIN_RAPPORT = path.join(ICI, 'duels-non-apparies.txt');
const CACHE = path.join(ICI, '.cache');

const UA = 'MozartBenchmark/1.0 (generateur de donnees hors ligne; contact via github.com/natrakoto/tempo)';

const PAUSE_KWORB = 1200;   // ms entre deux requêtes kworb — politesse envers un site personnel
const PAUSE_DEEZER = 250;   // ms entre deux requêtes Deezer — la limite est ~50 req / 5 s

/** Motifs de titres à écarter : doublons de catalogue qui produisent des duels absurdes. */
const TITRES_EXCLUS = [
  'remix', 'live', 'sped up', 'slowed', 'instrumental', 'karaoke', 'karaoké',
  'acoustic', 'radio edit', 'remaster', 'version', 'edit)', 'interlude',
  'mixed', 'reprise', 'demo', 'a cappella', 'acapella',
];

/**
 * Correspondances manuelles entre le nom dans data/artists.js et celui utilisé par kworb.
 * À étendre au fil des exécutions : le script journalise tout artiste non résolu.
 */
const ALIAS = {
  'bob marley': 'Bob Marley & The Wailers',
  'jay-z': 'JAŸ-Z',
  'kanye west': 'Kanye West',
  'the notorious b.i.g.': 'The Notorious B.I.G.',
  'pink': 'P!nk',
  'macklemore': 'Macklemore & Ryan Lewis',
  'guns n roses': "Guns N' Roses",
};

/* ============================================================
   PETITS OUTILS
============================================================ */

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [c, v] = a.replace(/^--/, '').split('=');
    return [c, v ?? true];
  })
);

const LIMITE_ARTISTES = args.limite ? Number(args.limite) : Infinity;
const TITRES_PAR_ARTISTE = args.titres ? Number(args.titres) : 15;
const UTILISER_CACHE = !args['sans-cache'];

/**
 * Normalisation agressive pour comparer des chaînes venant de deux sources différentes.
 * Minuscules, accents retirés, apostrophes typographiques unifiées, ponctuation retirée.
 */
function normaliser(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // accents
    .replace(/[\u2018\u2019\u02bc]/g, "'") // apostrophes courbes → droite
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Retire les mentions de featuring et les suffixes d'édition d'un titre,
 * pour maximiser les chances d'appariement avec Deezer.
 *   "Jimmy Cooks (feat. 21 Savage)" → "Jimmy Cooks"
 *   "Fair Trade (with Travis Scott)" → "Fair Trade"
 */
function titrePropre(titre) {
  return titre
    .replace(/\s*[\(\[](feat|ft|with|avec|prod)\.?\s[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*(bonus|single|album|extended|deluxe).*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function estTitreExclu(titre) {
  const n = titre.toLowerCase();
  return TITRES_EXCLUS.some((motif) => n.includes(motif));
}

/** Récupération HTTP avec cache disque : les relances n'appellent pas kworb. */
async function recupererHtml(url, cle) {
  const fichier = path.join(CACHE, `${cle}.html`);

  if (UTILISER_CACHE && existsSync(fichier)) {
    return readFile(fichier, 'utf8');
  }

  const rep = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!rep.ok) throw new Error(`${url} → HTTP ${rep.status}`);
  const html = await rep.text();

  await mkdir(CACHE, { recursive: true });
  await writeFile(fichier, html, 'utf8');
  await pause(PAUSE_KWORB);

  return html;
}

/* ============================================================
   LECTURE DE data/artists.js
   Le fichier est un module ESM, mais Node traite les .js d'un projet Next
   comme du CommonJS. On l'évalue donc à la main plutôt que de l'importer.
============================================================ */

async function lireArtistesLocaux() {
  const source = await readFile(CHEMIN_ARTISTES, 'utf8');
  const corps = source.replace(/export\s+const\s+ARTISTS\s*=/, 'return');

  try {
    return new Function(`${corps}\n;`)();
  } catch (err) {
    throw new Error(
      `Impossible d'évaluer data/artists.js (${err.message}). ` +
      `Le fichier doit contenir un unique "export const ARTISTS = [ ... ];".`
    );
  }
}

/* ============================================================
   ÉTAPE A — identifiants Spotify des artistes
============================================================ */

async function resoudreIdentifiants(artistesLocaux) {
  console.log('→ Étape A : résolution des identifiants d\'artistes…');

  const html = await recupererHtml('https://kworb.net/spotify/artists.html', 'artists');
  const $ = load(html);

  // Index kworb : nom normalisé → { nom, id }
  const index = new Map();
  $('a[href*="_songs.html"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const id = href.match(/artist\/([A-Za-z0-9]+)_songs\.html/)?.[1];
    const nom = $(el).text().trim();
    if (id && nom) index.set(normaliser(nom), { nom, id });
  });

  console.log(`  ${index.size} artistes indexés sur kworb.`);

  const resolus = [];
  const introuvables = [];

  for (const a of artistesLocaux) {
    const cleAlias = ALIAS[normaliser(a.nom)];
    const trouve = index.get(normaliser(cleAlias ?? a.nom));

    if (trouve) resolus.push({ nom: a.nom, nomKworb: trouve.nom, id: trouve.id });
    else introuvables.push(a.nom);
  }

  console.log(`  ${resolus.length} artistes résolus, ${introuvables.length} sans correspondance.`);
  if (introuvables.length) {
    console.log(`  Non résolus : ${introuvables.join(', ')}`);
    console.log('  (ajouter une entrée dans ALIAS si le nom diffère seulement d\'orthographe)');
  }

  return resolus.slice(0, LIMITE_ARTISTES);
}

/* ============================================================
   ÉTAPE B — morceaux d'un artiste
============================================================ */

async function extraireMorceaux(artiste) {
  const url = `https://kworb.net/spotify/artist/${artiste.id}_songs.html`;
  const html = await recupererHtml(url, `songs-${artiste.id}`);
  const $ = load(html);

  const maj = html.match(/Last updated:\s*([\d/]+)/)?.[1] ?? null;
  const morceaux = [];

  $('a[href*="open.spotify.com/track/"]').each((_, el) => {
    const $lien = $(el);
    const $ligne = $lien.closest('tr');
    const cellules = $ligne.find('td');
    if (cellules.length < 2) return;

    const texteCellule = $(cellules[0]).text().trim();

    // Un astérisque en tête signale un titre où l'artiste n'est QUE featuring.
    // On les écarte : le morceau appartient à un autre artiste, et le garder
    // créerait à la fois une attribution fausse et un doublon avec la page
    // de l'artiste principal.
    if (texteCellule.startsWith('*')) return;

    const titreBrut = $lien.text().trim();
    if (!titreBrut || estTitreExclu(titreBrut)) return;

    const streams = Number($(cellules[1]).text().replace(/[^\d]/g, ''));
    if (!Number.isFinite(streams) || streams <= 0) return;

    const spotifyId = $lien.attr('href').match(/track\/([A-Za-z0-9]+)/)?.[1];

    morceaux.push({
      titre: titrePropre(titreBrut),
      titreBrut,
      artiste: artiste.nom,
      streams,
      spotifyId,
    });
  });

  // kworb trie déjà par streams décroissants, mais on ne s'appuie pas dessus.
  morceaux.sort((a, b) => b.streams - a.streams);

  return { morceaux: morceaux.slice(0, TITRES_PAR_ARTISTE), maj };
}

/* ============================================================
   ÉTAPE C — appariement Deezer
============================================================ */

async function chercherDeezer(requete) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(requete)}&limit=10`;
  const rep = await fetch(url, { headers: { 'User-Agent': UA } });
  await pause(PAUSE_DEEZER);

  if (!rep.ok) return [];
  const data = await rep.json();
  return data?.data ?? [];
}

async function apparierDeezer(morceau) {
  const titreN = normaliser(morceau.titre);
  const artisteN = normaliser(morceau.artiste);

  // Deux tentatives : requête structurée d'abord, requête libre en repli.
  const requetes = [
    `artist:"${morceau.artiste}" track:"${morceau.titre}"`,
    `${morceau.artiste} ${morceau.titre}`,
  ];

  for (const requete of requetes) {
    let resultats;
    try {
      resultats = await chercherDeezer(requete);
    } catch {
      continue;
    }

    for (const t of resultats) {
      if (!t.preview) continue;

      const tTitre = normaliser(titrePropre(t.title ?? ''));
      const tArtiste = normaliser(t.artist?.name ?? '');

      const titreOk = tTitre === titreN;
      const artisteOk =
        tArtiste === artisteN ||
        tArtiste.includes(artisteN) ||
        artisteN.includes(tArtiste);

      if (titreOk && artisteOk) {
        return {
          deezerId: t.id,
          pochette: t.album?.cover_big ?? t.album?.cover_medium ?? null,
        };
      }
    }
  }

  return null;
}

/* ============================================================
   VÉRIFICATION FINALE — le pool produit-il de bons duels ?
============================================================ */

function verifierPool(morceaux, ratioMini = 1.25) {
  let compatibles = 0;
  const total = (morceaux.length * (morceaux.length - 1)) / 2;
  if (total === 0) return { total: 0, compatibles: 0, part: 0 };

  for (let i = 0; i < morceaux.length; i++) {
    for (let j = i + 1; j < morceaux.length; j++) {
      if (morceaux[i].artiste === morceaux[j].artiste) continue;
      const [a, b] = [morceaux[i].streams, morceaux[j].streams];
      if (Math.max(a, b) / Math.min(a, b) >= ratioMini) compatibles++;
    }
  }

  return { total, compatibles, part: compatibles / total };
}

/* ============================================================
   ORCHESTRATION
============================================================ */

async function main() {
  const debut = Date.now();

  const artistesLocaux = await lireArtistesLocaux();
  console.log(`data/artists.js : ${artistesLocaux.length} artistes.\n`);

  const artistes = await resoudreIdentifiants(artistesLocaux);

  console.log(`\n→ Étape B : extraction des titres (${TITRES_PAR_ARTISTE} max par artiste)…`);
  const candidats = [];
  let majKworb = null;

  for (const [i, artiste] of artistes.entries()) {
    try {
      const { morceaux, maj } = await extraireMorceaux(artiste);
      majKworb ??= maj;
      candidats.push(...morceaux);
      console.log(`  [${i + 1}/${artistes.length}] ${artiste.nom} — ${morceaux.length} titres`);
    } catch (err) {
      console.log(`  [${i + 1}/${artistes.length}] ${artiste.nom} — ÉCHEC : ${err.message}`);
    }
  }

  // Déduplication : un même morceau peut figurer deux fois sous deux éditions
  // (single puis album), avec deux identifiants Spotify distincts.
  const vus = new Set();
  const uniques = [];
  for (const m of candidats) {
    const cle = `${normaliser(m.artiste)}|${normaliser(m.titre)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push(m);
  }
  console.log(`  ${candidats.length} titres extraits, ${uniques.length} après déduplication.`);

  console.log('\n→ Étape C : appariement Deezer…');
  const apparies = [];
  const echecs = [];

  for (const [i, m] of uniques.entries()) {
    const trouve = await apparierDeezer(m);

    if (trouve) {
      apparies.push({
        titre: m.titre,
        artiste: m.artiste,
        streams: m.streams,
        deezerId: trouve.deezerId,
        pochette: trouve.pochette,
        spotifyId: m.spotifyId,
      });
    } else {
      echecs.push(`${m.artiste} — ${m.titreBrut}`);
    }

    if ((i + 1) % 25 === 0 || i === uniques.length - 1) {
      const taux = ((apparies.length / (i + 1)) * 100).toFixed(0);
      console.log(`  ${i + 1}/${uniques.length} — ${apparies.length} appariés (${taux} %)`);
    }
  }

  apparies.sort((a, b) => b.streams - a.streams);

  /* ---- Garde-fou ----
     Un incident réseau (kworb injoignable, Deezer en panne) produit un pool
     vide ou ridiculement petit. Sans cette vérification, le script écraserait
     un duels.json valide déjà committé par un fichier inutilisable. */

  const SEUIL_MINIMUM = 40;
  if (apparies.length < SEUIL_MINIMUM) {
    await writeFile(
      CHEMIN_RAPPORT,
      `${echecs.length} titres sans correspondance Deezer :\n\n${echecs.join('\n')}\n`,
      'utf8'
    );
    throw new Error(
      `seulement ${apparies.length} morceaux appariés (minimum attendu : ${SEUIL_MINIMUM}). ` +
      `${path.relative(RACINE, CHEMIN_SORTIE)} n'a PAS été modifié. ` +
      `Voir ${path.relative(RACINE, CHEMIN_RAPPORT)} pour le détail.`
    );
  }

  /* ---- Écriture ---- */

  const sortie = {
    genere: new Date().toISOString().slice(0, 10),
    source: 'kworb.net',
    majKworb,
    nombre: apparies.length,
    morceaux: apparies,
  };

  await mkdir(path.dirname(CHEMIN_SORTIE), { recursive: true });
  await writeFile(CHEMIN_SORTIE, JSON.stringify(sortie, null, 0), 'utf8');
  await writeFile(
    CHEMIN_RAPPORT,
    echecs.length
      ? `${echecs.length} titres sans correspondance Deezer :\n\n${echecs.join('\n')}\n`
      : 'Tous les titres ont été appariés.\n',
    'utf8'
  );

  /* ---- Rapport ---- */

  const octets = JSON.stringify(sortie).length;
  const paires = verifierPool(apparies);
  const artistesDistincts = new Set(apparies.map((m) => m.artiste)).size;

  console.log('\n──────────────────────────────────────────');
  console.log(`Morceaux retenus      ${apparies.length}`);
  console.log(`Artistes distincts    ${artistesDistincts}`);
  console.log(`Non appariés          ${echecs.length}`);
  console.log(`Streams (min → max)   ${apparies.at(-1)?.streams.toLocaleString('fr-FR')} → ${apparies[0]?.streams.toLocaleString('fr-FR')}`);
  console.log(`Paires jouables       ${(paires.part * 100).toFixed(1)} % (écart ≥ 1,25×)`);
  console.log(`Taille du JSON        ${(octets / 1024).toFixed(1)} Ko`);
  console.log(`Données kworb du      ${majKworb ?? 'inconnu'}`);
  console.log(`Durée                 ${((Date.now() - debut) / 1000).toFixed(0)} s`);
  console.log('──────────────────────────────────────────');
  console.log(`\nÉcrit : ${path.relative(RACINE, CHEMIN_SORTIE)}`);
  console.log(`Rapport : ${path.relative(RACINE, CHEMIN_RAPPORT)}`);
}

main().catch((err) => {
  console.error('\nÉchec :', err.message);
  process.exit(1);
});

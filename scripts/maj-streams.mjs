/**
 * scripts/maj-streams.mjs
 *
 * Régénère le champ `streams` de data/artists.js à partir de kworb.net.
 *
 *   node scripts/maj-streams.mjs            # écrit le fichier
 *   node scripts/maj-streams.mjs --dry      # affiche les écarts sans rien écrire
 *   node scripts/maj-streams.mjs --debug    # montre ce qui est lu dans la page
 *   node scripts/maj-streams.mjs --forcer   # applique aussi les écarts suspects
 *
 * ── Pourquoi un script lancé à la main, et pas un appel au runtime ──────────
 * kworb n'expose pas d'API : on lit du HTML, dont la structure peut changer
 * sans préavis. Une dépendance au runtime rendrait le jeu tributaire d'un site
 * tiers à chaque partie. Ici la base reste statique — rapide, sans latence,
 * sans quota — et la mise à jour est un geste volontaire qu'on relit avant de
 * committer.
 *
 * ── Principe de prudence ────────────────────────────────────────────────────
 * Le script n'écrase JAMAIS une valeur qu'il n'a pas su retrouver : l'ancienne
 * est conservée. Un artiste absent de la page, un nom mal orthographié ou une
 * panne réseau laissent donc la donnée en place plutôt que de la mettre à zéro,
 * ce qui fausserait le jeu Duel sans qu'on s'en aperçoive.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const FICHIER = join(ICI, '..', 'data', 'artists.js');

/* Classement cumulé par artiste, tous titres confondus. */
const SOURCE = 'https://kworb.net/spotify/artists.html';

/* Au-delà de cet écart relatif, on demande confirmation plutôt que d'écrire :
   un artiste qui triple ses streams en deux mois signale plus probablement une
   erreur d'appariement qu'une vraie progression. */
const ECART_SUSPECT = 0.6;

const ATTENTE_MS = 400;   // politesse : on ne martèle pas le serveur

/* Normalisation des noms, alignée sur celle du jeu : sans accents, sans
   ponctuation, en minuscules. « P!nk » et « Pink » doivent se rejoindre. */
const norm = (s) => String(s)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]/g, '');

/* Quelques artistes portent chez kworb un nom différent de celui de la base.
   Les cas connus sont déclarés ici plutôt que devinés. */
const ALIAS = {
  [norm('Gims')]: norm('Maitre Gims'),
  [norm('Bob Marley')]: norm('Bob Marley & The Wailers'),
  [norm('P!nk')]: norm('Pink'),
  [norm('Bigflo & Oli')]: norm('Bigflo et Oli'),
};

async function recupererPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MozartBenchmark/1.0; mise a jour ponctuelle)',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`kworb a répondu ${res.status}`);
  return res.text();
}

/* Décode les entités HTML les plus courantes et retire le balisage. */
function texteBrut(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrait { nomNormalisé -> streams en milliards } depuis le tableau HTML.
 *
 * Le parsing est volontairement permissif : les balises de kworb portent des
 * attributs (`<tr class="...">`), les noms sont enveloppés dans des liens, et
 * la mise en forme peut changer. Une première version exigeait `<tr>` nu et ne
 * trouvait que trois lignes.
 *
 * Pour les streams, on retient la PLUS GRANDE valeur numérique de la ligne :
 * le tableau donne aussi des chiffres quotidiens et un nombre de titres, et le
 * cumul est nécessairement le plus élevé. Repérer la colonne par sa position
 * serait plus fragile — elle bouge d'une version à l'autre du site.
 */
function extraireStreams(html, debug = false) {
  const table = {};
  const lignes = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let montrees = 0;

  for (const [, contenu] of lignes) {
    const cellules = [...contenu.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((m) => texteBrut(m[1]));

    /* Le dump vient AVANT tout filtrage : placé plus bas, il ne s'affichait
       jamais quand l'extraction échouait — or c'est précisément là qu'on en a
       besoin. On montre aussi le HTML brut de la première ligne, seul moyen de
       voir si le tableau utilise une structure inattendue. */
    if (debug && montrees < 5) {
      if (montrees === 0) {
        console.log('\n  [debug] HTML brut de la 1re ligne :');
        console.log('  ' + contenu.replace(/\s+/g, ' ').slice(0, 400));
      }
      console.log(`  [debug] ligne ${montrees + 1} — ${cellules.length} cellules :`, cellules.slice(0, 8));
      montrees++;
    }

    if (cellules.length < 2) continue;

    // Le nom : première cellule contenant des lettres et pas seulement un rang.
    const nom = cellules.find((c) => /[a-zA-ZÀ-ÿ]/.test(c) && c.length > 1);
    if (!nom) continue;

    /* Les nombres de kworb sont en MILLIONS, avec une décimale et une virgule
       de milliers : « 96,251.6 » vaut 96 251,6 millions, soit 96,3 milliards.
       Un filtre sur les entiers les rejetait tous — d'où zéro artiste extrait
       alors que les lignes étaient bien lues. */
    const nombres = cellules
      .map((c) => c.replace(/[,\s\u00a0]/g, ''))
      .filter((c) => /^\d+(\.\d+)?$/.test(c))
      .map(Number);
    if (!nombres.length) continue;

    // La plus grande valeur de la ligne est le cumul : les autres colonnes
    // donnent le quotidien, les titres en lead et les featurings.
    const millions = Math.max(...nombres);

    // Sous 500 millions cumulés, l'artiste ne figure pas dans notre base.
    if (millions < 500) continue;

    // La base raisonne en milliards, une décimale suffit à trancher un duel.
    table[norm(nom)] = Math.round((millions / 1000) * 10) / 10;
  }

  if (Object.keys(table).length < 50) {
    throw new Error(
      `Seulement ${Object.keys(table).length} artistes extraits sur ${lignes.length} lignes de tableau. `
      + `Relance avec --debug : les cellules de la 1re ligne diront si le tableau `
      + `a une structure inattendue, ou si la colonne des streams manque.`
    );
  }
  return table;
}

async function principal() {
  const sec = process.argv.includes('--dry');
  const debug = process.argv.includes('--debug');
  /* Après plusieurs mois sans mise à jour, les vrais écarts dépassent souvent
     le seuil de vigilance : `--forcer` applique quand même, une fois la liste
     relue en --dry. Le seuil reste utile pour les exécutions suivantes. */
  const forcer = process.argv.includes('--forcer');

  const source = await readFile(FICHIER, 'utf8');
  const html = await recupererPage(SOURCE);
  await new Promise((r) => setTimeout(r, ATTENTE_MS));
  if (debug) console.log(`\nPage reçue : ${html.length} caractères.`);
  const table = extraireStreams(html, debug);

  const trouves = [];
  const absents = [];
  const suspects = [];

  /* Réécriture ligne à ligne plutôt que par `import` puis sérialisation : on
     préserve ainsi les commentaires, l'ordre et le formatage du fichier, qui
     sont relus par des humains. */
  const sortie = source.replace(
    /(\{\s*nom:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?streams:\s*)([\d.]+)/g,
    (entier, avant, nomBrut, ancienTexte) => {
      const nom = nomBrut.replace(/\\'/g, "'");
      const cle = norm(nom);
      const nouveau = table[cle] ?? table[ALIAS[cle]];
      const ancien = Number(ancienTexte);

      if (nouveau === undefined) {
        absents.push(nom);
        return entier;                       // on garde l'ancienne valeur
      }

      const ecart = ancien > 0 ? Math.abs(nouveau - ancien) / ancien : 1;
      if (ecart > ECART_SUSPECT && !forcer) {
        suspects.push({ nom, ancien, nouveau });
        return entier;                       // on ne touche pas sans relecture
      }
      if (ecart > ECART_SUSPECT) suspects.push({ nom, ancien, nouveau });

      trouves.push({ nom, ancien, nouveau });
      return `${avant}${nouveau}`;
    }
  );

  const changes = trouves.filter((t) => t.ancien !== t.nouveau);

  console.log(`\n${trouves.length} artistes appariés, ${changes.length} valeurs modifiées.`);
  for (const { nom, ancien, nouveau } of changes) {
    const signe = nouveau > ancien ? '+' : '';
    console.log(`  ${nom.padEnd(24)} ${ancien} → ${nouveau} (${signe}${(nouveau - ancien).toFixed(1)})`);
  }

  if (suspects.length) {
    console.log(`\n${suspects.length} écarts suspects, ${forcer ? 'APPLIQUÉS (--forcer)' : 'NON appliqués'} :`);
    for (const { nom, ancien, nouveau } of suspects) {
      console.log(`  ${nom.padEnd(24)} ${ancien} → ${nouveau}`);
    }
    if (!forcer) console.log('  (relance avec --forcer si ces valeurs sont correctes)');
  }

  if (absents.length) {
    console.log(`\n${absents.length} artistes introuvables chez kworb, valeurs conservées :`);
    console.log('  ' + absents.join(', '));
    console.log('  (ajoute un ALIAS en tête du script si le nom diffère simplement)');
  }

  if (sec) {
    console.log('\n--dry : aucun fichier écrit.');
    return;
  }

  await writeFile(FICHIER, sortie, 'utf8');
  console.log(`\ndata/artists.js mis à jour. Relis le diff avant de committer.`);
}

principal().catch((err) => {
  console.error('\nÉchec :', err.message);
  console.error('data/artists.js est inchangé.');
  process.exit(1);
});

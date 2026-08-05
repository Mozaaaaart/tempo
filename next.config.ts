import type { NextConfig } from "next";

/**
 * ── Content-Security-Policy ─────────────────────────────────────────────
 *
 * DEUX PROFILS, ET C'EST VOULU.
 *
 * En développement, React et Turbopack ont besoin de choses qu'une CSP stricte
 * refuse — et qu'il serait dangereux d'autoriser en production :
 *
 *   'unsafe-eval'  React en mode dev appelle eval() pour reconstruire les
 *                  callstacks venus d'un autre environnement (c'est l'erreur
 *                  « eval() is not supported in this environment »). React ne
 *                  l'utilise JAMAIS en production, d'où l'exception limitée au
 *                  dev. L'ouvrir en production reviendrait à retirer une bonne
 *                  part de l'intérêt de la CSP.
 *   ws: / wss:     Le rafraîchissement à chaud (HMR) passe par une websocket
 *                  vers le serveur local. Inutile en production.
 *
 * Le profil de production reste donc strict, et c'est celui qui compte : c'est
 * lui qui sera servi sur mozartbenchmark.com.
 *
 * ── Le reste des directives ─────────────────────────────────────────────
 *
 *  - script-src 'unsafe-inline' : les deux blocs JSON-LD sont inline, et Next
 *    injecte ses propres scripts. Compromis ACCEPTABLE tant qu'aucune donnée
 *    contrôlable par l'utilisateur n'atteint le rendu — c'est le cas ici, les
 *    JSON-LD ne lisent que des constantes statiques. Pour durcir plus tard :
 *    passer les JSON-LD sur des hashes SHA-256 et retirer 'unsafe-inline'.
 *  - va.vercel-scripts.com : script et beacon de Vercel Analytics.
 *  - font-src 'self' : next/font télécharge les polices au build et les
 *    auto-héberge. Aucun domaine Google Fonts n'est nécessaire côté client.
 *  - img-src *.dzcdn.net / *.mzstatic.com : pochettes d'album Deezer et Apple.
 *  - media-src blob: + CDN Deezer : extraits audio.
 *  - worker-src blob: : AudioWorklet de Tone.js.
 *
 * PREMIER DÉPLOIEMENT : passer la clé à 'Content-Security-Policy-Report-Only',
 * jouer une épreuve avec le son, vérifier que la console est vierge, PUIS
 * repasser en 'Content-Security-Policy' bloquant.
 * ────────────────────────────────────────────────────────────────────────
 */

/* ══════════════════════════════════════════════════════════════════════════
 *  INTERRUPTEUR CSP — LA SEULE LIGNE À CHANGER
 *
 *  true  → mode OBSERVATION (Content-Security-Policy-Report-Only)
 *          Le navigateur ne bloque RIEN. Il se contente de signaler dans la
 *          console tout ce qu'il AURAIT bloqué. Le site fonctionne normalement.
 *          C'est le mode dans lequel on déploie la première fois.
 *
 *  false → mode BLOCAGE (Content-Security-Policy)
 *          La CSP est réellement appliquée. À n'activer qu'APRÈS avoir vérifié
 *          que la console ne signale plus aucune violation.
 *
 *  MARCHE À SUIVRE :
 *    1. Laisser `true`, déployer.
 *    2. Ouvrir le site, jouer une épreuve AVEC LE SON, regarder une pochette.
 *    3. Console du navigateur (F12) : chercher les lignes contenant
 *       « Content Security Policy ». Aucune ? Parfait.
 *       S'il y en a, lire la directive incriminée et ajouter le domaine
 *       manquant à la directive correspondante plus bas, puis recommencer.
 *    4. Passer à `false`, redéployer. Terminé.
 * ══════════════════════════════════════════════════════════════════════════ */
const CSP_EN_OBSERVATION = true;

const estDev = process.env.NODE_ENV === 'development';

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(estDev ? ["'unsafe-eval'"] : []), // React dev / Turbopack uniquement
  'https://va.vercel-scripts.com',
];

const connectSrc = [
  "'self'",
  'https://va.vercel-scripts.com',
  ...(estDev ? ['ws:', 'wss:'] : []), // websocket HMR uniquement
];

const CSP = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://*.dzcdn.net https://*.mzstatic.com",
  `connect-src ${connectSrc.join(' ')}`,
  "media-src 'self' blob: https://*.dzcdn.net https://*.deezer.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // En dev, forcer HTTPS casserait http://localhost.
  ...(estDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const EN_TETES_SECURITE = [
  {
    key: CSP_EN_OBSERVATION
      ? 'Content-Security-Policy-Report-Only' // signale sans bloquer
      : 'Content-Security-Policy',            // bloque réellement
    value: CSP,
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), interest-cohort=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // HSTS n'a de sens qu'en HTTPS : en dev (http://localhost) il est inutile et
  // peut coincer le navigateur sur des redirections HTTPS locales.
  ...(estDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

const nextConfig: NextConfig = {
  /**
   * En-têtes de sécurité appliqués à toutes les routes.
   * (Défense en profondeur : clickjacking, sniffing MIME, XSS, HTTPS forcé.)
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: EN_TETES_SECURITE,
      },
    ];
  },

  /**
   * Redirections permanentes d'anciennes URL. INCHANGÉ.
   *
   * DEUX FAMILLES. D'abord le déménagement de `/epreuves/` vers `/jeux/` : le
   * site parlait le vocabulaire de l'évaluation, il parle maintenant celui du
   * jeu, et l'adresse devait suivre. Le motif `:slug*` couvre les dix jeux
   * d'une seule règle, la ligne sans paramètre couvre la page catalogue.
   *
   * Ensuite les renommages d'épreuves. `/epreuves/refrain` et
   * `/epreuves/une-seconde` ont été servis, listés dans
   * le plan du site et soumis à Google avant que leurs épreuves soient
   * renommées « Paroles » et « Blind test ». Un slug indexé ne meurt jamais
   * tout à fait : il reste dans des favoris, dans des liens, et dans l'index
   * tant que le moteur ne l'a pas revisité.
   *
   * `permanent: true` produit un 308, qui transfère le classement acquis vers
   * la nouvelle adresse. Un 307 laisserait l'ancienne URL vivre sa vie dans
   * l'index et diviserait le signal entre deux pages pour un seul contenu.
   *
   * À conserver indéfiniment. Le coût est nul, le retrait ne rapporte rien.
   */
  async redirects() {
    return [
      /* Les renommages EN PREMIER : Next évalue les règles dans l'ordre, et
         une entrée `/epreuves/:slug*` placée avant capterait `refrain` pour
         l'envoyer sur `/jeux/refrain`, qui n'existe pas. Traitées ici, elles
         redirigent directement vers la bonne adresse finale — une seule
         redirection au lieu de deux enchaînées, ce que les moteurs
         préfèrent nettement. */
      {
        source: '/epreuves/refrain',
        destination: '/jeux/paroles',
        permanent: true,
      },
      {
        source: '/epreuves/une-seconde',
        destination: '/jeux/blind-test',
        permanent: true,
      },
      /* Puis le déménagement, qui ramasse tout le reste. */
      {
        source: '/epreuves',
        destination: '/jeux',
        permanent: true,
      },
      {
        source: '/epreuves/:slug*',
        destination: '/jeux/:slug*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
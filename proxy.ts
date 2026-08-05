import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy de protection des routes /api/*.
 *
 * NOM DU FICHIER : `proxy.ts`, et non `middleware.ts`.
 * Next 16 a déprécié la convention `middleware` au profit de `proxy` — le
 * terme « middleware » était trop souvent confondu avec celui d'Express.js.
 * L'ancien nom fonctionne encore mais affiche un avertissement, et il sera
 * retiré dans une version future. Deux choses changent, et deux seulement :
 * le nom du fichier, et le nom de la fonction exportée (`proxy`, plus bas).
 * La logique, elle, est identique.
 *
 * ⚠️  NE JAMAIS GARDER LES DEUX FICHIERS : si `middleware.ts` et `proxy.ts`
 * coexistent, le build échoue. Supprimer l'ancien après avoir posé celui-ci.
 *
 * VERSION ZÉRO-DÉPENDANCE, déployable immédiatement.
 *
 * Ce qu'il fait :
 *  - Contrôle d'origine léger (anti-hotlinking navigateur) : une requête
 *    cross-site dont l'en-tête `Origin` désigne un autre domaine est refusée.
 *    Les navigations directes (pas d'`Origin`) et les appels same-origin
 *    passent. Ce n'est PAS une protection contre un script serveur (l'`Origin`
 *    est falsifiable hors navigateur) — d'où le rate-limiting ci-dessous.
 *
 * Ce qu'il NE fait PAS ici : le rate-limiting proprement dit. Deux options,
 * au choix (voir README) :
 *   (a) Vercel Firewall — réglage dashboard, inclus au plan Pro, RIEN à coder.
 *       C'est l'option recommandée : rien à installer, rien à maintenir.
 *   (b) Upstash Redis — décommenter le bloc plus bas et installer
 *       @upstash/ratelimit + @upstash/redis. Free tier suffisant pour ce trafic.
 *
 * Si vous choisissez (a), ce fichier reste utile tel quel pour l'anti-hotlinking.
 */

// Origines autorisées à appeler /api/*. Ajoutez ici vos préproductions au besoin.
const ORIGINES_AUTORISEES = new Set<string>([
  'https://mozartbenchmark.com',
  'https://www.mozartbenchmark.com',
  'http://localhost:3000',
]);

function origineAutorisee(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  // Pas d'Origin = navigation directe / requête non-CORS : on laisse passer.
  if (!origin) return true;
  if (ORIGINES_AUTORISEES.has(origin)) return true;
  // En préproduction Vercel, l'origine est *.vercel.app : on tolère.
  try {
    if (new URL(origin).hostname.endsWith('.vercel.app')) return true;
  } catch {
    return false;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  // Anti-hotlinking : refuse les appels cross-site depuis un autre domaine.
  if (!origineAutorisee(request)) {
    return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * OPTION (b) — Rate-limiting applicatif via Upstash (free tier).
   * Pour l'activer :
   *   1. npm install @upstash/ratelimit @upstash/redis
   *   2. Créer une base Upstash Redis (console.upstash.com) et définir dans
   *      Vercel : UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
   *   3. Décommenter le bloc ci-dessous ET l'import en haut de fichier.
   *
   * import { Ratelimit } from '@upstash/ratelimit';
   * import { Redis } from '@upstash/redis';
   * const limiteur = new Ratelimit({
   *   redis: Redis.fromEnv(),
   *   limiter: Ratelimit.slidingWindow(120, '60 s'), // 120 req/min/IP sur /api/*
   *   prefix: 'mb:api',
   * });
   *
   * const ip =
   *   request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
   * const { success } = await limiteur.limit(ip);
   * if (!success) {
   *   return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
   * }
   * ───────────────────────────────────────────────────────────────────────── */

  return NextResponse.next();
}

// N'exécute le middleware que sur les routes API.
export const config = {
  matcher: '/api/:path*',
};
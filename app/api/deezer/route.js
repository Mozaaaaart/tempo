import { NextResponse } from 'next/server';

/**
 * Route proxy — API Deezer Search
 * GET /api/deezer?term=daft+punk&limit=25
 * Previews MP3 30s, gratuites, sans clé — lisibles par tous les navigateurs.
 *
 * ── Pourquoi ces en-têtes ──────────────────────────────────────────────
 * En production, Deezer renvoyait { data: [], total: 118 } : la recherche
 * aboutit, mais la page de résultats est vide. Deezer filtre selon le pays
 * qu'il déduit de l'appelant, et une fonction serverless se présente sans
 * langue déclarée, avec l'agent utilisateur de Node. En local la requête part
 * d'un navigateur, d'où l'écart entre les deux environnements.
 *
 * Déclarer une langue et un agent utilisateur crédibles suffit dans la
 * plupart des cas. Le repli sur `next` couvre le reste : quand la première
 * page revient vide alors que `total` est non nul, la page suivante contient
 * généralement les résultats.
 * ──────────────────────────────────────────────────────────────────────
 */

const ENTETES = {
  Accept: 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

async function interroger(url, revalidate = 3600) {
  const res = await fetch(url, { headers: ENTETES, next: { revalidate } });
  if (!res.ok) throw new Error(`Deezer API a répondu ${res.status}`);
  return res.json();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get('term');

  if (!term || !term.trim()) {
    return NextResponse.json({ error: 'Paramètre "term" manquant' }, { status: 400 });
  }

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10) || 25));

  const url = new URL('https://api.deezer.com/search');
  url.searchParams.set('q', term.trim());
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('index', '0');

  try {
    let data = await interroger(url.toString());

    // Page vide alors que la recherche a trouvé quelque chose : on suit le
    // lien `next` une fois plutôt que de rendre une liste vide au jeu.
    if (!data?.data?.length && data?.total > 0 && data?.next) {
      try {
        const suite = await interroger(data.next);
        if (suite?.data?.length) data = suite;
      } catch (err) {
        console.warn('Deezer — repli sur next échoué :', err.message);
      }
    }

    if (!data?.data?.length) {
      console.warn(`Deezer — aucune piste pour « ${term} » (total: ${data?.total ?? 0})`);
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Deezer', details: err.message },
      { status: 502 }
    );
  }
}
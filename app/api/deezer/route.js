import { NextResponse } from 'next/server';

/**
 * Route proxy — API Deezer Search
 * GET /api/deezer?term=daft+punk&limit=25
 * Previews MP3 30s, gratuites, sans clé — lisibles par tous les navigateurs.
 */

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

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Deezer API a répondu ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' }
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Deezer', details: err.message },
      { status: 500 }
    );
  }
}
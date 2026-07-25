import { NextResponse } from 'next/server';

/**
 * Route lookup — détail d'un morceau Deezer (dont le BPM)
 * GET /api/deezer/track?id=3135556
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Paramètre "id" manquant ou invalide' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.deezer.com/track/${id}`, {
      next: { revalidate: 86400 } // métadonnées quasi immuables : 24h
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Deezer API a répondu ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' }
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Deezer', details: err.message },
      { status: 500 }
    );
  }
}
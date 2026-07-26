import { NextResponse } from 'next/server';

/**
 * Route proxy — API Lyrics.ovh
 * GET /api/lyrics?artist=Queen&title=Bohemian Rhapsody
 * Attention : API communautaire, sans SLA — prévoir les échecs côté appelant.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const title = searchParams.get('title');

  if (!artist || !title) {
    return NextResponse.json({ error: 'Paramètres "artist" et "title" requis' }, { status: 400 });
  }

  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Paroles introuvables' }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Lyrics.ovh a répondu ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' }
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Lyrics.ovh', details: err.message },
      { status: 500 }
    );
  }
}
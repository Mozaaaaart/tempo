import { NextResponse } from 'next/server';

/**
 * Route lookup — récupération par ID iTunes
 * GET /api/itunes/lookup?id=697953739
 *
 * Usage principal : le "morceau du jour" du défi quotidien.
 * On stocke une liste interne de trackId vérifiés (previewUrl non nul),
 * et on résout les métadonnées à la volée via cette route.
 * Cache long (24 h) : les métadonnées par ID sont quasi immuables.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Validation : id obligatoire et numérique
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: 'Paramètre "id" manquant ou invalide (attendu : trackId numérique)' },
      { status: 400 }
    );
  }

  const url = new URL('https://itunes.apple.com/lookup');
  url.searchParams.set('id', id);
  url.searchParams.set('entity', 'song');

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 } // 24 h
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Service momentanément indisponible' },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800'
      }
    });
  } catch (err) {
    console.error('Proxy iTunes (lookup) :', err);
    return NextResponse.json(
      { error: 'Service momentanément indisponible' },
      { status: 502 }
    );
  }
}
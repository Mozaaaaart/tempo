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
    // fresh=1 → contourne le cache (indispensable pour les previewUrl, dont le jeton expire)
    const fresh = searchParams.get('fresh') === '1';
    const res = await fetch(`https://api.deezer.com/track/${id}`,
      fresh ? { cache: 'no-store' } : { next: { revalidate: 1800 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Service momentanément indisponible' }, { status: 502 });
    }

    const data = await res.json();

    /* CONTRADICTION à ne pas réintroduire : la réponse annonçait un jour de
       cache, y compris quand l'appelant avait demandé fresh=1. Contourner le
       cache côté serveur pour aussitôt en installer un en aval revient à
       n'avoir rien contourné : l'appel suivant recevait la même URL
       d'extrait, avec son jeton d'autant plus vieux, et l'élément audio
       échouait en NotSupportedError sur ce qui n'était plus un MP3.

       Une réponse demandée fraîche ne se met donc pas en cache. Les autres
       gardent le leur : le BPM et la date de sortie d'un morceau ne changent
       pas. */
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': fresh
          ? 'no-store'
          : 's-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error('Proxy Deezer (track) :', err);
    return NextResponse.json(
      { error: 'Service momentanément indisponible' },
      { status: 502 }
    );
  }
}
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
    /* `max-age` en plus de `s-maxage` : sans lui, seul le cache partagé de
       Vercel retenait la réponse, et le NAVIGATEUR repartait en aller-retour à
       chaque fois. Or l'épreuve Refrain émet sept à treize requêtes de paroles
       par montage, et le défi du jour la remonte à chaque arrivée : revenir
       dessus refaisait une douzaine d'allers-retours pour des réponses déjà
       connues.

       Une heure côté navigateur, une journée côté bord : des paroles ne
       changent pas, mais on garde la main pour corriger un mauvais extrait
       dans la journée sans attendre l'expiration chez chaque visiteur. */
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Lyrics.ovh', details: err.message },
      { status: 500 }
    );
  }
}
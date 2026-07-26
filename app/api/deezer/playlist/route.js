import { NextResponse } from 'next/server';

/**
 * Route — morceaux d'une playlist Deezer (sert de base de données de morceaux IA)
 * GET /api/deezer/playlist?id=1234567890
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Paramètre "id" manquant ou invalide' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.deezer.com/playlist/${id}`, {
      next: { revalidate: 1800 } // 30 min : tu peux enrichir la playlist sans redéployer
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Deezer API a répondu ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: 'Playlist introuvable ou privée', details: data.error }, { status: 404 });
    }

    // On ne renvoie que l'essentiel
    const tracks = (data.tracks?.data ?? []).map((t) => ({ id: t.id, title: t.title }));
    return NextResponse.json({ count: tracks.length, tracks });
  } catch (err) {
    return NextResponse.json(
      { error: 'Échec de la requête vers Deezer', details: err.message },
      { status: 500 }
    );
  }
}
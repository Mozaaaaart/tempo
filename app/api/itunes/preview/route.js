/**
 * Route proxy audio — fait transiter les previews iTunes par notre serveur
 * pour contourner le CORS lors du décodage Web Audio (pitch-shift Tone.js).
 * GET /api/itunes/preview?url=https://audio-ssl.itunes.apple.com/...
 */

const ALLOWED_HOSTS = ['audio-ssl.itunes.apple.com'];
const ALLOWED_SUFFIXES = ['.mzstatic.com', '.apple.com', '.dzcdn.net', '.deezer.com'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'Paramètre "url" manquant' }, { status: 400 });
  }

  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return Response.json({ error: 'URL invalide' }, { status: 400 });
  }
  const allowed =
    ALLOWED_HOSTS.includes(host) ||
    ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
  if (!allowed) {
    return Response.json({ error: 'Hôte non autorisé' }, { status: 403 });
  }

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return Response.json({ error: `Serveur audio a répondu ${res.status}` }, { status: 502 });
    }

    // Téléchargement complet avant renvoi (plus fiable que le streaming)
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mp4',
        'Cache-Control': 'public, s-maxage=86400, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return Response.json(
      { error: 'Échec du téléchargement audio', details: err.message },
      { status: 500 }
    );
  }
}
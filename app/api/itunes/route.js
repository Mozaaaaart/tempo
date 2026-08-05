import { NextResponse } from 'next/server';

/**
 * Route proxy — API iTunes Search
 * GET /api/itunes?term=daft+punk&limit=10&country=FR&entity=song
 *
 * Rôles :
 *  - contourner CORS (le navigateur ne peut pas appeler itunes.apple.com directement)
 *  - respecter la limite ~20 req/min via le cache serveur Next.js (revalidate)
 *  - centraliser la validation des paramètres pour tous les jeux
 */

const ALLOWED_ENTITIES = ['song', 'album', 'musicArtist'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const term = searchParams.get('term');
  const entityRaw = searchParams.get('entity') ?? 'song';

  // Validation : term obligatoire
  if (!term || !term.trim()) {
    return NextResponse.json(
      { error: 'Paramètre "term" manquant' },
      { status: 400 }
    );
  }

  // Validation : entity dans la liste blanche
  const entity = ALLOWED_ENTITIES.includes(entityRaw) ? entityRaw : 'song';

  /* Validation : country sur deux lettres exactement.
     Le paramètre était auparavant transmis tel quel. URLSearchParams l'encode,
     donc le risque était faible — mais une entrée non bornée n'a pas sa place
     à côté de `term`, `entity` et `limit` qui le sont tous. Toute valeur
     inattendue retombe sur FR. */
  const paysBrut = (searchParams.get('country') ?? 'FR').toUpperCase();
  const country = /^[A-Z]{2}$/.test(paysBrut) ? paysBrut : 'FR';

  // Validation : limit borné entre 1 et 50 (l'API accepte jusqu'à 200,
  // mais inutile pour les jeux et ça alourdit les réponses)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

  // Construction de l'URL iTunes (URL-encoding géré par URLSearchParams)
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term.trim());
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', entity);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('country', country);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 } // cache Next.js : 1 heure
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
        // cache CDN Vercel en plus du cache fetch (défense en profondeur
        // contre la limite de 20 req/min)
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (err) {
    console.error('Proxy iTunes (search) :', err);
    return NextResponse.json(
      { error: 'Service momentanément indisponible' },
      { status: 502 }
    );
  }
}
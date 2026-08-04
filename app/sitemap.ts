import type { MetadataRoute } from 'next';
import { EPREUVES } from '@/data/epreuves';
import { SITE_URL } from '@/data/site';

/**
 * Plan du site.
 *
 * Il n'y en avait aucun. Sans lui, Google découvre les dix épreuves par les
 * liens du carrousel — qui sont montés côté client, donc invisibles à toute
 * exploration qui n'exécute pas le JavaScript. Un plan de site règle la
 * question une fois pour toutes : les douze URL sont déclarées, quel que soit
 * ce que le crawler arrive à rendre.
 *
 * `priority` n'est qu'un indice relatif entre nos propres pages. Le défi du
 * jour change tous les jours, d'où sa fréquence ; les épreuves sont stables.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const maj = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: maj, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/jeux`, lastModified: maj, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/quotidien`, lastModified: maj, changeFrequency: 'daily', priority: 0.9 },
    ...EPREUVES.map((e) => ({
      url: `${SITE_URL}/jeux/${e.slug}`,
      lastModified: maj,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
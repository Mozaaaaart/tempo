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
    /* /jeux n'est plus declaree : elle redirige en 308 vers le premier jeu.
       Un plan du site ne doit contenir que des URL canoniques — une entree
       qui redirige fait perdre une exploration a chaque passage et brouille
       le signal, puisqu'elle annonce une page qui n'existe pas. */
    { url: `${SITE_URL}/quotidien`, lastModified: maj, changeFrequency: 'daily', priority: 0.9 },
    ...EPREUVES.map((e) => ({
      url: `${SITE_URL}/jeux/${e.slug}`,
      lastModified: maj,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    /* Les pages légales : déclarées pour être atteignables — les régies et
       certains moteurs vérifient leur EXISTENCE — mais en priorité basse,
       pour qu'elles ne disputent pas le budget d'exploration aux dix jeux.
       /soutenir les rejoint depuis que son lien Ko-fi est actif : même
       priorité, ce n'est pas une page qu'on cherche par un moteur. */
    ...['/mentions-legales', '/confidentialite', '/contact', '/soutenir'].map((p) => ({
      url: `${SITE_URL}${p}`,
      lastModified: maj,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ];
}
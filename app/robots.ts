import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/data/site';

/**
 * robots.txt.
 *
 * Il manquait aussi. Son intérêt ici n'est pas d'interdire — tout le site est
 * public — mais de DÉCLARER LE PLAN : c'est la ligne `Sitemap:` que la plupart
 * des moteurs lisent en premier, avant même qu'on ait soumis quoi que ce soit
 * dans la Search Console.
 *
 * Les routes d'API sont écartées : elles renvoient du JSON de proxy Deezer,
 * qui n'a rien à faire dans un index et qui gaspillerait le budget
 * d'exploration.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
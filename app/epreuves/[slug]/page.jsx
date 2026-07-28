import { notFound } from 'next/navigation';
import { EPREUVES, epreuveDuSlug } from '@/data/epreuves';
import JeuSlot from '@/components/JeuSlot';

/**
 * Une URL par épreuve. Composant serveur : c'est lui qui porte le <title>, la
 * meta description et le canonique — donc l'indexation et le contexte que
 * lisent les régies publicitaires.
 *
 * generateStaticParams prérend les dix routes au build : chacune est un
 * document HTML complet servi par le CDN, pas une page vide remplie ensuite
 * en JavaScript. C'est la condition pour que les crawlers voient autre chose
 * qu'un écran de chargement.
 */

export function generateStaticParams() {
  return EPREUVES.map((e) => ({ slug: e.slug }));
}

// Slug inconnu → 404 franc, plutôt qu'une page rendue à la volée.
export const dynamicParams = false;

export async function generateMetadata({ params }) {
  // Next 16 : params est une Promise, il faut l'attendre.
  const { slug } = await params;
  const e = epreuveDuSlug(slug);
  if (!e) return {};

  const titre = `${e.nom} — Épreuve ${e.num} · Mozart Benchmark`;
  const url = `/epreuves/${e.slug}`;

  return {
    title: titre,
    description: e.desc,
    alternates: { canonical: url },
    openGraph: {
      title: titre,
      description: e.desc,
      url,
      type: 'website',
      siteName: 'Mozart Benchmark',
    },
    twitter: {
      card: 'summary_large_image',
      title: titre,
      description: e.desc,
    },
  };
}

export default async function PageEpreuveSlug({ params }) {
  const { slug } = await params;
  const e = epreuveDuSlug(slug);
  if (!e) notFound();

  // Le décor (en-tête, onde, carrousel, bandeau) est fourni par le layout.
  return <JeuSlot slug={slug} />;
}
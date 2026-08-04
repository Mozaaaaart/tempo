import { notFound } from 'next/navigation';
import { EPREUVES, epreuveDuSlug } from '@/data/epreuves';
import { SITE_URL, SITE_NOM } from '@/data/site';
import JeuSlot from '@/components/JeuSlot';
import BlocPresentation from '@/components/BlocPresentation';
import { presentationDuSlug } from '@/data/presentations';

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

  /* Le titre ne dit plus « Accords — Épreuve 01 ».
     Personne ne tape « épreuve 01 » dans un moteur, et le numéro consommait
     un tiers d'une balise qui en compte soixante. Il dit maintenant ce que le
     visiteur cherche : « Reconnaître un accord à l'oreille ». La marque est
     ajoutée par le gabarit du layout racine, pas à la main. */
  const url = `/jeux/${e.slug}`;

  return {
    title: e.titreSeo,
    description: e.metaDesc,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: SITE_NOM,
      url,
      title: `${e.titreSeo} | ${SITE_NOM}`,
      description: e.metaDesc,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${e.titreSeo} | ${SITE_NOM}`,
      description: e.metaDesc,
    },
  };
}

export default async function PageEpreuveSlug({ params }) {
  const { slug } = await params;
  const e = epreuveDuSlug(slug);
  if (!e) notFound();

  /* ---- Données structurées de l'épreuve ----
     Game plutôt que WebPage : c'en est un, jouable dans le navigateur et
     gratuit. `offers` à zéro euro n'est pas une coquetterie — c'est ce qui
     autorise Google à afficher la mention « gratuit », et « gratuit » est
     dans presque toutes les requêtes de ce domaine.

     BreadcrumbList donne le fil d'Ariane sous le résultat : Accueil ›
     Épreuves › Accords, au lieu d'une URL nue. */
  /* Le bloc de présentation, s'il existe, alimente aussi un balisage FAQPage.
     C'est le seul type de données structurées qui puisse décrocher un résultat
     enrichi sur ce genre de page — mais uniquement si les questions sont
     réellement affichées, ce que Google vérifie. D'où la lecture de la MÊME
     source que le rendu : les deux ne peuvent pas diverger. */
  const presentation = presentationDuSlug(slug);

  const donnees = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Game',
        '@id': `${SITE_URL}/jeux/${e.slug}#jeu`,
        name: e.titreSeo,
        alternateName: e.nom,
        description: e.metaDesc,
        url: `${SITE_URL}/jeux/${e.slug}`,
        inLanguage: 'fr-FR',
        genre: ['Musique', 'Éducatif', 'Puzzle'],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isPartOf: { '@id': `${SITE_URL}/#site` },
      },
      ...(presentation?.questions?.length
        ? [{
          '@type': 'FAQPage',
          '@id': `${SITE_URL}/jeux/${e.slug}#faq`,
          mainEntity: presentation.questions.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.r },
          })),
        }]
        : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Jeux', item: `${SITE_URL}/jeux` },
          { '@type': 'ListItem', position: 3, name: e.nom },
        ],
      },
    ],
  };

  // Le décor (en-tête, onde, carrousel, bandeau) est fourni par le layout.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
      />
      <JeuSlot slug={slug} />
      <BlocPresentation slug={slug} />
    </>
  );
}
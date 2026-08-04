import PageQuotidien from '@/components/PageQuotidien';
import { SITE_NOM } from '@/data/site';

/**
 * Enveloppe SERVEUR du défi du jour. Même raison que /epreuves : le corps est
 * client, et un composant client ne peut pas porter de métadonnées.
 *
 * Cette page-ci a en plus un enjeu propre : « défi du jour » est une requête
 * récurrente, et c'est l'URL sur laquelle un joueur revient chaque matin. Elle
 * mérite mieux que le titre générique du site.
 */
export const metadata = {
  title: 'Le défi du jour',
  description:
    'Dix épreuves musicales, les mêmes pour tout le monde, renouvelées chaque jour. '
    + 'Un seul essai par épreuve, un score sur dix à partager. Gratuit, sans inscription.',
  alternates: { canonical: '/quotidien' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NOM,
    url: '/quotidien',
    title: `Le défi du jour | ${SITE_NOM}`,
    description:
      'Dix épreuves musicales, les mêmes pour tous, renouvelées chaque jour. '
      + 'Un score sur dix à partager.',
  },
};

export default function Page() {
  return <PageQuotidien />;
}
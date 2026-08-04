import PageQuotidien from '@/components/PageQuotidien';
import { SITE_NOM } from '@/data/site';

/**
 * Enveloppe SERVEUR du défi du jour. Le corps est un composant client, et un
 * composant client ne peut pas exporter de métadonnées : Next les ignore en
 * silence. Cette route ne porte donc que l'en-tête du document.
 *
 * ------------------------------------------------------------------ le titre
 *
 * « Le défi du jour » ne dit pas de QUOI. Un défi du jour, il y en a pour les
 * mots croisés, la géographie, le code : la requête seule ne mène nulle part.
 * « Défi musical du jour » est à la fois plus vrai et plus disputable — c'est
 * la seule formulation qui puisse capter quelqu'un qui cherche ce genre de jeu
 * sans connaître le site.
 *
 * La description, elle, cite les jeux plutôt que de les résumer : « blind
 * test », « accords », « tempo », « pochettes » sont les mots que les gens
 * tapent, et ils ont l'avantage d'être vrais.
 */
export const metadata = {
  title: 'Le défi musical du jour',
  description:
    'Dix jeux d\u2019oreille renouvelés chaque jour, identiques pour tous : '
    + 'blind test, accords, tempo, pochettes. Un score sur 100 à partager.',
  alternates: { canonical: '/quotidien' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NOM,
    url: '/quotidien',
    title: `Le défi musical du jour | ${SITE_NOM}`,
    description:
      'Dix jeux musicaux renouvelés chaque jour, les mêmes pour tous. '
      + 'Un score sur 100 à partager. Gratuit, sans inscription.',
  },
};

export default function Page() {
  return <PageQuotidien />;
}
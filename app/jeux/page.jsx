import CatalogueEpreuves from '@/components/CatalogueEpreuves';
import { SITE_NOM } from '@/data/site';

/**
 * Enveloppe SERVEUR du catalogue.
 *
 * La page était marquée 'use client' de bout en bout, et un composant client
 * ne peut pas exporter `metadata` : Next l'ignore silencieusement. Résultat,
 * /epreuves héritait du titre générique du layout racine — la deuxième page
 * la plus importante du site n'avait ni titre propre, ni description, ni
 * canonique.
 *
 * Le corps est descendu dans components/, la route ne garde que l'en-tête du
 * document. Aucune ligne de rendu n'a bougé.
 */
export const metadata = {
  title: 'Les dix jeux d\u2019oreille musicale',
  description:
    'Accords, rythme, tempo, pochettes floutées, blind test, musique générée par IA : '
    + 'dix jeux pour tester ton oreille, gratuits et sans inscription.',
  alternates: { canonical: '/jeux' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NOM,
    url: '/jeux',
    title: `Les dix jeux d\u2019oreille musicale | ${SITE_NOM}`,
    description:
      'Dix jeux pour tester ton oreille : accords, rythme, tempo, blind test, musique IA. '
      + 'Gratuits, sans inscription.',
  },
};

export default function Page() {
  return <CatalogueEpreuves />;
}
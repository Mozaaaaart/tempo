import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { EPREUVES } from '@/data/epreuves';
import { SITE_URL, SITE_NOM, SITE_ACCROCHE } from '@/data/site';

const geistSans = Geist({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
});

/**
 * Métadonnées racines.
 *
 * `metadataBase` MANQUAIT, et c'est la pièce dont dépendent toutes les autres :
 * sans elle, le canonique déclaré par les pages d'épreuve reste relatif, les
 * images Open Graph n'ont pas d'URL absolue, et Google traite l'ensemble comme
 * absent. Une seule ligne débloque le reste.
 *
 * `title.template` évite de répéter la marque à la main sur chaque page, et
 * `title.default` sert d'accueil : c'est la seule page où la marque passe en
 * tête, parce que c'est la seule qu'on cherche par son nom.
 */
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NOM} — jeux d'oreille musicale gratuits`,
    template: `%s | ${SITE_NOM}`,
  },
  description: SITE_ACCROCHE,
  applicationName: SITE_NOM,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NOM,
    url: '/',
    title: `${SITE_NOM} — jeux d'oreille musicale gratuits`,
    description: SITE_ACCROCHE,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NOM} — jeux d'oreille musicale gratuits`,
    description: SITE_ACCROCHE,
  },
  /* Vérification de propriété Google Search Console.
     Next pose lui-même la balise <meta name="google-site-verification">
     dans le <head> ; il n'y a rien à écrire à la main dans le HTML.

     Ce jeton n'est pas un secret : il est destiné à être public dans la page,
     c'est même sa raison d'être. En revanche il ne doit JAMAIS être retiré —
     Google revérifie la propriété périodiquement, et une balise disparue fait
     perdre l'accès aux rapports. */
  verification: {
    google: 'zYjQ-x1n-5CnXNioETiDD-R2gNM99lh0FSQO4l36I6g',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  category: 'music',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /* ---- Données structurées ----
     Deux blocs, et un seul rôle : donner à Google de quoi comprendre le site
     sans avoir à interpréter du JavaScript.

     WebSite porte le nom et la langue. ItemList énumère les dix épreuves avec
     leur URL : c'est ce qui permet aux liens de section d'apparaître sous le
     résultat principal, et ce qui fait découvrir les dix pages même si un
     crawler n'exécute pas le carrousel, qui est monté côté client.

     Posé dans le layout racine et non dans une page cliente : un script
     injecté après hydratation n'est pas garanti d'être lu. */
  const donnees = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#site`,
        url: SITE_URL,
        name: SITE_NOM,
        description: SITE_ACCROCHE,
        inLanguage: 'fr-FR',
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}/#epreuves`,
        name: 'Les dix épreuves',
        numberOfItems: EPREUVES.length,
        itemListElement: EPREUVES.map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: e.titreSeo,
          url: `${SITE_URL}/epreuves/${e.slug}`,
        })),
      },
    ],
  };

  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
        />
        {children}
      </body>
    </html>
  );
}
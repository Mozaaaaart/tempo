import PageTexte from '@/components/PageTexte';

/**
 * CONTACT
 *
 * Une adresse, PAS de formulaire. La page ne s'en justifie plus : les
 * sections « Pourquoi pas de formulaire » et « Ce que deviennent tes
 * messages » ont été retirées à la demande de l'éditeur — la page va
 * droit au but. Le raisonnement, lui, reste vrai et documenté là où il
 * doit l'être : le traitement des e-mails (réponse puis suppression) est
 * décrit à la section (d) de la politique de confidentialité, qui fait
 * foi. Ne PAS ajouter de formulaire sans relire cette section : il ferait
 * du site un responsable de traitement avec conservation à assumer.
 *
 * Tutoiement : page conversationnelle, comme le reste des jeux — on n'écrit
 * pas à un service juridique, on écrit à la personne qui fait le site.
 */

export const metadata = {
  title: 'Contact',
  description:
    'Une question, un bug, un signalement : écris directement à '
    + 'Mozart Benchmark.',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
};

export default function Contact() {
  /* Pas de prop maj sur le gabarit : une page de coordonnées ne date rien —
     la date d'engagement vit sur les pages dont le contenu fait foi. */
  return (
    <PageTexte etiquette="nous écrire" titre="Contact">
      <p>
        Une question, un bug, une idée de jeu, un désaccord sur une réponse
        du défi&nbsp;: tout passe par la même adresse.
      </p>
      <div className="texte-encadre">
        <a href="mailto:contact@mozartbenchmark.com">
          contact@mozartbenchmark.com
        </a>
      </div>

      <h2>Pour un bug, quelques détails aident</h2>
      <ul>
        <li>le jeu concerné (Accords, Rythme, Blind test&hellip;)&nbsp;;</li>
        <li>
          le mode&nbsp;: entraînement libre ou défi du jour (et sa
          date)&nbsp;;
        </li>
        <li>ton navigateur, et si tu es sur téléphone ou ordinateur.</li>
      </ul>

      <h2>Ayants droit</h2>
      <p>
        Tu représentes un artiste, un label ou un éditeur et un contenu te
        pose problème&nbsp;? Écris à la même adresse en précisant
        l&rsquo;emplacement du contenu et le motif&nbsp;: après vérification,
        il est retiré sans délai. Le détail de la démarche est dans les{' '}
        <a href="/mentions-legales">mentions légales</a>.
      </p>
    </PageTexte>
  );
}
import PageTexte from '@/components/PageTexte';

/**
 * MENTIONS LÉGALES
 *
 * Le référentiel est le droit NÉERLANDAIS — lieu d'établissement de
 * l'éditeur — et non la LCEN française, même si le site est en français. La
 * langue d'un site ne détermine pas son droit ; l'établissement de son
 * éditeur, si.
 *
 * L'obligation d'identification néerlandaise (art. 3:15d du Burgerlijk
 * Wetboek, transposition de la directive e-commerce) ne vise que les
 * « services de la société de l'information », définis par une activité
 * ÉCONOMIQUE. Ce site n'a ni publicité, ni vente, ni abonnement, ni
 * affiliation : il tombe très probablement hors champ, et l'anonymat de
 * l'éditeur est licite. La page le formule PRUDEMMENT (« proposé sans but
 * lucratif ») plutôt qu'en affirmation juridique péremptoire : une mention
 * légale n'est pas une plaidoirie.
 *
 * Chaque affirmation factuelle de cette page correspond à un constat de
 * l'audit du code (aucun hébergement de fichiers musicaux, proxy des
 * recherches, etc.) : une mention qui décrit un traitement inexistant est
 * aussi fautive qu'une mention manquante.
 *
 * Vouvoiement, délibérément : c'est la page formelle du site — celle qu'on
 * lit en cas de désaccord, pas celle où l'on joue.
 */

export const metadata = {
  title: 'Mentions légales',
  description:
    'Éditeur, hébergeur, propriété intellectuelle et droit applicable '
    + 'du site Mozart Benchmark.',
  alternates: { canonical: '/mentions-legales' },
  /* index,follow explicite : les régies et certains moteurs vérifient
     l'EXISTENCE de ces pages — les désindexer reviendrait à les cacher. */
  robots: { index: true, follow: true },
};

export default function MentionsLegales() {
  return (
    <PageTexte
      etiquette="informations légales"
      titre="Mentions légales"
      maj="5 août 2026"
    >
      <h2>Éditeur</h2>
      <p>
        Mozart Benchmark est édité à titre personnel et non professionnel par
        une personne physique établie aux <strong>Pays-Bas</strong>. Le site
        est proposé sans but lucratif : il ne diffuse aucune publicité, ne
        vend rien et ne propose aucun abonnement. En l&rsquo;absence
        d&rsquo;activité économique, il ne constitue pas un service de la
        société de l&rsquo;information au sens de l&rsquo;article 3:15d du
        Code civil néerlandais (Burgerlijk Wetboek), et l&rsquo;éditeur exerce
        son droit de ne pas divulguer publiquement son identité.
      </p>

      <h2>Contact</h2>
      <p>
        L&rsquo;éditeur reste joignable de manière rapide et effective à
        l&rsquo;adresse suivante :
      </p>
      <div className="texte-encadre">
        <a href="mailto:contact@mozartbenchmark.com">
          contact@mozartbenchmark.com
        </a>
      </div>

      <h2>Hébergeur</h2>
      <div className="texte-encadre">
        Vercel,&nbsp;Inc.
        <br />
        340 S Lemon Ave #4133
        <br />
        Walnut, CA 91789, États-Unis
        <br />
        <a href="https://vercel.com" rel="noopener noreferrer">vercel.com</a>
      </div>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le code, les textes, l&rsquo;interface et l&rsquo;identité visuelle du
        site sont l&rsquo;œuvre de son éditeur.
      </p>
      <ul>
        <li>
          Les <strong>extraits musicaux</strong> (previews officielles de
          30&nbsp;secondes) et les <strong>pochettes d&rsquo;albums</strong>{' '}
          restent la propriété de leurs ayants droit. Ils ne sont jamais
          hébergés par le site : ils sont appelés au moment de la lecture
          depuis les interfaces publiques de Deezer.
        </li>
        <li>
          Les <strong>paroles</strong> ne sont affichées que sous forme de
          courts extraits, dans les limites du droit de citation.
        </li>
        <li>
          Les <strong>sons de synthèse</strong> (accords, rythmes, ambiance)
          sont générés par le site lui-même, dans votre navigateur.
        </li>
        <li>
          Les <strong>échantillons d&rsquo;instruments</strong> proviennent de
          banques de sons librement réutilisables.
        </li>
      </ul>

      <h2>Signalement d&rsquo;un contenu</h2>
      <p>
        Tout ayant droit, ou tout tiers, peut signaler un contenu qu&rsquo;il
        estime problématique à l&rsquo;adresse de contact ci-dessus, en
        précisant l&rsquo;emplacement du contenu et le motif du signalement.
        Après vérification, le contenu concerné est retiré sans délai.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Le site est fourni gratuitement, en l&rsquo;état, sans garantie de
        disponibilité ni d&rsquo;exactitude. Son fonctionnement dépend de
        services tiers (fourniture des extraits musicaux, hébergement) sur
        lesquels l&rsquo;éditeur n&rsquo;a pas de contrôle. Les scores obtenus
        dans les jeux sont un divertissement : ils n&rsquo;ont aucune valeur
        de test officiel ni d&rsquo;évaluation certifiée des capacités
        musicales.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le site et les présentes mentions sont régis par le droit néerlandais.
        Les consommateurs résidant dans l&rsquo;Union européenne conservent la
        protection des dispositions impératives du droit de leur pays de
        résidence habituelle.
      </p>
    </PageTexte>
  );
}

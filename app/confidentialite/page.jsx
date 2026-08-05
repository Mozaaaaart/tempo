import PageTexte from '@/components/PageTexte';

/**
 * POLITIQUE DE CONFIDENTIALITÉ
 *
 * Écrite DEPUIS LE CODE, pas depuis un modèle. Chaque section correspond à un
 * constat vérifiable dans le dépôt :
 *
 *   - aucun cookie : zéro occurrence de document.cookie ou Set-Cookie ;
 *   - aucun analytics, aucun script tiers, aucun formulaire, aucun compte ;
 *   - cinq clés localStorage strictement nécessaires au service
 *     (mb:ambiance:volume, mb:ambiance:actif, mb-quotidien,
 *     mb-quotidien-veille, mb-direction) → exemptées de consentement au
 *     titre de l'article 5(3) de la directive ePrivacy ;
 *   - recherches musicales proxifiées par les routes /api/* : Deezer, iTunes
 *     et Lyrics.ovh ne voient jamais l'adresse IP du visiteur ;
 *   - EN REVANCHE le navigateur charge directement les extraits et pochettes
 *     depuis les CDN de Deezer, et les échantillons d'instruments depuis
 *     GitHub Pages — c'est LE transfert de données du site, énoncé tel quel ;
 *   - polices auto-hébergées au build par next/font : aucun appel à Google
 *     au chargement des pages.
 *
 * Si le code change (pub, analytics, comptes), cette page doit changer
 * AVANT : une politique qui décrit un traitement inexistant — ou qui en
 * tait un réel — est fautive dans les deux sens.
 *
 * Vouvoiement : page formelle, comme les mentions légales.
 */

export const metadata = {
  title: 'Confidentialité',
  description:
    'Ce que Mozart Benchmark sait de vous — presque rien — et ce que votre '
    + 'navigateur charge, expliqué depuis le code du site.',
  alternates: { canonical: '/confidentialite' },
  robots: { index: true, follow: true },
};

export default function Confidentialite() {
  return (
    <PageTexte
      etiquette="vie privée"
      titre="Politique de confidentialité"
      maj="5 août 2026"
    >
      <h2>L&rsquo;essentiel</h2>
      <p>
        Mozart Benchmark n&rsquo;a <strong>pas de comptes</strong>,{' '}
        <strong>pas de formulaires</strong>, <strong>pas de cookies</strong>,{' '}
        <strong>pas de mesure d&rsquo;audience</strong> et{' '}
        <strong>pas de publicité</strong>. Le site ne collecte aucune donnée
        personnelle et n&rsquo;en transmet aucune à des fins commerciales.
        Vos scores et vos réglages restent dans votre navigateur.
      </p>
      <p>
        Ce qui subsiste malgré tout — parce qu&rsquo;aucun site ne fonctionne
        dans le vide — est décrit ci-dessous, sans minimisation.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        L&rsquo;éditeur du site, tel que décrit dans les{' '}
        <a href="/mentions-legales">mentions légales</a>. Son anonymat public
        ne vous prive pas d&rsquo;un point de contact : pour toute question
        relative à vos données, écrivez à{' '}
        <a href="mailto:contact@mozartbenchmark.com">
          contact@mozartbenchmark.com
        </a>
        .
      </p>

      <h2>Ce que le site traite, en détail</h2>

      <p>
        <strong>a) Journaux techniques de l&rsquo;hébergeur.</strong> Le site
        est hébergé par Vercel (États-Unis). Comme tout hébergeur, Vercel
        tient des journaux techniques de connexion (adresse IP, horodatage,
        page demandée) nécessaires à la sécurité et au fonctionnement de son
        infrastructure. Base légale&nbsp;: intérêt légitime. Ces transferts
        vers les États-Unis sont encadrés par les garanties contractuelles de
        Vercel (clauses contractuelles types de la Commission européenne)
        décrites dans sa{' '}
        <a
          href="https://vercel.com/legal/privacy-policy"
          rel="noopener noreferrer"
        >
          politique de confidentialité
        </a>
        . L&rsquo;éditeur du site n&rsquo;accède pas à ces journaux à des fins
        d&rsquo;identification des visiteurs.
      </p>

      <p>
        <strong>b) Chargement direct des médias.</strong> Les recherches
        musicales passent par le serveur du site&nbsp;: Deezer, iTunes et
        Lyrics.ovh ne voient jamais votre adresse IP lors d&rsquo;une
        recherche. En revanche, pour que la musique joue, votre navigateur
        charge <strong>directement</strong> les extraits audio et les
        pochettes depuis les serveurs de diffusion de Deezer, et les
        échantillons d&rsquo;instruments depuis GitHub Pages. Ces fournisseurs
        reçoivent alors, comme pour tout chargement web, votre adresse IP et
        la signature technique de votre navigateur. C&rsquo;est le seul
        transfert de données du site. Base légale&nbsp;: intérêt légitime —
        fournir le contenu même que vous êtes venu écouter. Ces serveurs
        pouvant être situés hors de l&rsquo;Union européenne, ce chargement
        peut constituer un transfert international&nbsp;; il est régi par les
        politiques de confidentialité de{' '}
        <a
          href="https://www.deezer.com/legal/personal-datas"
          rel="noopener noreferrer"
        >
          Deezer
        </a>{' '}
        et de{' '}
        <a
          href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </p>

      <p>
        <strong>c) Stockage local de votre navigateur.</strong> Le site écrit
        cinq clés dans le <strong>localStorage</strong> de votre
        navigateur&nbsp;: le volume du son d&rsquo;ambiance et son état
        activé/coupé, votre progression du défi du jour, l&rsquo;archive du
        défi de la veille, et le sens de la dernière animation de transition.
        Ces données ne quittent jamais votre appareil, ne sont transmises à
        personne et sont strictement nécessaires au service que vous demandez
        — c&rsquo;est pourquoi elles ne requièrent pas de consentement
        (article&nbsp;5(3) de la directive ePrivacy). Vous pouvez les effacer
        à tout moment en supprimant les données de site de votre navigateur
        (généralement&nbsp;: réglages du navigateur, confidentialité, données
        de sites, puis mozartbenchmark.com).
      </p>

      <p>
        <strong>d) E-mails reçus.</strong> Si vous écrivez à l&rsquo;adresse
        de contact, votre message et votre adresse e-mail sont utilisés pour
        vous répondre, et pour rien d&rsquo;autre. Ils sont supprimés quand
        l&rsquo;échange n&rsquo;a plus d&rsquo;objet.
      </p>

      <h2>Pourquoi il n&rsquo;y a pas de bandeau cookies</h2>
      <p>
        Ce n&rsquo;est pas un oubli. Un bandeau sert à recueillir un
        consentement&nbsp;; or il n&rsquo;y a ici rien à consentir&nbsp;:
        aucun cookie, aucun traceur, et un stockage local exempté parce que
        strictement nécessaire. Afficher un bandeau sans traceur dégraderait
        votre visite pour rien — et serait trompeur, en laissant croire à des
        traitements qui n&rsquo;existent pas.
      </p>

      <h2>Vos droits</h2>
      <p>
        Le RGPD vous donne des droits d&rsquo;accès, de rectification,
        d&rsquo;effacement, de limitation, d&rsquo;opposition et de
        portabilité. L&rsquo;honnêteté du contexte&nbsp;: le site ne détient
        aucun fichier de visiteurs sur lequel les exercer. Vos scores et
        réglages étant stockés dans votre navigateur, l&rsquo;essentiel de ces
        droits s&rsquo;exerce directement — en vidant le stockage local, comme
        décrit ci-dessus. Pour les e-mails que vous auriez envoyés, une simple
        demande à l&rsquo;adresse de contact suffit.
      </p>

      <h2>Autorité de contrôle</h2>
      <p>
        L&rsquo;autorité de l&rsquo;établissement de l&rsquo;éditeur est
        l&rsquo;<strong>Autoriteit Persoonsgegevens</strong> néerlandaise (
        <a
          href="https://autoriteitpersoonsgegevens.nl"
          rel="noopener noreferrer"
        >
          autoriteitpersoonsgegevens.nl
        </a>
        ). Vous pouvez aussi saisir l&rsquo;autorité de votre propre pays de
        résidence — pour les visiteurs français, la CNIL (
        <a href="https://www.cnil.fr" rel="noopener noreferrer">cnil.fr</a>).
      </p>

      <h2>Mineurs</h2>
      <p>
        Le site ne collecte aucune donnée, ne crée aucun compte et ne propose
        aucune interaction sociale. Aucun traitement n&rsquo;étant fondé sur
        le consentement, la question de l&rsquo;âge du consentement numérique
        ne se pose pas.
      </p>

      <h2>Évolution de cette politique</h2>
      <p>
        Si le site devait un jour changer de nature — publicité, mesure
        d&rsquo;audience, comptes —, cette page serait mise à jour{' '}
        <strong>avant</strong> le changement, et tout traceur soumis à
        consentement ne serait déposé qu&rsquo;après recueil de celui-ci. La
        date en tête de page fait foi de la version en vigueur.
      </p>
    </PageTexte>
  );
}
